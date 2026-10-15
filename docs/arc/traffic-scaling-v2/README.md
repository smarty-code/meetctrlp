# Traffic scaling v2

Shop PCs stop polling our server. Each PC's print agent keeps one cheap HTTPS connection to a Realtime Database "doorbell". The server rings it after each change, and the agent and desktop fetch only what changed.

## Docs

| Doc | Read it to |
| --- | --- |
| [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](../DESKTOP_TRAFFIC_SCALING_PLAN.md) | Understand **why**: costs, rejected designs, decisions |
| [`TRAFFIC_SCALING_V2_IMPLEMENTATION.md`](../TRAFFIC_SCALING_V2_IMPLEMENTATION.md) | See **what** changes where: tasks, contracts, spike results, work breakdown |
| [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md) | Learn **how it works in code**, run it locally, and extend it |
| [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) | **Test it**: automated tests, manual cases with pass criteria, a results sheet |

## Status (15 Oct 2026)

| Phase / task | State | Where |
| --- | --- | --- |
| P0-02 doorbell spike | Passed (two runs on the dev PC) | Implementation plan 3.2 |
| P0-03 shop-network field checks | Open | Testing guide section 13 |
| P0-01, P1-00 to P1-07 (server foundation) | Done and committed (`b320f2e`); **not deployed**; rules tests not run | `fix/upload` |
| P2-03, P2-05 (agent token and doorbell, Rust bridge) | Done, merged (`80ad1bf`); not verified on a real shop PC | `fix/upload` |
| P2-01, P2-02 (server sync, report, board, history, search) | Done and committed (`8d283a2`); not deployed | `fix/upload` |
| P2-04 (agent sync service and report outbox) | Done and committed (`3fdaae6`); not run against staging | `fix/upload` |
| P2-06 (desktop board, token from the agent) | Done and committed (`7fd1485`) | `fix/upload` |
| P2-07, P3-01 to P3-03 (removals and docs, live tracking, signed cookie, guest trims, scale to zero) | Done and committed; staging cost and idle runs open | `fix/upload` |

**What's left** is ops and verification, not code: a staging project, deploying the indexes and rules, the rules tests (need Java 11+), API key restrictions, budget alerts, the Cloud Scheduler job, the staging runs (3-hour agent run, end-to-end print, cost and idle checks), the field checks, and the manual cases in the testing guide. See developer guide section 8.

**Urgent, separate from this work:** `apps/server/.env` and `.env.local` are tracked in git with the service-account key and S3 secret. Rotate both credentials and untrack the files. See developer guide section 8.
