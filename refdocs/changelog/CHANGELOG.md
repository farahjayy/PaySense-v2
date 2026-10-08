# PaySense v2 — Changelog

> Mandatory session log. Add an entry after **every** session where code changed, a decision was made, or a plan was modified. Newest first. Even a one-line fix gets a one-line entry.

Entry format:
```
### YYYY-MM-DD — [short summary of session goal]
- **Changed:** what files/components were touched and why
- **Decided:** any architectural or design decisions and the reasoning
- **Deviations:** anything that differed from the plan, and why
- **Verified:** what was actually run, and the result (not "should work")
- **Known issues / next steps:** what was left open
```

Those five lines are the floor, not the ceiling. Add these when the session earns them — a debugging session in particular is unreadable without the first two:
- **Reported:** the symptom in the user's own words, before you knew the cause
- **Diagnosed:** what you found, and how you proved it — the reproduction, not the hypothesis
- **Trade-off:** what this change costs, and who it costs it to
- **Noted, not changed:** something you found and deliberately left alone, so the next session doesn't re-investigate it

Rules that make this file worth keeping:
- **"Verified" means a command was run.** Name it and give the result. If nothing was run, write "nothing verified this session" — that is useful information.
- **Deviations are the most valuable line.** A plan that changed silently is a plan nobody will trust next time.
- **Write what you learned, not what you touched.** "Fixed the player" ages into nothing. "The provider's iframe navigates the top context, which sandbox flags block" is still worth reading in six months.
- Don't rewrite history. Corrections go in a new entry that references the old one.

---

## [Unreleased]

### 2026-10-08 — Project scaffolded
- **Changed:** Created the project doc system — `refdocs/` (PRD, STATUS, sources, context/ ×4, guides/, changelog/DECISIONS, plans/, execution/), `CLAUDE.md`, `README.md`, `.gitignore`, `.env.example` files, `.claude/` (settings, secret-guard hook, agents, commands, memory/preflight), and the kickoff superprompt. No application code yet.
- **Decided:** D-01 to D-25 (PRD §7). Load-bearing: component forecaster with Monte Carlo (D-04); candidates stay within the literature review, with benchmarks and monotonic constraints added (D-05, superseding an earlier "add Chronos + EBM" choice after the author asked for a recommendation); Engine 2 label = Engine 1's simulated shortfall probability (D-07); one shared feature module with a schema hash (D-09); username-only login (D-03, supervisor decision); no real personal data in this public repo (D-14); verified vs unverified BNPL providers (D-24); Berka as a benchmark only (D-25). UAT ethics approval not required (author).
- **Verified:** Nothing to verify — no code exists yet.
- **Known issues / next steps:** Five `ASSUMED:` items open (DECISIONS.md); P0's dependency spike resolves the Python-version and memory ones. Next session starts from `refdocs/plans/2026-10-08-p0-foundation.md`.
