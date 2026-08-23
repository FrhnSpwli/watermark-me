import type {
  ComposerItem,
  ComposerSourceContent,
} from '../../types/composer'

function imageItemId(sourceFileId: string) {
  return `image:${sourceFileId}`
}

function pdfPageItemId(sourceFileId: string, pageIndex: number) {
  return `pdf:${sourceFileId}:page:${pageIndex}`
}

function byComposerOrder(left: ComposerItem, right: ComposerItem) {
  return left.composerOrder - right.composerOrder
}

function byInitialOrder(left: ComposerItem, right: ComposerItem) {
  return left.initialOrder - right.initialOrder
}

export function createComposerItems(
  sourceContents: ComposerSourceContent[],
): ComposerItem[] {
  let order = 0

  return [...sourceContents]
    .sort((left, right) => left.source.sort_order - right.source.sort_order)
    .flatMap<ComposerItem>((content) => {
      if (content.kind === 'image') {
        const item: ComposerItem = {
          id: imageItemId(content.source.id),
          kind: 'image-file',
          sourceFileId: content.source.id,
          sourceName: content.source.original_name,
          mimeType: content.source.mime_type,
          selected: true,
          initialOrder: order,
          composerOrder: order,
          width: content.width,
          height: content.height,
        }
        order += 1
        return [item]
      }

      return [...content.pages]
        .sort((left, right) => left.pageIndex - right.pageIndex)
        .map<ComposerItem>((page) => {
          const item: ComposerItem = {
            id: pdfPageItemId(content.source.id, page.pageIndex),
            kind: 'pdf-page',
            sourceFileId: content.source.id,
            sourceName: content.source.original_name,
            mimeType: content.source.mime_type,
            selected: true,
            initialOrder: order,
            composerOrder: order,
            pageIndex: page.pageIndex,
            pageNumber: page.pageNumber,
            width: page.width,
            height: page.height,
            rotationDegrees: page.rotationDegrees,
          }
          order += 1
          return item
        })
    })
}

export function appendComposerItems(
  currentItems: ComposerItem[],
  incomingItems: ComposerItem[],
) {
  const existingIds = new Set(currentItems.map((item) => item.id))
  const nextOrder = currentItems.length
  const uniqueIncoming = incomingItems.filter((item) => !existingIds.has(item.id))

  return [
    ...currentItems,
    ...uniqueIncoming.map((item, index) => ({
      ...item,
      initialOrder: nextOrder + index,
      composerOrder: nextOrder + index,
    })),
  ]
}

export function getComposerItemsInSourceOrder(items: ComposerItem[]) {
  return [...items].sort(byInitialOrder)
}

export function getSelectedComposerItems(items: ComposerItem[]) {
  return items.filter((item) => item.selected).sort(byComposerOrder)
}

export function setComposerItemSelected(
  items: ComposerItem[],
  itemId: string,
  selected: boolean,
) {
  return items.map((item) =>
    item.id === itemId ? { ...item, selected } : item,
  )
}

export function moveSelectedComposerItem(
  items: ComposerItem[],
  itemId: string,
  targetItemId: string,
) {
  if (itemId === targetItemId) {
    return items
  }

  const selectedItems = getSelectedComposerItems(items)
  const sourceIndex = selectedItems.findIndex((item) => item.id === itemId)
  const targetIndex = selectedItems.findIndex((item) => item.id === targetItemId)

  if (sourceIndex < 0 || targetIndex < 0) {
    return items
  }

  const selectedOrderSlots = selectedItems.map((item) => item.composerOrder)
  const reorderedItems = [...selectedItems]
  const [movedItem] = reorderedItems.splice(sourceIndex, 1)
  reorderedItems.splice(targetIndex, 0, movedItem)
  const nextOrderById = new Map(
    reorderedItems.map((item, index) => [item.id, selectedOrderSlots[index]]),
  )

  return items.map((item) => {
    const composerOrder = nextOrderById.get(item.id)
    return composerOrder === undefined ? item : { ...item, composerOrder }
  })
}

export function moveSelectedComposerItemByOffset(
  items: ComposerItem[],
  itemId: string,
  offset: -1 | 1,
) {
  const selectedItems = getSelectedComposerItems(items)
  const itemIndex = selectedItems.findIndex((item) => item.id === itemId)
  const target = selectedItems[itemIndex + offset]

  return target
    ? moveSelectedComposerItem(items, itemId, target.id)
    : items
}

export function getComposerReadiness(items: ComposerItem[]) {
  const selectedCount = items.filter((item) => item.selected).length

  return {
    isReady: selectedCount > 0,
    selectedCount,
    message:
      selectedCount > 0
        ? `${selectedCount} ${selectedCount === 1 ? 'item' : 'items'} selected for output.`
        : 'Select at least one item to continue.',
  }
}

export function getComposerItemLabel(item: ComposerItem) {
  return item.kind === 'image-file'
    ? item.sourceName
    : `${item.sourceName} — Page ${item.pageNumber}`
}
