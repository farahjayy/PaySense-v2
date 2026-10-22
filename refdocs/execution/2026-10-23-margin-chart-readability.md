# Execution — P7f: a "running margin" chart a first-time student can read

> Plan: `refdocs/plans/2026-10-23-margin-chart-readability.md`. Test first; finish with `cd frontend && npm run lint && npx tsc --noEmit && npm run test` and the axe tests (`tests/unit/a11y.test.tsx`), and name the results in the changelog.

- [x] **T1 Tooltip.** Test: renders the month and the three rows in the order higher, most likely, lower, each with its `formatRm` value, its plain note and a marker (solid for the middle, hollow for the edges); renders nothing when inactive. Files: `components/forecast/MarginTooltip.tsx`, `tests/unit/MarginTooltip.test.tsx`.
- [x] **T2 Legend.** Test: a list of three items with the author's wording; each has a swatch that is not colour alone (line, fill, dashed). Files: `components/forecast/MarginLegend.tsx`, `tests/unit/MarginFan.test.tsx`.
- [x] **T3 Chart** (the readout sits under the chart, see the plan's risks). Test (recharts' container mocked to a fixed size so the SVG renders in jsdom): the "Most likely" label and the "RM 0" label are drawn; the figcaption sentences are gone; the table headings use the new words; the axis domain includes 0. Files: `components/forecast/MarginFan.tsx`.
- [x] **T4 Titles.** Test: the dashboard card is titled "How much money you would have left over, month by month" and keeps its "Imagine you start …" caption. Files: `components/screens/DashboardScreen.tsx`, `tests/unit/DashboardScreen.test.tsx`.
- [x] **T5 Checks and screenshots.** Lint, types, unit tests, axe tests; screenshots in light and dark, desktop and phone, with and without hover (a temporary Playwright spec, deleted afterwards); changelog and STATUS lines; commit.
