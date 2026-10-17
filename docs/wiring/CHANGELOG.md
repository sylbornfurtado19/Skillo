# Wiring Refactor Changelog

## [Iteration 0] - 2026-10-17
- **What**: Initialized wiring audit tooling (`scripts/wiring/audit-wiring.mjs`), package scripts (`audit:wiring`, `audit:wiring:strict`), generated baseline (`docs/wiring/BASELINE.md`), created `refactor/wiring` branch, and removed stray benchmark/failure artifacts from git index (`git rm --cached`).
- **Why**: Establish external ledger and automated reachability/dead-export tracking without modifying runtime behavior.
- **Evidence**: `audit:wiring` reports 180 total TS files, 169 reachable, 11 orphans, 15 dead exports; 62 repo-root and doc files classified in `LEDGER.csv` (384 unreviewed remaining).
