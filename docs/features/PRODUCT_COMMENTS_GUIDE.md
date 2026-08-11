# Product Comments & Feedback Feature Guide

## Overview

The Product Comments & Feedback feature allows customers to share detailed feedback about products, reply to other comments, and mark helpful feedback. This feature is distinct from the product ratings system, providing richer interaction and community-driven insights.

## Key Features

### 1. **Comments**
- **Content**: 1–500 character limit per comment
- **Optional Author Names**: Users can optionally provide a name (max 100 characters). Anonymous comments are fully supported.
- **Ownership**: Browser-local tokens (UUID) track comment ownership without requiring user accounts
- **Timestamps**: Created and updated timestamps with "(edited)" indicator when modified
- **Edit/Delete**: Authors can edit or delete their own comments via ownership token verification

### 2. **Replies**
- **Nested Replies**: Single-level replies to comments (1 depth only)
- **Same Validation Rules**: Content length 1–500 characters, optional author names
- **Ownership Verification**: Only comment authors can delete replies, but any user can add replies
- **Cascading Delete**: Deleting a comment automatically removes all its replies

### 3. **Reactions**
- **Helpful / Not Helpful**: Users can mark comments as helpful or toggle to not helpful
- **Per-User Tracking**: Each user token can only have one reaction per comment
- **UPSERT Behavior**: Clicking the reaction button toggles between helpful/not helpful/removed
- **Aggregated Count**: Display total helpful reactions across all users

### 4. **UI/UX**
- **Blue Theme**: Comment cards use blue background (bg-blue-50 light, bg-blue-900 dark)
- **Gray Theme for Replies**: Reply cards use gray (bg-gray-50 light, bg-gray-800 dark) to distinguish hierarchy
- **Dark Mode Support**: Full Tailwind dark mode support with `dark:` prefix classes
- **Modern Design**: Clean card layout with clear visual hierarchy
- **Responsive**: Works on mobile, tablet, and desktop

## Technical Architecture

### Database Schema

#### `product_comments` Table
```sql
CREATE TABLE product_comments (
  comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL CHECK (length(content) >= 1 AND length(content) <= 500),
  ownership_token TEXT NOT NULL CHECK (length(ownership_token) >= 16 AND length(ownership_token) <= 255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  INDEX idx_product_id_created_at (product_id, created_at DESC)
);
```

#### `comment_replies` Table
```sql
CREATE TABLE comment_replies (
  reply_id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL CHECK (length(content) >= 1 AND length(content) <= 500),
  ownership_token TEXT NOT NULL CHECK (length(ownership_token) >= 16 AND length(ownership_token) <= 255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES product_comments(comment_id) ON DELETE CASCADE,
  INDEX idx_comment_id_created_at (comment_id, created_at DESC)
);
```

#### `comment_reactions` Table
```sql
CREATE TABLE comment_reactions (
  reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  ownership_token TEXT NOT NULL CHECK (length(ownership_token) >= 16 AND length(ownership_token) <= 255),
  is_helpful INTEGER NOT NULL DEFAULT 1 CHECK (is_helpful IN (0, 1)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES product_comments(comment_id) ON DELETE CASCADE,
  UNIQUE (comment_id, ownership_token),
  INDEX idx_comment_id (comment_id)
);
```

### API Endpoints

All endpoints use the `X-Comment-Token` header for ownership verification.

#### Comment Endpoints

**GET** `/api/products/:productId/comments`  
- List all comments for a product (newest first)
- Optional `X-Comment-Token` header to include user's reactions
- Returns: Array of ProductComment objects with nested replies

**POST** `/api/products/:productId/comments`  
- Create a new comment
- Required header: `X-Comment-Token`
- Body: `{ content: string, authorName?: string }`
- Returns: 201 Created with new ProductComment

**GET** `/api/comments/:commentId`  
- Retrieve single comment with all replies and reactions
- Optional `X-Comment-Token` header for user reaction
- Returns: ProductComment object with nested replies and reaction counts

**PUT** `/api/comments/:commentId`  
- Update a comment (content and/or author name)
- Required header: `X-Comment-Token` (must match comment owner)
- Body: `{ content?: string, authorName?: string }`
- Returns: 200 OK with updated comment

**DELETE** `/api/comments/:commentId`  
- Delete a comment (cascades to replies and reactions)
- Required header: `X-Comment-Token` (must match comment owner)
- Returns: 204 No Content

#### Reply Endpoints

**POST** `/api/comments/:commentId/replies`  
- Create a reply to a comment
- Required header: `X-Comment-Token`
- Body: `{ content: string, authorName?: string }`
- Returns: 201 Created with new CommentReply

**PUT** `/api/comments/:commentId/replies/:replyId`  
- Update a reply
- Required header: `X-Comment-Token` (must match reply owner)
- Body: `{ content?: string, authorName?: string }`
- Returns: 200 OK with updated reply

**DELETE** `/api/comments/:commentId/replies/:replyId`  
- Delete a reply
- Required header: `X-Comment-Token` (must match reply owner)
- Returns: 204 No Content

#### Reaction Endpoints

**POST** `/api/comments/:commentId/reactions`  
- Set or update a reaction (helpful / not helpful)
- Required header: `X-Comment-Token`
- Body: `{ isHelpful: boolean }`
- Returns: 200 OK with reaction result

**DELETE** `/api/comments/:commentId/reactions`  
- Remove a user's reaction from a comment
- Required header: `X-Comment-Token`
- Returns: 204 No Content

### Frontend Components

#### ProductCommentsSection
- Root container component
- Manages data fetching and error states
- Coordinates all child components
- Props: `productId: number`

#### CreateCommentForm
- Form for creating new comments
- Features: Character counter, optional author input, validation
- Props: `onSubmit: (input: CreateCommentInput) => Promise<void>`, `isLoading: boolean`

#### CommentCard
- Displays single comment with full interaction surface
- Features: Author name, timestamps, edit/delete buttons, reactions, replies section
- Props: `comment: ProductComment`, `canEdit: boolean`, callback functions for mutations

#### RepliesSection
- Expandable container for replies to a comment
- Toggle button with reply count
- Props: `replies: CommentReply[]`, callback functions

#### ReplyCard
- Displays single reply
- Features: Author name, timestamps, edit/delete buttons
- Props: `reply: CommentReply`, `canEdit: boolean`, callback functions

#### CreateReplyForm
- Compact form for adding replies
- Props: `onSubmit: (input: CreateReplyInput) => Promise<void>`, `onCancel: () => void`, `isLoading: boolean`

#### CommentsSkeleton
- Loading placeholder
- Animated blue card placeholders
- Displays during data fetching

### Frontend State Management

**Token Management** (`frontend/src/api/commentToken.ts`)
- `getOrCreateCommentToken()`: Returns existing or creates new browser-local UUID
- `clearCommentToken()`: Removes token (for testing/logout)

**API Client** (`frontend/src/api/comments.ts`)
- Axios-based functions with automatic token injection
- Functions: getProductComments, getCommentById, createComment, updateComment, deleteComment, createReply, updateReply, deleteReply, setReaction, removeReaction

**React Query Hooks** (`frontend/src/api/useComments.ts`)
- `useProductCommentsQuery(productId)`: Fetch all comments for product
- `useCommentByIdQuery(commentId)`: Fetch single comment
- Mutation hooks: useCreateCommentMutation, useUpdateCommentMutation, useDeleteCommentMutation, useCreateReplyMutation, useUpdateReplyMutation, useDeleteReplyMutation, useSetReactionMutation, useRemoveReactionMutation
- Automatic query invalidation on mutations
- Query key scoping by product ID and user token

## Testing

### Repository Tests (24 test cases)
- **Comments** (14): CRUD, validation, ownership, FK constraints
- **Replies** (6): Creation, nesting, updates, deletes
- **Reactions** (4): Set, toggle, remove, aggregation

Run: `npm test --workspace=api`

### Route Tests (15 test cases)
- All 11 API endpoints with success/error cases
- HTTP status codes validation
- Ownership verification
- Error handling

### E2E Tests (10 test scenarios)
- Create, read, edit, delete comments
- Add and manage replies
- Mark reactions as helpful
- Form validation
- Anonymous comment support
- Dark mode support

Run: `npm run test:e2e` (requires `npm run dev` to be running)

## Browser Token Model

The system uses browser-local UUID-based ownership:

1. **Token Generation**: On first comment creation, a UUID is generated and stored in localStorage
2. **Token Transmission**: All API requests include `X-Comment-Token` header
3. **Server Validation**: Token is 16–255 characters, verified before mutations
4. **Ownership Verification**: Only comments/replies created with a token can be edited/deleted by that token
5. **Privacy**: Tokens are NEVER exposed to frontend after initial localStorage storage
6. **Fallback**: If `crypto.randomUUID()` unavailable (non-crypto browsers), uses timestamp-based fallback

This model provides:
- ✅ Ownership tracking without user accounts
- ✅ Anonymous comment support
- ✅ Simple implementation
- ✅ Per-browser ownership (not cross-device)

## CSS Classes & Styling

### Color Schemes
- **Comments**: Blue theme (`bg-blue-50` light, `bg-blue-900` dark)
- **Replies**: Gray theme (`bg-gray-50` light, `bg-gray-800` dark)
- **Text**: `text-gray-700` light, `dark:text-gray-300` dark
- **Buttons**: Tailwind default blue-600 / blue-500 dark

### Dark Mode
All components use Tailwind's `dark:` prefix for dark mode support. Test by toggling dark mode in browser DevTools or application theme switcher.

### Responsive Breakpoints
- Mobile: Full width with padding
- Tablet (md): Standard card layout
- Desktop (lg): With sidebar context

## Deployment

The feature is included in the monorepo build:
```bash
# Build all
npm run build

# Build frontend only
npm run build --workspace=frontend

# Build API only
npm run build --workspace=api
```

Docker deployment includes the migration in the startup sequence via `api/src/init-db.ts`.

## Configuration

### Character Limits
- Comment/Reply content: 1–500 characters (enforced at repository level)
- Author name: Max 100 characters
- Ownership token: 16–255 characters

### Pagination
- Currently: No pagination (all comments returned)
- Future: Consider implementing with `LIMIT` / `OFFSET`

### Caching
- React Query: 30-second stale time for comment data
- Query key: `['comments', productId, token]` for per-user scoping

## Troubleshooting

### Comments Not Appearing
- Verify product ID is correct
- Check browser console for API errors
- Ensure migrations ran: `npm run build --workspace=api`

### Can't Edit Own Comments
- Verify browser token is stored in localStorage: `octocat.commentToken`
- Check that `X-Comment-Token` header is sent (dev console Network tab)
- Ensure same browser/device where comment was created

### Dark Mode Not Working
- Check if `dark` class applied to `<html>` element
- Verify Tailwind config includes `darkMode: 'class'`
- Clear browser cache and reload

## Future Enhancements

1. **Moderation**: Admin approval for comments
2. **Spam Detection**: Simple keyword filtering
3. **Pagination**: Load comments in batches
4. **Sorting**: By date, helpful reactions, replies count
5. **Analytics**: Track comment engagement metrics
6. **Notifications**: Notify comment authors of replies
7. **User Accounts**: Link comments to registered users
8. **Attachments**: Images/files in comments
9. **Mentions**: @username notifications
10. **Profanity Filter**: Automatic content filtering

## Related Documentation

- [Architecture Overview](./architecture.md) — System design and data flow
- [API Documentation](./api.md) — Complete endpoint reference
- [Build & Deployment](./deployment.md) — Deployment instructions
- [SQLite Integration](./sqlite-integration.md) — Database details
