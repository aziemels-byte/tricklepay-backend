# API Error Codes

Every API failure returned by the TricklePay backend includes a stable, machine-readable `code` alongside a human-readable message. This allows client developers to build robust error handling and branch on error categories without having to parse human-readable text.

## Response Shape

The server returns a JSON error object with stable `code`, a human-readable `error` and a `requestId` that corresponds to the `reqId` field in Fastify's structured logs:

```json
{
  "code": "NOT_FOUND",
  "error": "Route GET /missing-path not found",
  "requestId": "client-trace-42"
}
```

- `code` is derived from the HTTP response status; see the status mapping below.
- `error` describes the failure. Server errors (HTTP 5xx) are redacted to `internal server error`.
- `requestId` identifies the same request in server logs.

## Error Codes and HTTP Statuses

These are the error statuses currently produced by the API and its request-handling safeguards, according to `src/error-redaction.ts`, `src/error-handlers.ts` and `src/server.ts`:

| HTTP status | `code` | When returned |
| --- | --- | --- |
| **400 Bad Request** | `VALIDATION_ERROR` | Invalid query parameters, malformed input, or an overlong raw query string. |
| **404 Not Found** | `NOT_FOUND` | Unknown API route or a requested stream that does not exist. |
| **413 Payload Too Large** | `REQUEST_ERROR` | Fastify's request-body limit; currently a safeguard for future body-bearing routes (the API currently exposes GET routes only). |
| **429 Too Many Requests** | `REQUEST_ERROR` | Fixed-window per-IP request rate limit; returns `Retry-After` with seconds until the window resets. |
| **500+ Server Error** | `INTERNAL_SERVER_ERROR` | Unexpected internal server failure; sensitive details are not sent to the client. |

The current application does **not** define authentication/authorization or conflict responses with statuses 401, 403 or 409; they should not appear in the list of currently supported API responses. The `errorCodeForStatus` helper maps other unhandled 4xx statuses to `REQUEST_ERROR` should they be introduced in future.

### Example: rate-limit response (429)

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 25
Content-Type: application/json
```

```json
{
  "code": "REQUEST_ERROR",
  "error": "rate limit exceeded",
  "requestId": "req-abc123"
}
```

Here `25` is an illustrative wait in **seconds**; the implementation rounds up the remaining fixed-window duration. Clients should honor the actual `Retry-After` header before retrying.

### Example: body-limit response (413)

Fastify enforces `BODY_LIMIT` at the server level. If a future endpoint accepts an oversized request body, its status maps to `REQUEST_ERROR`; **there is no current POST upload route** to use as a 413 example.

---


## Log Redaction Behaviour

Error messages sent to clients are redacted to prevent leaking sensitive information such as database connection strings, internal hostnames, or stack traces. The full, unredacted error remains in the server log for operator diagnosis.

### What is Redacted

The following information is stripped from error messages before they reach the client:

1. **Credential-bearing URLs**: Any URL containing embedded credentials (e.g., `postgres://user:password@host/db`) is replaced with `[redacted]`.
2. **Multi-line errors**: Stack traces and multi-line error messages are collapsed to their first line only. Subsequent lines (which often contain file paths, function names, and internal implementation details) are discarded.
3. **Internal server errors**: When the HTTP status is 500 or above, the client receives the generic message `"internal server error"` regardless of the original error text.

### What Remains in the Server Log

The original, unredacted error — including the full stack trace, connection string, SQL fragment, or any other diagnostic detail — is preserved in the structured server log. Every error log entry includes the `reqId` field, which matches the `requestId` returned to the client. Use this request ID to correlate a client-reported failure with its detailed server-side log entry.

### Example

**Original error (server-side):**
```
Invalid prisma.$queryRaw invocation:
Connection failed: postgres://tricklepay:s3cret@db.internal:5432/tricklepay
    at TCP.connect (node:net:123:45)
    at Database.query (/app/db.ts:67:12)
```

**Redacted message (client response):**
```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "error": "internal server error",
  "requestId": "req-abc123"
}
```

**Server log entry (for operator diagnosis):**
```json
{
  "level": 50,
  "time": 1234567890123,
  "reqId": "req-abc123",
  "err": {
    "type": "Error",
    "message": "Invalid prisma.$queryRaw invocation: Connection failed: postgres://tricklepay:s3cret@db.internal:5432/tricklepay",
    "stack": "Error: Invalid prisma.$queryRaw invocation...\n    at TCP.connect (node:net:123:45)\n    at Database.query (/app/db.ts:67:12)"
  },
  "msg": "request failed"
}
```

### Security Rationale

Exposing raw database or RPC errors to clients can leak:
- Database credentials embedded in connection strings
- Internal hostnames and network topology
- Software versions and library paths from stack traces
- SQL query structure and table names

By redacting client responses while preserving full details server-side, operators retain the diagnostic information needed to fix failures without exposing sensitive infrastructure details to external callers.
