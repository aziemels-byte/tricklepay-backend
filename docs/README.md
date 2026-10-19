# Documentation Index

This directory contains technical documentation and operational guides for the TricklePay backend service.

## What belongs in the README vs. docs/

**The main [README.md](../README.md)** is the entry point for developers and operators getting started with the service. It includes:
- Quick start and setup instructions
- High-level architecture overview ("How it works")
- API endpoint reference and example responses
- Configuration reference (environment variables)
- Running locally and testing instructions
- Project structure and contribution guidelines

**The `docs/` directory** holds focused technical documentation and operational guides that are too detailed for the README or cover specialized topics. Documents here assume the reader is already familiar with the service's basic concepts and is looking for depth on a specific area.

## Documents in this directory

- [adding-metrics.md](adding-metrics.md): Steps for defining and registering Prometheus metrics used by the backend.
- [api-error-codes.md](api-error-codes.md): Reference for the stable, machine-readable error codes returned in API failures, their response shape, and the log redaction behaviour that prevents sensitive information from reaching clients.
- [api-versioning.md](api-versioning.md): API stability guarantees, semantic-versioning rules, and the deprecation process.
- [backfill-duration.md](backfill-duration.md): Explains what determines how long an indexer backfill takes, how to estimate remaining progress, and the metric that shows it.
- [CONFIGURATION.md](CONFIGURATION.md): Environment-variable loading and configuration precedence.
- [container-image.md](container-image.md): Container image build, usage, and deployment guidance.
- [database-migrations.md](database-migrations.md): Prisma migration creation, verification, and deployment workflow.
- [database-outage-runbook.md](database-outage-runbook.md): Operator checklist for database outage symptoms, relevant metrics, automatic recovery behavior, and actions for unresolved event failures.
- [database-schema.md](database-schema.md): PostgreSQL schema reference covering models (`Stream`, `IndexedEvent`, `FailedEvent`, `IndexerState`), field definitions, types, indexes, and persistence logic.
- [DATABASE.md](DATABASE.md): PostgreSQL version requirements and supported deployment guidance; distinct from the database-schema.md model reference.
- [derived-figures.md](derived-figures.md): Formulas and runtime computation of derived stream vesting figures.
- [endpoint-failure-modes.md](endpoint-failure-modes.md): Failure scenarios and recovery behavior for the API endpoints.
- [event-replay.md](event-replay.md): Operator guide for the event replay recovery CLI tool (`npm run replay-failed-events`), detailing how to inspect, dry-run, and reprocess failed events.
- [failed-events-retention.md](failed-events-retention.md): Recommended data retention windows and SQL cleanup instructions for pruning unresolved records from the `FailedEvent` table.
- [glossary.md](glossary.md): Terminology definitions for domain and indexer concepts, including cursors, ledgers, backfill, lag, and event application.
- [INDEXER_VERIFICATION.md](INDEXER_VERIFICATION.md): How to verify indexer correctness against on-chain data.
- [indexer-failure-policy.md](indexer-failure-policy.md): Explanation of the skip-and-record failure policy, the liveness vs. completeness trade-off, and where failed events are recorded for operator review.
- [indexer-lag.md](indexer-lag.md): Explains what the `lagLedgers` figure in `GET /status` measures, how it is calculated, what a large value does and does not imply, and how to distinguish a healthy-but-quiet indexer from one that has stopped.
- [indexer-retry-backoff.md](indexer-retry-backoff.md): Describes poll retry timing, exponential backoff, configuration bounds, and the distinction between startup failures and poll-loop retries.
- [indexer-stalled-runbook.md](indexer-stalled-runbook.md): Operator checklist for diagnosing a stalled indexer using `/status`, `/metrics`, and application logs, followed by ordered recovery steps.
- [indexer-start-ledger.md](indexer-start-ledger.md): Guide for choosing the `INDEXER_START_LEDGER` configuration value for new deployments, explaining the trade-offs between backfill duration and historical data completeness.
- [local-network.md](local-network.md): Run the backend with a local Stellar/Soroban network.
- [logging.md](logging.md): Pino structured logging, log fields, and operational diagnostics.
- [request-ids.md](request-ids.md): Documentation on Request ID behavior, client-supplied header validation (`x-request-id`), and traceability in responses and logs.
- [request-lifecycle.md](request-lifecycle.md): End-to-end request processing, handlers, and response lifecycle.
- [request-size-limits.md](request-size-limits.md): Documentation on request body and query string size limits, including defaults, configuration, and rejection behavior.
- [resource-footprint.md](resource-footprint.md): Indicative deployment sizing, per-process Prisma connection usage, and how retained event volume affects PostgreSQL storage growth.
- [shutdown-ordering.md](shutdown-ordering.md): Graceful shutdown sequence and ordering considerations.

## When to add a new document here

Add a new file to `docs/` when:
- The topic is too detailed for the main README (e.g., complete schema field descriptions, detailed operational procedures)
- It documents operator or maintenance workflows (e.g., data retention, manual intervention procedures)
- It explains internal behavior or design decisions that are not immediately needed for basic usage

Keep it in the main README when:
- It's needed to get the service running (setup, installation, configuration)
- It's part of the high-level overview of what the service does and how
- It's a reference that will be consulted frequently (API endpoints, configuration variables)
