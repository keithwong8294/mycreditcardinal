import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { priceId: string };
  const { priceId } = body;

  if (!priceId) {
    return Response.json({ error: "Missing priceId" }, { status: 400 });
  }

  // Look up the user's Supabase record to get / create stripe_customer_id
  const { data: dbUser } = await supabase
    .from("users")
    .select("stripe_customer_id, name, email")
    .eq("id", user.id)
    .single();

  let customerId: string | undefined = dbUser?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser?.email ?? user.email,
      name: dbUser?.name ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    // Persist the Stripe customer ID
    await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings?upgraded=1`,
    cancel_url: `${origin}/settings`,
    metadata: { supabase_user_id: user.id },
  });

  return Response.json({ url: session.url });
}
