// Public checkout endpoint for the Mission Success Batch landing page.
// Actions: create_order, verify_payment, capture_lead
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AMOUNT_INR = 999;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function keys() {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay keys not configured");
  return { keyId, keySecret };
}

function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function validMobile(v: string) {
  return /^[6-9]\d{9}$/.test(v.replace(/\D/g, "").replace(/^91/, "").slice(-10));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = String(body.action || "");
    const db = admin();

    if (action === "capture_lead") {
      const name = String(body.name || "").trim().slice(0, 100);
      const mobile = String(body.mobile || "").trim().slice(0, 20);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
      const source = String(body.source || "landing").slice(0, 60);
      if (!name || !validMobile(mobile))
        throw new Error("Please enter valid name and mobile.");
      if (email && !validEmail(email)) throw new Error("Invalid email.");
      await db.from("mission_batch_leads").insert({
        name, mobile, email: email || null, source, status: "lead",
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_order") {
      const name = String(body.name || "").trim().slice(0, 100);
      const mobile = String(body.mobile || "").trim().slice(0, 20);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
      if (!name || !validMobile(mobile) || !validEmail(email))
        throw new Error("Name, valid mobile and email are required.");

      const { keyId, keySecret } = keys();
      const credentials = btoa(`${keyId}:${keySecret}`);
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: AMOUNT_INR * 100,
          currency: "INR",
          receipt: `msb_${Date.now()}`,
          notes: { product: "mission_success_batch", name, mobile, email },
        }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) {
        console.error("Razorpay order failed", order);
        throw new Error("Payment gateway error. Try again.");
      }
      await db.from("mission_batch_leads").insert({
        name, mobile, email, source: "checkout", status: "order_created",
        razorpay_order_id: order.id, amount: AMOUNT_INR,
      });
      return new Response(JSON.stringify({ order, key_id: keyId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_payment") {
      const { order_id, payment_id, signature } = body;
      if (!order_id || !payment_id || !signature)
        throw new Error("Missing verification params");
      const { keySecret } = keys();
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(keySecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign(
        "HMAC",
        key,
        enc.encode(`${order_id}|${payment_id}`),
      );
      const generated = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (generated !== signature) throw new Error("Signature mismatch");
      await db
        .from("mission_batch_leads")
        .update({
          status: "paid",
          razorpay_payment_id: payment_id,
          paid_at: new Date().toISOString(),
        })
        .eq("razorpay_order_id", order_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("mission-batch-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
