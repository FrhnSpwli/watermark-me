import type {
  WatermarkPurpose,
  WatermarkTextStyle,
} from '../../types/watermark'
import {
  generateDefaultWatermarkText,
  getPurposeOption,
  MAX_RECIPIENT_LENGTH,
  MAX_WATERMARK_TEXT_LENGTH,
  normalizeWatermarkRecipient,
} from './watermarkConfig'

export type WatermarkTextSource = 'generated' | 'manual'

export interface WatermarkPurposeState {
  purpose: WatermarkPurpose
  recipient: string
  text: string
  textStyle: WatermarkTextStyle
  textSource: WatermarkTextSource
  sessionDate: Date
}

export interface WatermarkDownloadReadiness {
  isReady: boolean
  normalizedRecipient: string
  normalizedText: string
  recipientError: string | null
  textError: string | null
  message: string
}

function getTextStyle(purpose: WatermarkPurpose): WatermarkTextStyle {
  return purpose === 'other' ? 'custom' : 'purpose'
}

export function createWatermarkPurposeState(
  sessionDate: Date,
  purpose: WatermarkPurpose = 'job-application',
): WatermarkPurposeState {
  return {
    purpose,
    recipient: '',
    text: generateDefaultWatermarkText(purpose, '', sessionDate),
    textStyle: getTextStyle(purpose),
    textSource: 'generated',
    sessionDate,
  }
}

export function changeWatermarkPurpose(
  state: WatermarkPurposeState,
  purpose: WatermarkPurpose,
): WatermarkPurposeState {
  const generatedText = generateDefaultWatermarkText(
    purpose,
    state.recipient,
    state.sessionDate,
  )
  const text = state.textSource === 'generated' ? generatedText : state.text

  return {
    ...state,
    purpose,
    text,
    textStyle: getTextStyle(purpose),
    textSource: text === generatedText ? 'generated' : state.textSource,
  }
}

export function changeWatermarkRecipient(
  state: WatermarkPurposeState,
  recipient: string,
): WatermarkPurposeState {
  const generatedText = generateDefaultWatermarkText(
    state.purpose,
    recipient,
    state.sessionDate,
  )
  const text =
    state.textSource === 'generated' && state.purpose !== 'other'
      ? generatedText
      : state.text

  return {
    ...state,
    recipient,
    text,
    textSource: text === generatedText ? 'generated' : state.textSource,
  }
}

export function normalizePurposeRecipient(state: WatermarkPurposeState) {
  return changeWatermarkRecipient(
    state,
    normalizeWatermarkRecipient(state.recipient),
  )
}

export function changeWatermarkText(
  state: WatermarkPurposeState,
  text: string,
): WatermarkPurposeState {
  const generatedText = generateDefaultWatermarkText(
    state.purpose,
    state.recipient,
    state.sessionDate,
  )

  return {
    ...state,
    text,
    textSource: text === generatedText ? 'generated' : 'manual',
  }
}

export function resetWatermarkText(
  state: WatermarkPurposeState,
): WatermarkPurposeState {
  return {
    ...state,
    text: generateDefaultWatermarkText(
      state.purpose,
      state.recipient,
      state.sessionDate,
    ),
    textStyle: getTextStyle(state.purpose),
    textSource: 'generated',
  }
}

export function validateWatermarkDownload(
  state: Pick<WatermarkPurposeState, 'purpose' | 'recipient' | 'text'>,
): WatermarkDownloadReadiness {
  const purposeOption = getPurposeOption(state.purpose)
  const normalizedRecipient = normalizeWatermarkRecipient(state.recipient)
  const normalizedText = state.text.trim()
  let recipientError: string | null = null
  let textError: string | null = null

  if (purposeOption.recipientRequired && !normalizedRecipient) {
    recipientError = 'Enter the recipient or organization for this purpose.'
  } else if (normalizedRecipient.length > MAX_RECIPIENT_LENGTH) {
    recipientError = `Recipient must be ${MAX_RECIPIENT_LENGTH} characters or fewer.`
  }

  if (!normalizedText) {
    textError = 'Watermark text cannot be empty.'
  } else if (normalizedText.length > MAX_WATERMARK_TEXT_LENGTH) {
    textError = `Watermark text must be ${MAX_WATERMARK_TEXT_LENGTH} characters or fewer.`
  }

  const isReady = !recipientError && !textError
  let message = 'Ready to create a purpose-specific copy.'

  if (recipientError) {
    message = purposeOption.recipientRequired
      ? 'Add a recipient or organization before downloading.'
      : recipientError
  } else if (textError) {
    message = 'Add valid watermark text before downloading.'
  }

  return {
    isReady,
    normalizedRecipient,
    normalizedText,
    recipientError,
    textError,
    message,
  }
}
