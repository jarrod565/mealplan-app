import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { Heart, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// CB_09: generic Connected Source card — renders any source's card object
// (see airtableAdapter.js for the Airtable shape) driven entirely by
// card.featureFlags. No source-specific logic lives here; a future source
// (Pinterest) only needs an adapter producing the same card shape to work
// with this component unchanged.
//
// Visual spec (CLAUDE.md Design Direction, "Swipe card For You / Pinterest"):
// natural aspect ratio image aligned to top, title, source footer — no
// difficulty/prep time/Never button/ingredients drawer. Swipe mechanics
// mirror SwipeCard.jsx (Explore) for a consistent feel across both decks.

const SWIPE_THRESHOLD = 80
const SNAP_CONFIG = { tension: 350, friction: 40 }

const ConnectedSourceCard = forwardRef(function ConnectedSourceCard(
  { card, isTop, onSwipeYes, onSwipeNo, onToggleFavorite, isFavorited },
  ref
) {
  const flags = card.featureFlags ?? {}
  const [{ x, y, rotate }, api] = useSpring(() => ({ x: 0, y: 0, rotate: 0 }))

  useImperativeHandle(ref, () => ({
    snapBack: () => api.start({ x: 0, y: 0, rotate: 0, config: SNAP_CONFIG }),
  }))

  useEffect(() => {
    if (isTop) api.set({ x: 0, y: 0, rotate: 0 })
  }, [isTop, api])

  const bind = useDrag(
    ({ down, movement: [mx, my], last, cancel }) => {
      if (!isTop) { cancel(); return }

      if (down) {
        api.set({ x: mx, y: my, rotate: mx / 30 })
        return
      }

      if (!last) return

      const swipedRight = flags.yes && mx > SWIPE_THRESHOLD
      const swipedLeft = flags.no && mx < -SWIPE_THRESHOLD

      if (swipedRight) {
        api.start({ x: 700, rotate: 18, config: { duration: 260 }, onRest: () => onSwipeYes(card) })
      } else if (swipedLeft) {
        api.start({ x: -700, rotate: -18, config: { duration: 260 }, onRest: () => onSwipeNo(card) })
      } else {
        api.start({ x: 0, y: 0, rotate: 0, config: SNAP_CONFIG })
      }
    },
    { filterTaps: true, enabled: isTop }
  )

  const yesOpacity = x.to((v) => (isTop ? Math.min(Math.max(v / SWIPE_THRESHOLD, 0), 1) : 0))
  const noOpacity = x.to((v) => (isTop ? Math.min(Math.max(-v / SWIPE_THRESHOLD, 0), 1) : 0))

  function handleHeartClick(e) {
    e.stopPropagation()
    onToggleFavorite(card)
  }
  function handleYesClick(e) {
    e.stopPropagation()
    api.start({ x: 700, rotate: 18, config: { duration: 260 }, onRest: () => onSwipeYes(card) })
  }
  function handleNoClick(e) {
    e.stopPropagation()
    api.start({ x: -700, rotate: -18, config: { duration: 260 }, onRest: () => onSwipeNo(card) })
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
      {/* Photo — flex-1 so it dominates the card like SwipeCard's, instead of a
          fixed aspect ratio that leaves it thumbnail-sized in a taller card. */}
      <div className="relative flex-1 bg-secondary overflow-hidden">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.title}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🍽️</span>
          </div>
        )}

        <animated.div
          style={{ opacity: yesOpacity }}
          className="absolute top-6 left-5 border-4 border-emerald-400 rounded-xl px-3 py-1 rotate-[-15deg] pointer-events-none"
        >
          <span className="text-emerald-400 font-black text-2xl tracking-wide">YES</span>
        </animated.div>
        <animated.div
          style={{ opacity: noOpacity }}
          className="absolute top-6 right-5 border-4 border-red-400 rounded-xl px-3 py-1 rotate-[15deg] pointer-events-none"
        >
          <span className="text-red-400 font-black text-2xl tracking-wide">NOPE</span>
        </animated.div>

        {flags.favorites && (
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
        )}
      </div>

      {/* Info panel — title, source footer, Yes/No only (no Never, no prep/difficulty, no ingredients row).
          shrink-0 (not flex-1): this panel is content-sized so the photo above absorbs all
          leftover space instead of leaving dead space below the text. */}
      <div className="shrink-0 flex flex-col bg-card">
        <div className="px-4 pt-3.5 pb-2">
          <h2 className="font-bold text-base leading-snug text-foreground line-clamp-2">
            {card.title || 'Untitled recipe'}
          </h2>
          {flags.sourceFooter && card.source_footer && (
            <p className="text-xs text-muted-foreground mt-1.5 truncate">{card.source_footer}</p>
          )}
        </div>

        {isTop && (flags.yes || flags.no) && (
          <div className="flex items-center justify-center gap-6 px-4 py-3.5 border-t border-border/40 shrink-0">
            {flags.no && (
              <button
                onClick={handleNoClick}
                aria-label="Skip"
                className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {flags.yes && (
              <button
                onClick={handleYesClick}
                aria-label="Yes"
                className="w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all"
              >
                <Plus className="w-7 h-7" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
      </div>
    </animated.div>
  )
})

export default ConnectedSourceCard
