export const PDF_IMAGE_PAGE_MARGIN_POINTS = 24
export const PDF_A4_PORTRAIT_POINTS = {
  width: 595.28,
  height: 841.89,
} as const

export interface ContainFit {
  x: number
  y: number
  width: number
  height: number
}

export interface ImagePdfPageLayout {
  pageWidth: number
  pageHeight: number
  image: ContainFit
}

export function calculateContainFit(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): ContainFit {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    throw new RangeError('Contain-fit dimensions must be positive.')
  }

  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  }
}

/** Images use portrait or landscape A4 pages with a fixed 24-point margin. */
export function calculateImagePdfPageLayout(
  imageWidth: number,
  imageHeight: number,
): ImagePdfPageLayout {
  const isLandscape = imageWidth > imageHeight
  const pageWidth = isLandscape
    ? PDF_A4_PORTRAIT_POINTS.height
    : PDF_A4_PORTRAIT_POINTS.width
  const pageHeight = isLandscape
    ? PDF_A4_PORTRAIT_POINTS.width
    : PDF_A4_PORTRAIT_POINTS.height
  const contentWidth = pageWidth - PDF_IMAGE_PAGE_MARGIN_POINTS * 2
  const contentHeight = pageHeight - PDF_IMAGE_PAGE_MARGIN_POINTS * 2
  const contained = calculateContainFit(
    imageWidth,
    imageHeight,
    contentWidth,
    contentHeight,
  )

  return {
    pageWidth,
    pageHeight,
    image: {
      ...contained,
      x: contained.x + PDF_IMAGE_PAGE_MARGIN_POINTS,
      y: contained.y + PDF_IMAGE_PAGE_MARGIN_POINTS,
    },
  }
}
