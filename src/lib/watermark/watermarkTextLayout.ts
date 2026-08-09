interface WrapWatermarkTextOptions {
  text: string
  maximumWidth: number
  measureText: (text: string) => number
  maximumLines?: number
}

function getBalancedTwoLineWrap(
  words: string[],
  maximumWidth: number,
  measureText: (text: string) => number,
) {
  let bestLines: string[] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    const firstLine = words.slice(0, splitIndex).join(' ')
    const secondLine = words.slice(splitIndex).join(' ')
    const firstWidth = measureText(firstLine)
    const secondWidth = measureText(secondLine)

    if (firstWidth > maximumWidth || secondWidth > maximumWidth) {
      continue
    }

    const orphanPenalty =
      splitIndex === 1 || words.length - splitIndex === 1
        ? maximumWidth * 0.18
        : 0
    const score =
      Math.max(firstWidth, secondWidth) +
      Math.abs(firstWidth - secondWidth) * 0.28 +
      orphanPenalty

    if (score < bestScore) {
      bestLines = [firstLine, secondLine]
      bestScore = score
    }
  }

  return bestLines
}

export function wrapWatermarkText({
  text,
  maximumWidth,
  measureText,
  maximumLines = 3,
}: WrapWatermarkTextOptions) {
  const normalizedText = text.trim().replace(/\s+/g, ' ')

  if (!normalizedText || measureText(normalizedText) <= maximumWidth) {
    return [normalizedText]
  }

  const words = normalizedText.split(' ')
  const balancedTwoLines = getBalancedTwoLineWrap(
    words,
    maximumWidth,
    measureText,
  )

  if (balancedTwoLines) {
    return balancedTwoLines
  }

  const lines: string[] = []
  let currentLine = ''

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (
      currentLine &&
      measureText(candidate) > maximumWidth &&
      lines.length < maximumLines - 1
    ) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = candidate
    }
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  if (lines.length >= 2) {
    const lastWords = lines.at(-1)?.split(' ') ?? []
    const previousWords = lines.at(-2)?.split(' ') ?? []

    if (lastWords.length === 1 && previousWords.length > 2) {
      const movedWord = previousWords.at(-1)

      if (movedWord) {
        const nextPreviousLine = previousWords.slice(0, -1).join(' ')
        const nextLastLine = `${movedWord} ${lastWords[0]}`

        if (measureText(nextLastLine) <= maximumWidth) {
          lines.splice(-2, 2, nextPreviousLine, nextLastLine)
        }
      }
    }
  }

  return lines
}
