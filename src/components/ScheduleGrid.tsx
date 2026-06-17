// @ts-nocheck
import { C } from '../constants';
import SlotCard from './SlotCard';

export default function ScheduleGrid({
  result,
  players,
  scores,
  editingSlot,
  editLayout,
  isAdmin,
  scheduleRef,
  minGames,
  maxGames,
  slotTime,
  startSlotEdit,
  applySlotEdit,
  applySlotEditOnly,
  cancelSlotEdit,
  assignToPosition,
  updateScore,
}) {
  return (
    <div ref={scheduleRef} style={{ background: C.bg, padding: 16, borderRadius: 12 }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>🏸 Badminton Schedule</span>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20, boxShadow: C.shadow }}>
        <h3 style={{ fontSize: 13, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>Games per Player</h3>
        <div className="stats-grid">
          {players.map((p, i) => {
            const g = result.gamesPlayed[i];
            const pct = maxGames > 0 ? (g / maxGames) * 100 : 0;
            return (
              <div key={`${p.name}-${i}`} className="stat-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: p.gender === 'F' ? C.pink : C.accent }}>{p.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{g}</span>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: p.gender === 'F' ? C.pink : C.accent }} />
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 13, color: C.textDim, margin: '12px 0 0', textAlign: 'center' }}>
          Spread: {minGames}–{maxGames} (diff: {maxGames - minGames})
          {maxGames - minGames <= 1 && <span style={{ color: C.green, marginLeft: 8 }}>✓ balanced</span>}
        </p>
      </div>

      <div className="schedule-grid">
        {result.schedule.map(slot => (
          <SlotCard
            key={slot.slot}
            slot={slot}
            scores={scores}
            editing={editingSlot === slot.slot}
            editLayout={editingSlot === slot.slot ? editLayout : null}
            isAdmin={isAdmin}
            slotTime={slotTime}
            startSlotEdit={startSlotEdit}
            applySlotEdit={applySlotEdit}
            applySlotEditOnly={applySlotEditOnly}
            cancelSlotEdit={cancelSlotEdit}
            assignToPosition={assignToPosition}
            updateScore={updateScore}
          />
        ))}
      </div>
    </div>
  );
}
