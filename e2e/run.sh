#!/usr/bin/env bash
# Runs the e2e suite against the dev server on :3000, then deletes every
# user/plan it created. See test-users.ts for why E2E_RUN_ID exists.
set -uo pipefail
cd "$(dirname "$0")/.."

export E2E_RUN_ID="$(date +%s)"
npx playwright test "$@"
status=$?

npx tsx e2e/cleanup.ts

exit $status
