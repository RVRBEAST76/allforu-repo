import {
  amountDisplay,
  bearerToken,
  cleanText,
  corsPreflight,
  displayName,
  getMonth,
  json,
  safeEqual,
  toUsd,
} from "../_lib/utils.js";

const ALLOWED_SOURCES = new Set(["bmc", "manual"]);

export async function onRequestPost({ request, env }) {
  if (!env?.DB) {
    return json({ error: "Database is not configured." }, 503);
  }
  if (!env?.ADMIN_TOKEN) {
    return json({ error: "Admin token is not configured." }, 503);
  }

  const token = bearerToken(request);
  if (!safeEqual(token, env.ADMIN_TOKEN)) {
    return json({ error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const source = ALLOWED_SOURCES.has(body?.source) ? body.source : "manual";
  const currency = String(body?.currency || "USD").toUpperCase();
  const amount = Number(body?.amount);
  const usd = toUsd(amount, currency, env);
  if (usd === null) {
    return json({ error: "Amount must be positive and currency must be INR or USD." }, 400);
  }

  const createdAtDate = body?.createdAt ? new Date(body.createdAt) : new Date();
  if (Number.isNaN(createdAtDate.getTime())) {
    return json({ error: "Invalid createdAt value." }, 400);
  }

  const id = cleanText(body?.id, 80) || `manual-${crypto.randomUUID()}`;
  const donorName = displayName(body?.name, "Supporter");
  const message = cleanText(body?.message, 160);
  const amountUsd = Math.round(usd * 10000) / 10000;
  const createdAt = createdAtDate.toISOString();
  const month = getMonth(createdAtDate);

  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO payments
      (id, source, amount_usd, amount_display, currency, donor_name, message, created_at, month)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      source,
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
    id,
    duplicate: Number(result?.meta?.changes || 0) === 0,
  });
}

export function onRequestOptions() {
  return corsPreflight();
}
