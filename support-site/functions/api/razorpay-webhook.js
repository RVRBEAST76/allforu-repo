import {
  amountDisplay,
  cleanText,
  corsPreflight,
  displayName,
  getMonth,
  hmacHex,
  json,
  safeEqual,
  toUsd,
} from "../_lib/utils.js";

const HANDLED_EVENTS = new Set(["payment.captured", "payment_link.paid"]);

export async function onRequestPost({ request, env }) {
  if (!env?.DB) {
    return json({ error: "Database is not configured." }, 503);
  }
  if (!env?.RAZORPAY_WEBHOOK_SECRET) {
    return json({ error: "Webhook secret is not configured." }, 503);
  }

  const rawBody = await request.text();
  const signature = (request.headers.get("x-razorpay-signature") || "").toLowerCase();
  const expected = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);

  if (!safeEqual(expected, signature)) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  if (!HANDLED_EVENTS.has(event?.event)) {
    return json({ ok: true, ignored: event?.event || "unknown" });
  }

  const payment = event?.payload?.payment?.entity;
  if (!payment?.id) {
    return json({ error: "Missing payment entity." }, 400);
  }

  const currency = String(payment.currency || "INR").toUpperCase();
  const amount = Number(payment.amount || 0) / 100;
  const usd = toUsd(amount, currency, env);
  if (usd === null) {
    return json({ error: `Unsupported payment amount or currency: ${currency}.` }, 400);
  }

  const createdAtDate = new Date(
    Number(payment.created_at || Math.floor(Date.now() / 1000)) * 1000,
  );
  if (Number.isNaN(createdAtDate.getTime())) {
    return json({ error: "Invalid payment timestamp." }, 400);
  }

  const notes = payment.notes && typeof payment.notes === "object"
    ? payment.notes
    : {};
  const donorName = displayName(notes.name || notes.donor_name, "Supporter");
  const message = cleanText(notes.message, 160);
  const createdAt = createdAtDate.toISOString();
  const month = getMonth(createdAtDate);
  const amountUsd = Math.round(usd * 10000) / 10000;

  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO payments
      (id, source, amount_usd, amount_display, currency, donor_name, message, created_at, month)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      payment.id,
      "razorpay",
      amountUsd,
      amountDisplay(amount, currency, amountUsd),
      currency,
      donorName,
      message,
      createdAt,
      month,
    )
    .run();

  return json({
    ok: true,
    duplicate: Number(result?.meta?.changes || 0) === 0,
  });
}

export function onRequestOptions() {
  return corsPreflight();
}
