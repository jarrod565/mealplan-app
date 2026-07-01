import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const BasketContext = createContext(null)

const GUEST_KEY = 'guest_basket'

export function BasketProvider({ children }) {
  const { subscription, isGuest } = useAuth()
  const [basketItems, setBasketItems] = useState([])
  const [pendingReturns, setPendingReturns] = useState([])

  useEffect(() => {
    if (isGuest) {
      const stored = localStorage.getItem(GUEST_KEY)
      setBasketItems(stored ? JSON.parse(stored) : [])
      return
    }
    if (!subscription?.id) return
    supabase
      .from('basket_items')
      .select('*')
      .eq('subscription_id', subscription.id)
      .order('added_at', { ascending: true })
      .then(({ data }) => setBasketItems(data ?? []))
  }, [subscription?.id, isGuest])

  async function addToBasket(meal) {
    const item = {
      meal_id: meal.meal_id,
      name: meal.name,
      photo_url: meal.photo_url ?? null,
      prep_time: meal.prep_time ?? null,
      servings: meal.servings ?? null,
      difficulty: meal.difficulty ?? null,
      source_type: meal.source_type ?? 'spoonacular',
      destination_url: meal.destination_url ?? null,
      title: meal.title ?? null,
      image_url: meal.image_url ?? null,
      source_domain: meal.source_domain ?? null,
      added_at: meal.added_at ?? new Date().toISOString(),
    }

    if (isGuest) {
      setBasketItems((prev) => {
        const next = [...prev.filter((b) => b.meal_id !== meal.meal_id), item]
        localStorage.setItem(GUEST_KEY, JSON.stringify(next))
        return next
      })
      return
    }
    if (!subscription?.id) throw new Error('No subscription — please sign out and sign back in.')

    const persistedItem = {
      subscription_id: subscription.id,
      ...item,
    }

    let data
    if (meal.source_type === 'url_import') {
      const { data: inserted, error } = await supabase
        .from('basket_items')
        .insert(persistedItem)
        .select()
        .single()
      if (error) throw error
      data = inserted
    } else {
      const { data: upserted, error } = await supabase
        .from('basket_items')
        .upsert(persistedItem, { onConflict: 'subscription_id,meal_id' })
        .select()
        .single()
      if (error) throw error
      data = upserted
    }

    setBasketItems((prev) => {
      const without = prev.filter((b) => b.meal_id !== meal.meal_id)
      return [...without, data]
    })
  }

  async function removeFromBasket(mealId) {
    if (isGuest) {
      const removed = basketItems.find((b) => b.meal_id === mealId)
      setBasketItems((prev) => {
        const next = prev.filter((b) => b.meal_id !== mealId)
        localStorage.setItem(GUEST_KEY, JSON.stringify(next))
        return next
      })
      if (removed) setPendingReturns((prev) => [...prev, removed])
      return
    }
    if (!subscription?.id) return
    await supabase
      .from('basket_items')
      .delete()
      .eq('subscription_id', subscription.id)
      .eq('meal_id', mealId)
    const removed = basketItems.find((b) => b.meal_id === mealId)
    setBasketItems((prev) => prev.filter((b) => b.meal_id !== mealId))
    if (removed) setPendingReturns((prev) => [...prev, removed])
  }

  function clearPendingReturns() {
    setPendingReturns([])
  }

  function isInBasket(mealId) {
    return basketItems.some((b) => b.meal_id === mealId)
  }

  return (
    <BasketContext.Provider
      value={{
        basketItems,
        basketCount: basketItems.length,
        isInBasket,
        addToBasket,
        removeFromBasket,
        pendingReturns,
        clearPendingReturns,
      }}
    >
      {children}
    </BasketContext.Provider>
  )
}

export function useBasket() {
  const ctx = useContext(BasketContext)
  if (!ctx) throw new Error('useBasket must be used within BasketProvider')
  return ctx
}
