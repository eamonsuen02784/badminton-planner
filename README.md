# 🏸 Badminton Match Planner

An interactive 2v2 badminton match scheduler for recreational groups. Generates fair, varied, and well-paced round-robin schedules for a 3-hour session.

**Live app → [eamonsuen02784.github.io/badminton-planner](https://eamonsuen02784.github.io/badminton-planner)**

## Features

- **Fair rotation** — everyone gets an equal number of games (±1 max spread)
- **No burnout** — max 2 consecutive games before mandatory rest; max 2 consecutive rests before mandatory play
- **Partner & opponent variety** — scoring penalizes repeated pairings and matchups
- **Mixed-gender preference** — soft preference for M+F teams
- **Multi-court support** — 1, 2, or 3 courts with color-coded assignments
- **Staggered arrivals** — All here / Early-Late groups / Per-player custom slot ranges
- **Persisted schedule** — generated schedule auto-saves to browser storage and survives page refresh
- **Re-roll** — regenerate with one click
- **Copy to clipboard** — formatted text output for group chats
- **Save as image** — exports schedule as PNG

## Usage

Open the live link above on any device (mobile-friendly). No install or login required.

1. Add players (or load the default roster)
2. Set game length, number of courts, and availability mode
3. Hit **Generate**
4. Share the link with your group — the schedule persists on refresh

## Algorithm

Greedy slot-by-slot with two phases per time slot:

**Phase 1 — Player selection**
- Filter by availability window
- Hard constraints: `consecutivePlayed ≥ 2` → must rest; `consecutiveRested ≥ 2` → must play
- Remaining players sorted by normalized play rate, Fisher-Yates shuffled within tied groups

**Phase 2 — Team pairing**

All 3 possible 2v2 splits are scored; lowest wins:
```
score = (partnerRepeat × 3) + (opponentRepeat × 1) + (sameGenderTeam × 1) + random(0, 1.5)
```

## Configuration

| Setting | Options | Default |
|---|---|---|
| Game length | 8–20 min | 15 min |
| Courts | 1, 2, 3 | 1 |
| Availability | All here / Early-Late / Per player | All here |
| Session length | Fixed | 180 min |

## Stack

- Single HTML file — React 18 + Babel loaded from CDN, no build step
- html2canvas for image export (loaded on demand)
- Hosted on GitHub Pages
