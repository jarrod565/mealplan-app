import { useState, useEffect, useRef } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useBasket } from '@/contexts/BasketContext'
import { useAuth } from '@/contexts/AuthContext'
import { useShoppingList } from '@/contexts/ShoppingListContext'
import { useHistory } from '@/contexts/HistoryContext'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { fetchMealDetails } from '@/lib/spoonacular'
import { getPinterestPin } from '@/lib/pinterest'
import { pinterestPinImageUrl } from '@/lib/pinterestAdapter'
import { aggregateIngredients, aisleToCategory, CATEGORIES } from '@/lib/units'
import { Button } from '@/components/ui/button'
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
import { cn, formatIngredientQty } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Loader2, Minus, Plus, ChevronRight,
  List, LayoutGrid, AlertTriangle, PlusCircle,
} from 'lucide-react'
import UserAvatar from '@/components/layout/UserAvatar'

void aisleToCategory // exported for external use; suppress unused import warning

function computeList(detailsMap, servingOverrides, basketItems, householdServings) {
  const contributions = basketItems
    .filter(m => detailsMap[m.meal_id]?.status === 'loaded')
    .map(m => {
      const details = detailsMap[m.meal_id].data
      const adjusted = servingOverrides[m.meal_id] ?? householdServings
      const multiplier = adjusted / (details.servings || 2)
      return { mealId: m.meal_id, ingredients: details.ingredients, multiplier }
    })
  return aggregateIngredients(contributions)
}

export default function IngredientsPage() {
  const { basketItems, clearBasket } = useBasket()
  const { subscription } = useAuth()
  const { items: existingItems, generateShoppingList } = useShoppingList()
  const { writeHistory } = useHistory()
  const { connections } = useConnectedSources()
  const navigate = useNavigate()

  const householdServings = subscription?.default_serving_size ?? 2
  const pinterestConnection = connections.find((c) => c.source_type === 'pinterest' && c.status === 'connected')

  const [detailsMap, setDetailsMap] = useState({})
  const [pinterestPinData, setPinterestPinData] = useState({})
  const [servingOverrides, setServingOverrides] = useState({})
  const [listItems, setListItems] = useState(null)
  const [viewMode, setViewMode] = useState('grouped')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)
  const [customForm, setCustomForm] = useState({ name: '', quantity: '', unit: '', category: 'Other' })
  const [isGenerating, setIsGenerating] = useState(false)
  const [emptyBasketOnGenerate, setEmptyBasketOnGenerate] = useState(false)

  const initializedRef = useRef(false)

  // Fetch all meal details when basket items change
  useEffect(() => {
    if (!basketItems.length) return
    const ids = basketItems.map(m => m.meal_id)
    console.log('[Ingredients] initializing detailsMap for ids', ids)
    setDetailsMap(Object.fromEntries(ids.map(id => [id, { status: 'loading', data: null }])))
    ids.forEach(async (mealId) => {
      const meal = basketItems.find(item => item.meal_id === mealId) ?? null
      console.log('[Ingredients] starting fetch for', mealId, 'source_type=', meal?.source_type)
      try {
        const data = await fetchMealDetails(mealId, meal)
        console.log('[Ingredients] fetched details for', mealId, data)
        setDetailsMap(prev => ({ ...prev, [mealId]: { status: 'loaded', data } }))
      } catch (err) {
        console.log('[Ingredients] failed to fetch details for', mealId, err)
        setDetailsMap(prev => ({ ...prev, [mealId]: { status: 'error', data: null } }))
      }
    })
  }, [basketItems]) // eslint-disable-line react-hooks/exhaustive-deps

  // CB_09: re-fetch pin title/image from Pinterest API using stored pin_id,
  // same pattern as BasketPage.jsx/HistoryPage.jsx — only pin_id is persisted
  // for Pinterest basket entries, title/image live only in local state.
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

  // Initialize list once all fetches complete
  useEffect(() => {
    if (initializedRef.current || !basketItems.length) return
    const allDone = basketItems.every(m => {
      const s = detailsMap[m.meal_id]
      return s?.status === 'loaded' || s?.status === 'error'
    })
    if (!allDone) return
    initializedRef.current = true
    setListItems(computeList(detailsMap, {}, basketItems, householdServings))
  }, [detailsMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute when serving overrides change (after initialization)
  useEffect(() => {
    if (!initializedRef.current) return
    setListItems(computeList(detailsMap, servingOverrides, basketItems, householdServings))
  }, [servingOverrides]) // eslint-disable-line react-hooks/exhaustive-deps

  // Safe to conditionally return after all hooks. Skip this redirect while a
  // generate is in flight — clearBasket() (when "Empty the basket" is checked)
  // empties basketItems before the explicit navigate('/shopping-list') below
  // runs, and without this guard that race sends the user to /basket instead.
  if (basketItems.length === 0 && !isGenerating) return <Navigate to="/basket" replace />

  function adjustServing(mealId, delta) {
    setServingOverrides(prev => {
      const current = prev[mealId] ?? householdServings
      return { ...prev, [mealId]: Math.max(1, current + delta) }
    })
  }

  function removeItem(id) {
    setListItems(prev => prev.filter(i => i.id !== id))
  }

  function startEdit(id, quantity) {
    setEditingId(id)
    setEditValue(String(quantity ?? ''))
  }

  function saveEdit(id) {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed) && parsed > 0) {
      setListItems(prev => prev.map(i => (i.id === id ? { ...i, quantity: parsed } : i)))
    }
    setEditingId(null)
    setEditValue('')
  }

  function addCustomItem() {
    const name = customForm.name.trim()
    if (!name) return
    const qty = parseFloat(customForm.quantity)
    const item = {
      id: `custom::${Date.now()}::${Math.random()}`,
      name,
      quantity: isNaN(qty) ? null : qty,
      unit: customForm.unit.trim(),
      category: customForm.category,
      isCustom: true,
      sourceMealIds: [],
    }
    setListItems(prev => [...(prev ?? []), item])
    setCustomForm({ name: '', quantity: '', unit: '', category: 'Other' })
    setShowCustomForm(false)
  }

  function dismissMeal(mealId) {
    const next = { ...detailsMap, [mealId]: { status: 'dismissed', data: null } }
    setDetailsMap(next)
    setListItems(computeList(next, servingOverrides, basketItems, householdServings))
  }

  function handleGenerate() {
    if (!listItems?.length) return
    if (existingItems.length > 0) {
      setShowReplaceDialog(true)
      return
    }
    doGenerate()
  }

  async function doGenerate() {
    setShowReplaceDialog(false)
    setIsGenerating(true)
    try {
      await generateShoppingList(listItems)
      // Fire-and-forget: History must never delay navigation or surface its
      // own errors — the shopping list is what the user is waiting on.
      writeHistory(basketItems)
      if (emptyBasketOnGenerate) await clearBasket()
      navigate('/shopping-list')
    } catch {
      toast.error('Could not generate shopping list. Please try again.')
      setIsGenerating(false)
    }
  }

  const isLoading = listItems === null
  const visibleMeals = basketItems
    .filter(m => detailsMap[m.meal_id]?.status !== 'dismissed')
    .map(m => {
      if (m.source_type !== 'pinterest') return m
      const pinData = pinterestPinData[m.meal_id]
      if (!pinData) return m
      return {
        ...m,
        name: pinData.title || m.name,
        photo_url: pinData.image_url || m.photo_url,
      }
    })
  const errorMeals = visibleMeals.filter(m => detailsMap[m.meal_id]?.status === 'error')
  const allFailed = !isLoading && visibleMeals.length > 0 && errorMeals.length === visibleMeals.length
  const activeItems = listItems ?? []
  const flatItems = [...activeItems].sort((a, b) => a.name.localeCompare(b.name))
  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = activeItems.filter(i => (i.category || 'Other') === cat)
    return acc
  }, {})

  return (
    <>
    <header className="flex items-center justify-between px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="text-xl font-bold tracking-tight">Ingredients</h1>
      <UserAvatar />
    </header>
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* View toggle */}
      <div className="flex items-center justify-end mb-5">
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode('grouped')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
              viewMode === 'grouped' ? 'bg-secondary text-primary font-semibold' : 'text-muted-foreground'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Grouped
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
              viewMode === 'flat' ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            <List className="w-3.5 h-3.5" />
            Flat
          </button>
        </div>
      </div>

      {/* Meal serving adjusters */}
      <div className="space-y-2 mb-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Servings per meal</p>
        {visibleMeals.map(meal => (
          <MealServingRow
            key={meal.meal_id}
            meal={meal}
            status={detailsMap[meal.meal_id]?.status ?? 'loading'}
            adjusted={servingOverrides[meal.meal_id] ?? householdServings}
            onAdjust={(delta) => adjustServing(meal.meal_id, delta)}
            onDismiss={() => dismissMeal(meal.meal_id)}
          />
        ))}
      </div>

      {/* Ingredient list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Fetching ingredients…</p>
        </div>
      ) : allFailed ? (
        <div className="py-12 text-center">
          <p className="text-4xl mb-3">😕</p>
          <p className="font-semibold text-sm">Couldn't load ingredients</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
            Ingredient data wasn't available for your selected meals. Go back to your basket and try swapping in different meals.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/basket">Back to basket</Link>
          </Button>
        </div>
      ) : activeItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No ingredients found. Add a custom item or adjust your basket.
        </div>
      ) : (
        <div className="mb-4">
          {viewMode === 'flat'
            ? flatItems.map(item => (
                <IngredientRow
                  key={item.id}
                  item={item}
                  isEditing={editingId === item.id}
                  editValue={editValue}
                  onEditStart={() => startEdit(item.id, item.quantity)}
                  onEditChange={setEditValue}
                  onEditSave={() => saveEdit(item.id)}
                  onRemove={() => removeItem(item.id)}
                />
              ))
            : CATEGORIES.map(cat => {
                const items = grouped[cat]
                if (!items?.length) return null
                return (
                  <div key={cat} className="mb-2">
                    <p className="text-[11px] font-bold text-primary/60 uppercase tracking-widest mb-1 mt-4 first:mt-0 px-1">
                      {cat}
                    </p>
                    {items.map(item => (
                      <IngredientRow
                        key={item.id}
                        item={item}
                        isEditing={editingId === item.id}
                        editValue={editValue}
                        onEditStart={() => startEdit(item.id, item.quantity)}
                        onEditChange={setEditValue}
                        onEditSave={() => saveEdit(item.id)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                  </div>
                )
              })}
        </div>
      )}

      {/* Add custom ingredient */}
      {!showCustomForm ? (
        <button
          onClick={() => setShowCustomForm(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add custom ingredient
        </button>
      ) : (
        <AddCustomForm
          form={customForm}
          onChange={setCustomForm}
          onAdd={addCustomItem}
          onCancel={() => setShowCustomForm(false)}
        />
      )}

      {/* Generate Shopping List */}
      <div className="mt-6 pt-4 border-t">
        <Button
          className="w-full gap-2 h-11 text-base"
          disabled={isLoading || activeItems.length === 0 || isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate Shopping List
          {!isGenerating && activeItems.length > 0 && (
            <span className="text-xs opacity-70">{activeItems.length} items</span>
          )}
          {!isGenerating && <ChevronRight className="w-4 h-4" />}
        </Button>
        <label className="flex items-center justify-center gap-2 mt-4 mx-auto text-xs text-muted-foreground select-none cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={emptyBasketOnGenerate}
            onChange={(event) => setEmptyBasketOnGenerate(event.target.checked)}
            className="w-3.5 h-3.5 rounded border-input accent-primary"
          />
          Empty the basket
        </label>
      </div>

      {/* Replace existing list confirmation */}
      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing list?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a shopping list. Generating a new one will permanently replace it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doGenerate}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  )
}

function MealServingRow({ meal, status, adjusted, onAdjust, onDismiss }) {
  const isError = status === 'error'
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-3', isError && 'opacity-60')}>
      {meal.photo_url ? (
        <img
          src={meal.photo_url}
          alt={meal.name}
          className={cn('w-10 h-10 rounded-lg object-cover shrink-0', isError && 'grayscale')}
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-base">
          🍽️
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium leading-snug truncate">{meal.name}</p>
          {status === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />}
          {isError && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
        </div>
        {isError && (
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <button
              onClick={onDismiss}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Remove from list
            </button>
            {meal.destination_url && (
              <a
                href={meal.destination_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                View recipe
              </a>
            )}
          </div>
        )}
      </div>
      {!isError && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onAdjust(-1)}
            disabled={adjusted <= 1}
            className="w-6 h-6 flex items-center justify-center rounded-full border disabled:opacity-30 hover:bg-secondary transition-colors"
            aria-label="Decrease servings"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-14 text-center text-sm font-medium tabular-nums">
            {adjusted} <span className="text-xs text-muted-foreground font-normal">srv</span>
          </span>
          <button
            onClick={() => onAdjust(1)}
            className="w-6 h-6 flex items-center justify-center rounded-full border hover:bg-secondary transition-colors"
            aria-label="Increase servings"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// Width (px) of the "Remove" button revealed by a left swipe
const REVEAL_WIDTH = 88

function IngredientRow({ item, isEditing, editValue, onEditStart, onEditChange, onEditSave, onRemove }) {
  const isToTaste = item.unit?.toLowerCase() === 'servings'
  const isCombined = (item.extras?.length ?? 0) > 0
  const canEdit = !isToTaste && !isCombined
  const displayQty = isToTaste
    ? 'to taste'
    : formatIngredientQty(item.quantity, item.unit, item.extras)

  const [{ x }, api] = useSpring(() => ({ x: 0 }))
  const revealedRef = useRef(false)

  const bind = useDrag(
    ({ down, movement: [mx], last, tap }) => {
      if (tap) return
      const base = revealedRef.current ? -REVEAL_WIDTH : 0
      const next = Math.min(0, Math.max(-REVEAL_WIDTH, base + mx))
      if (down) {
        api.start({ x: next, immediate: true })
        return
      }
      if (!last) return
      const shouldOpen = next < -REVEAL_WIDTH / 2
      revealedRef.current = shouldOpen
      api.start({ x: shouldOpen ? -REVEAL_WIDTH : 0 })
    },
    // No pointer: { touch } restriction — mouse drag works on desktop too
    { axis: 'x', filterTaps: true }
  )

  // A tap anywhere on the row while it's revealed just closes it, matching
  // the iOS swipe-to-delete convention — it never triggers edit/etc underneath.
  function handleRowClickCapture(e) {
    if (revealedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      revealedRef.current = false
      api.start({ x: 0 })
    }
  }

  return (
    <div className="relative overflow-hidden rounded-md">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_WIDTH }}>
        <button
          onClick={onRemove}
          className="flex-1 flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-semibold"
          aria-label={`Remove ${item.name}`}
        >
          Remove
        </button>
      </div>
      <animated.div
        {...bind()}
        onClickCapture={handleRowClickCapture}
        style={{ x, touchAction: 'pan-y' }}
        className="relative flex items-center gap-2 px-1 py-1.5 bg-background"
      >
        <span className="flex-1 text-sm">{item.name}</span>
        {isEditing && canEdit ? (
          <input
            type="number"
            min="0"
            step="0.25"
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onEditSave}
            onKeyDown={e => e.key === 'Enter' && onEditSave()}
            autoFocus
            className="w-16 text-right text-sm border rounded px-1.5 py-0.5 bg-background"
          />
        ) : (
          <button
            onClick={canEdit ? onEditStart : undefined}
            disabled={!canEdit}
            className="text-sm text-right text-muted-foreground hover:text-foreground transition-colors rounded px-1 shrink-0 disabled:pointer-events-none"
            title={canEdit ? 'Tap to edit quantity' : undefined}
          >
            {displayQty}
          </button>
        )}
      </animated.div>
    </div>
  )
}

function AddCustomForm({ form, onChange, onAdd, onCancel }) {
  function update(field, value) {
    onChange(prev => ({ ...prev, [field]: value }))
  }
  return (
    <div className="rounded-xl border p-3 space-y-2 mt-1">
      <p className="text-xs font-medium text-muted-foreground">Add custom ingredient</p>
      <input
        type="text"
        placeholder="Name *"
        value={form.name}
        onChange={e => update('name', e.target.value)}
        className="w-full text-sm border rounded-md px-2.5 py-1.5 bg-background"
      />
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Qty"
          min="0"
          step="0.25"
          value={form.quantity}
          onChange={e => update('quantity', e.target.value)}
          className="w-20 text-sm border rounded-md px-2.5 py-1.5 bg-background"
        />
        <input
          type="text"
          placeholder="Unit"
          value={form.unit}
          onChange={e => update('unit', e.target.value)}
          className="flex-1 text-sm border rounded-md px-2.5 py-1.5 bg-background"
        />
        <select
          value={form.category}
          onChange={e => update('category', e.target.value)}
          className="flex-1 text-sm border rounded-md px-2.5 py-1.5 bg-background"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onAdd} disabled={!form.name.trim()}>Add</Button>
      </div>
    </div>
  )
}
