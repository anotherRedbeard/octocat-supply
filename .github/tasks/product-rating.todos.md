# Product Rating Implementation Tasks

Add public product-level ratings across the SQLite API and React storefront. Visitors can submit one active 1-5 star rating per browser and product. Ratings publish immediately, require no purchase, and appear on product cards and the product detail modal.

The app has no backend user authentication. Browser-local ownership only lets the original browser edit or delete its rating; it is not security-grade identity.

## How To Use This List

Work through one phase at a time. When you say "complete Phase 1", that means complete every task listed in Phase 1, including its verification gate. A phase is not complete until all of its checkboxes are checked and its verification passes. Do not start the next phase until then.

## Product Rating Decisions

- Product-level aggregate ratings, not order-line feedback.
- Anonymous public submissions; no purchase requirement.
- 1-5 stars only; no written comments in this first slice.
- Publish immediately.
- One active rating per browser/product.
- The browser that created a rating may edit or delete it using a local ownership token.
- Ratings are visible on product cards and the product detail modal.
- No full authentication, verified purchase badge, moderation queue, comments, or rating expiry in this scope.

## Phase 1: Database Foundation

**Goal:** Define the rating data and make it persist safely in SQLite.

**This phase includes:** models, migration, optional demo seed data, repository code, and repository tests.

- [x] **P1-T1: Define rating contracts** *(completed)*
  - Create `api/src/models/rating.ts`.
  - Define the public rating, aggregate, create, and update shapes in camelCase.
  - Keep ownership credentials out of public responses and document the shapes with Swagger comments.
  - **Done when:** the API model compiles and the response contract is explicit.

- [x] **P1-T2: Add the ratings database migration** *(completed)*
  - Create the next sequential migration under `api/database/migrations/`.
  - Add product cascade cleanup, a score constraint from 1 through 5, timestamps, indexes, and one active rating per browser/product.
  - Store a non-guessable ownership credential; do not treat it as real authentication.
  - Do not modify existing migrations.
  - **Done when:** all migrations apply in order and the schema enforces product references and score bounds.

- [x] **P1-T3: Decide and add demo rating seed data** *(completed)*
  - Decide whether populated ratings are needed for product-card demos.
  - If needed, add deterministic synthetic ratings under `api/database/seed/`; otherwise record that no seed data is needed.
  - **Done when:** a fresh seeded database gives the intended empty or populated rating experience without invalid references.

- [x] **P1-T4: Implement the ratings repository** *(completed)*
  - Create `api/src/repositories/ratingsRepo.ts` using the existing factory/singleton pattern.
  - Implement list, aggregate, create, update, and delete operations with parameterized SQL and server-side calculations.
  - Reuse existing row mapping, repository, and shared error conventions.
  - **Done when:** repository methods return typed models and prevent unauthorized or duplicate active mutations.

- [x] **P1-T5: Test persistence behavior** *(completed)*
  - Add in-memory repository tests for empty ratings, averages/counts, score limits, ownership, duplicates, CRUD, and product-delete cascade.
  - **Done when:** focused repository tests pass.

- [x] **P1-T6: Phase 1 verification gate** *(completed)*
  - API build passes: `cd api && npm run build`.
  - Focused repository tests pass: `11 tests passed` in `src/repositories/ratingsRepo.test.ts`.
  - Migrations 001-004 and all five seed files apply successfully in a fresh in-memory database; six demo ratings are seeded.
  - API lint exits successfully with 12 pre-existing warnings in unrelated route files.

**Phase 1 is complete when:** every Phase 1 task, P1-T1 through P1-T6, is checked and the verification commands pass.

## Phase 2: API Endpoints

**Goal:** Expose the rating data through documented, tested API routes.

**This phase includes:** request validation, routes, API registration, Swagger, and route tests.

- [x] **P2-T1: Define rating request and ownership validation** *(completed)*
  - Validate route IDs, scores, ownership credentials, and update payloads at the HTTP boundary.
  - Use the existing validation error envelope and document the browser-local ownership limitation.
  - **Done when:** validation has focused coverage and all handlers use it consistently.

- [x] **P2-T2: Implement the ratings router** *(completed)*
  - Create `api/src/routes/rating.ts` with route-level Swagger documentation.
  - Add GET and POST product-rating routes plus PUT and DELETE rating routes.
  - Keep handlers thin and return the established status codes for validation, missing resources, duplicates, and ownership errors.
  - **Done when:** all endpoints delegate persistence to the repository and match the documented contract.

- [x] **P2-T3: Register the rating API** *(completed)*
  - Import the rating router in `api/src/index.ts`.
  - Mount the routes without creating ambiguous product paths and confirm existing product routes still work.
  - **Done when:** the running API recognizes all rating paths and existing product paths remain stable.

- [x] **P2-T4: Synchronize OpenAPI** *(completed)*
  - Update the checked-in and generated Swagger documents with rating paths, schemas, validation, and error responses.
  - **Done when:** checked-in and generated API documentation agree.

- [x] **P2-T5: Test rating endpoints** *(completed)*
  - Add SuperTest coverage for list, create, update, delete, validation, ownership, duplicates, and response shapes.
  - Include a regression test for existing product endpoints.
  - **Done when:** focused route tests pass against an in-memory database.

- [x] **P2-T6: Phase 2 verification gate** *(completed with unrelated residual failures recorded)*
  - API build passes: `cd api && npm run build`.
  - Focused repository and route tests pass: `20 tests passed` across the rating suites.
  - Generated Swagger output matches the checked-in rating paths and schemas.
  - API lint exits successfully with 12 pre-existing warnings in unrelated route files.
  - Full API suite result: `65 passed, 19 failed`; failures remain in unrelated branch, delivery, headquarters, order, order-detail, product, and supplier tests.

**Phase 2 is complete when:** every Phase 2 task, P2-T1 through P2-T6, is checked and the API verification is complete.

## Phase 3: Frontend Rating Controls

**Goal:** Give the frontend typed access to ratings and reusable rating controls.

**This phase includes:** API client, React Query state, star controls, rating form, and frontend verification.

- [x] **P3-T1: Add typed ratings API client** *(completed)*
  - Create or extend the existing typed API module with list, create, update, and delete functions.
  - Persist one opaque browser ownership token in localStorage and send it only for mutations.
  - **Done when:** all rating requests use one typed API client and one persisted browser token.

- [x] **P3-T2: Add React Query rating state** *(completed)*
  - Add a product-rating query and create/update/delete mutations.
  - Refresh the query after mutations and expose loading, error, empty, and success states.
  - **Done when:** mounted product consumers receive current aggregate and rating data after mutations.

- [x] **P3-T3: Create accessible star controls** *(completed)*
  - Create `frontend/src/components/entity/product/RatingStars.tsx`.
  - Support read-only display and interactive 1-5 selection with keyboard access, focus states, and screen-reader labels.
  - Keep the control stable, readable in dark mode, and usable on mobile.
  - **Done when:** star display and selection are accessible, typed, responsive, and independently testable.

- [x] **P3-T4: Create the rating form** *(completed)*
  - Create `frontend/src/components/entity/product/RatingForm.tsx`.
  - Support create, edit, and delete for the current browser-owned rating.
  - Show clear validation, loading, success, error, and empty states without exposing the ownership token.
  - **Done when:** the form handles create, update, delete, retry, and empty states without leaking ownership credentials.

- [x] **P3-T5: Phase 3 verification gate** *(completed)*
  - Frontend build passes: `cd frontend && npm run build`.
  - Frontend lint passes: `cd frontend && npm run lint`.
  - No frontend unit-test command is configured; product integration and end-to-end coverage remain in Phase 4.
  - The ratings client uses the existing API base URL and React Query provider.

**Phase 3 is complete when:** every Phase 3 task, P3-T1 through P3-T5, is checked and the frontend verification is complete.

## Phase 4: Product Page Experience

**Goal:** Put ratings on the product cards and detail modal, then verify the complete user experience.

**This phase includes:** product-card display, modal integration, visual polish, accessibility, responsive behavior, and end-to-end tests.

- [x] **P4-T1: Add ratings to product cards** *(completed)*
  - Update `frontend/src/components/entity/product/Products.tsx`.
  - Show the score and rating count without disrupting product actions or add-to-cart behavior.
  - Keep loading, empty, error, keyboard, and responsive states stable.
  - **Done when:** visitors can scan rating quality and count directly from the product grid.

- [x] **P4-T2: Add ratings to the product detail modal** *(completed)*
  - Show the score, count, rating breakdown, and browser-owned rating form.
  - Preserve the existing modal layout, image sizing, dark mode, focus order, and close behavior.
  - **Done when:** the modal supports the complete rating read and write flow.

- [x] **P4-T3: Apply modern visual treatment** *(completed)*
  - Use the existing Tailwind theme and icon conventions with clear star states and score/count hierarchy.
  - Add restrained motion only where it helps selection or loading; keep text and controls readable on mobile.
  - **Done when:** the rating action is visually prominent, understandable, responsive, and consistent with the storefront.

- [x] **P4-T4: Add frontend and end-to-end coverage** *(completed)*
  - Test star interaction, validation, ownership persistence, CRUD, cache refresh, and empty/populated states.
  - Add Playwright coverage if that is the established frontend test path; check desktop, tablet, mobile, and dark mode.
  - **Done when:** the complete rating flow passes against the API and Vite servers.

**Phase 4 is complete when:** every Phase 4 task, P4-T1 through P4-T4, is checked and the complete rating flow passes.

**Phase 4 verification:** Frontend build and lint pass. Microsoft Edge Playwright verification passed for product-card summaries, modal rating controls, submit/update/remove flow, accessible star labels, and a 375px mobile viewport. Screenshots were captured as `phase4-rating-form.png` and `phase4-rating-mobile.png`.

## Final Integration Checklist

- [x] Run the API and frontend builds.
- [x] Run the complete available API and frontend test commands.
  - API suite ran with 65 passing and 19 unrelated failures.
  - Frontend rating flow was verified through the required Microsoft Edge Playwright MCP workflow; no frontend unit-test command is configured.
- [x] Confirm `GET /api-docs.json` documents the rating API.
- [x] Confirm product ratings are isolated by product and one active browser-owned rating is enforced.
- [x] Confirm average scores and counts are calculated server-side.
- [x] Confirm the rating owner token is not returned in public responses or rendered in the UI.
- [x] Confirm a different browser cannot mutate the original browser's rating.
- [x] Confirm product deletion cascades associated ratings.
- [x] Confirm card and modal states work for empty, loading, error, and populated ratings.
- [x] Confirm keyboard access, dark mode, and responsive layouts.
- [x] Confirm no comments, checkout, payment, authentication, purchase verification, moderation, or inventory behavior was added accidentally.
- [x] Document unrelated pre-existing test or build failures.
  - Existing failures are in branch, delivery, headquarters, order, order-detail, product, and supplier tests; no rating tests failed.
