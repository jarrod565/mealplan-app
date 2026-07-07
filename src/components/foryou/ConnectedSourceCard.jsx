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
// Structurally a twin of SwipeCard.jsx (Explore) — same shell, same photo/
// footer proportions, same button placement. It differs only in content:
// no Never button, footer shows source_footer instead of a tappable
// ingredients row (ingredients_drawer is always false for Connected
// Sources). Deliberately not sharing a literal component with SwipeCard —
// mirroring the CSS/structure directly keeps Explore untouched while still
// being pixel-equivalent.

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
      {/* ── PHOTO SECTION ── fills all space above the info panel, exactly like SwipeCard */}
      <div className="relative flex-1 overflow-hidden">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.title}
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

        {/* Top gradient — makes the heart legible */}
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

        {/* Heart — top right */}
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

        {/* Action buttons — overlaid on photo near the bottom, top card only. No Never. */}
        {isTop && (flags.yes || flags.no) && (
          <div className="absolute bottom-6 inset-x-0 z-10 flex items-center justify-center gap-8">
            {flags.no && (
              <OverlayButton onClick={handleNoClick} label="Skip" icon={<X className="w-[1.1rem] h-[1.1rem]" />} />
            )}
            {flags.yes && (
              <OverlayButton
                onClick={handleYesClick}
                label="Yes!"
                icon={<Plus className="w-6 h-6" strokeWidth={2.5} />}
                large
                yes
              />
            )}
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
            {card.title || 'Untitled recipe'}
          </h2>
        </div>

        {/* Source footer — static, same rhythm as SwipeCard's ingredients row, not tappable */}
        {flags.sourceFooter && card.source_footer && (
          <div className="w-full flex items-center px-4 py-2.5 pb-3.5 border-t border-border/40">
            <span className="flex-1 text-sm text-muted-foreground truncate">{card.source_footer}</span>
          </div>
        )}
      </div>
    </animated.div>
  )
})

export default ConnectedSourceCard

// Buttons overlaid on the photo — mirrors SwipeCard.jsx's OverlayButton exactly
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
