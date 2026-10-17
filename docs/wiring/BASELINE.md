# Skillo Baseline Metrics (Iteration 0)

Date: 2026-10-17
Branch: `refactor/wiring`

## Verification Gates Baseline

| Gate | Status | Details |
|---|---|---|
| `npx tsc --noEmit` | **PASS** | 0 errors |
| `npm run lint` | **PASS** | 0 errors, 41 warnings (oxlint across 180 files) |
| `npm test` | **PASS** | 76/76 test suites passed, 620/620 tests passed (20.7s) |
| `npm run test:regression` | **PASS** | All CI regression & drift checks passed |
| `npm run audit:wiring` | **PASS** | 180 total files, 169 reachable, 11 orphans, 15 dead exports, 87 test-only exports |

## IVP CI Regression & Drift Baseline Values

- **Lip Corner Tracking RMSE**: `0.68 px` (Budget: `<= 2.94 px`)
- **Pupil Tracking RMSE**: `0.17 px` (Budget: `<= 1.85 px`)
- **MicroTrack Latency p50**: `0.01 ms`
- **MicroTrack Latency p95**: `0.04 ms` (Budget: `<= 5.8 ms`)
- **Net Heap Growth**: `0.00 MB` (Budget: `<= 15 MB`)
- **Drift (Lip RMSE)**: `+7.3%`
- **Drift (Pupil RMSE)**: `-4.8%`
- **Drift (Latency p95)**: `+8.3%`
- **Time to First Templates**: `110 ms` (Budget: `<= 1500 ms`)
- **Time to First Smoothed**: `142 ms` (Budget: `<= 1500 ms`)
- **Historical Baseline Timestamp**: `2026-09-16T05:39:13.926Z`
