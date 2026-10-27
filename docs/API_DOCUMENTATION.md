# REST API

Base URL: `${APP_URL}/api`. The web UI uses Server Actions; these endpoints expose the same services for mobile apps, integrations and automated tests.

**Authentication:** the `km_session` cookie (HttpOnly, SameSite=Lax) is set by `POST /api/auth/login` or `POST /api/auth/register`.

**CSRF:** every mutating request (`POST/PATCH/PUT/DELETE`) must send an `Origin` header equal to `APP_URL` or one of `CORS_ORIGINS`. Webhooks are the only exception (they are signature-verified).

**Errors:** `{"error": {"code": "<CODE>", "message": "<key or text>", "details"?: {}, "fields"?: {"field": "message"}}}`

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION` | 400 | Invalid input (`fields` lists problems) |
| `UNAUTHENTICATED` | 401 | No or invalid session |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ENTITLEMENT_REQUIRED` | 402 | Plan does not include this (quota reached, contacts, …) |
| `FORBIDDEN` / `FEATURE_DISABLED` / `EMAIL_NOT_VERIFIED` / `ACCOUNT_INACTIVE` | 403 | Not allowed |
| `NOT_FOUND` | 404 | Missing **or not visible to you** (privacy: never reveals existence) |
| `CONFLICT` | 409 | Duplicate interest, already reviewed, … |
| `ACCOUNT_LOCKED` | 423 | Too many failed logins (15 minutes) |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVICE_UNAVAILABLE` | 503 | A required provider is not configured or failed |

Public IDs (`KM100001`) identify profiles. Internal UUIDs of users and profiles are never returned to other members.

## Health

`GET /api/health` → `200 {"status":"ok","database":{"ok":true,"latencyMs":1}}`, or `503` with `"status":"degraded"` and `database.error` set to `"unreachable"` or `"timeout"`. Connection details are never included.

## Auth

| Method & path | Body | Response |
| --- | --- | --- |
| `POST /auth/register` | `{email, password, dateOfBirth:"YYYY-MM-DD", gender:"MALE"\|"FEMALE", phone?, acceptTerms:true}` | `201 {user:{id,status}, verificationEmailSent}` + session cookie. `400 UNDERAGE` if below legal age. |
| `POST /auth/login` | `{email, password}` | `200 {user:{id,role,status}}` + cookie |
| `POST /auth/logout` | — | `204`, session revoked |

## Profiles & discovery (active, verified members)

| Method & path | Notes |
| --- | --- |
| `GET /profiles/me` | Own profile including private sections (contact, documents metadata) |
| `GET /profiles/{publicId}` | `{access, profile, horoscope, preference, photos, contact}`. Fields are filtered by the access rules; `contact` is null unless already unlocked. |
| `POST /profiles/{publicId}/contact` | Unlock contact details. Requires an accepted interest **and** a plan with `canViewContacts`. Consumes one contact view the first time. `403`/`402` otherwise. |
| `GET /search?ageMin&ageMax&heightMinCm&heightMaxCm&maritalStatus*&education*&employment*&country&state&city&occupation&excludeKootam=on&verifiedOnly=on&withPhoto=on&sort=newest\|active\|age_asc\|age_desc&page&pageSize≤48` | Requires your own profile to be published. `*` = repeatable. Returns `{items, total, page, pageSize, pageCount}`. |

## Interests, shortlist, safety

| Method & path | Body | Notes |
| --- | --- | --- |
| `GET /interests?direction=received\|sent` | — | |
| `POST /interests` | `{publicId, message?}` | `201`. `409` for a duplicate or reverse interest; `402` when the daily quota is reached. |
| `PATCH /interests/{id}` | `{action:"accept"\|"decline"\|"withdraw"}` | Only the receiver may accept or decline; only the sender may withdraw. |
| `GET /shortlist` · `POST /shortlist` · `DELETE /shortlist` | `{publicId}` | |
| `GET /blocks` · `POST /blocks` | `{publicId}` | Blocking hides both members from each other and closes pending interests. |
| `POST /reports` | `{publicId, reason, details?}` | One open report per reporter and profile |

## Membership & payments

| Method & path | Notes |
| --- | --- |
| `GET /plans` | Public. Active plans and `paymentsEnabled`. |
| `POST /payments/checkout` `{planCode}` | `201 {provider, keyId, scriptUrl, orderId, amountMinor, currency, …}`. `403 FEATURE_DISABLED` while payments are off. The price always comes from the server. |
| `POST /payments/confirm` `{orderId, paymentId, signature}` | Verifies the provider signature and activates the plan idempotently. |
| `POST /webhooks/payments/{provider}` | Provider → server. Verifies `X-Razorpay-Signature` (HMAC-SHA256 of the raw body) and deduplicates on `X-Razorpay-Event-Id`. Handles `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`. Responses: `403` for a bad signature, `404` for an unconfigured provider, `200 {status:"processed"\|"ignored"\|"duplicate"}`. |

Configure the provider webhook URL as `${APP_URL}/api/webhooks/payments/razorpay`.

## Media & account

| Method & path | Notes |
| --- | --- |
| `GET /media/photos/{id}` | The owner, moderators, or members allowed by the profile's photo visibility (approved photos only). `Cache-Control: private`. |
| `GET /media/documents/{id}` | The owner and moderators only; served as a download with `no-store`. |
| `GET /account/export` | JSON download of the member's personal data (rate limited) |
