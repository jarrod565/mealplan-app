import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const ShoppingListContext = createContext(null)

const GUEST_KEY = 'guest_shopping_list'

function toItems(rows) {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    unit: r.unit,
    category: r.category,
    isCustom: r.is_custom,
    checked: r.is_checked,
  }))
}

export function ShoppingListProvider({ children }) {
  const { subscription, isGuest } = useAuth()
  const subscriptionId = subscription?.id ?? null

  const [listId, setListId] = useState(null)
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isGuest) {
      const stored = localStorage.getItem(GUEST_KEY)
      if (stored) {
        const { listId: gListId, items: gItems } = JSON.parse(stored)
        setListId(gListId)
        setItems(gItems)
      } else {
        setListId(null)
        setItems([])
      }
      return
    }
    if (!subscriptionId) {
      setListId(null)
      setItems([])
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const { data: list } = await supabase
          .from('shopping_lists')
          .select('id')
          .eq('subscription_id', subscriptionId)
          .maybeSingle()

        if (cancelled) return
        if (!list) { setListId(null); setItems([]); return }

        const { data: rows } = await supabase
          .from('shopping_list_items')
          .select('*')
          .eq('shopping_list_id', list.id)
          .order('sort_order')

        if (cancelled) return
        setListId(list.id)
        setItems(toItems(rows ?? []))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [subscriptionId, isGuest])

  async function generateShoppingList(listItems) {
    if (isGuest) {
      const gItems = listItems.map((item, idx) => ({
        id: `guest-${idx}-${Date.now()}`,
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? '',
        category: item.category ?? 'Other',
        isCustom: item.isCustom ?? false,
        checked: false,
      }))
      setListId('guest-list')
      setItems(gItems)
      localStorage.setItem(GUEST_KEY, JSON.stringify({ listId: 'guest-list', items: gItems }))
      return
    }
    if (!subscriptionId) return
    setIsLoading(true)
    try {
      // Delete any existing list for this subscription (cascade removes items)
      await supabase
        .from('shopping_lists')
        .delete()
        .eq('subscription_id', subscriptionId)

      const { data: newList, error: listErr } = await supabase
        .from('shopping_lists')
        .insert({ subscription_id: subscriptionId })
        .select('id')
        .single()
      if (listErr) throw listErr

      const toInsert = listItems.map((item, idx) => ({
        shopping_list_id: newList.id,
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? '',
        category: item.category ?? 'Other',
        is_custom: item.isCustom ?? false,
        is_checked: false,
        sort_order: idx,
      }))

      const { data: inserted, error: itemsErr } = await supabase
        .from('shopping_list_items')
        .insert(toInsert)
        .select()
      if (itemsErr) throw itemsErr

      setListId(newList.id)
      setItems(toItems(inserted ?? []))
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleItem(id) {
    if (isGuest) {
      setItems((current) => {
        const next = current.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        )
        localStorage.setItem(GUEST_KEY, JSON.stringify({ listId: 'guest-list', items: next }))
        return next
      })
      return
    }
    // Optimistic update; capture previous value for revert
    let prev
    setItems(current =>
      current.map(item => {
        if (item.id !== id) return item
        prev = item.checked
        return { ...item, checked: !item.checked }
      })
    )
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ is_checked: !prev })
      .eq('id', id)
    if (error) {
      setItems(current =>
        current.map(item => (item.id === id ? { ...item, checked: prev } : item))
      )
    }
  }

  async function clearList() {
    if (isGuest) {
      setListId(null)
      setItems([])
      localStorage.removeItem(GUEST_KEY)
      return
    }
    if (!subscriptionId) return
    await supabase
      .from('shopping_lists')
      .delete()
      .eq('subscription_id', subscriptionId)
    setListId(null)
    setItems([])
  }

  return (
    <ShoppingListContext.Provider value={{ items, isLoading, generateShoppingList, toggleItem, clearList }}>
      {children}
    </ShoppingListContext.Provider>
  )
}

export function useShoppingList() {
  const ctx = useContext(ShoppingListContext)
  if (!ctx) throw new Error('useShoppingList must be inside ShoppingListProvider')
  return ctx
}
