# Shopping Cart Implementation Tasks

Add a persistent demo shopping cart across the SQLite API and React storefront. The cart is associated with a numeric `userId` and the API must calculate quantities, prices, and totals server-side.

## Dependency Graph

```text
P1-T1 -> P1-T2 -> P1-T3 -> P1-T4 -> P1-T5
                                      |
                                      v
P2-T1 -> P2-T2 -> P2-T3 -> P2-T5 -> P2-T6
                 |          |
                 v          v
               P2-T4 ------+
                                      |
                                      v
P3-T1 -> P3-T2 -> P3-T3 --+
                 |         |
                 +-> P3-T4 -+-> P3-T6 -> P3-T7
                 |         |
                 +-> P3-T5 -+
```

Phase 2 is blocked until Phase 1 verification passes. Phase 3 is blocked until Phase 2 verification passes.

## Express Routing Guardrails

The cart router follows the current Express routing guide at https://expressjs.com/en/guide/routing.html:

- Use HTTP-method-specific handlers (`router.get`, `router.post`, and `router.delete`) for each cart operation.
- Mount a dedicated `express.Router()` once at `/api/cart` from `api/src/index.ts`.
- Keep route handlers thin and pass failures to the existing error middleware with `next(error)`.
- Treat named route parameters such as `:productId` as strings at the HTTP boundary and validate/parse them before repository calls.
- Keep literal and parameterized paths unambiguous and register specific paths before generic parameter paths; this avoids the existing `/products/name/:name` versus `/products/:id` collision pattern.
- Do not treat query strings as route paths; use request query/body validation separately if future cart filtering or pagination is added.

## Phase 1: Cart Data Model And Repository

- [x] **P1-T1: Define cart contracts** *(completed)*
  - Create `api/src/models/cart.ts`.
  - Add camelCase `Cart` and `CartItem` interfaces following the existing entity model conventions.
  - The cart must include `cartId`, `userId`, and `items`.
  - Each item must include `cartItemId`, `cartId`, `productId`, `quantity`, and `price`.
  - Add Swagger schema comments matching the actual response shape.
  - **Depends on:** none.
  - **Done when:** the API build accepts the model and the response contract is explicit.

- [x] **P1-T2: Add the cart database migration** *(completed)*
  - Create `api/database/migrations/003_add_carts.sql`; do not modify migrations 001 or 002.
  - Create `carts` keyed by `cart_id` with a unique `user_id` owner.
  - Create `cart_items` with a unique/composite key on `(cart_id, product_id)`.
  - Add a positive quantity `CHECK` constraint.
  - Add a foreign key from `cart_items.product_id` to `products.product_id`.
  - Add cascade cleanup for cart lines and indexes for cart/user/product lookups.
  - Store the requested item price in each cart line as `price`.
  - **Depends on:** P1-T1.
  - **Done when:** migrations 001, 002, and 003 apply in order and support empty carts and multiple cart keys.

- [x] **P1-T3: Implement the cart repository** *(completed)*
  - Create `api/src/repositories/cartsRepo.ts` using `DatabaseConnection`, `handleDatabaseError`, parameterized SQL, and the existing factory/singleton pattern.
  - Implement `findByUserId(userId)` to return the user's cart and its items.
  - Implement `addItem(userId, productId, quantity, price)` with increment semantics when the line already exists.
  - Implement `removeItem(userId, productId)` to remove the complete line.
  - Implement `clearCart(userId)` to remove all lines.
  - Validate positive integer quantities with existing error types.
  - Verify the product exists before adding an item.
  - Use transactions for add/increment and multi-statement clear operations.
  - **Depends on:** P1-T1, P1-T2.
  - **Done when:** all repository methods return the typed cart model and follow the existing repository factory/singleton exports.

- [x] **P1-T4: Test repository behavior** *(completed)*
  - Create `api/src/repositories/cartsRepo.test.ts`.
  - Use the in-memory database and run migrations before each isolated test setup.
  - Cover empty/new carts, adding a product, incrementing an existing line, missing products, invalid quantities, removing a line, clearing a cart, subtotal/item count, multiple-cart isolation, and product foreign-key behavior.
  - Include a regression test that product price is read from the product table rather than the request.
  - **Depends on:** P1-T3.
  - **Done when:** focused repository tests pass.

- [x] **P1-T5: Phase 1 verification gate** *(completed)*
  - Run `cd api && npm run build`.
  - Run the focused cart repository tests.
  - Confirm seed scripts remain valid after migration 003.
  - Record any unrelated pre-existing failures before continuing.
  - **Depends on:** P1-T4.
  - **Blocks:** all Phase 2 tasks.

## Phase 2: Cart API Endpoints *(completed)*

- [x] **P2-T1: Define cart identity validation** *(completed)*
  - Require a non-empty opaque `X-Cart-Key` header on every cart request.
  - Add a small reusable helper or route-local validator.
  - Reject missing or malformed keys with the existing validation error envelope.
  - Ignore any `cartKey` value supplied in a request body.
  - Document the header contract in Swagger.
  - **Depends on:** P1-T5.
  - **Done when:** the validator has focused coverage and every cart handler uses it.

- [x] **P2-T2: Implement the cart router** *(completed)*
  - Create `api/src/routes/cart.ts` with route-level Swagger documentation.
  - Implement `GET /api/cart` to return `{ cartKey, items, itemCount, subtotal }`; unseen keys return an empty cart.
  - Implement `POST /api/cart/items` accepting `{ productId: number, quantity: positive integer }`; increment existing lines and return the updated cart.
  - Implement `DELETE /api/cart/items/:productId` to remove the full line and return the updated cart. Make it idempotent with a `200` response for UI retry simplicity.
  - Implement `DELETE /api/cart` to clear all lines and return the empty cart.
  - Keep handlers thin: validate HTTP input, call the repository, map status codes, and forward errors.
  - Document response shapes and validation/not-found responses.
  - **Depends on:** P2-T1.
  - **Done when:** all four endpoints delegate persistence to `CartsRepository` and match the documented contract.

- [x] **P2-T3: Register the cart API** *(completed)*
  - Import `cartRoutes` in `api/src/index.ts`.
  - Mount it at `/api/cart` alongside the existing routers.
  - Add `cart: '/api/cart'` to `frontend/src/api/config.ts`.
  - **Depends on:** P2-T2.
  - **Done when:** the running API recognizes all four cart paths.

- [x] **P2-T4: Test cart endpoints** *(completed)*
  - Create `api/src/routes/cart.test.ts` using Supertest, JSON middleware, the cart router, and `errorHandler`.
  - Cover missing/invalid `X-Cart-Key`, get empty cart, add, increment, remove, clear, missing product, invalid quantity, response shape/status codes, and cart-key isolation.
  - Add a regression test that a body-supplied `cartKey` cannot override the header identity.
  - **Depends on:** P2-T2.
  - **Done when:** focused route tests pass against an in-memory database.

- [x] **P2-T5: Synchronize OpenAPI** *(completed)*
  - Update `api/api-swagger.json` with all four cart paths.
  - Include cart schemas, the `X-Cart-Key` header parameter, add-item request body, response codes, and error responses.
  - Verify generated `GET /api-docs.json` contains the same cart operations.
  - **Depends on:** P2-T2, P2-T3.
  - **Done when:** checked-in and generated API documentation agree.

- [x] **P2-T6: Phase 2 verification gate** *(completed with unrelated residual failures recorded)*
  - Run the API build.
  - Run focused cart repository and route tests.
  - Run the full API test suite.
  - Manually exercise get/add/increment/remove/clear using two different cart keys and confirm isolation.
  - **Depends on:** P2-T4, P2-T5.
  - **Blocks:** all Phase 3 tasks.
  - **Residual unrelated failures observed in full API suite (`cd api && npx vitest run --reporter=verbose --silent`):**
    - `src/routes/branch.test.ts`: FK validation expectation mismatch (500 vs expected 400).
    - `src/routes/delivery.test.ts`: FK validation expectation mismatch (500 vs expected 400).
    - `src/routes/headquarters.test.ts`: assumes `headquarters.city` column that is not present in schema.
    - `src/routes/order.test.ts`: FK validation expectation mismatch (500 vs expected 400).
    - `src/routes/orderDetail.test.ts`: FK validation expectation mismatch and response shape mismatch.
    - `src/routes/product.test.ts`: supplier FK validation + CRUD expectation mismatches.
    - `src/routes/supplier.test.ts`: create/list/status expectation mismatches.

## Phase 3: Frontend Cart Page And Navbar Count *(completed)*

- [x] **P3-T1: Add cart identity and typed API client** *(completed)*
  - Create `frontend/src/api/cart.ts`.
  - Generate an opaque UUID once and persist it in localStorage.
  - Send the value as `X-Cart-Key` on every cart API request.
  - Add typed `getCart`, `addCartItem`, `removeCartItem`, and `clearCart` functions.
  - Centralize the header and response types instead of duplicating them in components.
  - Keep this identity separate from the mock `AuthContext` so anonymous users can use the cart.
  - **Depends on:** P2-T6.
  - **Done when:** all cart calls use one persisted key and share one typed client module.

- [x] **P3-T2: Add shared cart query and mutation state** *(completed)*
  - Use the existing React Query provider.
  - Define a cart query keyed by the cart identity.
  - Add mutations for add, remove, and clear.
  - Invalidate or refetch the cart query after every successful mutation.
  - Expose loading, error, and success states to consuming components.
  - **Depends on:** P3-T1.
  - **Done when:** any mounted cart consumer receives current cart contents and `itemCount`.

- [x] **P3-T3: Connect product catalog add-to-cart** *(completed)*
  - Update `frontend/src/components/entity/product/Products.tsx`.
  - Replace the current alert/TODO in `handleAddToCart` with the cart mutation.
  - Preserve quantity steppers and prevent zero-quantity submissions.
  - Show pending/error feedback and reset the local quantity only after a successful request.
  - Refresh the shared cart query after success.
  - **Depends on:** P3-T2.
  - **Done when:** selecting a quantity and clicking Add to Cart changes the server cart and navbar count.

- [x] **P3-T4: Add cart page and route** *(completed)*
  - Create `frontend/src/components/cart/CartPage.tsx`.
  - Add `/cart` to `frontend/src/App.tsx`.
  - Render product image/name, quantity, unit price, line total, subtotal, remove controls, and clear-cart control.
  - Provide loading, API error, empty-cart, and successful-content states.
  - Keep checkout, payment, order creation, tax, and shipping out of scope.
  - **Depends on:** P3-T2.
  - **Done when:** the page renders current API state and remove/clear controls update it.

- [x] **P3-T5: Add navbar cart icon and item count** *(completed)*
  - Update `frontend/src/components/Navigation.tsx`.
  - Add an accessible cart icon link to `/cart`.
  - Display a stable-size badge using the shared cart query's `itemCount`.
  - Verify readable styling in both themes and at mobile widths.
  - Ensure the cart link does not depend on mock authentication state.
  - **Depends on:** P3-T2.
  - **Done when:** the badge updates after add/remove/clear and the icon remains keyboard accessible.

- [x] **P3-T6: Add frontend and E2E coverage** *(completed)*
  - Add focused component/API tests if a frontend unit-test command is configured; otherwise use Playwright as the executable coverage.
  - Add scenarios under `frontend/tests/e2e/` for add, navbar count, cart navigation, remove, clear, empty state, and refresh persistence.
  - Add or update a feature file under `frontend/tests/features/` as executable documentation.
  - Include desktop and mobile viewport checks.
  - **Depends on:** P3-T3, P3-T4, P3-T5.
  - **Done when:** the end-to-end cart flow passes against the API and Vite servers.

- [x] **P3-T7: Phase 3 verification gate** *(completed)*
  - Run `cd frontend && npm run build`.
  - Run `cd frontend && npm run lint`.
  - Run the configured unit-test command if component tests were added.
  - Run `npm run test:e2e` with API and Vite servers active.
  - Verify server-calculated totals, localStorage persistence, loading/error/empty states, and responsive layout.
  - **Depends on:** P3-T6.
  - **Done when:** the complete add-to-clear workflow passes and no client-supplied total is trusted.

## Final Integration Checklist

- [ ] Run the API and frontend builds.
- [ ] Run the complete available API and frontend test commands.
- [ ] Confirm `GET /api-docs.json` documents the cart API.
- [ ] Confirm cart data is isolated by `X-Cart-Key`.
- [ ] Confirm prices and totals are calculated from server-side product data.
- [ ] Confirm no checkout, payment, authentication, inventory reservation, tax, or shipping behavior was added accidentally.
- [ ] Document any unrelated pre-existing test or build failures.
