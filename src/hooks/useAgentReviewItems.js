import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// CB_17: Needs Review list left behind by an Aldi Cart Agent run.
// Subscription-only, same as grocery_lists — no guest/localStorage support.
// v1 has no return channel from Claude in Chrome, so items are entered
// manually by the user after reading the agent's report in its own chat.
export function useAgentReviewItems() {
  const { subscription, isGuest } = useAuth()
  const subscriptionId = subscription?.id ?? null

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isGuest || !subscriptionId) {
      setItems([])
      return
    }
    let cancelled = false
    setIsLoading(true)
    supabase
      .from('agent_review_items')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at')
      .then(({ data }) => {
        if (cancelled) return
        setItems(data ?? [])
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [subscriptionId, isGuest])

  const pendingCount = items.filter((i) => i.status === 'pending').length

  async function addItem({ name, quantity }) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { data, error } = await supabase
      .from('agent_review_items')
      .insert({ subscription_id: subscriptionId, item_name: trimmed, quantity: quantity?.trim() || null })
      .select()
      .single()
    if (error) throw error
    setItems((prev) => [...prev, data])
  }

  async function setStatus(id, status) {
    const { error } = await supabase.from('agent_review_items').update({ status }).eq('id', id)
    if (error) throw error
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
  }

  async function clearResolved() {
    const resolvedIds = items.filter((i) => i.status !== 'pending').map((i) => i.id)
    if (resolvedIds.length === 0) return
    const { error } = await supabase.from('agent_review_items').delete().in('id', resolvedIds)
    if (error) throw error
    setItems((prev) => prev.filter((i) => i.status === 'pending'))
  }

  return { items, isLoading, pendingCount, addItem, setStatus, clearResolved }
}
