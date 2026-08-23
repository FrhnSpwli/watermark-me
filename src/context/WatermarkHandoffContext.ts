import { createContext } from 'react'
import type {
  CreateWatermarkHandoffInput,
  WatermarkHandoffResolution,
} from '../types/watermarkHandoff'

export interface WatermarkHandoffContextValue {
  createHandoff: (input: CreateWatermarkHandoffInput) => string
  resolveHandoff: (
    handoffId: string,
    documentId: string,
  ) => WatermarkHandoffResolution
  discardHandoff: (handoffId: string) => void
}

export const WatermarkHandoffContext =
  createContext<WatermarkHandoffContextValue | undefined>(undefined)
