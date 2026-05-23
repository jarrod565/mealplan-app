import { useState, useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useBasket } from '@/contexts/BasketContext'
import { useAuth } from '@/contexts/AuthContext'
import { useShoppingList } from '@/contexts/ShoppingListContext'
import { fetchMealDetails } from '@/lib/spoonacular'
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
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Loader2, Minus, Plus, X, ChevronRight,
  List, LayoutGrid, AlertTriangle, PlusCircle,
} from 'lucide-react'

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
  const { basketItems } = useBasket()
  const { subscription } = useAuth()
  const { items: existingItems, generateShoppingList } = useShoppingList()
  const navigate = useNavigate()

  const householdServings = subscription?.default_serving_size ?? 2

  const [detailsMap, setDetailsMap] = useState({})
  const [servingOverrides, setServingOverrides] = useState({})
  const [listItems, setListItems] = useState(null)
  const [viewMode, setViewMode] = useState('grouped')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)
  const [customForm, setCustomForm] = useState({ name: '', quantity: '', unit: '', category: 'Other' })
  const [isGenerating, setIsGenerating] = useState(false)

  const initializedRef = useRef(false)

  // Fetch all meal details on mount
  useEffect(() => {
    if (!basketItems.length) return
    const ids = basketItems.map(m => m.meal_id)
    setDetailsMap(Object.fromEntries(ids.map(id => [id, { status: 'loading', data: null }])))
    ids.forEach(async (mealId) => {
      try {
        const data = await fetchMealDetails(mealId)
        setDetailsMap(prev => ({ ...prev, [mealId]: { status: 'loaded', data } }))
      } catch {
        setDetailsMap(prev => ({ ...prev, [mealId]: { status: 'error', data: null } }))
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Safe to conditionally return after all hooks
  if (basketItems.length === 0) return <Navigate to="/basket" replace />

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
      navigate('/shopping-list')
    } catch {
      toast.error('Could not generate shopping list. Please try again.')
      setIsGenerating(false)
    }
  }

  const isLoading = listItems === null
  const errorMeals = basketItems.filter(m => detailsMap[m.meal_id]?.status === 'error')
  const activeItems = listItems ?? []
  const flatItems = [...activeItems].sort((a, b) => a.name.localeCompare(b.name))
  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = activeItems.filter(i => (i.category || 'Other') === cat)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Ingredients</h1>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode('grouped')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
              viewMode === 'grouped' ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground'
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
        {basketItems.map(meal => (
          <MealServingRow
            key={meal.meal_id}
            meal={meal}
            status={detailsMap[meal.meal_id]?.status ?? 'loading'}
            adjusted={servingOverrides[meal.meal_id] ?? householdServings}
            onAdjust={(delta) => adjustServing(meal.meal_id, delta)}
          />
        ))}
      </div>

      {/* Error banners for failed meals */}
      {errorMeals.map(meal => (
        <div
          key={meal.meal_id}
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 mb-3 text-xs text-destructive"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Could not load ingredients for <span className="font-medium ml-1">{meal.name}</span> — excluded from list.
        </div>
      ))}

      {/* Ingredient list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Fetching ingredients…</p>
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
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-4 first:mt-0 px-1">
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
          className="w-full gap-2"
          disabled={isLoading || activeItems.length === 0 || isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate Shopping List
          {!isGenerating && activeItems.length > 0 && (
            <>
              <span className="ml-auto text-xs opacity-70">{activeItems.length} items</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
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
  )
}

function MealServingRow({ meal, status, adjusted, onAdjust }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      {meal.photo_url ? (
        <img
          src={meal.photo_url}
          alt={meal.name}
          className="w-10 h-10 rounded-lg object-cover shrink-0"
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
          {status === 'error' && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
        </div>
      </div>
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
    </div>
  )
}

function IngredientRow({ item, isEditing, editValue, onEditStart, onEditChange, onEditSave, onRemove }) {
  const displayQty =
    item.quantity == null
      ? ''
      : Number.isInteger(item.quantity)
        ? item.quantity
        : Number(item.quantity.toFixed(2))

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-secondary/40 group">
      <span className="flex-1 text-sm">{item.name}</span>
      {isEditing ? (
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
          onClick={onEditStart}
          className="text-sm text-right text-muted-foreground hover:text-foreground transition-colors rounded px-1 shrink-0"
          title="Tap to edit quantity"
        >
          {displayQty} {item.unit}
        </button>
      )}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
        aria-label={`Remove ${item.name}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
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
