# Integration Test Runner

This integration runner works on Windows, macOS, and Linux.

## Test organization

Tests are grouped by:

1. Entry path (`backend`, `frontend`, or `ui`)
2. Feature folder (`cleaning`, and future features)

Current structure:

```text
integration/
	tests/
		_shared/
			cleaning-flow-helpers.mjs
		backend/
			cleaning/
				ingest-cleaning-flow.test.mjs
		frontend/
			app-shell/
				root-shell.test.mjs
			cleaning/
				proxy-cleaning-flow.test.mjs
			ui/
				rfm/
					ui-rfm.test.mjs
```

## Runner vs tests folder

`run-integration-tests.mjs` only handles framework concerns:

1. Service readiness checks.
2. Test discovery and execution.
3. JUnit report output.

Feature/domain logic belongs under `integration/tests/**`.

1. Put feature tests in `integration/tests/backend/<feature>/` or `integration/tests/frontend/<feature>/`.
2. Put reusable feature helpers in `integration/tests/_shared/`.

### Where a test should go

Put tests in `integration/tests/backend/<feature>/` when:

1. The test starts at backend API endpoints directly.
2. You want backend-service-level integration validation with real DB persistence.

Put tests in `integration/tests/frontend/<feature>/` when:

1. The test starts through frontend entry/proxy paths.
2. You want to validate frontend-to-backend wiring and persisted outcomes.

Important:

1. Both folders still represent full integration tests.
2. Every test should still validate cross-service behavior, not isolated unit behavior.

## Local usage

1. Start the stack:

```bash
docker compose -f compose.yaml up -d --build
```

2. Run integration tests:

```bash
npm --prefix integration run test
```

Optional scoped runs for parallel development:

```bash
npm --prefix integration run test:backend
npm --prefix integration run test:frontend
npm --prefix integration run test:ui
```

The runner automatically discovers all `*.test.mjs` files under `integration/tests/backend`, `integration/tests/frontend`, and `integration/tests/ui`.

3. Stop the stack:

```bash
docker compose -f compose.yaml down -v
```

## Environment variables

- `BACKEND_BASE_URL` (default: `http://localhost:8080`)
- `FRONTEND_BASE_URL` (default: `http://localhost:3000`)

## Output

JUnit XML is written to:

- `integration/artifacts/junit/integration-tests.xml`

## Playwright (UI) tests

We use Playwright to run headless browser checks for UI flows (e.g. the RFM scatter-plot smoke tests).

Quick setup (local):

1. Install integration dependencies:

```bash
npm --prefix integration install
```

2. Install Playwright browsers (required once):

```bash
npx playwright install --with-deps
```

Run all integration tests (includes Playwright UI tests):

```bash
npm --prefix integration run test
```

Run only Playwright UI tests (local):

```bash
npm --prefix integration run test:ui
```

CI note:

1. CI runs `backend` and `frontend` integration scopes.
2. Playwright UI scope (`ui`) is intentionally excluded from CI and meant for local runs.

Notes & troubleshooting:

- The integration runner waits for the backend and frontend to be reachable before running tests. Ensure the stack is up (see the "Local usage" section).
- Playwright tests are executed headless by default. If a test fails with a selector timeout, open the app in a browser locally and verify the UI path (e.g. click "View Existing Results" → "RFM Scatter Plot").
- CI environments may require additional OS packages for Playwright browsers. Use `npx playwright install --with-deps` on Linux CI runners, or consult Playwright docs for platform-specific notes: https://playwright.dev/docs/intro
- Test results (including Playwright failures) are written to `integration/artifacts/junit/integration-tests.xml` for CI collection.

