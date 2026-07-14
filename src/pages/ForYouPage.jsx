import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { useForYouDeck } from '@/hooks/useForYouDeck'
import ConnectedSourceCard from '@/components/foryou/ConnectedSourceCard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Sparkles, Plug, Loader2, SlidersHorizontal, RotateCcw,
} from 'lucide-react'
import UserAvatar from '@/components/layout/UserAvatar'

export default function ForYouPage() {
  const {
    connections, isLoading, isSourceActive, toggleSourceActive, activeSourceIds,
    isBoardActive, toggleBoardActive, activePinterestBoardIds, pinterestBoardNames,
  } = useConnectedSources()
  const hasConnections = connections.length > 0
  const [filterOpen, setFilterOpen] = useState(false)

  const {
    deck, status, errorMessage, hasActiveSources,
    swipeYes, swipeNo, startOver, loadBatch, isFavorited, toggleFavorite,
  } = useForYouDeck()

  // Loads a batch once connections have resolved and at least one source is
  // active, and again immediately any time the active-source set changes —
  // toggling a filter reloads the deck right away instead of waiting for the
  // user to close the drawer and tap Start Over. activeSourceIds/
  // activePinterestBoardIds (not hasActiveSources) are the dependencies that
  // actually change on a toggle between two already-active sources or boards,
  // so they have to be watched directly.
  useEffect(() => {
    if (!isLoading && hasActiveSources) loadBatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasActiveSources, JSON.stringify(activeSourceIds), JSON.stringify(activePinterestBoardIds)])

  return (
    // Same shell as PlanPage — subtract bottom nav height (4rem) on mobile so
    // content never hides behind it, and so `main`'s flex-1 produces a real
    // computed height for the deck to fill, exactly like Explore.
    <div className="flex flex-col h-[calc(100svh-4rem)] md:h-screen">
      <header className="flex items-center justify-between px-5 py-4 border-b shrink-0 bg-background/95 backdrop-blur-sm">
        <h1 className="text-xl font-bold tracking-tight">For You</h1>
        <div className="flex items-center gap-2.5">
          {hasConnections && (
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Filter sources"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-80 p-0">
                <div className="flex items-center px-4 py-3 border-b">
                  <p className="text-base font-semibold">Filter sources</p>
                  <Link
                    to="/settings"
                    onClick={() => setFilterOpen(false)}
                    className="text-sm font-medium text-primary hover:underline ml-4"
                  >
                    Manage
                  </Link>
                </div>

                <div className="px-4 py-2">
                  {connections.flatMap((c) => {
                    // Airtable: one toggle row per connection, unchanged.
                    if (c.source_type !== 'pinterest') {
                      return (
                        <label key={c.id} className="flex items-center gap-3 py-2.5 cursor-pointer">
                          <Switch
                            checked={isSourceActive(c.id)}
                            onCheckedChange={() => toggleSourceActive(c.id)}
                          />
                          <span className="text-sm flex-1 min-w-0 truncate">
                            {c.base_name} / {c.table_name}
                          </span>
                        </label>
                      )
                    }

                    // Pinterest: one toggle row per selected board rather than one
                    // for the whole connection — board names are session-only
                    // (CB_09 policy), read from ConnectedSourcesContext's
                    // pinterestBoardNames rather than persisted anywhere.
                    const boardIds = c.config?.selected_board_ids ?? []
                    return boardIds.map((boardId) => {
                      const boardName = pinterestBoardNames[c.id]?.[boardId]
                      return (
                        <label key={`${c.id}:${boardId}`} className="flex items-center gap-3 py-2.5 cursor-pointer">
                          <Switch
                            checked={isBoardActive(boardId)}
                            onCheckedChange={() => toggleBoardActive(boardId)}
                          />
                          <span className="text-sm flex-1 min-w-0 truncate">
                            Pinterest / {boardName ?? 'Loading…'}
                          </span>
                        </label>
                      )
                    })
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <UserAvatar />
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !hasConnections ? (
          <NoConnectionsEmptyState />
        ) : !hasActiveSources ? (
          <NoActiveSourcesEmptyState onOpenFilter={() => setFilterOpen(true)} />
        ) : status === 'init' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Finding your recipes…</p>
          </div>
        ) : status === 'error' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 max-w-xs mx-auto">
            <p className="text-3xl">😕</p>
            <p className="font-semibold text-lg">Couldn't load your recipes</p>
            <p className="text-sm text-muted-foreground">{errorMessage ?? 'Please try again.'}</p>
            <Button onClick={loadBatch} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Try again
            </Button>
          </div>
        ) : status === 'empty' ? (
          <PoolExhaustedState onChangeFilters={() => setFilterOpen(true)} onStartOver={startOver} />
        ) : (
          // Identical container to PlanPage's card deck — same width, margins,
          // and desktop centering (lg:my-auto within a fixed lg:h-[640px] box).
          <div className="relative flex-1 min-h-0 mx-4 mt-3 mb-5 md:mx-auto md:w-full md:max-w-[420px] md:mt-6 md:mb-8 lg:flex-none lg:my-auto lg:w-[560px] lg:max-w-none lg:h-[640px]">
            {deck.slice(0, 2).map((card, i) => (
              <div
                key={card.card_id}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  zIndex: 10 - i,
                  transform: i === 1 ? 'scale(0.95) translateY(18px)' : undefined,
                  transition: i === 0 ? 'none' : 'transform 0.3s ease-out',
                  pointerEvents: i === 0 ? 'auto' : 'none',
                }}
              >
                <ConnectedSourceCard
                  card={card}
                  isTop={i === 0}
                  onSwipeYes={swipeYes}
                  onSwipeNo={swipeNo}
                  onToggleFavorite={toggleFavorite}
                  isFavorited={isFavorited(card.meal_id)}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function NoConnectionsEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <Sparkles className="w-7 h-7 text-primary/50" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <p className="font-semibold text-base">For You is where your own recipes live</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Connect a source like Airtable and your saved recipes will show up here as swipeable
          cards, right alongside Explore.
        </p>
      </div>
      <Button asChild className="w-full gap-2 max-w-xs">
        <Link to="/settings/connections">
          <Plug className="w-4 h-4" />
          Connect Your Recipes
        </Link>
      </Button>
      {/* "Connect Pinterest" CTA is added here once CB_09 exists — intentionally
          omitted for now rather than shown disabled or as a stub. */}
    </div>
  )
}

// Connections exist but none are toggled on in the filter drawer — distinct
// from both the "nothing connected at all" state above and the "session
// pool exhausted" state below.
function NoActiveSourcesEmptyState({ onOpenFilter }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <SlidersHorizontal className="w-7 h-7 text-primary/50" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <p className="font-semibold text-base">No sources active</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Turn on at least one connected source in Filter to start seeing your recipes.
        </p>
      </div>
      <Button onClick={onOpenFilter} className="w-full gap-2 max-w-xs">
        <SlidersHorizontal className="w-4 h-4" />
        Open Filter
      </Button>
    </div>
  )
}

function PoolExhaustedState({ onChangeFilters, onStartOver }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 max-w-xs mx-auto">
      <p className="text-5xl">🎉</p>
      <p className="font-bold text-xl">You've seen it all!</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        You've gone through all the recipes from your active sources.
      </p>
      <Button onClick={onChangeFilters} variant="outline" className="w-full gap-2">
        <SlidersHorizontal className="w-4 h-4" />
        Change Filters
      </Button>
      <Button onClick={onStartOver} className="w-full gap-2">
        <RotateCcw className="w-4 h-4" />
        Start Over
      </Button>
    </div>
  )
}
