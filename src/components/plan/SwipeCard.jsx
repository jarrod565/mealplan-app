import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { Star, Clock, ChevronDown, Loader2 } from 'lucide-react'
import { fetchMealDetails } from '@/lib/spoonacular'
import { cn } from '@/lib/utils'

const SWIPE_THRESHOLD = 80  // px before a swipe is committed
const SPRING_CONFIG = { tension: 300, friction: 28 }

const SwipeCard = forwardRef(function SwipeCard(
  { meal, isTop, onSwipeYes, onSwipeNo, onSwipeNever, onToggleFavorite, isFavorited },
  ref
) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [details, setDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const didDrag = useRef(false)

  // Spring for position — only animated when this is the top card
  const [{ x, y, rotate }, api] = useSpring(() => ({ x: 0, y: 0, rotate: 0 }))

  // Expose snapBack for parent to call when Never dialog is cancelled
  useImperativeHandle(ref, () => ({
    snapBack: () =>
      api.start({ x: 0, y: 0, rotate: 0, config: SPRING_CONFIG }),
  }))

  const bind = useDrag(
    ({ down, movement: [mx, my], last, cancel }) => {
      if (!isTop) { cancel(); return }

      if (Math.abs(mx) > 4 || Math.abs(my) > 4) didDrag.current = true

      if (down) {
        api.set({ x: mx, y: my, rotate: mx / 18 })
        return
      }

      if (!last) return

      const swipedRight = mx > SWIPE_THRESHOLD
      const swipedLeft  = mx < -SWIPE_THRESHOLD
      const swipedDown  = my > SWIPE_THRESHOLD && Math.abs(my) > Math.abs(mx)

      if (swipedRight) {
        api.start({
          x: 700, rotate: 35, config: { duration: 260 },
          onRest: () => onSwipeYes(meal),
        })
      } else if (swipedLeft) {
        api.start({
          x: -700, rotate: -35, config: { duration: 260 },
          onRest: () => onSwipeNo(meal),
        })
      } else if (swipedDown) {
        // Snap back and trigger Never dialog in parent
        api.start({ x: 0, y: 0, rotate: 0, config: SPRING_CONFIG })
        onSwipeNever(meal)
      } else {
        api.start({ x: 0, y: 0, rotate: 0, config: SPRING_CONFIG })
      }
    },
    { filterTaps: true, pointer: { touch: true } }
  )

  // Derived direction indicator from live spring values
  const yesOpacity = x.to((v) => (isTop ? Math.min(Math.max(v / SWIPE_THRESHOLD, 0), 1) : 0))
  const noOpacity  = x.to((v) => (isTop ? Math.min(Math.max(-v / SWIPE_THRESHOLD, 0), 1) : 0))
  const neverOpacity = y.to((v) => (isTop ? Math.min(Math.max(v / SWIPE_THRESHOLD, 0), 1) : 0))

  async function handleCardClick() {
    if (didDrag.current) { didDrag.current = false; return }
    if (!isTop) return

    if (isExpanded) {
      setIsExpanded(false)
      return
    }

    setIsExpanded(true)
    if (!details) {
      setDetailsLoading(true)
      try {
        const data = await fetchMealDetails(meal.meal_id)
        setDetails(data)
      } catch {
        // show empty gracefully
      } finally {
        setDetailsLoading(false)
      }
    }
  }

  function handleStarClick(e) {
    e.stopPropagation()
    onToggleFavorite(meal)
  }

  return (
    <animated.div
      {...(isTop ? bind() : {})}
      style={isTop ? { x, y, rotate, touchAction: 'none' } : undefined}
      onClick={handleCardClick}
      className={cn(
        'relative w-full h-full rounded-2xl overflow-hidden shadow-lg bg-secondary select-none',
        isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
      )}
    >
      {/* Photo */}
      {meal.photo_url ? (
        <img
          src={meal.photo_url}
          alt={meal.name}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-secondary flex items-center justify-center">
          <span className="text-6xl">🍽️</span>
        </div>
      )}

      {/* Gradient overlay (always visible at bottom) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />

      {/* YES indicator */}
      <animated.div
        style={{ opacity: yesOpacity }}
        className="absolute top-6 left-5 border-4 border-green-400 rounded-lg px-3 py-1 rotate-[-15deg] pointer-events-none"
      >
        <span className="text-green-400 font-black text-2xl tracking-wide">YES</span>
      </animated.div>

      {/* NO indicator */}
      <animated.div
        style={{ opacity: noOpacity }}
        className="absolute top-6 right-5 border-4 border-red-400 rounded-lg px-3 py-1 rotate-[15deg] pointer-events-none"
      >
        <span className="text-red-400 font-black text-2xl tracking-wide">NOPE</span>
      </animated.div>

      {/* NEVER indicator */}
      <animated.div
        style={{ opacity: neverOpacity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-gray-300 rounded-lg px-3 py-1 pointer-events-none"
      >
        <span className="text-gray-200 font-black text-2xl tracking-wide">NEVER</span>
      </animated.div>

      {/* Star icon — top-right */}
      <button
        onClick={handleStarClick}
        className={cn(
          'absolute top-4 right-4 z-10 p-2 rounded-full bg-black/30 backdrop-blur-sm transition-colors',
          isFavorited ? 'text-yellow-400' : 'text-white/80 hover:text-white'
        )}
        aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorited}
      >
        <Star className={cn('w-5 h-5', isFavorited && 'fill-current')} />
      </button>

      {/* Meal info — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h2 className="text-xl font-semibold leading-snug">{meal.name}</h2>
        <div className="flex items-center gap-1.5 mt-1 text-white/80 text-sm">
          <Clock className="w-4 h-4" />
          <span>{meal.prep_time != null ? `${meal.prep_time} min` : 'Time unknown'}</span>
          {meal.difficulty && (
            <>
              <span className="mx-1">·</span>
              <span>{meal.difficulty}</span>
            </>
          )}
        </div>

        {/* Tap hint when not expanded */}
        {!isExpanded && isTop && (
          <div className="flex items-center gap-1 mt-2 text-white/50 text-xs">
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Tap for ingredients</span>
          </div>
        )}
      </div>

      {/* Expanded ingredient panel */}
      <div
        className={cn(
          'absolute inset-0 bg-background/95 backdrop-blur-sm transition-transform duration-300 ease-in-out flex flex-col',
          isExpanded ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="font-semibold text-sm">{meal.name}</p>
            <p className="text-xs text-muted-foreground">
              {meal.difficulty ?? '–'} · {meal.prep_time != null ? `${meal.prep_time} min` : '–'}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false) }}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Collapse"
          >
            <ChevronDown className="w-5 h-5 rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {detailsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading ingredients…
            </div>
          ) : details?.ingredients?.length > 0 ? (
            <ul className="space-y-1.5">
              {details.ingredients.map((ing) => (
                <li key={ing.id} className="text-sm">
                  {ing.original}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Ingredient details unavailable.
            </p>
          )}
        </div>
      </div>
    </animated.div>
  )
})

export default SwipeCard
