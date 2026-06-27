import { useHidden } from '@/contexts/HiddenContext'
import { EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import UserAvatar from '@/components/layout/UserAvatar'
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

  async function handleRestore(meal) {
    try {
      await removeFromHidden(meal.meal_id)
      toast.success(`${meal.meal_name} will reappear in future sessions.`)
    } catch {
      toast.error('Could not restore meal. Please try again.')
    }
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Hidden</h1>
          {hiddenMeals.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {hiddenMeals.length} meal{hiddenMeals.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <UserAvatar />
      </header>

      {hiddenMeals.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <EyeOff className="w-7 h-7 text-primary/50" />
          </div>
          <div>
            <p className="font-semibold text-base">No hidden meals</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Meals you swipe Never on will appear here. You can restore them any time.
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-5">
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
      )}
    </>
  )
}

function HiddenCard({ meal, onRestore }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card shadow-sm p-4">
      <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0">
        {meal.photo_url ? (
          <img
            src={meal.photo_url}
            alt={meal.meal_name}
            className="w-full h-full object-cover opacity-40"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <span className="text-2xl opacity-40">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <EyeOff className="w-4 h-4 text-foreground/50" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug line-clamp-2 text-muted-foreground">
          {meal.meal_name}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Hidden {formatDate(meal.dismissed_at)}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRestore}
        className="shrink-0 gap-1.5 text-muted-foreground hover:text-primary"
        aria-label={`Restore ${meal.meal_name}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Restore
      </Button>
    </div>
  )
}
