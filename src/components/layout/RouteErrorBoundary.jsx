import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

// React Router's errorElement — one of these is attached to every route so an
// uncaught render error is contained to that route's Outlet slot instead of
// unmounting the whole app. Without this, any bug in any single page (e.g.
// the ConnectedSourceCard incident) blanks the entire app for every route,
// since React's default behavior with no error boundary anywhere is to
// unmount the whole tree on an uncaught render error.
export default function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()

  // Surfaced to the console for debugging — this is the one thing static
  // build/lint checks can never catch, so it's the only signal we get.
  console.error('[RouteErrorBoundary] caught a render error:', error)

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error?.message || 'Something unexpected happened on this page.'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
      </div>
      <div>
        <p className="font-semibold text-base">Something went wrong on this page</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">{message}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button onClick={() => navigate('/plan', { replace: true })}>
          Go to Explore
        </Button>
      </div>
    </div>
  )
}
