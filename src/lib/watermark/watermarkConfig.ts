import type {
  ImageWatermarkSettings,
  WatermarkPosition,
  WatermarkPurpose,
} from '../../types/watermark'

export interface WatermarkPurposeOption {
  value: WatermarkPurpose
  label: string
  description: string
  recipientPlaceholder: string
  recipientRequired: boolean
}

interface WatermarkPositionOption {
  value: WatermarkPosition
  label: string
  description: string
}

export const WATERMARK_PURPOSES = [
  {
    value: 'job-application',
    label: 'Job Application',
    description: 'For documents sent to a company or recruiter.',
    recipientPlaceholder: 'PT Example Indonesia',
    recipientRequired: true,
  },
  {
    value: 'bank-verification',
    label: 'Bank Verification',
    description: 'For documents submitted to a bank.',
    recipientPlaceholder: 'Bank BCA',
    recipientRequired: true,
  },
  {
    value: 'property-rental',
    label: 'Property Rental',
    description: 'For identity documents submitted for a rental.',
    recipientPlaceholder: 'PT Example Property',
    recipientRequired: true,
  },
  {
    value: 'university-admission',
    label: 'University Admission',
    description: 'For documents sent to an educational institution.',
    recipientPlaceholder: 'Universitas Indonesia',
    recipientRequired: true,
  },
  {
    value: 'insurance',
    label: 'Insurance',
    description: 'For documents submitted to an insurance provider.',
    recipientPlaceholder: 'PT Example Insurance',
    recipientRequired: true,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'For any use that needs fully custom watermark text.',
    recipientPlaceholder: 'Optional recipient or organization',
    recipientRequired: false,
  },
] as const satisfies readonly WatermarkPurposeOption[]

export const WATERMARK_POSITIONS = [
  {
    value: 'top-left',
    label: 'Top left',
    description: 'Aligned inside the top-left safe margins.',
  },
  {
    value: 'top-center',
    label: 'Top center',
    description: 'Centered horizontally inside the top safe margin.',
  },
  {
    value: 'top-right',
    label: 'Top right',
    description: 'Aligned inside the top-right safe margins.',
  },
  {
    value: 'center-left',
    label: 'Center left',
    description: 'Centered vertically inside the left safe margin.',
  },
  {
    value: 'center',
    label: 'Center',
    description: 'Centered horizontally and vertically.',
  },
  {
    value: 'center-right',
    label: 'Center right',
    description: 'Centered vertically inside the right safe margin.',
  },
  {
    value: 'bottom-left',
    label: 'Bottom left',
    description: 'Aligned inside the bottom-left safe margins.',
  },
  {
    value: 'bottom-center',
    label: 'Bottom center',
    description: 'Centered horizontally inside the bottom safe margin.',
  },
  {
    value: 'bottom-right',
    label: 'Bottom right',
    description: 'Aligned inside the bottom-right safe margins.',
  },
] as const satisfies readonly WatermarkPositionOption[]

export const MAX_RECIPIENT_LENGTH = 100
export const MAX_WATERMARK_TEXT_LENGTH = 300
export const MIN_WATERMARK_OPACITY = 0.1
export const MAX_WATERMARK_OPACITY = 1
export const MIN_WATERMARK_ROTATION = -90
export const MAX_WATERMARK_ROTATION = 90
export const MIN_FONT_SIZE_RATIO = 0.02
export const MAX_FONT_SIZE_RATIO = 0.12

export const WATERMARK_VISUAL_LAYOUT = {
  purposeEyebrowSizeRatio: 0.54,
  purposeDateSizeRatio: 0.54,
  purposeRecipientMaxWidthRatio: 0.58,
  purposeMaxRotatedWidthRatio: 0.68,
  purposeMaxRotatedHeightRatio: 0.68,
  customMaxRotatedWidthRatio: 0.9,
  customMaxRotatedHeightRatio: 0.9,
  eyebrowGapRatio: 0.3,
  primaryLineGapRatio: 0.1,
  primaryToSecondaryGapRatio: 0.32,
  customLineGapRatio: 0.24,
} as const

export const DEFAULT_WATERMARK_SETTINGS: Omit<ImageWatermarkSettings, 'text'> = {
  opacity: 0.25,
  rotationDegrees: 0,
  fontSizeRatio: 0.06,
  position: 'center',
  textStyle: 'purpose',
}

export function getPurposeLabel(purpose: WatermarkPurpose) {
  return getPurposeOption(purpose).label
}

export function getPurposeOption(purpose: WatermarkPurpose) {
  return (
    WATERMARK_PURPOSES.find((option) => option.value === purpose) ??
    WATERMARK_PURPOSES.at(-1)!
  )
}

export function normalizeWatermarkRecipient(recipient: string) {
  return recipient.trim()
}

export function formatWatermarkDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .toLocaleUpperCase()
}

export function formatFilenameDate(date: Date) {
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}${month}${day}`
}

export function generateDefaultWatermarkText(
  purpose: WatermarkPurpose,
  recipient: string,
  date: Date,
) {
  if (purpose === 'other') {
    return `CUSTOM WATERMARK\n${formatWatermarkDate(date)}`
  }

  const normalizedRecipient =
    normalizeWatermarkRecipient(recipient) || 'RECIPIENT / ORGANIZATION'
  return `ONLY FOR\n${normalizedRecipient.toLocaleUpperCase()}\n${formatWatermarkDate(date)}`
}

function sanitizeFilenamePart(value: string, fallback: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)

  return normalized || fallback
}

export function buildWatermarkedFilename(
  originalName: string,
  purpose: WatermarkPurpose,
  recipient: string,
  date: Date,
  extension: 'png' | 'pdf' = 'png',
) {
  const originalWithoutExtension = originalName.replace(/\.[^.]+$/, '')
  const parts = [
    sanitizeFilenamePart(originalWithoutExtension, 'DOCUMENT'),
    sanitizeFilenamePart(getPurposeLabel(purpose), 'WATERMARK'),
  ]

  if (recipient.trim()) {
    parts.push(sanitizeFilenamePart(recipient, 'RECIPIENT'))
  }

  parts.push(formatFilenameDate(date))
  return `${parts.join('_')}.${extension}`
}
