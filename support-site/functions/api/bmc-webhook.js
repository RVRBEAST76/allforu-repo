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

const HANDLED_EVENTS = new Set(["donation.created", "donation.refunded"]);

export async function onRequestPost({ request, env }) {
  if (!env?.DB) {
    return json({ error: "Database is not configured." }, 503);
  }
  if (!env?.BMC_WEBHOOK_SECRET) {
    return json({ error: "BMC webhook secret is not configured." }, 503);
  }

  const rawBody = await request.text();
  const signature = (request.headers.get("x-signature-sha256") || "").toLowerCase();
  const expected = await hmacHex(env.BMC_WEBHOOK_SECRET, rawBody);

  if (!safeEqual(expected, signature)) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  if (!HANDLED_EVENTS.has(event?.type)) {
    return json({ ok: true, ignored: event?.type || "unknown" });
  }

  // Dashboard "Send test event" deliveries are not real donations.
  if (event.live_mode === false) {
    return json({ ok: true, ignored: "test event" });
  }

  const data = event?.data;
  if (!data?.id) {
    return json({ error: "Missing donation id." }, 400);
  }

  const paymentId = `bmc-${data.id}`;

  if (
    event.type === "donation.refunded" ||
    String(data.refunded) === "true" ||
    data.status === "refunded"
  ) {
    const refundedAt = new Date(
      Number(data.refunded_at || event.created || Math.floor(Date.now() / 1000)) * 1000,
    );
    const result = await env.DB.prepare(
      "UPDATE payments SET refunded_at = ? WHERE id = ?",
    )
      .bind(
        Number.isNaN(refundedAt.getTime()) ? new Date().toISOString() : refundedAt.toISOString(),
        paymentId,
      )
      .run();

    return json({
      ok: true,
      refunded: true,
      found: Number(result?.meta?.changes || 0) > 0,
    });
  }

  const currency = String(data.currency || "USD").toUpperCase();
  const amount = Number(data.amount);
  const usd = toUsd(amount, currency, env);
  if (usd === null) {
    return json({ error: `Unsupported payment amount or currency: ${currency}.` }, 400);
  }

  const createdAtDate = new Date(
    Number(data.created_at || event.created || Math.floor(Date.now() / 1000)) * 1000,
  );
  if (Number.isNaN(createdAtDate.getTime())) {
    return json({ error: "Invalid payment timestamp." }, 400);
  }

  const hidden = String(data.note_hidden) === "true";
  const donorName = hidden
    ? "Anonymous"
    : displayName(data.supporter_name, "Supporter");
  const message = hidden ? "" : cleanText(data.support_note, 160);
  const amountUsd = Math.round(usd * 10000) / 10000;
  const createdAt = createdAtDate.toISOString();
  const month = getMonth(createdAtDate);

  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO payments
      (id, source, amount_usd, amount_display, currency, donor_name, message, created_at, month)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      paymentId,
      "bmc",
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
