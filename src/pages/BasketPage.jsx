import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBasket } from '@/contexts/BasketContext'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { fetchMealDetails } from '@/lib/spoonacular'
import { fetchRecipeMetadata, isPinterestUrl, isValidUrl, normalizeUrl } from '@/lib/urlImport'
import { getPinterestPin } from '@/lib/pinterest'
import { pinterestPinImageUrl, resolveViewRecipeUrl } from '@/lib/pinterestAdapter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import UserAvatar from '@/components/layout/UserAvatar'
import { Clock, Loader2, ShoppingBasket, ChevronRight, Trash2, X, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { cn, formatIngredientQty } from '@/lib/utils'

export default function BasketPage() {
  const { basketItems, basketCount, removeFromBasket, addToBasket } = useBasket()
  const { connections, activeSourceIds, activePinterestBoardIds } = useConnectedSources()

  // Same "active connected source" definition useForYouDeck uses to decide
  // whether the For You deck has anything to show: Airtable is active at the
  // connection level, Pinterest is active only if at least one of its
  // selected boards is toggled on.
  const hasActiveConnection = connections.some((c) => {
    if (c.status !== 'connected') return false
    if (c.source_type === 'pinterest') {
      const boardIds = c.config?.selected_board_ids ?? []
      return boardIds.some((id) => activePinterestBoardIds.includes(id))
    }
    return activeSourceIds.includes(c.id)
  })

  const [openMealId, setOpenMealId] = useState(null)
  const [drawerDetails, setDrawerDetails] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [pinterestPinData, setPinterestPinData] = useState({})
  const cacheRef = useRef({})
  const inputRef = useRef(null)

  const pinterestConnection = connections.find((c) => c.source_type === 'pinterest' && c.status === 'connected')

  // CB_09: "Basket display re-fetches pin title/image from Pinterest API
  // using stored pin_id." Only pin_id/destination_url are ever persisted for
  // Pinterest basket entries — title/image live only in this session's React
  // state, re-fetched fresh every time the basket renders.
  useEffect(() => {
    if (!pinterestConnection) return
    const unresolved = basketItems.filter(
      (m) => m.source_type === 'pinterest' && !pinterestPinData[m.meal_id]
    )
    if (unresolved.length === 0) return

    let cancelled = false
    Promise.all(
      unresolved.map(async (item) => {
        const pinId = item.meal_id.slice('pinterest:'.length)
        try {
          const pin = await getPinterestPin(pinterestConnection.access_token, pinId)
          return [item.meal_id, {
            title: pin.title || pin.description || null,
            image_url: pinterestPinImageUrl(pin),
          }]
        } catch {
          return [item.meal_id, { title: null, image_url: null }]
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setPinterestPinData((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketItems, pinterestConnection])

  // Basket items with Pinterest display data (title/image) merged back in for
  // rendering only — the underlying basketItems/Supabase rows never gain
  // this data, per CB_09's storage policy.
  const displayItems = basketItems.map((m) => {
    if (m.source_type !== 'pinterest') return m
    const pinData = pinterestPinData[m.meal_id]
    if (!pinData) return m
    return {
      ...m,
      title: pinData.title || m.title,
      name: pinData.title || m.name,
      image_url: pinData.image_url || m.image_url,
      photo_url: pinData.image_url || m.photo_url,
    }
  })

  useEffect(() => {
    if (!openMealId) return

    const selectedMeal = basketItems.find((m) => m.meal_id === openMealId) ?? null
    if (cacheRef.current[openMealId]) {
      setDrawerDetails(cacheRef.current[openMealId])
      setDrawerLoading(false)
      return
    }

    setDrawerLoading(true)
    setDrawerDetails(null)

    fetchMealDetails(openMealId, selectedMeal)
      .then((data) => {
        cacheRef.current[openMealId] = data
        setDrawerDetails(data)
      })
      .catch(() => {
        const fallback = {
          error: true,
          source_type: selectedMeal?.source_type || 'spoonacular',
          title: selectedMeal?.title || selectedMeal?.name,
          destination_url: selectedMeal?.destination_url || null,
        }
        setDrawerDetails(fallback)
      })
      .finally(() => setDrawerLoading(false))
  }, [openMealId, basketItems])

  const openMeal = displayItems.find((m) => m.meal_id === openMealId) ?? null
  const viewRecipeUrl = resolveViewRecipeUrl(openMeal)

  function handleOpenMeal(mealId) {
    setOpenMealId(mealId)
  }

  function handleCloseDrawer() {
    setOpenMealId(null)
  }

  async function handleAddMeal() {
    const rawValue = urlInput.trim()
    if (!isValidUrl(rawValue)) {
      setUrlError('Please enter a valid URL')
      inputRef.current?.focus()
      return
    }

    const normalizedUrl = normalizeUrl(rawValue)
    const duplicate = basketItems.some((item) => item.destination_url === normalizedUrl)
    if (duplicate) {
      setConfirmState({ type: 'duplicate', url: normalizedUrl })
      setUrlError('')
      return
    }

    if (isPinterestUrl(normalizedUrl)) {
      setUrlError('Pinterest links work best through the Pinterest integration. Open Settings → Integrations to connect Pinterest.')
      inputRef.current?.focus()
      return
    }

    setIsImporting(true)
    setUrlError('')

    try {
      const metadata = await fetchRecipeMetadata(normalizedUrl)
      if (!metadata.title) {
        setUrlError("We couldn't read this page. Check the link and try again.")
        return
      }

      if (!metadata.looksLikeRecipe) {
        setConfirmState({ type: 'recipe', url: normalizedUrl, metadata })
        return
      }

      await addImportedMeal(normalizedUrl, metadata)
    } catch (error) {
      if (error?.type === 'timeout') {
        setUrlError('This is taking too long. Check the link and try again.')
      } else if (error?.type === 'page_unreadable') {
        setUrlError("We couldn't read this page. Check the link and try again.")
      } else {
        setUrlError("We couldn't reach this page. Check the link and try again.")
      }
    } finally {
      setIsImporting(false)
    }
  }

  async function addImportedMeal(url, metadata) {
    const uniqueId = `url-import:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const meal = {
      meal_id: uniqueId,
      name: metadata.title || 'Imported recipe',
      photo_url: metadata.image_url || null,
      source_type: 'url_import',
      destination_url: normalizeUrl(url),
      title: metadata.title || 'Imported recipe',
      image_url: metadata.image_url || null,
      source_domain: metadata.source_domain || null,
      added_at: new Date().toISOString(),
    }

    await addToBasket(meal)
    setUrlInput('')
    setUrlError('')
    setConfirmState(null)
  }

  async function handleConfirmImport() {
    if (!confirmState) return
    if (confirmState.type === 'duplicate') {
      const metadata = await fetchRecipeMetadata(confirmState.url)
      if (!metadata.title) {
        setUrlError("We couldn't read this page. Check the link and try again.")
        setConfirmState(null)
        return
      }
      await addImportedMeal(confirmState.url, metadata)
      return
    }

    await addImportedMeal(confirmState.url, confirmState.metadata)
  }

  if (basketCount === 0) {
    return (
      <>
        <PageHeader title="Basket" />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <ShoppingBasket className="w-7 h-7 text-primary/50" />
            </div>
            <div>
              <p className="font-semibold text-base">Your basket is empty</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Swipe right on meals you'd like to cook this week.
              </p>
            </div>
            {hasActiveConnection ? (
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <Button asChild className="flex-1">
                  <Link to="/for-you">Start Swiping</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/plan">Explore Meals</Link>
                </Button>
              </div>
            ) : (
              <Button asChild>
                <Link to="/plan">Start swiping</Link>
              </Button>
            )}
          </div>

          <div className="mt-6 rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={urlInput}
                onChange={(event) => {
                  setUrlInput(event.target.value)
                  if (urlError) setUrlError('')
                }}
                onKeyDown={(event) => event.key === 'Enter' && handleAddMeal()}
                placeholder="Paste a recipe URL"
                disabled={isImporting}
                aria-label="Paste a recipe URL"
                className="flex-1 h-11"
              />
              <Button onClick={handleAddMeal} disabled={isImporting || !urlInput.trim()} className="gap-2 h-11 text-base shrink-0">
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding meal…
                  </>
                ) : (
                  <>
                    Add Meal
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
            {urlError && <p className="text-sm text-destructive">{urlError}</p>}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Basket"
        subtitle={`${basketCount} meal${basketCount !== 1 ? 's' : ''}`}
      />

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="space-y-3">
          {displayItems.map((meal) => (
            <BasketCard
              key={meal.meal_id}
              meal={meal}
              onOpen={() => handleOpenMeal(meal.meal_id)}
              onRemove={() => removeFromBasket(meal.meal_id)}
            />
          ))}
        </div>

        <Separator className="my-6" />

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={urlInput}
              onChange={(event) => {
                setUrlInput(event.target.value)
                if (urlError) setUrlError('')
              }}
              onKeyDown={(event) => event.key === 'Enter' && handleAddMeal()}
              placeholder="Paste a recipe URL"
              disabled={isImporting}
              aria-label="Paste a recipe URL"
              className="flex-1 h-11"
            />
            <Button onClick={handleAddMeal} disabled={isImporting || !urlInput.trim()} className="gap-2 h-11 text-base shrink-0">
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding meal…
                </>
              ) : (
                <>
                  Add Meal
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
          {urlError && <p className="text-sm text-destructive">{urlError}</p>}
        </div>

        <Button asChild className="w-full gap-2 h-11 text-base mt-6">
          <Link to="/ingredients">
            View Ingredients List
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <Sheet open={openMealId !== null} onOpenChange={(v) => !v && handleCloseDrawer()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 w-full sm:max-w-sm flex flex-col"
        >
          {/* Photo header */}
          <div className="relative shrink-0 h-48 bg-secondary">
            {(openMeal?.image_url || openMeal?.photo_url) ? (
              <img
                src={openMeal.image_url || openMeal.photo_url}
                alt={openMeal.title || openMeal.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl">🍽️</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

            <SheetClose className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </SheetClose>

            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <SheetTitle className="text-white font-bold text-lg leading-snug line-clamp-2">
                {openMeal?.title || openMeal?.name}
              </SheetTitle>
              {(openMeal?.prep_time != null || openMeal?.difficulty) && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {openMeal.prep_time != null && (
                    <span className="inline-flex items-center gap-1 bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white/90 font-medium">
                      <Clock className="w-3 h-3" />
                      {openMeal.prep_time} min
                    </span>
                  )}
                  {openMeal?.difficulty && (
                    <span className="inline-flex items-center bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white/90 font-medium">
                      {openMeal.difficulty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ingredient list */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {viewRecipeUrl && (
              <Button variant="outline" size="sm" asChild className="mb-4 gap-1.5">
                <a href={viewRecipeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Recipe
                </a>
              </Button>
            )}
            <p className="text-[11px] font-bold text-primary/70 uppercase tracking-widest mb-4">
              {drawerLoading
                ? 'Loading ingredients…'
                : drawerDetails?.error
                  ? 'Ingredients unavailable'
                  : drawerDetails?.source_type === 'url_import' || drawerDetails?.source_type === 'airtable' || drawerDetails?.source_type === 'pinterest'
                    ? 'Ingredients extracted'
                    : `Ingredients${drawerDetails?.ingredients?.length ? ` · ${drawerDetails.ingredients.length}` : ''}`}
            </p>

            {drawerLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Fetching ingredients…
              </div>
            )}

            {!drawerLoading && drawerDetails?.error && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t extract ingredients for this recipe. You can still open the source page and add the ingredients manually.
                </p>
                {drawerDetails?.destination_url && (
                  <a
                    href={drawerDetails.destination_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-sm font-medium text-primary underline underline-offset-4"
                  >
                    View recipe
                  </a>
                )}
              </div>
            )}

            {!drawerLoading && drawerDetails?.ingredients?.length > 0 && (
              <ul className="space-y-3">
                {drawerDetails.ingredients.map((ing) => {
                  const qty = formatIngredientQty(ing.amount, ing.unit)
                  return (
                    <li key={ing.id} className="flex items-baseline gap-3">
                      {qty && (
                        <span className={cn(
                          'shrink-0 min-w-[64px] text-right text-xs font-semibold text-muted-foreground',
                          qty !== 'to taste' && 'tabular-nums'
                        )}>
                          {qty}
                        </span>
                      )}
                      <span className="text-sm text-foreground leading-snug">{ing.name}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.type === 'duplicate' ? 'This recipe is already in your basket. Add it again?' : 'This doesn\'t look like a recipe page. Do you still want to add it?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.type === 'duplicate'
                ? 'You already added this link once. Adding it again will create a second basket entry.'
                : 'We couldn\'t confirm that this page is a recipe, but you can still add it and review it later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>Add Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PageHeader({ title, subtitle }) {
  return (
    <header className="flex items-center justify-between px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <UserAvatar />
    </header>
  )
}

function BasketCard({ meal, onOpen, onRemove }) {
  const isUrlImport = meal.source_type === 'url_import'
  const displayName = meal.title || meal.name
  const displayImage = meal.image_url || meal.photo_url

  return (
    <div className="flex items-stretch rounded-2xl bg-card shadow-sm overflow-hidden">
      {/* Square thumbnail */}
      <button
        onClick={onOpen}
        className="shrink-0 w-24 h-24"
        aria-label={`View ingredients for ${meal.name}`}
        tabIndex={-1}
      >
        {displayImage ? (
          <img
            src={displayImage}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <span className="text-2xl">🍽️</span>
          </div>
        )}
      </button>

      {/* Content */}
      <button
        onClick={onOpen}
        className="flex-1 min-w-0 px-4 py-3 text-left hover:bg-secondary/20 active:bg-secondary/40 transition-colors"
        aria-label={`View ingredients for ${meal.name}`}
      >
        {meal.difficulty && (
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-0.5">
            {meal.difficulty}
          </p>
        )}
        <p className="font-semibold text-sm leading-snug line-clamp-2 text-foreground">
          {displayName}
        </p>
        {isUrlImport && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <LinkIcon className="w-3 h-3" />
            Imported by URL
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          {meal.prep_time != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {meal.prep_time} min
            </span>
          )}
          {meal.prep_time != null && (
            <span className="text-border">·</span>
          )}
          {meal.source_domain && (
            <span className="truncate">{meal.source_domain}</span>
          )}
          {!meal.source_domain && (
            <span className="text-primary font-medium">Ingredients</span>
          )}
        </div>
      </button>

      {/* Trash */}
      <button
        onClick={onRemove}
        className="shrink-0 px-4 flex items-center text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`Remove ${displayName} from basket`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
