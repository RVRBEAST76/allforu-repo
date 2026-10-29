const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function getMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month) {
  const [year, index] = String(month).split("-").map(Number);
  if (!year || !index || index < 1 || index > 12) return String(month);
  return `${MONTHS[index - 1]} ${year}`;
}

export function getTarget(env) {
  const value = Number(env?.TARGET_GOAL_USD);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

export function getInrRate(env) {
  const value = Number(env?.INR_PER_USD);
  return Number.isFinite(value) && value > 0 ? value : 88;
}

export function toUsd(amount, currency, env) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;

  const code = String(currency || "").toUpperCase();
  if (code === "USD") return value;
  if (code === "INR") return value / getInrRate(env);
  return null;
}

export function amountDisplay(amount, currency, usd) {
  const code = String(currency || "").toUpperCase();
  const value = Number(amount);
  const usdValue = Number(usd);
  if (code === "INR") {
    return `₹${value.toFixed(2)} (≈ $${usdValue.toFixed(2)})`;
  }
  return `$${usdValue.toFixed(2)}`;
}

export function cleanText(value, maxLength = 160) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function displayName(value, fallback = "Supporter") {
  const name = cleanText(value, 40);
  if (!name) return fallback;
  if (name.includes("@") || /^https?:\/\//i.test(name)) return fallback;
  return name;
}

export function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
