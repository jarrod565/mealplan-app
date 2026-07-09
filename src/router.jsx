import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import RouteErrorBoundary from '@/components/layout/RouteErrorBoundary'
import SignInPage from '@/pages/SignInPage'
import PlanPage from '@/pages/PlanPage'
import BasketPage from '@/pages/BasketPage'
import FavoritesPage from '@/pages/FavoritesPage'
import HiddenPage from '@/pages/HiddenPage'
import AccountSettingsPage from '@/pages/AccountSettingsPage'
import DietaryPreferencesPage from '@/pages/DietaryPreferencesPage'
import IngredientsPage from '@/pages/IngredientsPage'
import ShoppingListPage from '@/pages/ShoppingListPage'
import HistoryPage from '@/pages/HistoryPage'
import AirtableCallbackPage from '@/pages/AirtableCallbackPage'
import PinterestCallbackPage from '@/pages/PinterestCallbackPage'
import ConnectionsPage from '@/pages/ConnectionsPage'
import ForYouPage from '@/pages/ForYouPage'
import PrivacyPage from '@/pages/PrivacyPage'

export const router = createBrowserRouter([
  {
    path: '/sign-in',
    element: <SignInPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/privacy',
    element: <PrivacyPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: <AppLayout />,
    // Fail-safe for errors in AppLayout itself (Sidebar/BottomNav/auth gate).
    // Every child below also has its own errorElement so a crash there is
    // caught at the child level instead, leaving AppLayout (and nav) mounted.
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/plan" replace /> },
      { path: 'plan', element: <PlanPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'for-you', element: <ForYouPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'basket', element: <BasketPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'favorites', element: <FavoritesPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'hidden', element: <HiddenPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'settings', element: <AccountSettingsPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'settings/dietary', element: <DietaryPreferencesPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'ingredients', element: <IngredientsPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'shopping-list', element: <ShoppingListPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'history', element: <HistoryPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'settings/connections', element: <ConnectionsPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'settings/connections/airtable/callback', element: <AirtableCallbackPage />, errorElement: <RouteErrorBoundary /> },
      { path: 'settings/connections/pinterest/callback', element: <PinterestCallbackPage />, errorElement: <RouteErrorBoundary /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/plan" replace />,
  },
])
