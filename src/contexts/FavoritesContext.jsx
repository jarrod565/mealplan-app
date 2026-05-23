import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { subscription } = useAuth()
  const [favorites, setFavorites] = useState([])

  useEffect(() => {
    if (!subscription?.id) return
    supabase
      .from('favorites')
      .select('*')
      .eq('subscription_id', subscription.id)
      .order('favorited_at', { ascending: false })
      .then(({ data }) => setFavorites(data ?? []))
  }, [subscription?.id])

  const favoriteIds = new Set(favorites.map((f) => f.meal_id))

  function isFavorited(mealId) {
    return favoriteIds.has(mealId)
  }

  async function toggleFavorite(meal) {
    if (!subscription?.id) return
    if (isFavorited(meal.meal_id)) {
      await supabase
        .from('favorites')
        .delete()
        .eq('subscription_id', subscription.id)
        .eq('meal_id', meal.meal_id)
      setFavorites((prev) => prev.filter((f) => f.meal_id !== meal.meal_id))
    } else {
      const item = {
        subscription_id: subscription.id,
        meal_id: meal.meal_id,
        name: meal.name,
        photo_url: meal.photo_url ?? null,
        prep_time: meal.prep_time ?? null,
      }
      const { data, error } = await supabase
        .from('favorites')
        .upsert(item, { onConflict: 'subscription_id,meal_id' })
        .select()
        .single()
      if (error) throw error
      setFavorites((prev) => [data, ...prev])
    }
  }

  return (
    <FavoritesContext.Provider value={{ favorites, favoriteIds, isFavorited, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
