# Request Limits

The TricklePay backend enforces configurable limits on incoming HTTP requests to protect against resource exhaustion and malformed payloads. This document describes the limits, their defaults, and the behavior when they are exceeded.

## Overview

Three separate limits are enforced:

1. **Body size limit**: Maximum request-body size enforced by Fastify. This is a safeguard for future body-bearing routes; the current service exposes only GET API routes.
2. **Query string limit**: Maximum length of the URL query string portion.
3. **Request rate limit**: Maximum requests from one client IP in a fixed time window.

The three request limits use four environment variables. The separate response-compression threshold is listed alongside them below.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BODY_LIMIT` | `1048576` (1 MiB) | Maximum request body size in bytes |
| `QUERY_STRING_LIMIT` | `2048` | Maximum raw URL query string length (JavaScript string length); `0` disables this check |
| `RATE_LIMIT_MAX` | `100` | Maximum requests per client IP per rate-limit window |
| `RATE_LIMIT_WINDOW_MS` | `60000` (1 minute) | Duration of the fixed request rate-limit window in milliseconds |
| `COMPRESSION_THRESHOLD_BYTES` | `1024` (1 KiB) | Response-size threshold for compression; separate from request limits |

### Setting Custom Limits

For a Bash shell, export the variables before starting the server as shown below. In `.env`, use the same assignments without `export`:

```bash
# Configure a 2 MiB body limit for future body-bearing routes
export BODY_LIMIT=2097152

# Allow up to 4096 raw query-string code units
export QUERY_STRING_LIMIT=4096

# Allow 100 requests per client IP per minute
export RATE_LIMIT_MAX=100
export RATE_LIMIT_WINDOW_MS=60000

# Compress eligible responses at the 1 KiB threshold
export COMPRESSION_THRESHOLD_BYTES=1024
```

**Units:** `BODY_LIMIT` is in bytes; `QUERY_STRING_LIMIT` is checked against the raw query string's JavaScript `.length` (UTF-16 code units, not a byte count). `RATE_LIMIT_MAX` is a request count and `RATE_LIMIT_WINDOW_MS` is in milliseconds. `COMPRESSION_THRESHOLD_BYTES` also counts bytes. 1 KiB = 1024 bytes and 1 MiB = 1048576 bytes.

## Body Size Limit

Fastify configures a maximum request-body size using `config.bodyLimit`. **The current TricklePay API exposes GET routes only**, so no existing API endpoint accepts JSON uploads, file uploads, or POST/PUT/PATCH bodies. This limit is in place for any future body-bearing route; it is not a currently usable upload limit.

### When the Limit is Exceeded

**Status Code:** `413 Payload Too Large`

**Response:**
```json
{
  "code": "REQUEST_ERROR",
  "error": "Request body is too large",
  "requestId": "req-1234"
}
```

**Behavior:** Fastify rejects an oversized body while parsing it, before a body-bearing route handler runs. This is a description of the server safeguard, **not a request you can reproduce against the current GET-only API**. An unsupported POST request should not be used as a body-limit test.

## Query String Limit

For ordinary URLs, the query string limit applies to the portion after `?`, including all parameters and their values. For compatibility with the router's handling of raw request targets, a literal `#` also acts as a query delimiter: the first literal `?` or `#` wins. Browser URL fragments normally are not sent to the server, and an encoded `%23` is not a delimiter.

### When the Limit is Exceeded

**Status Code:** `400 Bad Request`

**Response:**
```json
{
  "code": "VALIDATION_ERROR",
  "error": "query string too long",
  "requestId": "req-1234"
}
```

**Behavior:** The `onRequest` hook rejects the request before its route handler and database access. Fastify has already parsed the query string during routing; this check does not run before parsing.

### Example

```bash
# With the server using its default QUERY_STRING_LIMIT=2048:
# Query the real GET /streams route with over 2,048 query characters.
curl -i -H 'x-request-id: req-1234' "http://localhost:3000/streams?$(node -e 'process.stdout.write("sender=" + "x".repeat(3000))')"

# Response: 400 Bad Request
# {"code":"VALIDATION_ERROR","error":"query string too long","requestId":"req-1234"}
```

### What Counts Toward the Limit

The entire portion after the first `?` or literal `#` in the raw request URL is measured, including any additional literal `?` or `#` characters; the path, hostname, and protocol are excluded. The server uses JavaScript `rawQuery.length`, so the limit counts UTF-16 code units of the raw query string rather than the decoded parameters or their byte size.

## Request Rate Limit

Each client IP is allowed `RATE_LIMIT_MAX` requests during a fixed window of `RATE_LIMIT_WINDOW_MS`. The default is 100 requests per minute. When the limit is exceeded, the server returns HTTP 429 with a `Retry-After` header containing the remaining window duration in seconds, rounded up to the next whole second.

The in-memory limiter is local to one server process, so clients behind a load balancer may receive a separate allowance from each instance. Fastify uses the direct peer address unless the proxy is listed in `TRUSTED_PROXIES`; only configure trusted proxies when they overwrite forwarded client-IP headers.

For `http://localhost:3000/streams?limit=50&offset=100`, only `limit=50&offset=100` is measured (19 code units). The pathname and the leading `?` do not count.

## Response Compression

Response size is separate from the request limits above, but it is controlled by a related threshold. Large list responses (for example `/streams` with 100 streams) are mostly repetitive JSON, so the service registers `@fastify/compress` and compresses any response at or above `COMPRESSION_THRESHOLD_BYTES` (default `1024`) when the client advertises `gzip` or `br` via `Accept-Encoding`.

- **Above the threshold, client accepts gzip/brotli:** the response carries a `Content-Encoding` header (`gzip` or `br`) and a compressed body.
- **Below the threshold:** the response is sent uncompressed, because the encoding overhead would outweigh the saving for small bodies.
- **Client does not opt in:** the response is sent uncompressed regardless of size.

Compression cuts transfer size for clients on metered or slow links. The threshold is configurable via `COMPRESSION_THRESHOLD_BYTES`; lower it to compress more responses, or raise it if CPU cost on the server matters more than transfer size.

## Why These Limits Exist

1. **Body limit:** Guards against unbounded request bodies if the service later adds body-bearing endpoints. No current API route accepts them.

2. **Query string limit:** Prevents abuse via extremely long URLs. Web servers and proxies often have their own URL length limits (commonly 4KB-8KB), and excessively long query strings can bypass caching or cause parsing issues.

3. **Rate limit:** Bounds request frequency per client IP and server process.

## Debugging Limit Errors

If a legitimate request is rejected:

1. **Check the request:** For GET requests, inspect only the part of the raw request URL after its first `?` or literal `#`; its JavaScript string length must fit `QUERY_STRING_LIMIT`. The body limit applies to no current route.
2. **Reduce the query:** Use supported pagination parameters (`limit`, `offset` or `cursor`), avoid oversized filters, and remove unnecessary query parameters. The API does not offer a POST alternative.
3. **Adjust the appropriate limit:** If the query is valid and legitimately needs more space, raise `QUERY_STRING_LIMIT`; changes to `BODY_LIMIT` do not affect GET query strings.

### Checking Request Size

**Query string length (client-side):**
```bash
# Match the server's JavaScript string-length check for this ASCII query.
node -e 'console.log("limit=50&offset=100".length)'
# Output: 19
```

The check uses the **raw** query string (including percent-encoded characters). The numeric result above is for the ASCII example and is not a body byte count.

**Inspecting rejected requests (server logs):**
The request ID in the error response matches the `reqId` field in structured logs. The GET example above supplies `req-1234` explicitly; requests without a safe `x-request-id` receive a generated UUID. A completion entry includes these fields (timestamp, process, host and duration fields omitted):

```json
{"level":30,"reqId":"req-1234","res":{"statusCode":400},"msg":"request completed"}
```

Capture process output and search for that ID:

```bash
# By default Pino writes JSON logs to stdout.
# Start the server with JSON output redirected to a file:
QUERY_STRING_LIMIT=2048 LOG_PRETTY=false npm run dev > server.stdout.log 2>&1
# In another shell, run the GET example above, then search the captured output:
grep '"reqId":"req-1234"' server.stdout.log

# For a containerized deployment:
docker compose logs api | grep '"reqId":"req-1234"'
```

## Implementation Details

- **Body limit:** Enforced by Fastify's built-in `bodyLimit` option, which reads from `config.bodyLimit` (no current route consumes a body).
- **Query string limit:** Enforced by a custom `onRequest` hook in `src/server.ts`, using `rawQuery.length` after routing/query parsing but before the route handler. Ordinary URLs use `?`; to match the `find-my-way` router's raw-target handling, the guard uses `search(/[?#]/)` and `slice` to measure everything after the first literal `?` or `#`. Percent-encoded `%23` is data, not a delimiter.
- **Rate limit:** Enforced by the per-IP fixed-window `onRequest` hook in `src/server.ts`, returning HTTP 429 and a `Retry-After` header.
- **Compression threshold:** Enforced by `@fastify/compress` using `config.compressionThresholdBytes`; it applies to responses, not requests.

See `src/config.ts` for the default values and `src/server.ts` for the rejection logic.

## Common Scenarios

### Scenario 1: Large Stream List Query

**Problem:** A client requests `GET /streams` with an overly long query string.

**Solution:**
- Keep supported pagination parameters (`limit`, `offset`, `cursor`) and remove unnecessary filters.
- If the encoded query is still legitimately longer than the configured limit, raise `QUERY_STRING_LIMIT`.
- Do not POST the filters; this API does not implement a POST query route.

### Scenario 2: Rate Limit on Repeated Stream Reads

**Problem:** A client repeatedly requests `GET /streams?limit=50`, exceeding the fixed per-IP request window.

**Solution:**
- Respect the HTTP 429 `Retry-After` header before retrying.
- Reduce polling frequency, batch pagination efficiently, or adjust `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` for authorized workloads.

## Further Reading

- [Fastify Body Limit Documentation](https://fastify.dev/docs/latest/Reference/Server/#bodylimit)
- [RFC 7230 Section 3.1.1: Request Line Length](https://datatracker.ietf.org/doc/html/rfc7230#section-3.1.1)
