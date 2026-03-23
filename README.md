# 🏸 Badminton Match Planner

An interactive 2v2 badminton match scheduler for recreational groups. Generates fair, varied, and well-paced round-robin schedules for a 3-hour session.

**Live app → [eamonsuen02784.github.io/badminton-planner](https://eamonsuen02784.github.io/badminton-planner)**

---

## Scheduling Priorities

The algorithm balances several goals, in this order:

| Priority | Rule | Type |
|---|---|---|
| 1 | Equal games — max ±1 spread across all players | Hard |
| 2 | No more than 2 consecutive games before mandatory rest | Hard |
| 3 | No more than 2 consecutive rests before mandatory play | Hard |
| 4 | All courts filled every slot (no empty courts) | Hard |
| 5 | Avoid repeating the same partner | Soft (3× penalty) |
| 6 | Skill-balanced teams — equalize combined skill ratings | Soft (2× penalty) |
| 7 | At least 2 women's doubles games per session | Soft (5× incentive until met) |
| 8 | Avoid repeating the same opponents | Soft (1× penalty) |
| 9 | Balanced gender matchups — MM vs MM, FF vs FF, or MF vs MF | Soft (4× penalty for unbalanced) |
| 10 | Controlled randomness — variety across re-rolls | Jitter (0–1.5) |

**Hard constraints** are never violated. **Soft constraints** are scored — lower is better — and the best combination wins. When multiple arrangements score equally, jitter breaks the tie randomly so re-rolls produce different schedules.

---

## Features

- **Fair rotation** — equal game counts enforced by play-rate grouping + shuffle
- **Skill balancing** — win/loss records feed back into matchmaking on the next generate
- **Score entry** — enter results after each game; valid badminton scores (21-point rules) are enforced
- **Women's doubles** — at least 2 WD games per session, then relaxes to normal preferences
- **No burnout** — hard limits on consecutive play and rest
- **Extra court** — configure a sub-window where an additional court is available (e.g. +1 court from 60–150 min)
- **Multi-court** — 1, 2, or 3 base courts with color-coded court assignments
- **Staggered arrivals** — All here / Early-Late groups / Per-player custom slot ranges
- **Mid-session changes** — re-generate from any slot to handle late arrivals or player substitutions
- **Persisted schedule** — auto-saves to browser storage; survives page refresh
- **Re-roll** — regenerate in one click until you're happy
- **Copy to clipboard** — formatted text for group chats
- **Save as image** — exports schedule as PNG via html2canvas

---

## Algorithm

Greedy slot-by-slot with two phases per time slot:

### Phase 1 — Player Selection

1. Filter by each player's availability window
2. Classify players: `mustRest` (≥2 consecutive games), `mustPlay` (≥2 consecutive rests), `canPlay`
3. Compute eligible count = available − mustRest; use this to determine how many courts can be filled
4. Sort `canPlay` by normalized play rate (`gamesPlayed / availableSlots`), shuffle within tied groups (Fisher-Yates)
5. Fill `numCourts × 4` spots: mustPlay first, then canPlay by rate order

### Phase 2 — Team Pairing

For each court's 4 players, evaluate all 3 possible 2v2 splits and score each:

```
score = (partnerRepeat × 3)              // strongly avoid same partners
      + (skillImbalance × 2)             // equalize team skill totals
      + (womenDoublesNeeded ? +5 : 0)    // incentivize WD until 2 games reached
      + (genderTypesMismatch ? +4 : 0)   // prefer MM vs MM, FF vs FF, MF vs MF
      + (opponentRepeat × 1)             // lightly avoid same opponents
      + random(0, 1.5)                   // jitter for variety
```

Lowest score wins. Skill ratings are derived from each player's win rate from previously entered scores.

---

## Configuration

| Setting | Options | Default |
|---|---|---|
| Game length | 8–20 min (slider) | 15 min |
| Base courts | 1, 2, 3 | 1 |
| Extra court | Off / On with start offset + duration | Off |
| Availability | All here / Early-Late / Per player | All here |
| Session length | Fixed | 180 min (3 hrs) |

---

## Default Roster

| # | Name | Gender |
|---|---|---|
| 1 | Eamon | M |
| 2 | Jialin | F |
| 3 | Mindy | F |
| 4 | Yuta | M |
| 5 | Jae | M |
| 6 | Jess | F |
| 7 | Edwin | M |
| 8 | Stanley | M |
| 9 | Kayleen | F |
| 10 | Ricky | M |
| 11 | Tim | M |
| 12 | Henry | M |

---

## Stack

- Single HTML file — React 18 + Babel loaded from CDN, no build step
- html2canvas for image export (loaded on demand)
- Hosted on GitHub Pages
- Source component: `badminton-planner.jsx` (synced into `index.html` for deployment)
