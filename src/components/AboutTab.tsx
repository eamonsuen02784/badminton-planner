// @ts-nocheck
import { C, FONT } from '../constants';

function Section({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.shadow }}>
      <h3 style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, margin: '0 0 12px' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

export default function AboutTab() {
  return (
    <div>
      <Section title="How scheduling works">
        <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginBottom: 14 }}>
          The scheduler runs a greedy slot-by-slot algorithm with two phases per time slot.
        </p>

        <Row label="1. Selection">
          Eligible players (within their availability window) are filtered by hard rest rules — anyone who's
          played 2 games in a row must sit, anyone who's sat 2 in a row must play. The rest are grouped by how
          often they've played relative to how long they've been available, shuffled within each group, and the
          neediest players fill the open court spots first.
        </Row>

        <Row label="2. Pairing">
          For each court's 4 players, all 3 possible 2v2 splits are scored and the lowest-scoring split wins:
        </Row>
        <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', fontSize: 11, color: C.textDim, overflowX: 'auto', marginBottom: 10, fontFamily: 'monospace' }}>
{`score = (partnerRepeat × 3)     // avoid repeat partners
      + (opponentRepeat × 1)    // lightly avoid repeat opponents
      + (sameGenderTeam × 1)    // soft preference for mixed teams
      + random(0, 1.5)          // jitter to break ties`}
        </pre>
        <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          The heavy partner-repeat penalty means you almost never play with the same person twice in a row,
          while the lighter same-gender penalty is easily overridden by jitter — letting MM-vs-MM games appear
          naturally instead of forcing mixed teams every game.
        </p>
      </Section>

      <Section title="Constraints">
        <Row label="Equal games">Hard — everyone's game count stays within 1 of each other.</Row>
        <Row label="No burnout">Hard — max 2 consecutive games, max 2 consecutive rests.</Row>
        <Row label="Vary partners">Soft — heavily penalized in pairing score, rarely repeats.</Row>
        <Row label="Vary opponents">Soft — lightly penalized, repeats sometimes.</Row>
        <Row label="Mixed teams">Soft — preferred but not forced; MM/FF pairings happen naturally.</Row>
        <Row label="Staggered arrival">Availability windows are normalized so a player here for half the
          session gets proportionally half the games, not fewer.</Row>
      </Section>

      <Section title="Editing without breaking fairness">
        <Row label="Apply & regen">Forces your edit for one slot, then regenerates every later slot so the
          fairness constraints above still hold for the rest of the session.</Row>
        <Row label="This game only">Swaps players in just the one game you're editing — every other slot
          stays exactly as already generated or shared. The games-played tracker is recalculated to stay
          accurate, but no one else's matchups change. Trades a little fairness drift for not disturbing a
          schedule you've already sent out.</Row>
      </Section>

      <Section title="Confirm & Saved Plans">
        <Row label="Confirm">Marks the current schedule as the one for the session. Once confirmed,
          regenerating, clearing, importing, or partial-regenerating prompts you first and archives the old
          version automatically.</Row>
        <Row label="Saved Plans">A rolling ~2-week history of past schedules — both auto-archived overwrites
          and anything you explicitly Save with a tag. Loading a saved plan lets you Update it in place instead
          of always creating a new copy.</Row>
      </Section>

      <Section title="Architecture">
        <Row label="Frontend">React + TypeScript, built with Vite. Single-page app, all state in
          localStorage — no login, no backend database for the schedule itself.</Row>
        <Row label="Hosting">Deployed to GitHub Pages. A GitHub Actions workflow builds and publishes the
          site automatically on every push to main.</Row>
        <Row label="Share links">A small Cloudflare Worker + KV store issues short mutable links — opening
          one fetches the latest version of that schedule from the worker, no account needed.</Row>
        <Row label="Admin lock">An optional PIN gates score entry and saving, stored in session storage once
          unlocked.</Row>
      </Section>
    </div>
  );
}
