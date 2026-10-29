import { createHmac } from "node:crypto";

const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
const url = process.env.WEBHOOK_URL || "http://localhost:8788/api/razorpay-webhook";

if (!secret) {
  console.error("Set RAZORPAY_WEBHOOK_SECRET first.");
  process.exit(1);
}

const body = JSON.stringify({
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: `pay_test_${Date.now()}`,
        amount: 50000,
        currency: "INR",
        status: "captured",
        created_at: Math.floor(Date.now() / 1000),
        notes: {
          name: "Test Supporter",
          message: "Local webhook test",
        },
      },
    },
  },
});

const signature = createHmac("sha256", secret).update(body).digest("hex");
const response = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-razorpay-signature": signature,
  },
  body,
});

console.log(response.status, await response.text());
