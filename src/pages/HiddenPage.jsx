import { useHidden } from '@/contexts/HiddenContext'
import { EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export default function HiddenPage() {
  const { hiddenMeals, removeFromHidden } = useHidden()

  if (hiddenMeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
        <EyeOff className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">No hidden meals</p>
          <p className="text-sm text-muted-foreground mt-1">
            Meals you swipe Never on will appear here. You can restore them any time.
          </p>
        </div>
      </div>
    )
  }

  async function handleRestore(meal) {
    try {
      await removeFromHidden(meal.meal_id)
      toast.success(`${meal.meal_name} will reappear in future sessions.`)
    } catch {
      toast.error('Could not restore meal. Please try again.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Hidden</h1>
        <span className="text-sm text-muted-foreground">
          {hiddenMeals.length} meal{hiddenMeals.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {hiddenMeals.map((meal) => (
          <HiddenCard
            key={meal.meal_id}
            meal={meal}
            onRestore={() => handleRestore(meal)}
          />
        ))}
      </div>
    </div>
  )
}

function HiddenCard({ meal, onRestore }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      {/* Photo — muted to signal "hidden" state */}
      <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
        {meal.photo_url ? (
          <img
            src={meal.photo_url}
            alt={meal.meal_name}
            className="w-full h-full object-cover opacity-50"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <span className="text-2xl opacity-50">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <EyeOff className="w-4 h-4 text-foreground/60" />
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-snug line-clamp-2 text-muted-foreground">
          {meal.meal_name}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Hidden {formatDate(meal.dismissed_at)}
        </p>
      </div>

      {/* Restore — no confirmation required per CB_05 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRestore}
        className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
        aria-label={`Restore ${meal.meal_name}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Restore
      </Button>
    </div>
  )
}
