# Database Requirements & Versioning

TricklePay stores its indexed stream state in PostgreSQL through Prisma. The repository configures the following versions; configuration and successful test execution are separate evidence.

## PostgreSQL version coverage

| Environment | Configured PostgreSQL version | Verification |
| --- | --- | --- |
| GitHub Actions | **16** (`postgres:16`) | The [CI workflow](../.github/workflows/ci.yml) runs Prisma migrations and the integration suite against this service. Check the workflow result for the commit being deployed. |
| Local development | **17** (`postgres:17-alpine`) | Configured by the [Compose `postgres` service](../docker-compose.yml); this image declaration is not proof that a particular commit has passed tests on 17. |
| Local integration tests | **17** (`postgres:17-alpine`) | Configured by the [Compose `postgres-test` service](../docker-compose.yml), enabled with the `test` profile. Run the integration suite explicitly to verify this configuration. |

**Last verified (2026-10-22): PostgreSQL 16.15.** Migrations applied successfully and **14/14 integration tests passed** in [fork CI run 39752421490, `migration-check`](https://github.com/aziemels-byte/tricklepay-backend/actions/runs/39752421490/job/119735995481). The checkout was GitHub's merge commit `e974bac8998fcdc6efb18f93e06dc1e97847df98`, incorporating PR head `3a56609a57882acc2399025c65e0abc86d68305b`. This run does not establish test coverage for PostgreSQL 17.

PostgreSQL 16 is the oldest version configured for the current CI suite. The repository does not establish a tested minimum version of PostgreSQL 15.0, nor does it use `postgres:15-alpine` in Compose. It also does not demonstrate compatibility with every later major version.

## Verify a different version

Before deploying a different database version, run the repository's migrations and integration suite against an isolated database on that version:

```bash
# Example for the running Compose postgres-test service (PostgreSQL 17).
# For another version, replace this URL with its disposable test database.
export DATABASE_URL=postgresql://tricklepay_test:tricklepay_test@localhost:5433/tricklepay_test
npx prisma migrate deploy
npx vitest run --project integration
```

The integration suite clears its test tables. Use the [Compose test service](../docker-compose.yml) on port 5433 with its separate test database; do not point the suite at development or production data.

## Schema and compatibility

The [Prisma schema](../prisma/schema.prisma) uses bigint identifiers and times, exact `Decimal(40, 0)` amounts, and indexes. These schema choices do not by themselves establish a minimum PostgreSQL major version. Do not infer a PostgreSQL 15 requirement from unsupported claims about UUID generation, JSONB, or PostgreSQL 15-specific upsert features.

When changing version coverage, update the Compose images, CI service image and this document together, and record which versions actually passed migrations and integration tests.
