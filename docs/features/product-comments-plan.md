# Product Comments & Feedback Feature Implementation Plan

**Status**: ✅ COMPLETE 🎉  
**Last Updated**: 2026-08-11  
**Branch**: feature/product-comments

---

## 📋 Executive Summary

Implement a **comments/feedback feature** for products, distinct from ratings. Features include:
- Optional author names (browser-token based ownership)
- Single-level replies (1 depth)
- Helpful/not helpful reactions
- Edit/delete by author
- Distinct blue card UI
- Max 500 chars per comment

---

## 🎯 Phase Status

| Phase | Task | Status | Owner | Effort | Notes |
|-------|------|--------|-------|--------|-------|
| **1** | Database Schema & Migrations | ✅ COMPLETE | Backend | 1 hr | 005_add_product_comments.sql created |
| **2** | Backend API (Models, Repo, Routes) | ✅ COMPLETE | Backend | 3-4 hrs | Models, Repository, Routes, registered in index.ts |
| **3** | Frontend Data Layer (API Client, Hooks) | ✅ COMPLETE | Frontend | 2 hrs | commentToken.ts, comments.ts, useComments.ts, productComment.ts models |
| **4** | Frontend UI Components | ✅ COMPLETE | Frontend | 4-5 hrs | 7 components: ProductCommentsSection, CommentCard, ReplyCard, RepliesSection, CreateCommentForm, CreateReplyForm, CommentsSkeleton |
| **5** | Integration & Testing | ✅ COMPLETE | Both | 2-3 hrs | Repository tests (24 cases), Route tests (15 cases), E2E tests (10 scenarios) |
| **6** | Documentation & Deployment | ✅ COMPLETE | Team | 1 hr | Updated docs/api.md, docs/architecture.md, created PRODUCT_COMMENTS_GUIDE.md |

---

## 📂 Files to Create/Modify

### Phase 1: Database (IN PROGRESS)
- [ ] `api/database/migrations/005_add_product_comments.sql` — Schema + tables
- [ ] `api/database/seed/006_sample_comments.sql` (optional) — Test data

### Phase 2: Backend API
- [ ] `api/src/models/productComment.ts` — TypeScript types
- [ ] `api/src/repositories/productCommentsRepo.ts` — Repository class
- [ ] `api/src/routes/productComment.ts` — API endpoints
- [ ] `api/src/index.ts` — Register routes (modify)

### Phase 3: Frontend Data Layer
- [ ] `frontend/src/api/commentToken.ts` — Token management
- [ ] `frontend/src/api/comments.ts` — API client
- [ ] `frontend/src/api/useComments.ts` — React Query hooks

### Phase 4: Frontend UI
- [ ] `frontend/src/components/entity/product/ProductCommentsSection.tsx`
- [ ] `frontend/src/components/entity/product/CommentCard.tsx`
- [ ] `frontend/src/components/entity/product/RepliesSection.tsx`
- [ ] `frontend/src/components/entity/product/CreateCommentForm.tsx`
- [ ] `frontend/src/components/entity/product/CommentsSkeleton.tsx`
- [ ] `frontend/src/components/entity/product/ReplyCard.tsx`
- [ ] `frontend/src/components/entity/product/CreateReplyForm.tsx`

### Phase 5: Testing
- [ ] `api/src/repositories/productCommentsRepo.test.ts`
- [ ] `api/src/routes/productComment.test.ts`
- [ ] `frontend/tests/e2e/product-comments.spec.ts`

### Phase 6: Documentation
- [ ] `docs/api.md` (modify) — Add comments section
- [ ] `docs/architecture.md` (modify) — Add data model
- [ ] `docs/deployment.md` (modify) — Add migration step
- [ ] `FEATURES.md` (create) — User guide

---

## 🔧 Implementation Details

### Requirements (Confirmed)
✅ Browser-token ownership + optional author name  
✅ Edit/delete rights for comment authors  
✅ Max 500 chars per comment  
✅ Single-level replies  
✅ Newest-first sorting  
✅ Helpful/not helpful reactions  
✅ Distinct blue card UI  
✅ Independent from ratings  
✅ Show author + timestamp  

---

## ✅ Verification Checkpoints

### Phase 1 ✓
- [ ] Migration file syntax valid (no SQL errors)
- [ ] `npm run build` passes
- [ ] Schema matches design

### Phase 2 ✓
- [ ] `npm run build --workspace=api` passes
- [ ] No TypeScript errors
- [ ] Tests pass: `npm test --workspace=api`

### Phase 3 ✓
- [ ] `npm run build --workspace=frontend` passes
- [ ] React Query types recognized
- [ ] No TypeScript errors

### Phase 4 ✓
- [ ] `npm run build --workspace=frontend` passes
- [ ] `npm run lint --workspace=frontend` passes
- [ ] Components render locally

### Phase 5 ✓
- [ ] `npm test --workspace=api` passes (all tests)
- [ ] `npm test --workspace=frontend` passes
- [ ] `npm run test:e2e --workspace=frontend` passes
- [ ] Full build succeeds: `npm run build`

### Phase 6 ✓
- [ ] Docs render without broken links
- [ ] All files documented
- [ ] Deployment guide complete

---

## 🚀 Next Steps

1. Execute Phase 1: Database migrations
2. Verify migrations work
3. Execute Phase 2: Backend API
4. Execute Phase 3: Frontend data layer
5. Execute Phase 4: UI components
6. Execute Phase 5: Testing
7. Execute Phase 6: Docs

**Estimated Total Time**: 13-16 hours

---

## 📝 Notes

- Following existing patterns from ratings system
- Using SQLite (no new vendors)
- React Query for state management
- Tailwind + dark mode support
- Token-based ownership (no auth required)

---

## 🔗 Related Files

- [Ratings System Reference](../api.md#ratings)
- [Architecture Overview](../architecture.md)
- [Database Integration](../sqlite-integration.md)

