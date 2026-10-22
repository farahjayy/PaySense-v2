# Plan — P7f: a "running margin" chart a first-time student can read

> Execution: `refdocs/execution/2026-10-23-margin-chart-readability.md`. Scope source: the author's request to make the dashboard's running-margin chart understandable without help. Frontend presentation only: no API, data, forecast or formatting change.

## 1. Why this exists

Hovering a month highlights three dots (the top edge of the band, the middle line, the bottom edge) but the tooltip names only the middle one, so two of the three dots are unexplained. The chart has no legend (its three explanatory sentences sit below it and are easy to miss), and "margin" and "most likely" mean little to a student.

## 2. Scope

**In**
1. **Tooltip** with all three values for the hovered month, in plain words and with a marker matching each dot: *Higher outcome* (only 1 in 10 futures end above this), *Most likely* (the middle result), *Lower outcome* (only 1 in 10 futures end below this). The values are the chart's own P90, P50 and P10 (`high`, `middle`, `low` from `marginPoints`), written by the existing `formatRm`.
2. **Legend above the chart**: a dark line "Most likely", a shaded swatch "Where 8 out of 10 possible futures land", a dashed line "RM 0: below this you would be short of money". It replaces the three sentences under the chart.
3. **Distinct hover dots**: solid for the middle value, hollow for the two band edges; the hover cursor is always a thin vertical line, never a rectangle.
4. **Direct labels**: "Most likely" beside the last point; "RM 0" on the dashed line. The vertical axis always includes RM 0, so the dashed line (and its legend entry) can never be missing.
5. **Titles**: the card title becomes "How much money you would have left over, month by month"; the "Imagine you start October 2026 with RM 0…" caption stays.
6. **Table** keeps its columns; their headings take the tooltip's words ("lower outcome", "most likely", "higher outcome").

**Not built, and why**
- **A per-month shortfall note** ("in about X% of futures you would be short by <month>"): the forecast carries one number, `p_shortfall`, for the whole horizon (the chance the running margin is below RM 0 at *any* month-end), already shown above the chart. There is no per-month figure, and the author asked that a note appear only if the number exists. (A lower bound can be read from the band, for example "at least 1 in 10" when the lower edge is below RM 0, but that is not a figure the data states, so it is not shown.)

**Out**: any change to the forecast, the API, money formatting, or the other charts (the risk check's with/without chart).

## 3. Design

- New `components/forecast/MarginTooltip.tsx` and `MarginLegend.tsx`; `MarginFan.tsx` composes them and drops the figcaption.
- Colours only from the theme tokens (`--color-accent`, `--color-chart-blue`, `--color-chart-edge`, `--color-danger`, `--color-surface`), so light and dark follow.
- Colour is never the only signal: the line styles (solid, filled, dashed) and the marker shapes (solid, hollow) carry the meaning, and every legend and tooltip item is text.
- The text alternative (`role="img"` with `chartSummary`) and the "Show the numbers" table stay. The tooltip keeps recharts' hover and touch behaviour; the chart stays out of the tab order as before, and the table is the keyboard route to every number.

## 4. Risks

- **A tooltip as wide as a phone chart hides the dots it explains** (found in the first screenshots at 375 px: it covered two of the three). Resolution: the tooltip is anchored just *under* the chart, following the cursor sideways, so it never covers the data; it briefly overlays the "Show the numbers" bar and the cards below, which is harmless because it ignores the pointer.
- **Forcing RM 0 into the axis** changes the scale when every month is far above zero. Accepted: the dashed line and its legend entry must always be on the chart.
- `ASSUMED:` the band is the 10th to 90th percentile, so "only 1 in 10 futures end above / below" is exact for the cumulative running total, as `marginPoints` builds it.
