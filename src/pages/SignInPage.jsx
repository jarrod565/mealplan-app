import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="#1877F2"
      />
    </svg>
  )
}

export default function SignInPage() {
  const { isAuthenticated, isLoading, isGuest, signInWithGoogle, signInWithFacebook, enterGuestMode } = useAuth()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [facebookLoading, setFacebookLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isLoading && (isAuthenticated || isGuest)) {
    return <Navigate to="/plan" replace />
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      setError('Could not sign in with Google. Please try again.')
      setGoogleLoading(false)
    }
  }

  async function handleFacebook() {
    setError(null)
    setFacebookLoading(true)
    try {
      await signInWithFacebook()
    } catch {
      setError('Could not sign in with Facebook. Please try again.')
      setFacebookLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm space-y-10">
        {/* Branding */}
        <div className="text-center space-y-4">
          <img
            src="/dinder-logo.svg"
            alt="Dinder"
            className="h-10 w-auto mx-auto dark:[filter:brightness(0)_invert(1)]"
          />
          <p className="text-base text-muted-foreground leading-relaxed">
            Weekly meal planning for your household
          </p>
        </div>

        {/* SSO buttons */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full gap-3 h-12 text-[15px] font-medium"
            onClick={handleGoogle}
            disabled={googleLoading || facebookLoading}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-3 h-12 text-[15px] font-medium"
            onClick={handleFacebook}
            disabled={googleLoading || facebookLoading}
          >
            <FacebookIcon />
            {facebookLoading ? 'Redirecting…' : 'Continue with Facebook'}
          </Button>

          <div className="pt-1 text-center">
            <button
              onClick={enterGuestMode}
              disabled={googleLoading || facebookLoading}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline disabled:pointer-events-none"
            >
              Continue as Guest
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Separator />

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          By continuing, you agree to our Terms of Service and Privacy Policy.
          Two people can share a single account.
        </p>
      </div>
    </div>
  )
}
