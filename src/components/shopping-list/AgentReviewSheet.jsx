import { useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus, Store, SkipForward } from 'lucide-react'

// CB_17: Needs Review list from an Aldi Cart Agent run. Pending items first,
// resolved (meijer/skipped) shown muted below. The "add item" form exists
// because v1 has no automated channel back from Claude in Chrome — the user
// transcribes whatever the agent reported as unresolved.
export default function AgentReviewSheet({ open, onOpenChange, agentReview }) {
  const { items, addItem, setStatus, clearResolved } = agentReview
  const [form, setForm] = useState({ name: '', quantity: '' })

  const pending = items.filter((i) => i.status === 'pending')
  const resolved = items.filter((i) => i.status !== 'pending')

  async function handleAdd() {
    if (!form.name.trim()) return
    try {
      await addItem(form)
      setForm({ name: '', quantity: '' })
    } catch {
      toast.error('Could not add item.')
    }
  }

  async function handleSetStatus(item, status) {
    try {
      await setStatus(item.id, status)
    } catch {
      toast.error('Could not update item.')
    }
  }

  async function handleClearResolved() {
    try {
      await clearResolved()
    } catch {
      toast.error('Could not clear resolved items.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Needs Review</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {pending.length === 0 && resolved.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing to review yet. After running the Aldi Cart Agent, log anything it couldn't find below.
            </p>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-1">
                  {pending.map((item) => (
                    <ReviewRow key={item.id} item={item} onSetStatus={handleSetStatus} />
                  ))}
                </div>
              )}

              {resolved.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Resolved
                    </p>
                    <button
                      onClick={handleClearResolved}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Clear resolved
                    </button>
                  </div>
                  {resolved.map((item) => (
                    <ReviewRow key={item.id} item={item} onSetStatus={handleSetStatus} muted />
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-1.5 pt-2 border-t">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Item the agent couldn't find"
              className="flex-1 text-sm border rounded-md px-2.5 py-1.5 bg-background"
            />
            <input
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Qty (optional)"
              className="w-28 text-sm border rounded-md px-2.5 py-1.5 bg-background"
            />
            <Button size="sm" onClick={handleAdd} disabled={!form.name.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReviewRow({ item, onSetStatus, muted = false }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-md px-2 py-2.5', muted && 'opacity-50')}>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.item_name}</p>
        {item.quantity && <p className="text-xs text-muted-foreground truncate">{item.quantity}</p>}
      </div>
      {item.status === 'pending' ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onSetStatus(item, 'meijer')}>
            <Store className="w-3.5 h-3.5" />
            Get at Meijer
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => onSetStatus(item, 'skipped')}>
            <SkipForward className="w-3.5 h-3.5" />
            Skip this week
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground shrink-0">
          {item.status === 'meijer' ? 'Meijer' : 'Skipped'}
        </span>
      )}
    </div>
  )
}
