import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useShoppingList } from '@/contexts/ShoppingListContext'
import { formatListAsText } from '@/lib/exportList'
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
import { CATEGORIES } from '@/lib/units'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, ShoppingCart, Trash2, Clipboard, Share2 } from 'lucide-react'

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export default function ShoppingListPage() {
  const { items, isLoading, toggleItem, clearList } = useShoppingList()
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const allChecked = items.length > 0 && items.every(i => i.checked)
  const unchecked = items.filter(i => !i.checked).length

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => (i.category || 'Other') === cat)
    return acc
  }, {})

  async function handleCopy() {
    const text = formatListAsText(items)
    if (!text) {
      toast.info('Nothing to copy — your list is empty.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(
        allChecked
          ? 'Full list copied (all items already checked)'
          : 'List copied to clipboard'
      )
    } catch {
      toast.error('Could not copy to clipboard — please try again.')
    }
  }

  async function handleShare() {
    const text = formatListAsText(items)
    if (!text) return
    try {
      await navigator.share({ title: 'Shopping List', text })
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Could not open share sheet.')
      }
    }
  }

  async function handleClear() {
    await clearList()
    setClearDialogOpen(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
        <ShoppingCart className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">No shopping list yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add meals to your basket, review ingredients, and generate a list.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/plan">Go to Plan</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-semibold">Shopping List</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unchecked > 0
                ? `${unchecked} of ${items.length} remaining`
                : `All ${items.length} items checked`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setClearDialogOpen(true)}
            className="text-muted-foreground hover:text-destructive gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>
        </div>

        {/* Export actions */}
        <div className="flex gap-2 mb-5 mt-3">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            <Clipboard className="w-3.5 h-3.5" />
            Copy list
          </Button>
          {canShare && (
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              Share
            </Button>
          )}
        </div>

        {/* "That's everything!" banner */}
        {allChecked && (
          <div className="rounded-xl bg-foreground text-background px-4 py-3 mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">That's everything!</p>
              <p className="text-xs opacity-60 mt-0.5">Ready to clear your list?</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-foreground border-background/30 hover:bg-background/10"
              onClick={() => setClearDialogOpen(true)}
            >
              Clear list
            </Button>
          </div>
        )}

        {/* Grouped list */}
        <div className="space-y-1 pb-6">
          {CATEGORIES.map(cat => {
            const catItems = grouped[cat]
            if (!catItems?.length) return null
            return (
              <div key={cat} className="mb-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-4 first:mt-0 px-1">
                  {cat}
                </p>
                {catItems.map(item => (
                  <CheckItem key={item.id} item={item} onToggle={() => toggleItem(item.id)} />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Clear confirmation */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear shopping list?</AlertDialogTitle>
            <AlertDialogDescription>
              All {items.length} items will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep list</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear}>Clear list</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CheckItem({ item, onToggle }) {
  const displayQty =
    item.quantity == null
      ? ''
      : Number.isInteger(item.quantity)
        ? item.quantity
        : Number(Number(item.quantity).toFixed(2))

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 px-2 py-2.5 rounded-md text-left transition-colors hover:bg-secondary/40 active:bg-secondary/60',
        item.checked && 'opacity-50'
      )}
    >
      <span
        className={cn(
          'w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
          item.checked ? 'bg-foreground border-foreground' : 'border-border'
        )}
      >
        {item.checked && (
          <svg className="w-3 h-3 text-background" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <span className={cn('flex-1 text-sm', item.checked && 'line-through')}>
        {item.name}
      </span>

      {displayQty !== '' && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {displayQty}{item.unit ? ` ${item.unit}` : ''}
        </span>
      )}
    </button>
  )
}
