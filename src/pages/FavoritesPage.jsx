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
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Heart className="w-7 h-7 text-primary/50" />
        </div>
        <div>
          <p className="font-semibold text-base">No favorites yet</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Tap the star on any meal while swiping to save it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-7">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <span className="text-sm text-muted-foreground font-medium">
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
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      {meal.photo_url ? (
        <img
          src={meal.photo_url}
          alt={meal.name}
          className="w-[72px] h-[72px] rounded-xl object-cover shrink-0"
        />
      ) : (
        <div className="w-[72px] h-[72px] rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <span className="text-2xl">🍽️</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug line-clamp-2">{meal.name}</p>
        {meal.prep_time != null && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{meal.prep_time} min</span>
          </div>
        )}

        <button
          onClick={onAddToBasket}
          disabled={inBasket}
          className={cn(
            'mt-2.5 flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 transition-colors border',
            inBasket
              ? 'border-transparent bg-secondary text-secondary-foreground cursor-default'
              : 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10'
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

      <button
        onClick={onUnfavorite}
        className="shrink-0 p-2 rounded-full text-amber-400 hover:bg-amber-400/10 transition-colors"
        aria-label={`Remove ${meal.name} from favorites`}
        aria-pressed={true}
      >
        <Star className="w-5 h-5 fill-current" />
      </button>
    </div>
  )
}
