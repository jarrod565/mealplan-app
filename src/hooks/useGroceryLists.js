import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// CB_13: saved named grocery lists (Aldi, Meijer, etc.) — subscription-only,
// no guest/localStorage support (schema is subscription_id-only per the brief,
// and this is an optional power-user layer, not core app functionality).
export function useGroceryLists() {
  const { subscription, isGuest } = useAuth()
  const subscriptionId = subscription?.id ?? null

  const [lists, setLists] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  // grocery_list_id -> items[], populated lazily on loadItems() so a sheet
  // opening doesn't fetch items for every saved list up front.
  const [itemsByList, setItemsByList] = useState({})

  useEffect(() => {
    if (isGuest || !subscriptionId) {
      setLists([])
      setItemsByList({})
      return
    }
    let cancelled = false
    setIsLoading(true)
    supabase
      .from('grocery_lists')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled) return
        setLists(data ?? [])
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [subscriptionId, isGuest])

  async function loadItems(listId) {
    const { data, error } = await supabase
      .from('grocery_list_items')
      .select('*')
      .eq('grocery_list_id', listId)
      .order('name')
    if (error) throw error
    setItemsByList((prev) => ({ ...prev, [listId]: data ?? [] }))
    return data ?? []
  }

  async function createList(name) {
    const trimmed = name.trim()
    if (!trimmed) return null
    const { data, error } = await supabase
      .from('grocery_lists')
      .insert({ subscription_id: subscriptionId, name: trimmed, sort_order: lists.length })
      .select()
      .single()
    if (error) throw error
    setLists((prev) => [...prev, data])
    return data
  }

  async function renameList(id, name) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { error } = await supabase.from('grocery_lists').update({ name: trimmed }).eq('id', id)
    if (error) throw error
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: trimmed } : l)))
  }

  async function deleteList(id) {
    const { error } = await supabase.from('grocery_lists').delete().eq('id', id)
    if (error) throw error
    setLists((prev) => prev.filter((l) => l.id !== id))
    setItemsByList((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // Simple up/down reorder (swap sort_order with the neighbor) — no drag
  // library in this codebase, and the brief doesn't specify drag-and-drop.
  async function moveList(id, direction) {
    const idx = lists.findIndex((l) => l.id === id)
    const swapIdx = idx + direction
    if (idx < 0 || swapIdx < 0 || swapIdx >= lists.length) return
    const a = lists[idx]
    const b = lists[swapIdx]
    const next = [...lists]
    next[idx] = { ...b, sort_order: a.sort_order }
    next[swapIdx] = { ...a, sort_order: b.sort_order }
    next.sort((x, y) => x.sort_order - y.sort_order)
    setLists(next)
    await Promise.all([
      supabase.from('grocery_lists').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('grocery_lists').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
  }

  async function addItem(listId, { name, quantity }) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { data, error } = await supabase
      .from('grocery_list_items')
      .insert({ grocery_list_id: listId, name: trimmed, quantity: quantity?.trim() || null })
      .select()
      .single()
    if (error) throw error
    setItemsByList((prev) => ({
      ...prev,
      [listId]: [...(prev[listId] ?? []), data].sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }

  async function updateItem(listId, itemId, { name, quantity }) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { error } = await supabase
      .from('grocery_list_items')
      .update({ name: trimmed, quantity: quantity?.trim() || null })
      .eq('id', itemId)
    if (error) throw error
    setItemsByList((prev) => ({
      ...prev,
      [listId]: (prev[listId] ?? [])
        .map((i) => (i.id === itemId ? { ...i, name: trimmed, quantity: quantity?.trim() || null } : i))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }

  async function deleteItem(listId, itemId) {
    const { error } = await supabase.from('grocery_list_items').delete().eq('id', itemId)
    if (error) throw error
    setItemsByList((prev) => ({
      ...prev,
      [listId]: (prev[listId] ?? []).filter((i) => i.id !== itemId),
    }))
  }

  return {
    lists,
    isLoading,
    itemsByList,
    loadItems,
    createList,
    renameList,
    deleteList,
    moveList,
    addItem,
    updateItem,
    deleteItem,
  }
}
