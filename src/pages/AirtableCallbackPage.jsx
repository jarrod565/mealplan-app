import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { completeAirtableOAuth } from '@/lib/airtable'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'
import UserAvatar from '@/components/layout/UserAvatar'

// Sessionwide handoff slot — read by the Settings → Connections screen (next
// build step) to continue the wizard into base/table selection and column
// mapping. Connected Sources requires a real Supabase subscription row, so
// this never applies to guest mode (Connect entry points are hidden there).
const PENDING_CONNECTION_KEY = 'airtable_pending_connection'

export default function AirtableCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const { updateConnectionTokens } = useConnectedSources()
  const [status, setStatus] = useState('exchanging')
  const [errorMessage, setErrorMessage] = useState(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const oauthError = searchParams.get('error')
    if (oauthError) {
      setErrorMessage(
        oauthError === 'access_denied'
          ? 'Airtable access was not granted.'
          : 'Airtable sign-in was cancelled.'
      )
      setStatus('error')
      return
    }

    if (isGuest) {
      setErrorMessage('Sign in to connect Airtable — guest data is local-only and can’t hold a connection.')
      setStatus('error')
      return
    }

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code) {
      setErrorMessage('Missing authorization code from Airtable.')
      setStatus('error')
      return
    }

    completeAirtableOAuth(code, state)
      .then(async ({ reconnectConnectionId, ...tokens }) => {
        // Reconnect flow: update the existing connection's tokens in place and
        // skip the base/table/mapping wizard entirely — base_id, table_id, and
        // column_mapping are left untouched by updateConnectionTokens.
        if (reconnectConnectionId) {
          try {
            await updateConnectionTokens(reconnectConnectionId, tokens)
            toast.success('Reconnected to Airtable.')
          } catch {
            toast.error('Reconnected to Airtable, but could not update the saved connection. Please try again.')
          }
          navigate('/settings/connections', { replace: true })
          return
        }

        sessionStorage.setItem(PENDING_CONNECTION_KEY, JSON.stringify(tokens))
        navigate('/settings/connections', { replace: true })
      })
      .catch((err) => {
        setErrorMessage(err?.message || 'Could not connect to Airtable. Please try again.')
        setStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight">Connect Airtable</h1>
        <UserAvatar />
      </header>

      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-4">
        {status === 'exchanging' ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Connecting to Airtable…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <p className="font-semibold text-base">Couldn't connect Airtable</p>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{errorMessage}</p>
            <Button asChild variant="outline">
              <Link to="/settings/connections">Back to Connections</Link>
            </Button>
          </>
        )}
      </div>
    </>
  )
}
