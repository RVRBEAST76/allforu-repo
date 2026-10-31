# AllForU Support Page

A CNCV-style, real-time monthly support goal for AllForU.

**Live:** https://allforu-goal.pages.dev

- Public page: `index.html`
- Live stats API: `GET /api/stats`
- Razorpay webhook: `POST /api/razorpay-webhook`
- Manual/BMC entry: `POST /api/manual-donation`
- Storage: Cloudflare D1
- Hosting: Cloudflare Pages + Pages Functions

The page polls `/api/stats` every 30 seconds. Razorpay sends a webhook after a
captured payment; the webhook verifies the signature, deduplicates the payment,
and stores it in D1. The stats API aggregates the current UTC month.

## 1. Create the D1 database

```bash
cd support-site
npx wrangler login
npx wrangler d1 create allforu-support
```

Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "allforu-support"
database_id = "YOUR_D1_DATABASE_ID"
```

Apply the schema:

```bash
npx wrangler d1 execute allforu-support --remote --file=./schema.sql
```

## 2. Create the Pages project and secrets

```bash
npx wrangler pages project create allforu-goal

# Generate two strong random strings first. Do not reuse them elsewhere.
npx wrangler pages secret put RAZORPAY_WEBHOOK_SECRET --project-name allforu-goal
npx wrangler pages secret put ADMIN_TOKEN --project-name allforu-goal
```

`TARGET_GOAL_USD` and `INR_PER_USD` are public settings in `wrangler.toml`.
Change the target there and redeploy when needed. The default target is `$100`
and the default INR conversion is `88 INR = 1 USD`.

## 3. Deploy

```bash
npx wrangler pages deploy . --project-name allforu-goal --branch main
```

The first deployment gives a URL like:

```text
https://allforu-goal.pages.dev
```

If that project name is already taken, choose another name and update
`wrangler.toml`, the deploy command, and the README badge URL.

### Deploy from the Cloudflare dashboard instead

Connect the GitHub repository and use:

- Root directory: `support-site`
- Build command: leave empty (or `exit 0`)
- Build output directory: `.`
- D1 binding: `DB` → `allforu-support`

## 4. Configure the Razorpay webhook

In Razorpay Dashboard → Account & Settings → Webhooks:

- URL: `https://allforu-goal.pages.dev/api/razorpay-webhook`
- Secret: the same value used for `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured` and `payment_link.paid`

Use Razorpay test mode first. A test payment should appear in the supporter list
within about 30 seconds.

The webhook is idempotent: the same Razorpay payment ID is only stored once.
The handler never exposes email addresses or phone numbers.

## 5. Add a BMC or manual donation

BuyMeACoffee automatic webhooks depend on the account/plan. If automatic
webhooks are not available, add the donation with the protected endpoint:

```bash
curl -X POST "https://allforu-goal.pages.dev/api/manual-donation" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "bmc",
    "amount": 5,
    "currency": "USD",
    "name": "Alex",
    "message": "Keep it up"
  }'
```

Use `"source": "bmc"` for BuyMeACoffee and `"source": "manual"` for anything
else. `id` is optional; it is useful for deduplication. `createdAt` is optional;
the default is now. Keep `ADMIN_TOKEN` server-side only — never put it in the
page, a plugin, or a public repo.

## 6. Test locally

```bash
# Terminal 1
npx wrangler pages dev . --d1 DB=allforu-support

# Terminal 2
RAZORPAY_WEBHOOK_SECRET=test_secret \
WEBHOOK_URL=http://localhost:8788/api/razorpay-webhook \
node scripts/test-webhook.mjs
```

For local secrets, create `.dev.vars` (git-ignored):

```dotenv
RAZORPAY_WEBHOOK_SECRET=test_secret
ADMIN_TOKEN=test_admin_token
TARGET_GOAL_USD=100
INR_PER_USD=88
```

## 7. README badge

After deployment, add this to the repository README:

```md
[![Monthly support goal](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fallforu-goal.pages.dev%2Fapi%2Fstats&query=percent&label=Monthly%20Support&suffix=%25&color=ff6b35)](https://allforu-goal.pages.dev)
```

The badge reads the live `percent` field from `/api/stats`.

## API

### `GET /api/stats`

```json
{
  "month": "2026-10",
  "monthLabel": "October 2026",
  "targetGoalUsd": 100,
  "totalUsd": 71.74,
  "percent": 72,
  "supporterCount": 69,
  "goalReached": false,
  "contributions": [],
  "updatedAt": "2026-10-29T01:20:00.000Z"
}
```

### `POST /api/razorpay-webhook`

Requires a valid `X-Razorpay-Signature`. Handles `payment.captured` and
`payment_link.paid`.

### `POST /api/manual-donation`

Requires `Authorization: Bearer $ADMIN_TOKEN`.

```json
{
  "source": "bmc",
  "amount": 5,
  "currency": "USD",
  "name": "Alex",
  "message": "Keep it up",
  "id": "optional-unique-id",
  "createdAt": "2026-10-29T01:20:00.000Z"
}
```

## Security notes

- Secrets live in Cloudflare Pages secrets, not in this repo.
- Razorpay signatures are verified with HMAC-SHA256 before writing.
- Payment IDs are primary keys, so retries do not double-count.
- Donor emails/phone numbers are never returned by the API.
- Display names are optional; email-like values become `Supporter`.
- The goal is a display target. It does not auto-charge anyone and does not
  block access to any plugin.
