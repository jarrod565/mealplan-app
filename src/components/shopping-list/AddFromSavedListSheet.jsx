import { useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'

// CB_13: pull a saved list's items onto the current shopping list. All items
// default on; user toggles off what they already have. Confirming one list
// returns to the list picker (not close) so multiple lists can be pulled in
// the same session, per the brief.
export default function AddFromSavedListSheet({ open, onOpenChange, groceryLists, onAddItems }) {
  const { lists, itemsByList, loadItems } = groceryLists

  const [activeListId, setActiveListId] = useState(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [adding, setAdding] = useState(false)

  const activeList = activeListId ? lists.find((l) => l.id === activeListId) : null
  const activeItems = activeListId ? (itemsByList[activeListId] ?? []) : []

  async function openList(list) {
    setActiveListId(list.id)
    setItemsLoading(true)
    try {
      const loaded = await loadItems(list.id)
      setCheckedIds(new Set(loaded.map((i) => i.id)))
    } catch {
      toast.error('Could not load items for this list.')
      setActiveListId(null)
    } finally {
      setItemsLoading(false)
    }
  }

  function backToLists() {
    setActiveListId(null)
    setCheckedIds(new Set())
  }

  function handleClose(nextOpen) {
    if (!nextOpen) backToLists()
    onOpenChange(nextOpen)
  }

  function toggleItem(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAdd() {
    const pulled = activeItems
      .filter((i) => checkedIds.has(i.id))
      .map((i) => ({ name: i.name, quantity: i.quantity }))
    if (pulled.length === 0) return
    setAdding(true)
    try {
      const { added } = await onAddItems(pulled, activeList.name)
      if (added === 0) {
        toast.info('Everything on that list is already on your shopping list.')
      } else if (added === pulled.length) {
        toast.success(`${added} item${added !== 1 ? 's' : ''} added from ${activeList.name}`)
      } else {
        toast.success(`${added} item${added !== 1 ? 's' : ''} added — ${pulled.length - added} already on your list`)
      }
      backToLists()
    } catch {
      toast.error('Could not add items. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col p-0">
        <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b">
          {activeList && (
            <button
              onClick={backToLists}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to saved lists"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <SheetTitle>{activeList ? activeList.name : 'Add from saved list'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!activeList ? (
            <div className="rounded-2xl border bg-card divide-y overflow-hidden">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => openList(list)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-secondary/50 transition-colors text-left"
                >
                  {list.name}
                </button>
              ))}
            </div>
          ) : itemsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading items…</span>
            </div>
          ) : activeItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">This list has no items yet.</p>
          ) : (
            <div className="space-y-1">
              {activeItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-secondary/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 rounded border-input accent-primary shrink-0"
                  />
                  <span className="flex-1 text-sm">{item.name}</span>
                  {item.quantity && <span className="text-xs text-muted-foreground shrink-0">{item.quantity}</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {activeList && (
          <SheetFooter>
            <Button onClick={handleAdd} disabled={checkedIds.size === 0 || adding} className="w-full">
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Add ${checkedIds.size} item${checkedIds.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
