import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

// Raw body is required for webhook signature verification —
// disable Next.js body parsing for this route.
export const dynamic = "force-dynamic";

// Supabase service-role client (bypasses RLS for plan updates)
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

async function updateUserPlan(
  supabase: ReturnType<typeof createAdminClient>,
  customerId: string,
  plan: "pro" | "free"
) {
  await supabase
    .from("users")
    .update({ plan })
    .eq("stripe_customer_id", customerId);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const userId = session.metadata?.supabase_user_id;

      // Store stripe_customer_id if we have the user ID in metadata
      if (userId && customerId) {
        await supabase
          .from("users")
          .update({ stripe_customer_id: customerId, plan: "pro" })
          .eq("id", userId);
      } else if (customerId) {
        await updateUserPlan(supabase, customerId, "pro");
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      // Active / trialing = pro; anything else = free
      const isActive = sub.status === "active" || sub.status === "trialing";
      await updateUserPlan(supabase, customerId, isActive ? "pro" : "free");
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      await updateUserPlan(supabase, customerId, "free");
      break;
    }

    default:
      // Ignore unhandled event types
      break;
  }

  return Response.json({ received: true });
}
