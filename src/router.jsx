import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import SignInPage from '@/pages/SignInPage'
import PlanPage from '@/pages/PlanPage'
import BasketPage from '@/pages/BasketPage'
import FavoritesPage from '@/pages/FavoritesPage'
import HiddenPage from '@/pages/HiddenPage'
import AccountSettingsPage from '@/pages/AccountSettingsPage'
import DietaryPreferencesPage from '@/pages/DietaryPreferencesPage'
import IngredientsPage from '@/pages/IngredientsPage'
import ShoppingListPage from '@/pages/ShoppingListPage'

export const router = createBrowserRouter([
  {
    path: '/sign-in',
    element: <SignInPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/plan" replace /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'basket', element: <BasketPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'hidden', element: <HiddenPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
      { path: 'settings/dietary', element: <DietaryPreferencesPage /> },
      { path: 'ingredients', element: <IngredientsPage /> },
      { path: 'shopping-list', element: <ShoppingListPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/plan" replace />,
  },
])
