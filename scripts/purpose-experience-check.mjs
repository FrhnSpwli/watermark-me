import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
})

let checkCount = 0

function check(condition, message) {
  if (!condition) {
    throw new Error(message)
  }

  checkCount += 1
}

function createMeasuringContext() {
  return {
    font: '',
    measureText(text) {
      const fontSize = Number(/([0-9.]+)px/.exec(this.font)?.[1] ?? 16)
      return { width: Array.from(text).length * fontSize * 0.58 }
    },
  }
}

try {
  const config = await server.ssrLoadModule(
    '/src/lib/watermark/watermarkConfig.ts',
  )
  const experience = await server.ssrLoadModule(
    '/src/lib/watermark/purposeExperience.ts',
  )
  const imageRenderer = await server.ssrLoadModule(
    '/src/lib/watermark/imageWatermark.ts',
  )
  const pdfRenderer = await server.ssrLoadModule(
    '/src/lib/watermark/pdfWatermark.ts',
  )
  const sessionDate = new Date(2026, 7, 9, 23, 59, 59)
  const expectedPurposes = [
    'job-application',
    'bank-verification',
    'property-rental',
    'university-admission',
    'insurance',
    'other',
  ]

  check(
    JSON.stringify(config.WATERMARK_PURPOSES.map((option) => option.value)) ===
      JSON.stringify(expectedPurposes),
    'The canonical config contains exactly the six MVP purposes.',
  )
  check(
    config.WATERMARK_PURPOSES.every(
      (option) => option.description && option.recipientPlaceholder,
    ),
    'Every purpose provides concise meaning and a recipient example.',
  )

  for (const purpose of expectedPurposes.slice(0, -1)) {
    let state = experience.createWatermarkPurposeState(sessionDate)
    state = experience.changeWatermarkPurpose(state, purpose)
    state = experience.changeWatermarkRecipient(state, '  Example Recipient  ')
    const readiness = experience.validateWatermarkDownload(state)

    check(
      state.text === 'ONLY FOR\nEXAMPLE RECIPIENT\n09 AUG 2026',
      `${purpose} generates the canonical semantic text.`,
    )
    check(readiness.isReady, `${purpose} is ready with a recipient.`)
    check(
      readiness.normalizedRecipient === 'Example Recipient',
      `${purpose} trims recipient whitespace for output.`,
    )
    check(
      state.sessionDate === sessionDate,
      `${purpose} preserves the editor session date.`,
    )
  }

  let generatedState = experience.createWatermarkPurposeState(sessionDate)
  const missingRecipient = experience.validateWatermarkDownload(generatedState)
  check(!missingRecipient.isReady, 'A predefined purpose requires a recipient.')
  check(
    Boolean(missingRecipient.recipientError),
    'A missing predefined recipient has a clear validation error.',
  )
  check(
    generatedState.text.includes('RECIPIENT / ORGANIZATION'),
    'An empty generated preview uses only a neutral visual placeholder.',
  )

  generatedState = experience.changeWatermarkRecipient(
    generatedState,
    '  PT Example Indonesia  ',
  )
  generatedState = experience.normalizePurposeRecipient(generatedState)
  check(
    generatedState.recipient === 'PT Example Indonesia',
    'Recipient normalization removes leading and trailing whitespace.',
  )
  check(
    generatedState.text.includes('PT EXAMPLE INDONESIA'),
    'Normalized recipient remains synchronized with generated text.',
  )

  const manualText = 'ONLY FOR\nRECRUITMENT REVIEW\n09 AUG 2026'
  let manualState = experience.changeWatermarkText(generatedState, manualText)
  manualState = experience.changeWatermarkRecipient(manualState, 'Another Company')
  check(
    manualState.text === manualText && manualState.textSource === 'manual',
    'Recipient changes preserve intentionally edited text.',
  )
  manualState = experience.changeWatermarkPurpose(manualState, 'insurance')
  check(
    manualState.text === manualText,
    'Purpose changes preserve intentionally edited text.',
  )
  manualState = experience.resetWatermarkText(manualState)
  check(
    manualState.text === 'ONLY FOR\nANOTHER COMPANY\n09 AUG 2026',
    'Reset regenerates text from the current purpose and recipient.',
  )
  check(manualState.textSource === 'generated', 'Reset restores generated mode.')

  let otherState = experience.createWatermarkPurposeState(sessionDate)
  otherState = experience.changeWatermarkPurpose(otherState, 'other')
  check(
    experience.validateWatermarkDownload(otherState).isReady,
    'Other allows an optional recipient when watermark text is present.',
  )
  otherState = experience.changeWatermarkText(
    otherState,
    'COPY FOR REVIEW\nCASE 42',
  )
  otherState = experience.changeWatermarkRecipient(otherState, 'Optional Org')
  check(
    otherState.text === 'COPY FOR REVIEW\nCASE 42',
    'Other preserves custom multiline text when recipient changes.',
  )
  check(otherState.textStyle === 'custom', 'Other uses the custom text layout.')

  let switchingState = experience.createWatermarkPurposeState(sessionDate)
  for (const purpose of [
    'job-application',
    'bank-verification',
    'insurance',
    'other',
    'job-application',
  ]) {
    switchingState = experience.changeWatermarkPurpose(switchingState, purpose)
    check(
      switchingState.text ===
        config.generateDefaultWatermarkText(
          purpose,
          switchingState.recipient,
          sessionDate,
        ),
      `Switching to ${purpose} keeps generated text synchronized.`,
    )
  }

  const maximumRecipientState = experience.changeWatermarkRecipient(
    experience.createWatermarkPurposeState(sessionDate),
    'A'.repeat(config.MAX_RECIPIENT_LENGTH),
  )
  check(
    experience.validateWatermarkDownload(maximumRecipientState).isReady,
    'A recipient at the maximum length is accepted.',
  )
  const excessiveRecipientState = experience.changeWatermarkRecipient(
    experience.createWatermarkPurposeState(sessionDate),
    'A'.repeat(config.MAX_RECIPIENT_LENGTH + 1),
  )
  check(
    !experience.validateWatermarkDownload(excessiveRecipientState).isReady,
    'A recipient over the maximum length is rejected.',
  )
  const emptyOtherText = experience.changeWatermarkText(otherState, '   ')
  check(
    !experience.validateWatermarkDownload(emptyOtherText).isReady,
    'Other requires non-empty custom watermark text.',
  )
  const excessiveText = experience.changeWatermarkText(
    otherState,
    'X'.repeat(config.MAX_WATERMARK_TEXT_LENGTH + 1),
  )
  check(
    !experience.validateWatermarkDownload(excessiveText).isReady,
    'Watermark text over the maximum length is rejected.',
  )

  const sharedSettings = {
    ...config.DEFAULT_WATERMARK_SETTINGS,
    text: config.generateDefaultWatermarkText(
      'bank-verification',
      'Bank BCA',
      sessionDate,
    ),
  }
  const imageLayout = imageRenderer.calculateWatermarkLayout(
    createMeasuringContext(),
    1600,
    1000,
    sharedSettings,
  )
  const measurementPdf = await PDFDocument.create()
  const pdfLayout = pdfRenderer.calculatePdfPageWatermarkLayout(
    595,
    842,
    sharedSettings,
    {
      regular: await measurementPdf.embedFont(StandardFonts.Helvetica),
      bold: await measurementPdf.embedFont(StandardFonts.HelveticaBold),
    },
  )
  check(
    imageLayout.lines.map((line) => line.text).join('\n') ===
      pdfLayout.lines.map((line) => line.text).join('\n'),
    'Image and PDF renderers receive identical purpose semantics.',
  )
  check(
    config.buildWatermarkedFilename(
      'Document.pdf',
      'bank-verification',
      'Bank BCA',
      switchingState.sessionDate,
      'pdf',
    ).endsWith('_20260809.pdf'),
    'Filename generation uses the same stable session date.',
  )

  console.log(`Purpose experience checks: ${checkCount} passed`)
} finally {
  await server.close()
}
