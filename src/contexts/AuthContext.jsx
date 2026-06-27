import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

const GUEST_STORAGE_KEYS = [
  'guest_basket',
  'guest_favorites',
  'guest_hidden',
  'guest_shopping_list',
  'guest_mode',
]

function clearGuestData() {
  GUEST_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k))
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = unauthenticated
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('guest_mode') === 'true')

  // Prevents concurrent / duplicate loads when multiple auth events fire on startup
  const loadingUserIdRef = useRef(null)

  async function loadProfileAndSubscription(userId) {
    if (loadingUserIdRef.current === userId) return
    loadingUserIdRef.current = userId

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Failed to load profile:', profileError)
      loadingUserIdRef.current = null
      return
    }

    setProfile(profileData)

    if (!profileData.subscription_id) {
      loadingUserIdRef.current = null
      return
    }

    const { data: subData, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', profileData.subscription_id)
      .single()

    if (subError) {
      console.error('Failed to load subscription:', subError)
      loadingUserIdRef.current = null
      return
    }

    setSubscription(subData)
    loadingUserIdRef.current = null

    // Keep last_sign_in_at current — fire-and-forget
    supabase.from('profiles').update({ last_sign_in_at: new Date().toISOString() }).eq('id', userId)
  }

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on registration,
    // so we don't need a separate getSession() call.
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        if (session?.user) {
          // Real sign-in: discard any lingering guest data
          if (localStorage.getItem('guest_mode') === 'true') {
            clearGuestData()
            setIsGuest(false)
          }
          loadProfileAndSubscription(session.user.id)
        } else {
          loadingUserIdRef.current = null
          setProfile(null)
          setSubscription(null)
        }
      }
    )

    return () => authListener.unsubscribe()
  }, [])

  function enterGuestMode() {
    localStorage.setItem('guest_mode', 'true')
    setIsGuest(true)
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/plan` },
    })
    if (error) throw error
  }

  async function signOut() {
    if (isGuest) {
      // Exit guest mode but preserve localStorage data so it's there if they return as guest
      localStorage.removeItem('guest_mode')
      setIsGuest(false)
      return
    }
    supabase.auth.signOut().catch(() => {})
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k))
  }

  async function updateSubscription(updates) {
    if (!subscription?.id) return
    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscription.id)
      .select()
      .single()
    if (error) throw error
    if (data) setSubscription(data)
  }

  // Skip the Supabase loading spinner when we already know the user is a guest
  const isLoading = session === undefined && !isGuest
  const isAuthenticated = !!session
  const subscriptionTier = subscription?.subscription_tier ?? 'free'
  const isPremium = subscriptionTier === 'premium'

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        subscription,
        isLoading,
        isAuthenticated,
        isGuest,
        subscriptionTier,
        isPremium,
        signInWithGoogle,
        signOut,
        enterGuestMode,
        updateSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
