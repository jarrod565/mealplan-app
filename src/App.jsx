import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { BasketProvider } from '@/contexts/BasketContext'
import { FavoritesProvider } from '@/contexts/FavoritesContext'
import { HiddenProvider } from '@/contexts/HiddenContext'
import { ShoppingListProvider } from '@/contexts/ShoppingListContext'
import { router } from './router'

export default function App() {
  return (
    <AuthProvider>
      <BasketProvider>
        <FavoritesProvider>
          <HiddenProvider>
            <ShoppingListProvider>
              <RouterProvider router={router} />
              <Toaster position="top-center" richColors />
            </ShoppingListProvider>
          </HiddenProvider>
        </FavoritesProvider>
      </BasketProvider>
    </AuthProvider>
  )
}
