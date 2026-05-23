import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = unauthenticated
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)

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

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/plan` },
    })
    if (error) throw error
  }

  async function signInWithFacebook() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/plan` },
    })
    if (error) throw error
  }

  async function signOut() {
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

  const isLoading = session === undefined
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
        subscriptionTier,
        isPremium,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
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
