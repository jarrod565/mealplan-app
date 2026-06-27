import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const HiddenContext = createContext(null)

const GUEST_KEY = 'guest_hidden'

export function HiddenProvider({ children }) {
  const { subscription, isGuest } = useAuth()
  const [hiddenMeals, setHiddenMeals] = useState([])

  // Resolve full hidden list at session start (CB_03 requirement)
  useEffect(() => {
    if (isGuest) {
      const stored = localStorage.getItem(GUEST_KEY)
      setHiddenMeals(stored ? JSON.parse(stored) : [])
      return
    }
    if (!subscription?.id) return
    supabase
      .from('hidden_meals')
      .select('*')
      .eq('subscription_id', subscription.id)
      .order('dismissed_at', { ascending: false })
      .then(({ data }) => setHiddenMeals(data ?? []))
  }, [subscription?.id, isGuest])

  const hiddenIds = new Set(hiddenMeals.map((h) => h.meal_id))

  async function addToHidden(meal, reason = null) {
    if (isGuest) {
      const item = {
        meal_id: meal.meal_id,
        meal_name: meal.name,
        photo_url: meal.photo_url ?? null,
        reason: reason ?? null,
        dismissed_at: new Date().toISOString(),
      }
      setHiddenMeals((prev) => {
        const next = [item, ...prev.filter((h) => h.meal_id !== meal.meal_id)]
        localStorage.setItem(GUEST_KEY, JSON.stringify(next))
        return next
      })
      return
    }
    if (!subscription?.id) return
    const item = {
      subscription_id: subscription.id,
      meal_id: meal.meal_id,
      meal_name: meal.name,
      photo_url: meal.photo_url ?? null,
      reason: reason ?? null,
    }
    const { data, error } = await supabase
      .from('hidden_meals')
      .upsert(item, { onConflict: 'subscription_id,meal_id' })
      .select()
      .single()
    if (error) throw error
    setHiddenMeals((prev) => [data, ...prev])
  }

  async function removeFromHidden(mealId) {
    if (isGuest) {
      setHiddenMeals((prev) => {
        const next = prev.filter((h) => h.meal_id !== mealId)
        localStorage.setItem(GUEST_KEY, JSON.stringify(next))
        return next
      })
      return
    }
    if (!subscription?.id) return
    await supabase
      .from('hidden_meals')
      .delete()
      .eq('subscription_id', subscription.id)
      .eq('meal_id', mealId)
    setHiddenMeals((prev) => prev.filter((h) => h.meal_id !== mealId))
  }

  return (
    <HiddenContext.Provider value={{ hiddenMeals, hiddenIds, addToHidden, removeFromHidden }}>
      {children}
    </HiddenContext.Provider>
  )
}

export function useHidden() {
  const ctx = useContext(HiddenContext)
  if (!ctx) throw new Error('useHidden must be used within HiddenProvider')
  return ctx
}
