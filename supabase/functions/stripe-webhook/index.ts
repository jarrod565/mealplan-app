import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

Deno.serve(async (req) => {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId = session.metadata?.subscription_id
        if (subscriptionId) {
          await supabase
            .from('subscriptions')
            .update({ subscription_tier: 'premium' })
            .eq('id', subscriptionId)
        }
        break
      }

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        // Subscription lapsed or payment failed — downgrade to free
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice
        const customerId =
          'customer' in obj ? (obj.customer as string) : null

        if (customerId) {
          await supabase
            .from('subscriptions')
            .update({ subscription_tier: 'free' })
            .eq('stripe_customer_id', customerId)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err)
    return new Response('Handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
