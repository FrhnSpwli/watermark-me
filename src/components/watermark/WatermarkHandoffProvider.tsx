import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  WatermarkHandoffContext,
  type WatermarkHandoffContextValue,
} from '../../context/WatermarkHandoffContext'
import { useAuth } from '../../hooks/useAuth'
import { createWatermarkHandoffStore } from '../../lib/watermark/watermarkHandoff'
import type { CreateWatermarkHandoffInput } from '../../types/watermarkHandoff'

export function WatermarkHandoffProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const ownerId = user?.id ?? null
  const [store] = useState(() => createWatermarkHandoffStore())

  useEffect(() => {
    store.setOwner(ownerId)
  }, [ownerId, store])

  const createHandoff = useCallback(
    (input: CreateWatermarkHandoffInput) => {
      if (!ownerId) {
        throw new Error('An authenticated session is required for this handoff.')
      }
      return store.create(ownerId, input)
    },
    [ownerId, store],
  )
  const resolveHandoff = useCallback(
    (handoffId: string, documentId: string) =>
      store.resolve(ownerId, handoffId, documentId),
    [ownerId, store],
  )
  const discardHandoff = useCallback(
    (handoffId: string) => store.discard(ownerId, handoffId),
    [ownerId, store],
  )
  const value = useMemo<WatermarkHandoffContextValue>(
    () => ({ createHandoff, resolveHandoff, discardHandoff }),
    [createHandoff, discardHandoff, resolveHandoff],
  )

  return (
    <WatermarkHandoffContext.Provider value={value}>
      {children}
    </WatermarkHandoffContext.Provider>
  )
}
