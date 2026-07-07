import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { BasketProvider } from '@/contexts/BasketContext'
import { FavoritesProvider } from '@/contexts/FavoritesContext'
import { HiddenProvider } from '@/contexts/HiddenContext'
import { ShoppingListProvider } from '@/contexts/ShoppingListContext'
import { HistoryProvider } from '@/contexts/HistoryContext'
import { ConnectedSourcesProvider } from '@/contexts/ConnectedSourcesContext'
import { ThemeSync } from '@/components/ThemeSync'
import { router } from './router'

export default function App() {
  return (
    <AuthProvider>
      {/* Syncs Supabase theme_preference → next-themes on session load */}
      <ThemeSync />
      <BasketProvider>
        <FavoritesProvider>
          <HiddenProvider>
            <ShoppingListProvider>
              <HistoryProvider>
                <ConnectedSourcesProvider>
                  <RouterProvider router={router} />
                  <Toaster position="top-center" richColors />
                </ConnectedSourcesProvider>
              </HistoryProvider>
            </ShoppingListProvider>
          </HiddenProvider>
        </FavoritesProvider>
      </BasketProvider>
    </AuthProvider>
  )
}
