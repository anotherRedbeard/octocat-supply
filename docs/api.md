# OctoCAT Supply Chain API

This document describes the Express API implemented in `api/src/index.ts` and
the route modules under `api/src/routes`. The TypeScript source and runtime
middleware are authoritative. The checked-in `api/api-swagger.json` is useful
for reference but is not complete and differs from current runtime behavior in
several places.

## Service

The development server defaults to `http://localhost:3000`. The port is read
from the `PORT` environment variable. The API is mounted under `/api`.

Interactive Swagger UI is served at `/api-docs`, and the generated OpenAPI
document is served as JSON at `/api-docs.json`.

### Authentication

There is no authentication or authorization middleware in the current Express
application. All API, Swagger, and root endpoints are publicly callable to any
client that can reach the server. The frontend may have its own login or
session behavior, but that behavior is not enforced by this API.

The CORS configuration allows the `Authorization` request header, but the API
does not read or validate it. Sending a bearer token therefore does not
authenticate a request.

### Common headers

JSON requests should send:

```http
Content-Type: application/json
```

Responses from successful JSON handlers use `application/json`. A successful
`DELETE` returns no body. Several not-found handlers return plain text rather
than the JSON error envelope described below.

## CORS

CORS is enabled globally with methods `GET`, `POST`, `PUT`, `DELETE`, and
`OPTIONS`, and with credentials enabled. The default allowed origins are:

- `http://localhost:5137`
- `http://localhost:3001`
- `http://127.0.0.1:5137`
- `http://127.0.0.1:3001`
- HTTPS origins matching `*.app.github.dev`
- HTTPS origins matching `*.azurecontainerapps.io`

If `API_CORS_ORIGINS` is set, its comma-separated values replace the defaults.
Allowed request headers are `Content-Type` and `Authorization`. Requests from
other browser origins are not allowed by the CORS middleware. CORS is a browser
policy; it is not authentication and does not protect direct server-to-server
requests.

## Endpoint index

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Health-style greeting |
| `GET` | `/api-docs` | Swagger UI |
| `GET` | `/api-docs.json` | Generated OpenAPI JSON |
| `GET`, `POST` | `/api/branches` | List or create branches |
| `GET`, `PUT`, `DELETE` | `/api/branches/:id` | Read, update, or delete a branch |
| `GET`, `POST` | `/api/deliveries` | List or create deliveries |
| `GET`, `PUT`, `DELETE` | `/api/deliveries/:id` | Read, update, or delete a delivery |
| `PUT` | `/api/deliveries/:id/status` | Update delivery status, optionally notify a partner |
| `GET`, `POST` | `/api/headquarters` | List or create headquarters |
| `GET`, `PUT`, `DELETE` | `/api/headquarters/:id` | Read, update, or delete headquarters |
| `GET` | `/api/headquarters/:id/metrics` | Calculate headquarters metrics |
| `GET` | `/api/headquarters/:id/label` | Create a headquarters label |
| `GET`, `POST` | `/api/orders` | List or create orders |
| `GET`, `PUT`, `DELETE` | `/api/orders/:id` | Read, update, or delete an order |
| `GET`, `POST` | `/api/order-details` | List or create order details |
| `GET`, `PUT`, `DELETE` | `/api/order-details/:id` | Read, update, or delete an order detail |
| `GET`, `POST` | `/api/order-detail-deliveries` | List or create delivery allocations |
| `GET`, `PUT`, `DELETE` | `/api/order-detail-deliveries/:id` | Read, update, or delete an allocation |
| `GET`, `POST` | `/api/products` | List or create products |
| `GET` | `/api/products/:id` | Read a product by ID |
| `GET` | `/api/products/name/:name` | Read a product by name; currently shadowed by `/:id` |
| `PUT`, `DELETE` | `/api/products/:id` | Update or delete a product |
| `GET`, `POST` | `/api/suppliers` | List or create suppliers |
| `GET`, `PUT`, `DELETE` | `/api/suppliers/:id` | Read, update, or delete a supplier |
| `GET` | `/api/suppliers/:id/status` | Derive supplier status |
| `GET`, `POST` | `/api/products/:productId/comments` | List or create product comments |
| `GET`, `PUT`, `DELETE` | `/api/comments/:commentId` | Read, update, or delete a comment |
| `POST` | `/api/comments/:commentId/replies` | Create a reply to a comment |
| `PUT`, `DELETE` | `/api/comments/:commentId/replies/:replyId` | Update or delete a reply |
| `POST`, `DELETE` | `/api/comments/:commentId/reactions` | Set/update or remove a helpful reaction |

All `:id` parameters are passed through `parseInt` without explicit validity
checking. Non-numeric values can become `NaN` and usually result in a not-found
response or a database error rather than a dedicated validation response.

**Comment endpoints** use the `X-Comment-Token` header for ownership verification.
See [Product Comments Guide](./features/PRODUCT_COMMENTS_GUIDE.md) for detailed endpoint documentation.

## Resource schemas

These are the JSON shapes used by the model interfaces and repository mapping.
For create requests, omit the generated primary-key field even though the
Swagger model comments mark it as required. For updates, the repository accepts
the supplied object and can apply partial fields; there is no general request
schema validator in the routes.

### Branch

| Field | Type | Notes |
|---|---|---|
| `branchId` | integer | Generated primary key; response only for normal creates |
| `headquartersId` | integer | Required database foreign key |
| `name` | string | Required database field |
| `description` | string | Nullable in SQLite |
| `address` | string | Nullable in SQLite |
| `contactPerson` | string | Nullable in SQLite |
| `email` | string | Nullable in SQLite |
| `phone` | string | Nullable in SQLite |

Example create body and response:

```json
{
  "headquartersId": 1,
  "name": "Eastside Branch",
  "description": "Eastern district branch",
  "address": "321 East St",
  "contactPerson": "Emma Davis",
  "email": "edavis@octo.com",
  "phone": "555-0203"
}
```

```json
{
  "branchId": 1,
  "headquartersId": 1,
  "name": "Eastside Branch",
  "description": "Eastern district branch",
  "address": "321 East St",
  "contactPerson": "Emma Davis",
  "email": "edavis@octo.com",
  "phone": "555-0203"
}
```

### Delivery

| Field | Type | Notes |
|---|---|---|
| `deliveryId` | integer | Generated primary key |
| `supplierId` | integer | Required database foreign key |
| `deliveryDate` | string | Required database field; commonly an ISO date/time string |
| `name` | string | Required database field |
| `description` | string | Nullable in SQLite |
| `status` | string | Defaults to `pending` in SQLite; the model does not enforce an enum |

The route-level status comment lists `pending`, `in-transit`, `delivered`, and
`failed`, but the handler accepts any supplied string and the database has no
status check constraint.

Example:

```json
{
  "deliveryId": 1,
  "supplierId": 2,
  "deliveryDate": "2026-08-04T12:00:00.000Z",
  "name": "Weekly shipment",
  "description": "Warehouse delivery",
  "status": "pending"
}
```

### Headquarters

| Field | Type | Notes |
|---|---|---|
| `headquartersId` | integer | Generated primary key |
| `name` | string | Required database field |
| `description` | string | Nullable in SQLite |
| `address` | string | Nullable in SQLite |
| `contactPerson` | string | Nullable in SQLite |
| `email` | string | Nullable in SQLite |
| `phone` | string | Nullable in SQLite |
| `city` | string | Optional model field; not present in the initial migration |
| `country` | string | Optional model field; not present in the initial migration |
| `floorCount` | integer | Optional model field; used by metrics |
| `capacity` | integer | Optional model field; used by metrics |

Example:

```json
{
  "headquartersId": 1,
  "name": "North America HQ",
  "description": "Primary office",
  "address": "1 Main Street",
  "contactPerson": "Alex Smith",
  "email": "hq@example.com",
  "phone": "555-0100",
  "city": "Seattle",
  "country": "US",
  "floorCount": 4,
  "capacity": 250
}
```

### Order

| Field | Type | Notes |
|---|---|---|
| `orderId` | integer | Generated primary key |
| `branchId` | integer | Required database foreign key |
| `orderDate` | string | Required database field; commonly an ISO date/time string |
| `name` | string | Required database field |
| `description` | string | Nullable in SQLite |
| `status` | string | Defaults to `pending`; the model does not enforce an enum |

### OrderDetail

| Field | Type | Notes |
|---|---|---|
| `orderDetailId` | integer | Generated primary key |
| `orderId` | integer | Required foreign key |
| `productId` | integer | Required foreign key |
| `quantity` | integer | Required database field; no route-level range validation |
| `unitPrice` | number | Required database field |
| `notes` | string | Nullable in SQLite |

### OrderDetailDelivery

| Field | Type | Notes |
|---|---|---|
| `orderDetailDeliveryId` | integer | Generated primary key |
| `orderDetailId` | integer | Required foreign key |
| `deliveryId` | integer | Required foreign key |
| `quantity` | integer | Required database field |
| `notes` | string | Nullable in SQLite |

### Product

| Field | Type | Notes |
|---|---|---|
| `productId` | integer | Generated primary key |
| `supplierId` | integer | Required database foreign key |
| `name` | string | Required database field |
| `description` | string | Nullable in SQLite |
| `price` | number | Required database field |
| `sku` | string | Required database field |
| `unit` | string | Required database field |
| `imgName` | string | Nullable in SQLite |
| `discount` | number | Defaults to `0.0` in SQLite |

### ProductComment

| Field | Type | Notes |
|---|---|---|
| `commentId` | integer | Generated primary key |
| `productId` | integer | Required database foreign key |
| `authorName` | string | Optional; max 100 characters |
| `content` | string | Required; 1–500 character limit |
| `ownershipToken` | string | 16–255 chars, NOT exposed to frontend |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |
| `replies` | CommentReply[] | Nested replies (read-only in responses) |
| `helpfulCount` | integer | Count of helpful reactions |
| `userReaction` | UserReaction | Current user's reaction (if token provided) |

**Example response:**

```json
{
  "commentId": 1,
  "productId": 123,
  "authorName": "Alice",
  "content": "Great product! Exactly what I needed.",
  "createdAt": "2026-08-10T14:22:00Z",
  "updatedAt": "2026-08-10T14:22:00Z",
  "helpfulCount": 3,
  "replies": [
    {
      "replyId": 5,
      "commentId": 1,
      "authorName": "Bob",
      "content": "I agree!",
      "createdAt": "2026-08-10T14:25:00Z",
      "updatedAt": "2026-08-10T14:25:00Z",
      "helpfulCount": 1,
      "userReaction": null
    }
  ],
  "userReaction": {
    "reactionId": 12,
    "isHelpful": true
  }
}
```

**Create request body:**

```json
{
  "content": "Great product!",
  "authorName": "Alice"
}
```

Requests must include `X-Comment-Token` header for ownership tracking.

### Supplier

| Field | Type | Notes |
|---|---|---|
| `supplierId` | integer | Generated primary key |
| `name` | string | Required database field |
| `description` | string | Nullable in SQLite |
| `contactPerson` | string | Nullable in SQLite |
| `email` | string | Nullable in SQLite |
| `phone` | string | Nullable in SQLite |
| `active` | boolean | Stored as SQLite integer; defaults to true |
| `verified` | boolean | Stored as SQLite integer; defaults to false |

Example:

```json
{
  "supplierId": 2,
  "name": "Acme Components",
  "description": "Electronic components",
  "contactPerson": "Jordan Lee",
  "email": "jordan@example.com",
  "phone": "555-0102",
  "active": true,
  "verified": false
}
```

## CRUD endpoints

The following pattern applies to each resource collection listed below.

### List resources

```http
GET /api/{resource}
```

No query parameters are read by the route. The response is `200` with a JSON
array of the resource schema. Empty collections return `[]`.

### Create a resource

```http
POST /api/{resource}
Content-Type: application/json
```

The request body is the resource schema without its primary-key field. The
handler casts `req.body` to the TypeScript type but does not validate it before
calling the repository. A successful create returns `201` with the created
resource, including its generated ID.

Foreign-key violations are returned as `400 VALIDATION_ERROR`; uniqueness
violations are returned as `409 CONFLICT`; other database failures use the
standard database errors below.

### Read by ID

```http
GET /api/{resource}/{id}
```

`id` is a required integer path parameter. A successful lookup returns `200`
with one resource. A missing resource returns `404` and a plain-text message
such as `Product not found` rather than the JSON error envelope.

### Update by ID

```http
PUT /api/{resource}/{id}
Content-Type: application/json
```

The body is an object containing fields to update. The route does not perform
general schema validation. A successful update returns `200` with the updated
resource. A missing resource returns `404` with a plain-text message. Database
constraint failures use the JSON error envelope.

### Delete by ID

```http
DELETE /api/{resource}/{id}
```

A successful delete returns `204` with an empty body. A missing resource
returns `404` with a plain-text message. Foreign-key cascades are defined by
the SQLite schema, so deleting a parent can also delete related records.

The CRUD resources are:

- `/api/branches` using the Branch schema
- `/api/deliveries` using the Delivery schema
- `/api/headquarters` using the Headquarters schema
- `/api/orders` using the Order schema
- `/api/order-details` using the OrderDetail schema
- `/api/order-detail-deliveries` using the OrderDetailDelivery schema
- `/api/products` using the Product schema
- `/api/suppliers` using the Supplier schema

Each collection exposes `GET` and `POST`; each `/:id` path exposes `GET`,
`PUT`, and `DELETE`, except that the specialized routes described next add
resource-specific behavior.

## Specialized endpoints

### Update delivery status

```http
PUT /api/deliveries/{id}/status
Content-Type: application/json
```

Path parameters:

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | integer | yes | Delivery ID |

Request body:

```json
{
  "status": "delivered",
  "deliveryPartner": "acme-logistics"
}
```

`status` is read from the body and passed to the repository without route-level
validation. `deliveryPartner` is optional. Without it, the response is `200`
with the updated Delivery object. With it, the handler executes
`notify {deliveryPartner}` and responds with:

```json
{
  "delivery": {
    "deliveryId": 1,
    "supplierId": 2,
    "deliveryDate": "2026-08-04T12:00:00.000Z",
    "name": "Weekly shipment",
    "description": "Warehouse delivery",
    "status": "delivered"
  },
  "commandOutput": "notification output\n"
}
```

Status codes are `200` for success, `404` with plain text when the delivery is
missing, `500` with `{ "error": "..." }` if the external command fails, and
the standard JSON database error envelope for other repository failures.

Security caveat: `deliveryPartner` is interpolated directly into a shell
command passed to Node's `exec`. Because this endpoint has no authentication,
an attacker who can reach the API may be able to execute shell metacharacters.
Do not expose this endpoint beyond a trusted environment until the command
execution is removed or replaced with a safe, allow-listed process invocation.

### Product by name

```http
GET /api/products/name/{name}
```

The intended parameter is the required URL path parameter `name`, a product
name string. The intended success response is `200` with a Product and the
intended missing response is `404` with `Product not found`.

Current runtime behavior: `router.get('/:id')` is registered before
`router.get('/name/:name')`. Express therefore matches `/name/{name}` as the
ID route first, parses `name` as `NaN`, and does not reach the name handler.
This operation is currently not reliably usable and should be treated as a
documented-vs-actual mismatch.

### Supplier status

```http
GET /api/suppliers/{id}/status
```

The required `id` path parameter is an integer supplier ID. A successful `200`
response is:

```json
{
  "status": "APPROVED"
}
```

The current helper returns `APPROVED` when `active` is truthy and `PENDING`
otherwise. `verified` is logged but does not affect the returned value. A
missing supplier returns `404` with `Supplier not found`.

### Headquarters metrics

```http
GET /api/headquarters/{id}/metrics
```

For an existing headquarters, the `200` response has this shape:

```json
{
  "score": 255,
  "average": 2.5,
  "display": "HQ-14"
}
```

The values are calculated from `headquartersId`, `floorCount` (or `0`), and
`capacity` (or `0`): `score` is their sum, `average` is `(id + floorCount) / 2`,
and `display` is `HQ-{id}{floorCount}`. A missing headquarters returns `404`
with `Headquarters not found`.

### Headquarters label

```http
GET /api/headquarters/{id}/label
```

The required `id` path parameter is an integer. A successful `200` response is:

```json
{
  "label": "Location:North America HQCity:SeattleCountry:US"
}
```

The current implementation concatenates the three values without separators.
A missing headquarters returns `404` with `Headquarters not found`.

### Root greeting

```http
GET /
```

Returns `200` with the plain-text body:

```text
Hello, world!
```

## Error responses

Repository and database errors are passed to the global error middleware. The
JSON envelope is:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error: Invalid reference to related entity"
  }
}
```

| HTTP status | Code | When it is used |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Invalid foreign-key reference, SQLite constraint validation, or explicit validation error |
| `404` | `NOT_FOUND` | Repository-level not-found error; most route handlers instead send plain text |
| `409` | `CONFLICT` | SQLite unique constraint violation |
| `500` | `DATABASE_ERROR` | Other database operation failures |
| `500` | `INTERNAL_ERROR` | Unhandled non-database errors |
| `503` | `DATABASE_BUSY` | SQLite is busy or locked |

The default unhandled-error response is:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

Not-found responses generated directly by the route handlers are plain text,
for example:

```text
Supplier not found
```

The headquarters create and update handlers intend to return `400 Invalid
headquarters data` for invalid input. In the current source, the validator is
called with a string while it expects an object with a `name` property, so it
throws before `isValid()` is reached. That exception is handled as an
`INTERNAL_ERROR` `500` response instead.

Malformed JSON rejected by `express.json()` is handled by Express's parser
error path rather than the database error middleware and should not be assumed
to use the JSON envelope above.

## Documentation and implementation mismatches

- `api/api-swagger.json` documents the 16 base resource paths but does not
  include `/api/products/name/{name}`, `/api/suppliers/{id}/status`,
  `/api/headquarters/{id}/metrics`, or `/api/headquarters/{id}/label`.
- The generated Swagger comments describe the product-name route, but route
  registration order causes `/:id` to shadow it.
- Swagger model comments mark primary keys as required for create request
  bodies, while repositories generate IDs when the primary key is omitted.
- Swagger comments describe richer fields for Delivery, Order, and Product
  than the current TypeScript interfaces and SQLite tables actually expose.
- Swagger not-found responses are underspecified. Runtime handlers usually
  return plain-text `404` responses, not the shared JSON error envelope.
- Swagger lists a delivery status enum, but the handler and database do not
  enforce that enum.
- The runtime Swagger server definition includes both HTTP and HTTPS localhost
  URLs based on `PORT`; the checked-in JSON only lists HTTP on port 3000.

## Security and operational caveats

- No authentication, authorization, rate limiting, or audit logging is present
  in the Express application.
- `Authorization` is allowed by CORS but ignored.
- The delivery notification endpoint passes user input to a shell command.
- CORS defaults are suitable for the listed development/frontend origins, not
  a general production deployment. Set `API_CORS_ORIGINS` explicitly for a
  hardened deployment.
- Request bodies are cast to TypeScript interfaces rather than validated at
  runtime. Clients should not rely on TypeScript types as server-side input
  validation.
- SQLite foreign keys use cascading deletes for related records. Deleting
  suppliers, headquarters, branches, orders, products, deliveries, or order
  details can remove dependent data.