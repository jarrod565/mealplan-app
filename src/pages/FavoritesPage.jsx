import { toast } from 'sonner'
import { useFavorites } from '@/contexts/FavoritesContext'
import { useBasket } from '@/contexts/BasketContext'
import { Star, Clock, Heart, ShoppingBasket, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites()
  const { isInBasket, addToBasket } = useBasket()

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
        <Heart className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">No favorites yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Tap the star on any meal while swiping to save it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Favorites</h1>
        <span className="text-sm text-muted-foreground">
          {favorites.length} saved
        </span>
      </div>

      <div className="space-y-3">
        {favorites.map((meal) => (
          <FavoriteCard
            key={meal.meal_id}
            meal={meal}
            inBasket={isInBasket(meal.meal_id)}
            onUnfavorite={() => toggleFavorite(meal)}
            onAddToBasket={async () => {
              try {
                await addToBasket(meal)
              } catch {
                toast.error('Could not add to basket. Please try again.')
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

function FavoriteCard({ meal, inBasket, onUnfavorite, onAddToBasket }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      {/* Photo */}
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

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-snug line-clamp-2">{meal.name}</p>
        {meal.prep_time != null && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{meal.prep_time} min</span>
          </div>
        )}

        {/* Add to Basket */}
        <button
          onClick={onAddToBasket}
          disabled={inBasket}
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors border',
            inBasket
              ? 'border-transparent bg-secondary text-muted-foreground cursor-default'
              : 'border-border text-foreground hover:bg-secondary'
          )}
          aria-label={inBasket ? 'Already in basket' : `Add ${meal.name} to basket`}
        >
          {inBasket ? (
            <>
              <Check className="w-3 h-3" />
              In Basket
            </>
          ) : (
            <>
              <ShoppingBasket className="w-3 h-3" />
              Add to Basket
            </>
          )}
        </button>
      </div>

      {/* Star — always active on this screen; tapping unfavorites */}
      <button
        onClick={onUnfavorite}
        className="shrink-0 p-2 rounded-full text-yellow-400 hover:bg-yellow-400/10 transition-colors"
        aria-label={`Remove ${meal.name} from favorites`}
        aria-pressed={true}
      >
        <Star className="w-5 h-5 fill-current" />
      </button>
    </div>
  )
}
