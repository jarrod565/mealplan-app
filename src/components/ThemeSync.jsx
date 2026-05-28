import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Reads theme_preference from the Supabase subscription record and
 * applies it to next-themes on load. Lives inside both ThemeProvider
 * and AuthProvider so both contexts are available.
 */
export function ThemeSync() {
  const { setTheme } = useTheme()
  const { subscription } = useAuth()

  useEffect(() => {
    if (subscription?.theme_preference) {
      setTheme(subscription.theme_preference)
    }
  }, [subscription?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
