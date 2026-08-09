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

function approximately(actual, expected, tolerance, message) {
  check(Math.abs(actual - expected) <= tolerance, message)
}

function checkWithinSafeMargins(layout, width, height, message) {
  const left = layout.x - layout.boundingWidth / 2
  const right = layout.x + layout.boundingWidth / 2
  const top = layout.y - layout.boundingHeight / 2
  const bottom = layout.y + layout.boundingHeight / 2
  const tolerance = 0.02

  check(left + tolerance >= layout.safeMargin, `${message}: left safe margin.`)
  check(
    right - tolerance <= width - layout.safeMargin,
    `${message}: right safe margin.`,
  )
  check(top + tolerance >= layout.safeMargin, `${message}: top safe margin.`)
  check(
    bottom - tolerance <= height - layout.safeMargin,
    `${message}: bottom safe margin.`,
  )
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

function createDrawingCanvas() {
  const calls = {
    drawImage: 0,
    fill: [],
    stroke: [],
  }
  const context = {
    fillStyle: '',
    font: '',
    globalAlpha: 1,
    lineJoin: '',
    lineWidth: 1,
    strokeStyle: '',
    textAlign: '',
    textBaseline: '',
    clearRect() {},
    drawImage() {
      calls.drawImage += 1
    },
    fillText(text, x, y) {
      calls.fill.push({
        alpha: this.globalAlpha,
        color: this.fillStyle,
        font: this.font,
        lineWidth: this.lineWidth,
        text,
        x,
        y,
      })
    },
    measureText(text) {
      const fontSize = Number(/([0-9.]+)px/.exec(this.font)?.[1] ?? 16)
      return { width: Array.from(text).length * fontSize * 0.58 }
    },
    restore() {},
    rotate() {},
    save() {},
    strokeText(text, x, y) {
      calls.stroke.push({
        alpha: this.globalAlpha,
        color: this.strokeStyle,
        font: this.font,
        lineWidth: this.lineWidth,
        text,
        x,
        y,
      })
    },
    translate() {},
  }
  const canvas = {
    height: 0,
    width: 0,
    getContext() {
      return context
    },
  }

  return { calls, canvas }
}

try {
  const renderer = await server.ssrLoadModule(
    '/src/lib/watermark/imageWatermark.ts',
  )
  const config = await server.ssrLoadModule(
    '/src/lib/watermark/watermarkConfig.ts',
  )
  const date = new Date(2026, 7, 9)
  const generatedText = config.generateDefaultWatermarkText(
    'job-application',
    'PT Semen Indonesia',
    date,
  )
  const baseSettings = {
    ...config.DEFAULT_WATERMARK_SETTINGS,
    text: generatedText,
  }
  const context = createMeasuringContext()
  const purposeLayout = renderer.calculateWatermarkLayout(
    context,
    3000,
    2000,
    baseSettings,
  )

  check(purposeLayout.isHierarchical, 'Generated purpose text uses hierarchy.')
  check(purposeLayout.lines[0].role === 'eyebrow', 'ONLY FOR is the eyebrow.')
  check(
    purposeLayout.lines.at(-1).role === 'secondary',
    'The generated date is secondary text.',
  )

  const primaryLines = purposeLayout.lines.filter(
    (line) => line.role === 'primary',
  )
  check(primaryLines.length === 1, 'A normal recipient remains on one line.')
  approximately(
    purposeLayout.lines[0].fontSize / primaryLines[0].fontSize,
    0.54,
    0.001,
    'Eyebrow font is 54% of the primary font.',
  )
  approximately(
    purposeLayout.lines.at(-1).fontSize / primaryLines[0].fontSize,
    0.54,
    0.001,
    'Date font is 54% of the primary font.',
  )
  check(
    primaryLines[0].fontWeight > purposeLayout.lines[0].fontWeight,
    'Recipient has stronger typographic weight.',
  )
  check(
    purposeLayout.lines[0].letterSpacing > 0,
    'Eyebrow has intentional letter spacing.',
  )

  const eyebrowBottom =
    purposeLayout.lines[0].y + purposeLayout.lines[0].fontSize / 2
  const primaryTop = primaryLines[0].y - primaryLines[0].fontSize / 2
  const primaryBottom =
    primaryLines.at(-1).y + primaryLines.at(-1).fontSize / 2
  const secondaryTop =
    purposeLayout.lines.at(-1).y - purposeLayout.lines.at(-1).fontSize / 2
  check(primaryTop > eyebrowBottom, 'Eyebrow-to-recipient spacing is positive.')
  check(secondaryTop > primaryBottom, 'Recipient-to-date spacing is positive.')

  const longText = config.generateDefaultWatermarkText(
    'job-application',
    'PT Semen Indonesia (Persero) Tbk',
    date,
  )
  const longLayout = renderer.calculateWatermarkLayout(context, 1200, 800, {
    ...baseSettings,
    text: longText,
  })
  const wrappedRecipient = longLayout.lines.filter(
    (line) => line.role === 'primary',
  )
  check(wrappedRecipient.length >= 2, 'Long recipient wraps onto multiple lines.')
  check(
    wrappedRecipient.every((line) => line.width <= 1200 * 0.58 + 0.01),
    'Wrapped recipient lines respect the intended maximum width.',
  )
  check(
    wrappedRecipient.every((line) => line.text.split(' ').length > 1),
    'Balanced wrapping avoids an isolated one-word line for the sample recipient.',
  )
  check(
    longLayout.boundingWidth <= 1200 * 0.68 + 0.01,
    'Long recipient remains inside the rotated purpose width.',
  )
  check(
    longLayout.boundingHeight <= 800 * 0.68 + 0.01,
    'Long recipient remains inside the rotated purpose height.',
  )

  const customLayout = renderer.calculateWatermarkLayout(context, 1600, 1000, {
    ...baseSettings,
    text: 'COPY FOR REVIEW\nCASE 42\nDO NOT REDISTRIBUTE',
    textStyle: 'custom',
  })
  check(!customLayout.isHierarchical, 'Other text uses the custom layout model.')
  check(
    customLayout.lines.every((line) => line.role === 'custom'),
    'Custom lines do not receive generated-purpose roles.',
  )
  check(
    new Set(customLayout.lines.map((line) => line.fontSize)).size === 1,
    'Custom multiline text keeps consistent font sizing.',
  )
  check(customLayout.lines.length === 3, 'Custom multiline text is preserved.')

  approximately(
    renderer.calculateWatermarkSafeMargin(500, 300),
    15,
    0.001,
    'A 500 × 300 image uses a responsive safe margin.',
  )
  approximately(
    renderer.calculateWatermarkSafeMargin(1920, 1080),
    54,
    0.001,
    'A 1920 × 1080 image uses a responsive safe margin.',
  )
  approximately(
    renderer.calculateWatermarkSafeMargin(4000, 3000),
    150,
    0.001,
    'A 4000 × 3000 image uses a responsive safe margin.',
  )

  const positions = [
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]

  for (const position of positions) {
    const layout = renderer.calculateWatermarkLayout(context, 1600, 1000, {
      ...baseSettings,
      position,
      rotationDegrees: 0,
    })
    checkWithinSafeMargins(layout, 1600, 1000, `${position} at 0°`)

    if (position.endsWith('-left')) {
      approximately(
        layout.x - layout.boundingWidth / 2,
        layout.safeMargin,
        0.01,
        `${position} aligns its rotated left bound.`,
      )
    } else if (position.endsWith('-right')) {
      approximately(
        layout.x + layout.boundingWidth / 2,
        1600 - layout.safeMargin,
        0.01,
        `${position} aligns its rotated right bound.`,
      )
    } else {
      approximately(layout.x, 800, 0.01, `${position} is horizontally centered.`)
    }

    if (position.startsWith('top-')) {
      approximately(
        layout.y - layout.boundingHeight / 2,
        layout.safeMargin,
        0.01,
        `${position} aligns its rotated top bound.`,
      )
    } else if (position.startsWith('bottom-')) {
      approximately(
        layout.y + layout.boundingHeight / 2,
        1000 - layout.safeMargin,
        0.01,
        `${position} aligns its rotated bottom bound.`,
      )
    } else {
      approximately(layout.y, 500, 0.01, `${position} is vertically centered.`)
    }
  }

  const rotatedPositionCases = [
    { position: 'top-left', rotationDegrees: -25 },
    { position: 'top-right', rotationDegrees: 25 },
    { position: 'center', rotationDegrees: -22 },
    { position: 'bottom-left', rotationDegrees: 25 },
    { position: 'bottom-right', rotationDegrees: -25 },
  ]

  for (const testCase of rotatedPositionCases) {
    const settings = { ...baseSettings, ...testCase }
    const layout = renderer.calculateWatermarkLayout(
      context,
      1600,
      1000,
      settings,
    )
    checkWithinSafeMargins(
      layout,
      1600,
      1000,
      `${testCase.position} at ${testCase.rotationDegrees}°`,
    )
    approximately(
      layout.rotationRadians,
      (testCase.rotationDegrees * Math.PI) / 180,
      0.0001,
      `${testCase.position} preserves its independent rotation.`,
    )
    check(
      settings.position === testCase.position &&
        settings.rotationDegrees === testCase.rotationDegrees,
      `${testCase.position} does not mutate position or rotation settings.`,
    )
  }

  for (const position of [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]) {
    const rotationDegrees = position.endsWith('left') ? -25 : 25
    const layout = renderer.calculateWatermarkLayout(context, 1920, 1080, {
      ...baseSettings,
      position,
      rotationDegrees,
      text: longText,
    })
    checkWithinSafeMargins(
      layout,
      1920,
      1080,
      `Long recipient at ${position}`,
    )
    check(
      layout.lines.filter((line) => line.role === 'primary').length >= 2,
      `Long recipient remains wrapped at ${position}.`,
    )
    check(
      layout.fontSize >= 1080 * baseSettings.fontSizeRatio * 0.75,
      `Long recipient remains reasonably sized at ${position}.`,
    )
  }

  const { calls, canvas } = createDrawingCanvas()
  const renderedLayout = renderer.renderImageWatermark(
    canvas,
    { source: {}, width: 3000, height: 2000, dispose() {} },
    { ...baseSettings, opacity: 0.4 },
  )
  check(canvas.width === 3000, 'Render canvas preserves natural source width.')
  check(canvas.height === 2000, 'Render canvas preserves natural source height.')
  check(calls.drawImage === 1, 'Original image is drawn exactly once.')
  check(calls.stroke.length > 0, 'Watermark uses text stroke.')
  check(calls.fill.length > 0, 'Watermark uses text fill.')
  check(
    calls.fill.every((call) => call.color === '#4f46e5'),
    'Watermark fill uses WatermarkMe indigo.',
  )
  check(
    calls.stroke.every((call) => call.color === '#ffffff'),
    'Watermark outline remains light.',
  )
  check(
    calls.stroke.every(
      (call) => call.lineWidth >= call.font.match(/([0-9.]+)px/)?.[1] * 0.025,
    ),
    'Stroke scales from each line font size.',
  )
  check(
    calls.stroke.every((call) => call.alpha < 0.4),
    'Outline opacity remains subtler than fill opacity.',
  )
  check(
    renderedLayout.boundingWidth <= 3000 * 0.68 + 0.01,
    'Rendered hierarchy respects rotated width fitting.',
  )

  check(config.DEFAULT_WATERMARK_SETTINGS.opacity === 0.25, 'Default opacity is 25%.')
  check(
    config.DEFAULT_WATERMARK_SETTINGS.rotationDegrees === 0,
    'Default rotation is 0 degrees.',
  )
  check(
    config.DEFAULT_WATERMARK_SETTINGS.fontSizeRatio === 0.06,
    'Default watermark size is 6% of the shorter edge.',
  )
  check(
    config.DEFAULT_WATERMARK_SETTINGS.position === 'center',
    'Default position is Center.',
  )
  check(
    config.DEFAULT_WATERMARK_SETTINGS.rotationDegrees === 0,
    'Center position retains the independent 0° default rotation.',
  )
  check(
    JSON.stringify(config.WATERMARK_POSITIONS.map((position) => position.value)) ===
      JSON.stringify([
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ]),
    'Position configuration contains exactly the typed 3 × 3 model.',
  )
  check(
    config.buildWatermarkedFilename(
      'KTP photo.jpg',
      'job-application',
      'PT Semen Indonesia',
      date,
    ) === 'KTP_PHOTO_JOB_APPLICATION_PT_SEMEN_INDONESIA_20260809.png',
    'Safe PNG filename generation is unchanged.',
  )

  console.log(`Watermark visual regression checks: ${checkCount} passed`)
} finally {
  await server.close()
}
