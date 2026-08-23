import type { CreateWatermarkHandoffInput, WatermarkHandoffEntry, WatermarkHandoffReadyKind, WatermarkHandoffResolution } from '../../types/watermarkHandoff'

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg'])

function classifyHandoff(
  handoff: WatermarkHandoffEntry,
): WatermarkHandoffReadyKind | null {
  const { artifacts } = handoff

  if (artifacts.length === 1) {
    return artifacts[0].mimeType === 'application/pdf'
      ? 'generated-single-pdf'
      : IMAGE_MIME_TYPES.has(artifacts[0].mimeType)
        ? 'generated-single-image'
        : null
  }

  if (
    artifacts.length > 1 &&
    IMAGE_MIME_TYPES.has(artifacts[0].mimeType) &&
    artifacts.every((artifact) => artifact.mimeType === artifacts[0].mimeType)
  ) {
    return 'generated-image-batch'
  }

  return null
}

function hasValidArtifactMetadata(handoff: WatermarkHandoffEntry) {
  return handoff.artifacts.every((artifact) => {
    if (!artifact.blob.size || !artifact.filename.trim()) {
      return false
    }

    if (artifact.blob.type && artifact.blob.type !== artifact.mimeType) {
      return false
    }

    if (artifact.mimeType === 'application/pdf') {
      return artifact.extension === 'pdf'
    }

    if (artifact.mimeType === 'image/png') {
      return artifact.extension === 'png'
    }

    return artifact.mimeType === 'image/jpeg' && artifact.extension === 'jpg'
  })
}

export function createWatermarkHandoffStore(
  idFactory: () => string = () => crypto.randomUUID(),
  now: () => number = () => Date.now(),
) {
  let activeHandoff: WatermarkHandoffEntry | null = null
  let currentOwnerId: string | null = null

  const clear = () => {
    activeHandoff = null
  }

  return {
    setOwner(ownerId: string | null) {
      if (ownerId !== currentOwnerId) {
        clear()
        currentOwnerId = ownerId
      }
    },

    create(ownerId: string, input: CreateWatermarkHandoffInput) {
      if (!ownerId || !input.documentId || !input.result.artifacts.length) {
        throw new Error('A valid authenticated conversion result is required.')
      }

      if (input.result.artifacts.length !== input.filenames.length) {
        throw new Error('Conversion artifacts and filenames do not match.')
      }

      currentOwnerId = ownerId
      const handoff: WatermarkHandoffEntry = Object.freeze({
        id: idFactory(),
        ownerId,
        documentId: input.documentId,
        documentName: input.documentName,
        createdAt: now(),
        artifacts: Object.freeze(
          input.result.artifacts.map((artifact, index) => Object.freeze({
            blob: artifact.blob,
            mimeType: artifact.mimeType,
            extension: artifact.extension,
            filename: input.filenames[index],
            itemIds: [...artifact.itemIds],
          })),
        ),
      })
      activeHandoff = handoff
      return handoff.id
    },

    resolve(
      ownerId: string | null,
      handoffId: string,
      documentId: string,
    ): WatermarkHandoffResolution {
      if (
        !ownerId ||
        !activeHandoff ||
        activeHandoff.id !== handoffId ||
        activeHandoff.ownerId !== ownerId
      ) {
        return { status: 'missing' }
      }

      if (activeHandoff.documentId !== documentId) {
        return {
          status: 'unsupported',
          message: 'This temporary conversion does not belong to this document.',
        }
      }

      const kind = classifyHandoff(activeHandoff)
      if (!kind || !hasValidArtifactMetadata(activeHandoff)) {
        return {
          status: 'unsupported',
          message: 'This converted output cannot be opened as one watermark session.',
        }
      }

      return { status: 'ready', kind, handoff: activeHandoff }
    },

    discard(ownerId: string | null, handoffId: string) {
      if (
        activeHandoff?.ownerId === ownerId &&
        activeHandoff.id === handoffId
      ) {
        clear()
      }
    },

    clear,
  }
}

export function createWatermarkNavigationState(handoffId: string) {
  return { watermarkHandoffId: handoffId }
}

export function getWatermarkHandoffId(navigationState: unknown) {
  if (!navigationState || typeof navigationState !== 'object') {
    return null
  }

  const handoffId = Reflect.get(navigationState, 'watermarkHandoffId')
  return typeof handoffId === 'string' && handoffId.length > 0 && handoffId.length <= 128
    ? handoffId
    : null
}
