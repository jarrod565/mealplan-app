import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ChevronLeft, Info } from 'lucide-react'
import { SUPPORTED_RESTRICTIONS } from '@/lib/spoonacular'
import { cn } from '@/lib/utils'

export default function DietaryPreferencesPage() {
  const { subscription, updateSubscription } = useAuth()

  const [active, setActive] = useState(new Set(subscription?.dietary_restrictions ?? []))
  const [saving, setSaving] = useState(false)

  // Sync toggles once subscription loads (it's null on first render)
  useEffect(() => {
    if (subscription?.id) {
      setActive(new Set(subscription.dietary_restrictions ?? []))
    }
  }, [subscription?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(key) {
    const next = new Set(active)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setActive(next)

    setSaving(true)
    try {
      await updateSubscription({ dietary_restrictions: Array.from(next) })
    } catch {
      // Revert optimistic update
      setActive(new Set(active))
      toast.error('Could not save preference. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = active.size

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/settings">
            <ChevronLeft className="w-4 h-4" />
            <span className="sr-only">Back to Settings</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Dietary Preferences</h1>
          {activeCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {activeCount} restriction{activeCount !== 1 ? 's' : ''} active
            </p>
          )}
        </div>
        {saving && (
          <div className="ml-auto w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Info banner */}
      <div className="flex gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Changes apply to your <strong>next</strong> planning session — they won't affect meals
          already in your current swipe deck.
        </p>
      </div>

      {/* Restriction toggles */}
      <div>
        <p className="text-sm font-medium mb-3">Select all that apply to your household</p>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_RESTRICTIONS.map(({ key, label }) => {
            const isActive = active.has(key)
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                disabled={saving}
                className={cn(
                  'inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-60',
                  isActive
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground hover:bg-secondary'
                )}
                aria-pressed={isActive}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Clear all shortcut */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          disabled={saving}
          onClick={async () => {
            setActive(new Set())
            setSaving(true)
            try {
              await updateSubscription({ dietary_restrictions: [] })
              toast.success('All restrictions cleared.')
            } catch {
              setActive(new Set(subscription?.dietary_restrictions ?? []))
              toast.error('Could not clear restrictions. Please try again.')
            } finally {
              setSaving(false)
            }
          }}
        >
          Clear all restrictions
        </Button>
      )}
    </div>
  )
}
