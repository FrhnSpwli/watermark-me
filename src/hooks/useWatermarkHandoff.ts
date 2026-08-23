import { useContext } from 'react'
import { WatermarkHandoffContext } from '../context/WatermarkHandoffContext'

export function useWatermarkHandoff() {
  const context = useContext(WatermarkHandoffContext)

  if (!context) {
    throw new Error('useWatermarkHandoff must be used within WatermarkHandoffProvider.')
  }

  return context
}
