# Configuration and environment variable precedence

TricklePay uses **Node.js and Fastify**, not NestJS ConfigModule or the
`dotenv` package. At startup, `src/config.ts` calls Node.js
`process.loadEnvFile()`, then `loadConfig()` reads `process.env`,
applies defaults, and validates the settings it owns. The optional `.env`
file is read from the **process working directory**. If the file is absent,
the backend relies on its existing process environment.

For the current variable names, defaults, and validation rules, use the
[README configuration table](../README.md#configuration) and the
[environment template](../.env.example). This guide explains **which
value wins**, rather than duplicating that table.

## Precedence: process environment before `.env`

From highest to lowest priority:

1. **Existing process environment.** Variables exported by a shell,
   provided inline when launching a command, or injected by a container
   runtime or orchestrator take precedence.
2. **Project-root `.env` file.** `process.loadEnvFile()` adds values
   that are not already present in the process environment.
3. **Defaults in `loadConfig()`.** Where a configuration option has a
   default, the loader uses it if its environment value is absent or,
   for its optional/integer helpers, empty or whitespace-only.

**An existing process value is not overwritten by `.env`**, even when
the two have different values. This is Node's `process.loadEnvFile()`
behavior, not a custom NestJS precedence rule.

The service needs valid `DATABASE_URL` and `STREAM_CONTRACT_ID` values
to pass configuration validation. An empty contract ID is not a usable
placeholder; see the README for the required Soroban address format.

## Example: overriding the server port

After copying the environment template, set the required values and a
local port:

```bash
cp .env.example .env
# Edit .env to set STREAM_CONTRACT_ID to the real deployed contract ID.
# DATABASE_URL must also point at your Postgres instance.
```

Suppose `.env` contains:

```dotenv
PORT=3000
```

Run the configuration inspection command with a process-level override:

```bash
PORT=4000 npm run print-config
```

The resolved JSON contains `"port": 4000`, not `3000`. Running
`npm run print-config` without the override uses `PORT=3000` from
`.env`, unless the shell already exports a different `PORT`.

The same rule applies to a real server launch: for example,
`PORT=4000 npm run dev` overrides the port in `.env`.

On hosts using Docker or Kubernetes, the variables **passed into the
backend process** are process-environment values. The orchestrator's
own handling of its environment files and substitutions is separate
from the backend's `process.loadEnvFile()` step.

## Checking effective configuration

```bash
npm run print-config
```

This command calls the same `loadConfig()` used by the backend and
shows the resolved settings without starting the HTTP server. Its
database URL is passed through `redactDatabaseUrl()` to mask embedded
credentials. Do not publish unrelated secrets from your shell, `.env`
file, or terminal history.

Invalid values for validated settings cause `loadConfig()` to reject
the configuration at startup. The full reference is in
[`src/config.ts`](../src/config.ts).

## Exception: `CORS_ORIGIN`

At present, `src/server.ts` reads `process.env.CORS_ORIGIN`
**directly**, rather than taking the value from `loadConfig()`.
Consequently, it is not validated as part of `Config` and does not
appear in `npm run print-config`.

The current CORS registration uses
`origin: process.env.CORS_ORIGIN ?? true`:

- **Unset** (not present): `true` reflects the requesting browser's
  origin.
- **Empty** (`CORS_ORIGIN=`): an empty string is passed to the CORS
  plugin; it does **not** behave like the unset case and can prevent
  the browser from receiving a usable allow-origin header.
- **Set**: the supplied value is passed to the plugin as a single
  origin value. It is not parsed as a comma-separated list.

Copying the current `.env.example` includes an empty `CORS_ORIGIN`
assignment. If you intend the permissive, origin-reflecting default
in local development, **remove or comment out that assignment** rather
than leaving it empty. For a deployment, set the actual frontend
origin, such as `CORS_ORIGIN=https://app.example.com`.

This section describes the implementation as it stands; any later
change to normalize or validate `CORS_ORIGIN` must be reflected here.
