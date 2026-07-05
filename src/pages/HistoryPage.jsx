import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useHistory } from '@/contexts/HistoryContext'
import { useBasket } from '@/contexts/BasketContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import { History as HistoryIcon, Loader2, Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/layout/UserAvatar'

function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

function generateUrlImportMealId() {
  return `url-import:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// History never stores a reusable meal_id for url_import records (it's null —
// see HistoryContext's toHistoryFields), because the one from the original add
// is a one-time synthetic value. Re-adding always mints a fresh one, exactly
// like a brand new URL import.
function recordToMeal(record) {
  if (record.source_type === 'url_import') {
    return {
      meal_id: generateUrlImportMealId(),
      name: record.title,
      title: record.title,
      photo_url: record.image_url,
      image_url: record.image_url,
      source_type: 'url_import',
      destination_url: record.destination_url,
    }
  }
  return {
    meal_id: record.meal_id,
    name: record.title,
    photo_url: record.image_url,
    source_type: record.source_type,
  }
}

export default function HistoryPage() {
  const { records, isLoading, isLoadingMore, hasMore, refresh, loadMore } = useHistory()
  const { isInBasket, isUrlInBasket, addToBasket } = useBasket()
  const { isFavorited, toggleFavorite } = useFavorites()

  // Only one inline favorite prompt may be visible at a time, tracked by
  // History record id. Dismissed by choosing Yes/No, tapping Make This Again
  // on another row, or scrolling.
  const [promptRecordId, setPromptRecordId] = useState(null)

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!promptRecordId) return
    function dismiss() {
      setPromptRecordId(null)
    }
    window.addEventListener('scroll', dismiss, { passive: true })
    return () => window.removeEventListener('scroll', dismiss)
  }, [promptRecordId])

  function recordInBasket(record) {
    return record.source_type === 'url_import'
      ? isUrlInBasket(record.destination_url)
      : isInBasket(record.meal_id)
  }

  async function handleMakeAgain(record) {
    try {
      await addToBasket(recordToMeal(record))
      // Favorites is meal_id-keyed and Spoonacular-scoped (CB_04) — url_import
      // meals have no stable identity there, so the prompt only applies to
      // meals Favorites can actually track.
      if (record.source_type !== 'url_import' && !isFavorited(record.meal_id)) {
        setPromptRecordId(record.id)
      } else {
        setPromptRecordId(null)
      }
    } catch {
      toast.error('Could not add to basket. Please try again.')
    }
  }

  function handleFavoriteYes(record) {
    toggleFavorite({ meal_id: record.meal_id, name: record.title, photo_url: record.image_url })
    setPromptRecordId(null)
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight">History</h1>
        <UserAvatar />
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Loading history…</p>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <HistoryIcon className="w-7 h-7 text-primary/50" />
          </div>
          <div>
            <p className="font-semibold text-base">Nothing here yet</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Meals you've planned will appear here after you generate your first shopping list.
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="space-y-3">
            {records.map((record) => (
              <HistoryRow
                key={record.id}
                record={record}
                inBasket={recordInBasket(record)}
                showFavoritePrompt={promptRecordId === record.id}
                onMakeAgain={() => handleMakeAgain(record)}
                onFavoriteYes={() => handleFavoriteYes(record)}
                onFavoriteNo={() => setPromptRecordId(null)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-5">
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function HistoryRow({ record, inBasket, showFavoritePrompt, onMakeAgain, onFavoriteYes, onFavoriteNo }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-4 rounded-2xl bg-card shadow-sm p-4">
        <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
          {record.image_url ? (
            <img src={record.image_url} alt={record.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl opacity-40">🍽️</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-2">{record.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Made {formatDate(record.last_made_at)}
          </p>
        </div>

        <button
          onClick={onMakeAgain}
          disabled={inBasket}
          className={cn(
            'shrink-0 flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 transition-colors border',
            inBasket
              ? 'border-transparent bg-secondary text-secondary-foreground cursor-default'
              : 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10'
          )}
          aria-label={inBasket ? 'Already in basket' : `Make ${record.title} again`}
        >
          {inBasket ? (
            <><Check className="w-3 h-3" />Already in Basket</>
          ) : (
            <><RotateCcw className="w-3 h-3" />Make This Again</>
          )}
        </button>
      </div>

      {showFavoritePrompt && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground pl-[88px]">
          <span>Add to Favorites too?</span>
          <button onClick={onFavoriteYes} className="font-semibold text-primary hover:underline">
            Yes
          </button>
          <button onClick={onFavoriteNo} className="font-semibold hover:underline">
            No
          </button>
        </div>
      )}
    </div>
  )
}
