import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import {
  Heart, Clock, ChevronRight,
  UtensilsCrossed, EyeOff, Plus, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SWIPE_THRESHOLD = 80
// High friction prevents overshoot on snap-back
const SNAP_CONFIG = { tension: 350, friction: 40 }

const SwipeCard = forwardRef(function SwipeCard(
  { meal, isTop, onSwipeYes, onSwipeNo, onSwipeNever, onToggleFavorite, isFavorited, onIngredientsPress },
  ref
) {
  const [{ x, y, rotate }, api] = useSpring(() => ({ x: 0, y: 0, rotate: 0 }))

  useImperativeHandle(ref, () => ({
    snapBack: () => api.start({ x: 0, y: 0, rotate: 0, config: SNAP_CONFIG }),
  }))

  // Guarantee this card is centered whenever it becomes the active top card
  useEffect(() => {
    if (isTop) api.set({ x: 0, y: 0, rotate: 0 })
  }, [isTop, api])

  const bind = useDrag(
    ({ down, movement: [mx, my], last, cancel }) => {
      if (!isTop) { cancel(); return }

      if (down) {
        // Reduced tilt (÷30 instead of ÷18) to avoid exaggerated rotation
        api.set({ x: mx, y: my, rotate: mx / 30 })
        return
      }

      if (!last) return

      const swipedRight = mx > SWIPE_THRESHOLD
      const swipedLeft  = mx < -SWIPE_THRESHOLD
      const swipedDown  = my > SWIPE_THRESHOLD && Math.abs(my) > Math.abs(mx)

      if (swipedRight) {
        api.start({
          x: 700, rotate: 18, config: { duration: 260 },
          onRest: () => onSwipeYes(meal),
        })
      } else if (swipedLeft) {
        api.start({
          x: -700, rotate: -18, config: { duration: 260 },
          onRest: () => onSwipeNo(meal),
        })
      } else if (swipedDown) {
        api.start({ x: 0, y: 0, rotate: 0, config: SNAP_CONFIG })
        onSwipeNever(meal)
      } else {
        api.start({ x: 0, y: 0, rotate: 0, config: SNAP_CONFIG })
      }
    },
    // No pointer: { touch } restriction — enables mouse drag on desktop
    { filterTaps: true, enabled: isTop }
  )

  const yesOpacity   = x.to((v) => (isTop ? Math.min(Math.max(v / SWIPE_THRESHOLD, 0), 1) : 0))
  const noOpacity    = x.to((v) => (isTop ? Math.min(Math.max(-v / SWIPE_THRESHOLD, 0), 1) : 0))
  const neverOpacity = y.to((v) => (isTop ? Math.min(Math.max(v / SWIPE_THRESHOLD, 0), 1) : 0))

  function handleHeartClick(e) {
    e.stopPropagation()
    onToggleFavorite(meal)
  }

  function handleNeverClick(e) {
    e.stopPropagation()
    // Never opens a confirmation dialog first — no pre-animation needed
    onSwipeNever(meal)
  }
  function handleYesClick(e) {
    e.stopPropagation()
    api.start({
      x: 700, rotate: 18, config: { duration: 260 },
      onRest: () => onSwipeYes(meal),
    })
  }
  function handleNoClick(e) {
    e.stopPropagation()
    api.start({
      x: -700, rotate: -18, config: { duration: 260 },
      onRest: () => onSwipeNo(meal),
    })
  }
  function handleIngredientsClick(e) {
    e.stopPropagation()
    onIngredientsPress?.(meal)
  }

  return (
    <animated.div
      {...(isTop ? bind() : {})}
      style={isTop ? { x, y, rotate, touchAction: 'none' } : undefined}
      className={cn(
        'relative w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-xl bg-card select-none',
        isTop ? 'cursor-grab active:cursor-grabbing' : ''
      )}
    >
      {/* ── PHOTO SECTION ── fills all space above the info panel */}
      <div className="relative flex-1 overflow-hidden">
        {meal.photo_url ? (
          <img
            src={meal.photo_url}
            alt={meal.name}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-secondary flex items-center justify-center">
            <span className="text-7xl">🍽️</span>
          </div>
        )}

        {/* Bottom gradient — darkens photo so buttons are legible */}
        <div className="absolute bottom-0 left-0 right-0 h-52 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

        {/* Top gradient — makes top-left badges legible */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />

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

        {/* Difficulty + prep time — top left (top card only) */}
        {isTop && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5">
            {meal.difficulty && (
              <span className="inline-flex items-center bg-primary text-primary-foreground rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm">
                {meal.difficulty}
              </span>
            )}
            {meal.prep_time != null && (
              <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white rounded-full px-2.5 py-1 text-xs font-medium">
                <Clock className="w-3 h-3" />
                {meal.prep_time} min
              </span>
            )}
          </div>
        )}

        {/* Heart — top right */}
        <button
          onClick={handleHeartClick}
          className={cn(
            'absolute top-4 right-4 z-10 p-2.5 rounded-full bg-black/50 backdrop-blur-sm transition-all',
            isFavorited ? 'text-rose-400' : 'text-white/70 hover:text-white'
          )}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorited}
        >
          <Heart className={cn('w-5 h-5', isFavorited && 'fill-current')} />
        </button>

        {/* Action buttons — overlaid on photo near the bottom, top card only */}
        {isTop && (
          <div className="absolute bottom-6 inset-x-0 z-10 flex items-center justify-center gap-8">
            <OverlayButton
              onClick={handleNeverClick}
              label="Never"
              icon={<EyeOff className="w-[1.1rem] h-[1.1rem]" />}
            />
            <OverlayButton
              onClick={handleYesClick}
              label="Yes!"
              icon={<Plus className="w-6 h-6" strokeWidth={2.5} />}
              large
              yes
            />
            <OverlayButton
              onClick={handleNoClick}
              label="Skip"
              icon={<X className="w-[1.1rem] h-[1.1rem]" />}
            />
          </div>
        )}
      </div>

      {/* ── WHITE INFO PANEL ── sits at the bottom of the card */}
      <div
        className="shrink-0 bg-card border-t border-border/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Meal name */}
        <div className="px-4 pt-3.5 pb-2">
          <h2 className="font-bold text-base leading-snug text-foreground line-clamp-1">
            {meal.name}
          </h2>
        </div>

        {/* Ingredients row — tappable */}
        <button
          onClick={handleIngredientsClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 pb-3.5 text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors border-t border-border/40"
          aria-label="View ingredients"
        >
          <UtensilsCrossed className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 text-sm text-muted-foreground">Ingredients</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        </button>
      </div>
    </animated.div>
  )
})

export default SwipeCard

// Buttons overlaid on the photo — white/semi-transparent for gray circles, solid emerald for Yes
function OverlayButton({ onClick, label, icon, large = false, yes = false }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'rounded-full flex items-center justify-center active:scale-95 transition-all',
        large ? 'w-[4.5rem] h-[4.5rem]' : 'w-12 h-12',
        yes
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400'
          : 'border-2 border-white/30 bg-white/20 backdrop-blur-sm text-white shadow-lg hover:bg-white/30'
      )}
    >
      {icon}
    </button>
  )
}
