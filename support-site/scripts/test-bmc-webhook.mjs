import { createHmac } from "node:crypto";

const secret = process.env.BMC_WEBHOOK_SECRET;
const url = process.env.WEBHOOK_URL || "http://localhost:8788/api/bmc-webhook";
const mode = process.env.BMC_TEST_MODE || "donation";

if (!secret) {
  console.error("Set BMC_WEBHOOK_SECRET first.");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const id = Number(process.env.BMC_TEST_ID || Date.now());
const isRefund = mode === "refund";
const body = JSON.stringify({
  event_id: Date.now(),
  type: isRefund ? "donation.refunded" : "donation.created",
  live_mode: true,
  created: now,
  attempt: 1,
  data: {
    id,
    object: "payment",
    transaction_id: `pi_test_${id}`,
    status: isRefund ? "refunded" : "succeeded",
    refunded: isRefund ? "true" : "false",
    amount: Number(process.env.BMC_TEST_AMOUNT || 5),
    coffee_count: 1,
    coffee_price: Number(process.env.BMC_TEST_AMOUNT || 5),
    currency: process.env.BMC_TEST_CURRENCY || "USD",
    total_amount_charged: Number(process.env.BMC_TEST_AMOUNT || 5),
    application_fee: 0.25,
    supporter_name: process.env.BMC_TEST_NAME || "BMC Test",
    supporter_name_type: "default",
    supporter_id: 42,
    supporter_email: "test@example.com",
    support_note: process.env.BMC_TEST_NOTE || "Local BMC webhook test",
    note_hidden: "false",
    support_type: "Supporter",
    message: "BMC Test bought 1 coffee",
    created_at: now,
    refunded_at: isRefund ? now : null,
  },
});

const signature = createHmac("sha256", secret).update(body).digest("hex");
const response = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-signature-sha256": signature,
  },
  body,
});

console.log(`BMC test id: ${id}`);
console.log(response.status, await response.text());
