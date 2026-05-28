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

  const [{ x, y, rotate }, api] = useSpring(() => ({ x: 0, y: 0, rotate: 0 }))

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
        api.start({ x: 0, y: 0, rotate: 0, config: SPRING_CONFIG })
        onSwipeNever(meal)
      } else {
        api.start({ x: 0, y: 0, rotate: 0, config: SPRING_CONFIG })
      }
    },
    { filterTaps: true, pointer: { touch: true } }
  )

  const yesOpacity    = x.to((v) => (isTop ? Math.min(Math.max(v / SWIPE_THRESHOLD, 0), 1) : 0))
  const noOpacity     = x.to((v) => (isTop ? Math.min(Math.max(-v / SWIPE_THRESHOLD, 0), 1) : 0))
  const neverOpacity  = y.to((v) => (isTop ? Math.min(Math.max(v / SWIPE_THRESHOLD, 0), 1) : 0))

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
        'relative w-full h-full rounded-3xl overflow-hidden shadow-xl bg-secondary select-none',
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

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

      {/* YES stamp */}
      <animated.div
        style={{ opacity: yesOpacity }}
        className="absolute top-6 left-5 border-4 border-emerald-400 rounded-xl px-3 py-1 rotate-[-15deg] pointer-events-none"
      >
        <span className="text-emerald-400 font-black text-2xl tracking-wide">YES</span>
      </animated.div>

      {/* NOPE stamp */}
      <animated.div
        style={{ opacity: noOpacity }}
        className="absolute top-6 right-5 border-4 border-red-400 rounded-xl px-3 py-1 rotate-[15deg] pointer-events-none"
      >
        <span className="text-red-400 font-black text-2xl tracking-wide">NOPE</span>
      </animated.div>

      {/* NEVER stamp */}
      <animated.div
        style={{ opacity: neverOpacity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-white/60 rounded-xl px-3 py-1 pointer-events-none"
      >
        <span className="text-white/70 font-black text-2xl tracking-wide">NEVER</span>
      </animated.div>

      {/* Star — top right */}
      <button
        onClick={handleStarClick}
        className={cn(
          'absolute top-4 right-4 z-10 p-2.5 rounded-full bg-black/30 backdrop-blur-sm transition-all',
          isFavorited ? 'text-amber-400' : 'text-white/70 hover:text-white'
        )}
        aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorited}
      >
        <Star className={cn('w-5 h-5', isFavorited && 'fill-current')} />
      </button>

      {/* Meal info — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <h2 className="text-2xl font-bold leading-tight">{meal.name}</h2>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {meal.prep_time != null && (
            <span className="inline-flex items-center gap-1.5 bg-black/35 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white/90 font-medium">
              <Clock className="w-3 h-3" />
              {meal.prep_time} min
            </span>
          )}
          {meal.difficulty && (
            <span className="inline-flex items-center bg-black/35 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white/90 font-medium">
              {meal.difficulty}
            </span>
          )}
        </div>

        {!isExpanded && isTop && (
          <div className="flex items-center gap-1 mt-3 text-white/50 text-xs">
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Tap for ingredients</span>
          </div>
        )}
      </div>

      {/* Expanded ingredient panel */}
      <div
        className={cn(
          'absolute inset-0 bg-background/96 backdrop-blur-md transition-transform duration-300 ease-in-out flex flex-col',
          isExpanded ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="font-semibold text-sm leading-snug">{meal.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {meal.difficulty ?? '–'} · {meal.prep_time != null ? `${meal.prep_time} min` : '–'}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false) }}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors"
            aria-label="Collapse"
          >
            <ChevronDown className="w-5 h-5 rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {detailsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Loading ingredients…
            </div>
          ) : details?.ingredients?.length > 0 ? (
            <ul className="space-y-2">
              {details.ingredients.map((ing) => (
                <li key={ing.id} className="text-sm text-foreground/80 flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
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
