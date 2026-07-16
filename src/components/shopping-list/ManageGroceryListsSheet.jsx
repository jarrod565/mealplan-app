import { useState } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, ChevronUp, ChevronDown, Pencil, Trash2, Plus, X, Check, Loader2 } from 'lucide-react'

// CB_13: create/rename/reorder/delete saved grocery lists, and manage the
// items within each. Lives entirely inside this sheet — no new route.
export default function ManageGroceryListsSheet({ open, onOpenChange, groceryLists }) {
  const {
    lists, itemsByList, loadItems, createList, renameList, deleteList, moveList,
    addItem, updateItem, deleteItem,
  } = groceryLists

  const [activeListId, setActiveListId] = useState(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [itemForm, setItemForm] = useState({ name: '', quantity: '' })
  const [editingItemId, setEditingItemId] = useState(null)
  const [editItemForm, setEditItemForm] = useState({ name: '', quantity: '' })

  const activeList = activeListId ? lists.find((l) => l.id === activeListId) : null
  const activeItems = activeListId ? (itemsByList[activeListId] ?? []) : []

  function backToLists() {
    setActiveListId(null)
    setItemForm({ name: '', quantity: '' })
    setEditingItemId(null)
  }

  async function openList(list) {
    setActiveListId(list.id)
    setItemsLoading(true)
    try {
      await loadItems(list.id)
    } catch {
      toast.error('Could not load items for this list.')
      setActiveListId(null)
    } finally {
      setItemsLoading(false)
    }
  }

  function handleClose(nextOpen) {
    if (!nextOpen) {
      backToLists()
      setNewListName('')
      setRenamingId(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleCreateList() {
    const name = newListName.trim()
    if (!name) return
    try {
      await createList(name)
      setNewListName('')
    } catch {
      toast.error('Could not create that list — the name may already be in use.')
    }
  }

  function startRename(list) {
    setRenamingId(list.id)
    setRenameValue(list.name)
  }

  async function confirmRename(id) {
    try {
      await renameList(id, renameValue)
    } catch {
      toast.error('Could not rename list.')
    } finally {
      setRenamingId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteList(deleteTarget.id)
      if (activeListId === deleteTarget.id) backToLists()
    } catch {
      toast.error('Could not delete list.')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleAddItem() {
    if (!itemForm.name.trim()) return
    try {
      await addItem(activeListId, itemForm)
      setItemForm({ name: '', quantity: '' })
    } catch {
      toast.error('Could not add item.')
    }
  }

  function startEditItem(item) {
    setEditingItemId(item.id)
    setEditItemForm({ name: item.name, quantity: item.quantity ?? '' })
  }

  async function confirmEditItem() {
    try {
      await updateItem(activeListId, editingItemId, editItemForm)
    } catch {
      toast.error('Could not update item.')
    } finally {
      setEditingItemId(null)
    }
  }

  async function handleDeleteItem(item) {
    try {
      await deleteItem(activeListId, item.id)
    } catch {
      toast.error('Could not remove item.')
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b">
            {activeList && (
              <button
                onClick={backToLists}
                className="p-1.5 -ml-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Back to grocery lists"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <SheetTitle>{activeList ? activeList.name : 'Grocery Lists'}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {!activeList ? (
              <>
                {lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No saved lists yet. Create one below for your regular staples — Aldi, Meijer, Sam's Club.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lists.map((list, idx) => (
                      <div key={list.id} className="flex items-center gap-2 rounded-xl border bg-card p-3">
                        <div className="flex flex-col shrink-0">
                          <button
                            onClick={() => moveList(list.id, -1)}
                            disabled={idx === 0}
                            className="p-0.5 text-muted-foreground disabled:opacity-20 hover:text-foreground"
                            aria-label={`Move ${list.name} up`}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveList(list.id, 1)}
                            disabled={idx === lists.length - 1}
                            className="p-0.5 text-muted-foreground disabled:opacity-20 hover:text-foreground"
                            aria-label={`Move ${list.name} down`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {renamingId === list.id ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && confirmRename(list.id)}
                              className="flex-1 text-sm border rounded-md px-2 py-1 bg-background"
                            />
                            <button onClick={() => confirmRename(list.id)} className="p-1.5 text-primary" aria-label="Save name">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setRenamingId(null)} className="p-1.5 text-muted-foreground" aria-label="Cancel rename">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => openList(list)} className="flex-1 text-left text-sm font-medium truncate">
                            {list.name}
                          </button>
                        )}

                        {renamingId !== list.id && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => startRename(list)}
                              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                              aria-label={`Rename ${list.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(list)}
                              className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Delete ${list.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                    placeholder="New list name (e.g. Aldi)"
                    className="flex-1 text-sm border rounded-md px-2.5 py-1.5 bg-background"
                  />
                  <Button size="sm" onClick={handleCreateList} disabled={!newListName.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : itemsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading items…</span>
              </div>
            ) : (
              <>
                {activeItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No items yet.</p>
                ) : (
                  <div className="space-y-1">
                    {activeItems.map((item) =>
                      editingItemId === item.id ? (
                        <div key={item.id} className="flex items-center gap-1.5 rounded-md border p-2">
                          <input
                            autoFocus
                            value={editItemForm.name}
                            onChange={(e) => setEditItemForm((f) => ({ ...f, name: e.target.value }))}
                            className="flex-1 text-sm border rounded px-2 py-1 bg-background"
                            placeholder="Name"
                          />
                          <input
                            value={editItemForm.quantity}
                            onChange={(e) => setEditItemForm((f) => ({ ...f, quantity: e.target.value }))}
                            className="w-24 text-sm border rounded px-2 py-1 bg-background"
                            placeholder="Qty"
                          />
                          <button onClick={confirmEditItem} className="p-1.5 text-primary" aria-label="Save item">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingItemId(null)} className="p-1.5 text-muted-foreground" aria-label="Cancel edit">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-secondary/40">
                          <span className="flex-1 text-sm truncate">{item.name}</span>
                          {item.quantity && (
                            <span className="text-xs text-muted-foreground shrink-0">{item.quantity}</span>
                          )}
                          <button
                            onClick={() => startEditItem(item)}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-2 border-t">
                  <input
                    value={itemForm.name}
                    onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    placeholder="Item name"
                    className="flex-1 text-sm border rounded-md px-2.5 py-1.5 bg-background"
                  />
                  <input
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    placeholder="Qty (optional)"
                    className="w-28 text-sm border rounded-md px-2.5 py-1.5 bg-background"
                  />
                  <Button size="sm" onClick={handleAddItem} disabled={!itemForm.name.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
