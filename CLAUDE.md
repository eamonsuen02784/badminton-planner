# 🏸 Badminton Match Planner

An interactive 2v2 badminton match scheduler built as a single-file React component. Designed for recreational groups that want fair, varied, and well-paced round-robin play across a 3-hour session.

Built iteratively with Claude.

## Features

- **Fair rotation** — everyone gets an equal number of games (±1 max spread)
- **No burnout** — max 2 consecutive games before mandatory rest; max 2 consecutive rests before mandatory play
- **Partner & opponent variety** — scoring penalizes repeated pairings and repeated matchups
- **Mixed-gender preference** — soft preference for M+F teams, but MM vs MM and MM vs MF games appear naturally
- **Controlled randomness** — Fisher-Yates shuffle within tied game-count groups + jitter on pairing scores prevents deterministic repetition while preserving fairness constraints
- **Multi-court support** — 1, 2, or 3 courts; games run in parallel with color-coded court assignments
- **Staggered arrivals** — three modes:
  - **All here**: everyone available the full session
  - **Early / Late**: tag players as Early, Full, or Late with ~20% overlap in the middle
  - **Per player**: set exact slot ranges (e.g., slots 1–8)
- **Per-slot player tracker** — each game card shows all available players with ON/OFF streak and cumulative game count
- **Re-roll** — regenerate with one click until you like the schedule
- **Copy to clipboard** — formatted text output for group chats
- **Save as image** — exports schedule as a high-res PNG via html2canvas

## Algorithm

The scheduler runs a greedy slot-by-slot algorithm with two phases per time slot:

### Phase 1: Player Selection

1. **Availability filter** — only players whose availability window includes the current slot are considered
2. **Hard constraints**:
   - `consecutivePlayed >= 2` → must rest this slot
   - `consecutiveRested >= 2` → must play this slot
3. **Priority pool** — remaining eligible players are grouped by a normalized play rate (`gamesPlayed / availabilityWindow`), then Fisher-Yates shuffled within each group
4. **Selection** — fill `numCourts × 4` spots from the priority pool, must-play players first

### Phase 2: Team Pairing

For each court's 4 selected players, evaluate all 3 possible 2v2 arrangements and score each:

```
score = (partnerRepeat × 3)           // heavily penalize same partners
      + (opponentRepeat × 1)          // lightly penalize same opponents
      + (sameGenderTeam × 1)          // soft preference for mixed teams
      + random(0, 1.5)                // jitter to break ties
```

Lowest score wins. The `× 3` weight on partner repeats ensures you almost never play with the same person twice in a row, while the `× 1` on same-gender teams is easily overridden by jitter — allowing MM vs MM games to emerge naturally.

### Stagger Normalization

When players have different availability windows, the selection priority uses `gamesPlayed / totalAvailableSlots` instead of raw game count. This ensures a player available for 6 slots gets proportionally as many games as someone available for all 12.

## Configuration

| Setting | Options | Default |
|---|---|---|
| Game length | 8–20 min (slider) | 15 min |
| Courts | 1, 2, 3 | 1 |
| Availability | All here / Early-Late / Per player | All here |
| Session length | Fixed 3 hours | 180 min |

## Constraints Summary

| Constraint | Type | Implementation |
|---|---|---|
| Equal games (±1) | Hard | Greedy selection by fewest games played |
| Max 2 consecutive games | Hard | `mustRest` when `consecutivePlayed >= 2` |
| Max 2 consecutive rests | Hard | `mustPlay` when `consecutiveRested >= 2` |
| Vary partners | Soft | `partnerRepeat × 3` penalty in pairing score |
| Vary opponents | Soft | `opponentRepeat × 1` penalty in pairing score |
| Mixed-gender teams | Soft | `sameGenderTeam × 1` penalty, easily overridden by jitter |
| Include women when available | Soft | Tiebreak in selection sort; no forced inclusion |

## Tech Stack

- React (single-file component, `.jsx`)
- No external dependencies in the core logic
- html2canvas (loaded dynamically for image export)
- Designed to run as a Claude Artifact, standard React app, or any JSX-compatible environment

## File Structure

```
├── CLAUDE.md                  # This file
├── badminton-planner.jsx      # Single-file React component (algorithm + UI)
```

## Usage

### As a Claude Artifact

Upload `badminton-planner.jsx` as a React artifact in Claude — it will render directly.

### In a React project

```bash
# Copy the component into your project
cp badminton-planner.jsx src/components/BadmintonPlanner.jsx
```

```jsx
import BadmintonPlanner from './components/BadmintonPlanner';

function App() {
  return <BadmintonPlanner />;
}
```

### Customization

Edit the `DEFAULT_PLAYERS` array at the top of the file to set your group's roster:

```js
const DEFAULT_PLAYERS = [
  { name: "Eamon", gender: "M" },
  { name: "Jialin", gender: "F" },
  // ...
];
```

Session length can be changed via `TOTAL_MINUTES` (default: 180).

## Design Decisions

**Why greedy instead of constraint programming?** The problem is small enough (≤12 players, ≤15 slots) that a well-tuned greedy algorithm with randomization produces good results in milliseconds. A CP solver would guarantee optimality but adds complexity and a dependency for marginal gain at this scale.

**Why shuffle within tied groups instead of pure random?** Pure random violates the equal-games constraint. Pure deterministic creates repetitive schedules. Shuffling within game-count tiers gives variety while preserving the fairness invariant.

**Why soft constraints for gender mixing?** With 3 women and 5 men, forcing 2 women per game means women play every game with no rest. A soft preference lets the algorithm balance rest fairly while still favoring mixed teams when possible.

## Development History

This project was built iteratively through conversation, starting from a basic round-robin algorithm and evolving through the following changes:

1. Basic 2v2 scheduler with equal game counts and consecutive play/rest limits
2. Added partner and opponent variety tracking with weighted scoring
3. Added gender-aware features (mixed-team preference, women inclusion)
4. Relaxed gender constraints to prevent women burnout — shifted from forced inclusion to soft preference
5. Added controlled randomness (Fisher-Yates shuffle within tied groups, pairing jitter)
6. Reduced mixed-gender penalty to allow MM vs MM games
7. Changed default to 15-minute games, two-column layout
8. Added per-slot player status tracker (ON/OFF streak + total games)
9. Added copy-to-clipboard (with execCommand fallback for iframe) and save-as-image (html2canvas)
10. Full rewrite to support multi-court (1–3) and staggered availability (group-based or per-player custom slot ranges)
