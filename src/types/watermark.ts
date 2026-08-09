export type WatermarkPurpose =
  | 'job-application'
  | 'bank-verification'
  | 'property-rental'
  | 'university-admission'
  | 'insurance'
  | 'other'

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type WatermarkTextStyle = 'purpose' | 'custom'

export interface ImageWatermarkSettings {
  text: string
  opacity: number
  rotationDegrees: number
  fontSizeRatio: number
  position: WatermarkPosition
  textStyle: WatermarkTextStyle
}

export type WatermarkSettings = ImageWatermarkSettings

export interface DecodedSourceImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}
