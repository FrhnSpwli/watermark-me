import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import {
  getComposerItemLabel,
  getSelectedComposerItems,
} from '../../lib/composer/composerState'
import type { ComposerItem } from '../../types/composer'

interface ComposerSelectedOrderProps {
  items: ComposerItem[]
  imageUrls: ReadonlyMap<string, string>
  activeItemId: string | null
  onActivate: (itemId: string) => void
  onMoveByOffset: (itemId: string, offset: -1 | 1) => void
  onMoveToItem: (itemId: string, targetItemId: string) => void
}

export function ComposerSelectedOrder({
  items,
  imageUrls,
  activeItemId,
  onActivate,
  onMoveByOffset,
  onMoveToItem,
}: ComposerSelectedOrderProps) {
  const draggedItemId = useRef<string | null>(null)
  const lastPointerTargetId = useRef<string | null>(null)
  const selectedItems = getSelectedComposerItems(items)

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    itemId: string,
  ) => {
    draggedItemId.current = itemId
    lastPointerTargetId.current = null
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const itemId = draggedItemId.current
    if (!itemId) {
      return
    }

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-composer-order-id]')
    const targetItemId = target?.dataset.composerOrderId

    if (
      targetItemId &&
      targetItemId !== itemId &&
      targetItemId !== lastPointerTargetId.current
    ) {
      lastPointerTargetId.current = targetItemId
      onMoveToItem(itemId, targetItemId)
    }
  }

  const finishPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    draggedItemId.current = null
    lastPointerTargetId.current = null
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
          Output order
        </p>
        <h2 className="mt-1 font-bold text-slate-950">
          Selected items ({selectedItems.length})
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Drag a handle, or use the move buttons. This order exists only in this browser session.
        </p>
      </div>

      {selectedItems.length === 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Nothing is selected. Re-include an item from the source browser.
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {selectedItems.map((item, index) => {
            const label = getComposerItemLabel(item)
            const isActive = item.id === activeItemId

            return (
              <li
                className={`grid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border p-2 transition ${
                  isActive
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
                data-composer-order-id={item.id}
                key={item.id}
              >
                <button
                  aria-label={`Drag ${label}`}
                  className="h-12 touch-none cursor-grab rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-500 active:cursor-grabbing"
                  onPointerCancel={finishPointerMove}
                  onPointerDown={(event) => handlePointerDown(event, item.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishPointerMove}
                  type="button"
                >
                  ::
                </button>
                <button
                  aria-label={`Preview ${label}`}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white p-1"
                  onClick={() => onActivate(item.id)}
                  onFocus={() => onActivate(item.id)}
                  type="button"
                >
                  {item.kind === 'image-file' && imageUrls.get(item.sourceFileId) ? (
                    <img
                      alt=""
                      className="h-14 w-full object-contain"
                      src={imageUrls.get(item.sourceFileId)}
                    />
                  ) : item.kind === 'pdf-page' ? (
                    <span className="flex h-14 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600">
                      PDF {item.pageNumber}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">No preview</span>
                  )}
                </button>
                <div className="min-w-0">
                  <button
                    className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-indigo-700"
                    onClick={() => onActivate(item.id)}
                    onFocus={() => onActivate(item.id)}
                    title={label}
                    type="button"
                  >
                    {index + 1}. {label}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                      disabled={index === 0}
                      onClick={() => onMoveByOffset(item.id, -1)}
                      type="button"
                    >
                      Move earlier
                    </button>
                    <button
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                      disabled={index === selectedItems.length - 1}
                      onClick={() => onMoveByOffset(item.id, 1)}
                      type="button"
                    >
                      Move later
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
