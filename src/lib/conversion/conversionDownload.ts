import type { ConversionArtifact } from '../../types/conversion'

export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  try {
    link.href = objectUrl
    link.download = filename
    link.style.display = 'none'
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  }
}

export async function createArtifactsZip(
  artifacts: ConversionArtifact[],
  filenames: string[],
  onProgress?: (percent: number) => void,
) {
  if (!artifacts.length || artifacts.length !== filenames.length) {
    throw new Error('Generated artifacts and filenames do not match.')
  }

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  const artifactBuffers = await Promise.all(
    artifacts.map((artifact) => artifact.blob.arrayBuffer()),
  )
  artifactBuffers.forEach((buffer, index) => {
    zip.file(filenames[index], buffer)
  })

  return zip.generateAsync(
    {
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => onProgress?.(Math.round(metadata.percent)),
  )
}
