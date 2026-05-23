import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Crown, LogOut, Users, Webhook, Zap } from 'lucide-react'
import { stripePromise } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'

export default function AccountSettingsPage() {
  const { user, subscription, subscriptionTier, isPremium, signOut, updateSubscription } = useAuth()
  const [servingSize, setServingSize] = useState(
    String(subscription?.default_serving_size ?? 2)
  )
  const [savingSize, setSavingSize] = useState(false)

  // Sync input once subscription loads (it's null on first render)
  useEffect(() => {
    if (subscription?.id) {
      setServingSize(String(subscription.default_serving_size ?? 2))
    }
  }, [subscription?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [upgrading, setUpgrading] = useState(false)

  async function handleSaveServingSize() {
    const parsed = parseInt(servingSize, 10)
    if (isNaN(parsed) || parsed < 1) {
      toast.error('Serving size must be a number greater than 0.')
      return
    }
    setSavingSize(true)
    try {
      await updateSubscription({ default_serving_size: parsed })
      toast.success('Serving size saved.')
    } catch {
      toast.error('Could not save serving size. Please try again.')
    } finally {
      setSavingSize(false)
    }
  }

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { subscription_id: subscription?.id },
      })
      if (error) throw error

      const stripe = await stripePromise
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })
      if (stripeError) throw stripeError
    } catch {
      toast.error('Could not start upgrade. Please try again.')
      setUpgrading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    window.location.href = '/sign-in'
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
      </div>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {isPremium ? (
              <Crown className="w-4 h-4 text-amber-500" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current plan</span>
            <Badge variant={isPremium ? 'default' : 'secondary'}>
              {isPremium ? 'Premium' : 'Free'}
            </Badge>
          </div>

          {!isPremium && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Upgrade to Premium</p>
                <p className="text-sm text-muted-foreground">
                  Unlock AI-powered meal suggestions, smarter ingredient substitutions,
                  and more — coming soon.
                </p>
                <Button
                  className="w-full"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  {upgrading ? 'Loading…' : 'Upgrade to Premium'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Household preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Household
          </CardTitle>
          <CardDescription>
            Applied when calculating ingredient quantities for your shopping list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serving-size">Default serving size (people)</Label>
            <div className="flex gap-2">
              <Input
                id="serving-size"
                type="number"
                min="1"
                max="20"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                className="w-24"
              />
              <Button
                variant="outline"
                onClick={handleSaveServingSize}
                disabled={savingSize}
              >
                {savingSize ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dietary Preferences link */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Dietary Preferences</CardTitle>
              <CardDescription className="mt-1">
                Filter the meal discovery experience by dietary restrictions.
              </CardDescription>
            </div>
            {(subscription?.dietary_restrictions?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {subscription.dietary_restrictions.length} active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/settings/dietary">Manage dietary restrictions</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Future integrations placeholder */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Integrations
            <Badge variant="outline" className="text-xs ml-auto">Coming soon</Badge>
          </CardTitle>
          <CardDescription>
            Connect MealPlan with your favourite shopping apps and services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Integrations with Aldi, AnyList, Instacart, and others are planned for a future release.
          </p>
        </CardContent>
      </Card>

      {/* Future webhooks placeholder */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="w-4 h-4" />
            Webhooks
            <Badge variant="outline" className="text-xs ml-auto">Coming soon</Badge>
          </CardTitle>
          <CardDescription>
            Push your shopping list to external systems automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Webhook configuration will be available in a future release.
          </p>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Separator />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive gap-2">
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be returned to the sign-in screen. Your meal plan and shopping list
              will be waiting when you return.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
