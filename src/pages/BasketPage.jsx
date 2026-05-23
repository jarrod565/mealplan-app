import { Link } from 'react-router-dom'
import { useBasket } from '@/contexts/BasketContext'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Clock, Trash2, ShoppingBasket, ChevronRight } from 'lucide-react'

export default function BasketPage() {
  const { basketItems, basketCount, removeFromBasket } = useBasket()

  if (basketCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
        <ShoppingBasket className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">Your basket is empty</p>
          <p className="text-sm text-muted-foreground mt-1">
            Swipe right on meals you'd like to cook this week.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/plan">Start swiping</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Basket</h1>
        <span className="text-sm text-muted-foreground">
          {basketCount} meal{basketCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {basketItems.map((meal) => (
          <BasketCard
            key={meal.meal_id}
            meal={meal}
            onRemove={() => removeFromBasket(meal.meal_id)}
          />
        ))}
      </div>

      <Separator className="my-6" />

      <Button asChild className="w-full gap-2">
        <Link to="/ingredients">
          View Ingredients List
          <ChevronRight className="w-4 h-4" />
        </Link>
      </Button>
    </div>
  )
}

function BasketCard({ meal, onRemove }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      {meal.photo_url ? (
        <img
          src={meal.photo_url}
          alt={meal.name}
          className="w-16 h-16 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <span className="text-2xl">🍽️</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-snug line-clamp-2">{meal.name}</p>
        {meal.prep_time != null && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{meal.prep_time} min</span>
            {meal.difficulty && (
              <>
                <span className="mx-0.5">·</span>
                <span>{meal.difficulty}</span>
              </>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label={`Remove ${meal.name} from basket`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
