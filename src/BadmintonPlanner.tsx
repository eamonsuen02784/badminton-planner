// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { generateSchedule, generateScheduleGen, extractState, recomputeStats } from './algorithm/scheduler';
import { ARCHIVE_TTL_MS, C, DEFAULT_PLAYERS, FONT } from './constants';
import { usePlannerState } from './hooks/usePlannerState';
import PlayerList from './components/PlayerList';
import ScheduleGrid from './components/ScheduleGrid';
import AboutTab from './components/AboutTab';
import {
  ArchiveTab,
  ConfirmOverwriteModal,
  ImportModal,
  LucideIcon,
  PinPromptModal,
  SavePlanModal,
  ShareLinkModal,
} from './components/PlannerModals';
import {
  isFirebaseConfigured,
  loadWinLoss,
  saveWinLoss,
  createShare,
  updateShare,
  subscribeToShare,
} from './firebase';

function normalizeApiBase(base) {
  return base ? base.replace(/\/+$/, '') : null;
}

function isValidBadmintonScore(a, b) {
  if (a === b || a < 0 || b < 0) return false;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 21 && lo <= 19) return true;
  if (hi >= 22 && lo >= 20 && hi - lo === 2) return true;
  if (hi === 30 && lo === 29) return true;
  return false;
}

function copyText(text, onCopied) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    onCopied?.();
  } catch {}
  document.body.removeChild(ta);
}

function BadmintonPlanner() {
  const { state, setField, patchState } = usePlannerState();
  const [dbSynced, setDbSynced] = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => !window.ADMIN_PIN || sessionStorage.getItem('bp-admin') === window.ADMIN_PIN);
  const scheduleRef = useRef(null);

  const {
    players,
    playerHistory,
    nameInput,
    genderInput,
    totalMinutes,
    gameMinutes,
    numCourts,
    extraCourt,
    staggerMode,
    sessionStart,
    result,
    scores,
    winLoss,
    fromSlot,
    fromSlotCourts,
    copied,
    copiedGames,
    saved,
    isGenerating,
    genSlot,
    showPinPrompt,
    pinInput,
    pinError,
    showImport,
    importText,
    importError,
    savedPlans,
    showSavePlan,
    saveTag,
    activeTab,
    editingSlot,
    editLayout,
    pendingShare,
    showShareLoad,
    showShareModal,
    sharedUrl,
    copiedShareUrl,
    shareIsUpdate,
    shareId,
    shareToken,
    preferMixedTeams,
    isConfirmed,
    pendingOverwrite,
    loadedPlanId,
  } = state;

  const totalSlots = Math.floor(totalMinutes / gameMinutes);
  const minGames = result ? Math.min(...result.gamesPlayed) : 0;
  const maxGames = result ? Math.max(...result.gamesPlayed) : 0;
  const hasAppliedScores = result && Object.values(scores).some(s => s.applied);
  const allDefaultsLoaded = DEFAULT_PLAYERS.every(dp => players.some(p => p.name.toLowerCase() === dp.name.toLowerCase()));

  useEffect(() => {
    if (players.length === 0) return;
    const known = new Set(playerHistory.map(p => p.name.toLowerCase()));
    const newOnes = players.filter(p => !known.has(p.name.toLowerCase()));
    if (newOnes.length === 0) return;
    patchState({
      playerHistory: [...playerHistory, ...newOnes.map(p => ({ name: p.name, gender: p.gender }))],
    });
  }, [players]);

  useEffect(() => {
    const cutoff = Date.now() - ARCHIVE_TTL_MS;
    const fresh = savedPlans.filter(p => new Date(p.savedAt).getTime() >= cutoff);
    if (fresh.length !== savedPlans.length) patchState({ savedPlans: fresh });
  }, [savedPlans]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    loadWinLoss()
      .then(remote => {
        patchState({
          winLoss: (() => {
            const merged = { ...state.winLoss };
            for (const [name, data] of Object.entries(remote)) {
              if (!merged[name]) merged[name] = data;
              else {
                merged[name] = {
                  wins: Math.max(merged[name].wins ?? 0, data.wins ?? 0),
                  losses: Math.max(merged[name].losses ?? 0, data.losses ?? 0),
                };
              }
            }
            return merged;
          })(),
        });
        setDbSynced('synced');
      })
      .catch(() => setDbSynced('error'));
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !isAdmin) return;
    setDbSynced('syncing');
    saveWinLoss(winLoss).then(() => setDbSynced('synced')).catch(() => setDbSynced('error'));
  }, [winLoss, isAdmin]);

  useEffect(() => {
    if (!result) return;
    patchState({ saved: true });
    const t = setTimeout(() => patchState({ saved: false }), 2000);
    return () => clearTimeout(t);
  }, [result]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlShareId = params.get('share');

    if (urlShareId && isFirebaseConfigured()) {
      patchState({ shareId: urlShareId });
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    const apiBase = normalizeApiBase(window.SHARE_API_BASE);
    if (urlShareId && apiBase) {
      fetch(`${apiBase}/shares/${encodeURIComponent(urlShareId)}`)
        .then(async response => {
          if (!response.ok) throw new Error(`Share load failed: ${response.status}`);
          return response.json();
        })
        .then(payload => {
          const data = payload?.data;
          if (data?.v === 1 && data.p && data.slots) {
            applySharePayload(data);
            window.history.replaceState(null, '', window.location.pathname);
          }
        })
        .catch(() => {});
      return;
    }

    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;
    try {
      const data = JSON.parse(atob(hash.slice(7)));
      if (data.v === 1 && data.p && data.slots) {
        applySharePayload(data);
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {}
  }, []);

  const isApplyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!shareId || !isFirebaseConfigured()) return;
    const unsubscribe = subscribeToShare(shareId, data => {
      if (data?.v === 1 && data.p && data.slots) {
        isApplyingRemoteRef.current = true;
        applySharePayload(data);
        setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
      }
    });
    return unsubscribe;
  }, [shareId]);

  const buildSharePayload = useCallback(() => {
    if (!result) return null;
    const pwith = getPlayersWithAvailability();
    return {
      v: 1,
      p: pwith.map(p => [p.name, p.gender]),
      cfg: { g: gameMinutes, c: numCourts },
      scores: Object.fromEntries(
        Object.entries(scores)
          .filter(([, value]) => value?.applied)
          .map(([key, value]) => [key, { a: value.a, b: value.b }]),
      ),
      slots: result.schedule.map(s => ({
        s: s.slot,
        c: s.courts.map(court => [
          court.teamA.map(p => pwith.findIndex(pl => pl.name === p.name)),
          court.teamB.map(p => pwith.findIndex(pl => pl.name === p.name)),
        ]),
        sit: (s.sitting || []).map(p => pwith.findIndex(pl => pl.name === p.name)),
      })),
      confirmed: isConfirmed,
    };
  }, [gameMinutes, getPlayersWithAvailability, isConfirmed, numCourts, result, scores]);

  useEffect(() => {
    if (!shareId || !isFirebaseConfigured() || !result) return;
    if (isApplyingRemoteRef.current) return;
    const t = setTimeout(() => {
      const payload = buildSharePayload();
      if (payload) updateShare(shareId, payload);
    }, 600);
    return () => clearTimeout(t);
  }, [shareId, buildSharePayload]);

  const slotTime = useCallback((slotIdx) => {
    const startMin = (slotIdx - 1) * gameMinutes;
    const endMin = slotIdx * gameMinutes;
    if (!sessionStart) return `~${startMin}–${endMin}m`;
    const [h, m] = sessionStart.split(':').map(Number);
    const fmt = totalMin => {
      const d = new Date(2000, 0, 1, h, m + totalMin);
      const hh = d.getHours();
      const mm = d.getMinutes();
      const ampm = hh >= 12 ? 'PM' : 'AM';
      return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
    };
    return `${fmt(startMin)} – ${fmt(endMin)}`;
  }, [gameMinutes, sessionStart]);

  const getCourtsPerSlot = useCallback(() => {
    return Array.from({ length: totalSlots }, (_, slot) => {
      const slotStartMin = slot * gameMinutes;
      const slotEndMin = slotStartMin + gameMinutes;
      let courts = numCourts;
      if (extraCourt.enabled) {
        const extraEnd = extraCourt.startMin + extraCourt.durationMin;
        if (slotStartMin < extraEnd && slotEndMin > extraCourt.startMin) courts++;
      }
      return Math.min(courts, 3);
    });
  }, [extraCourt, gameMinutes, numCourts, totalSlots]);

  const getPlayersWithAvailability = useCallback(() => {
    const midSlot = Math.floor(totalSlots / 2);
    const overlap = Math.max(1, Math.floor(totalSlots * 0.2));
    return players.map(p => {
      let next;
      if (staggerMode === 'none') next = { ...p, availFrom: 0, availTo: totalSlots - 1 };
      else if (staggerMode === 'group') {
        if (p.group === 'early') next = { ...p, availFrom: 0, availTo: midSlot + overlap - 1 };
        else if (p.group === 'late') next = { ...p, availFrom: midSlot - overlap, availTo: totalSlots - 1 };
        else next = { ...p, availFrom: 0, availTo: totalSlots - 1 };
      } else {
        next = p;
      }
      if (p.leavesAt != null) next = { ...next, availTo: Math.min(next.availTo, p.leavesAt) };
      return next;
    });
  }, [players, staggerMode, totalSlots]);

  const computeSkill = useCallback((name) => {
    const wl = winLoss[name];
    if (!wl || wl.wins + wl.losses === 0) return 0.5;
    return wl.wins / (wl.wins + wl.losses);
  }, [winLoss]);

  const loadDefaults = useCallback(() => {
    const existing = new Set(players.map(p => p.name.toLowerCase()));
    const toAdd = DEFAULT_PLAYERS.filter(p => !existing.has(p.name.toLowerCase()));
    if (toAdd.length === 0) return;
    patchState({
      players: [
        ...players,
        ...toAdd.map(p => ({ ...p, availFrom: 0, availTo: totalSlots - 1, group: 'full', leavesAt: null })),
      ],
      result: null,
    });
  }, [players, totalSlots]);

  const resetPlayers = useCallback(() => {
    patchState({
      players: DEFAULT_PLAYERS.map(p => ({ ...p, availFrom: 0, availTo: totalSlots - 1, group: 'full', leavesAt: null })),
      result: null,
    });
  }, [totalSlots]);

  const clearPlayers = useCallback(() => patchState({ players: [], result: null }), []);

  const addPlayer = useCallback(() => {
    const name = nameInput.trim();
    if (!name || players.find(p => p.name.toLowerCase() === name.toLowerCase())) return;
    patchState({
      players: [...players, { name, gender: genderInput, skill: 2, availFrom: 0, availTo: totalSlots - 1, group: 'full', leavesAt: null }],
      nameInput: '',
    });
  }, [genderInput, nameInput, players, totalSlots]);

  const addSelectedFromBank = useCallback((entries) => {
    const existing = new Set(players.map(p => p.name.toLowerCase()));
    const toAdd = entries.filter(e => !existing.has(e.name.toLowerCase()));
    if (toAdd.length === 0) return;
    patchState({
      players: [...players, ...toAdd.map(e => ({ name: e.name, gender: e.gender, skill: 2, availFrom: 0, availTo: totalSlots - 1, group: 'full', leavesAt: null }))],
    });
  }, [players, totalSlots]);

  const addToBank = useCallback((name, gender) => {
    const trimmed = name.trim();
    if (!trimmed || playerHistory.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return;
    patchState({ playerHistory: [...playerHistory, { name: trimmed, gender }] });
  }, [playerHistory]);

  const removeFromHistory = useCallback((name) => {
    patchState({ playerHistory: playerHistory.filter(p => p.name.toLowerCase() !== name.toLowerCase()) });
  }, [playerHistory]);

  const removePlayer = useCallback((idx) => {
    patchState({ players: players.filter((_, i) => i !== idx), result: null });
  }, [players]);

  const updatePlayer = useCallback((idx, field, value) => {
    patchState({
      players: players.map((p, i) => i === idx ? { ...p, [field]: value } : p),
      result: null,
    });
  }, [players]);

  const submitPin = useCallback(() => {
    if (pinInput === window.ADMIN_PIN) {
      sessionStorage.setItem('bp-admin', pinInput);
      setIsAdmin(true);
      patchState({ showPinPrompt: false, pinInput: '', pinError: false });
    } else {
      patchState({ pinError: true });
    }
  }, [pinInput]);

  const clearWinLoss = useCallback(() => {
    patchState({ winLoss: {} });
    if (isFirebaseConfigured() && isAdmin) saveWinLoss({});
  }, [isAdmin]);

  const parseScheduleText = useCallback((text) => {
    const playerMap = Object.fromEntries(players.map(p => [p.name.toLowerCase(), p]));
    const resolve = name => playerMap[name.toLowerCase()] || { name, gender: '?' };
    const slots = [];
    let cur = null;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      const slotMatch = line.match(/^--- Slot (\d+) .* ---$/);
      if (slotMatch) {
        if (cur) slots.push(cur);
        cur = { slot: +slotMatch[1], courts: [], sitting: [] };
        continue;
      }
      if (!cur) continue;
      const courtMatch = line.match(/^(?:Court (\d+): )?(.+?)\s{2}vs\s{2}(.+)$/);
      if (courtMatch) {
        cur.courts.push({
          court: courtMatch[1] ? +courtMatch[1] : cur.courts.length + 1,
          teamA: courtMatch[2].split('&').map(n => resolve(n.trim())),
          teamB: courtMatch[3].split('&').map(n => resolve(n.trim())),
        });
        continue;
      }
      const sitMatch = line.match(/^Sit: (.+)$/);
      if (sitMatch) cur.sitting = sitMatch[1].split(',').map(n => resolve(n.trim()));
    }
    if (cur) slots.push(cur);
    return slots.length > 0 ? { schedule: slots, gamesPlayed: players.map(() => 0) } : null;
  }, [players]);

  const runImport = useCallback(() => {
    const parsed = parseScheduleText(importText);
    if (!parsed) {
      patchState({ importError: 'Could not parse schedule — paste the full copied text.' });
      return;
    }
    patchState({ result: parsed, scores: {}, showImport: false, importText: '', importError: '', isConfirmed: false, loadedPlanId: null, shareId: null, shareToken: null });
  }, [importText, parseScheduleText]);

  const importSchedule = useCallback(() => {
    if (isConfirmed) {
      patchState({ pendingOverwrite: 'import' });
      return;
    }
    runImport();
  }, [isConfirmed, runImport]);

  const runGenerate = useCallback(() => {
    if (players.length < 4 || isGenerating) return;
    patchState({ isGenerating: true, result: null, scores: {}, copied: false, genSlot: 0, isConfirmed: false, loadedPlanId: null, shareId: null, shareToken: null });
    const playersWithSkill = getPlayersWithAvailability().map(p => ({ ...p, skill: computeSkill(p.name) }));
    const gen = generateScheduleGen(playersWithSkill, totalSlots, getCourtsPerSlot(), 0, null, null, { preferMixedTeams });
    let lastValue = null;
    function step() {
      const { value, done } = gen.next();
      if (value) {
        lastValue = value;
        patchState({ genSlot: value.schedule.length });
      }
      if (done) patchState({ result: lastValue, isGenerating: false });
      else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [computeSkill, getCourtsPerSlot, getPlayersWithAvailability, isGenerating, players.length, preferMixedTeams, totalSlots]);

  const generate = useCallback(() => {
    if (players.length < 4 || isGenerating) return;
    if (isConfirmed) {
      patchState({ pendingOverwrite: 'generate' });
      return;
    }
    runGenerate();
  }, [isConfirmed, isGenerating, players.length, runGenerate]);

  const runRegenerateRemaining = useCallback(() => {
    if (players.length < 4 || !result) return;
    const playersWithSkill = getPlayersWithAvailability().map(p => ({ ...p, skill: computeSkill(p.name) }));
    const keptSlots = result.schedule.slice(0, fromSlot - 1);
    const stateSnapshot = extractState(keptSlots, playersWithSkill);
    const courtsArr = getCourtsPerSlot();
    if (fromSlotCourts > 0) {
      for (let i = fromSlot - 1; i < totalSlots; i++) courtsArr[i] = fromSlotCourts;
    }
    const newResult = generateSchedule(playersWithSkill, totalSlots, courtsArr, fromSlot - 1, stateSnapshot, null, { preferMixedTeams });
    if (!newResult) return;
    const nextScores = {};
    for (const key in scores) {
      const match = key.match(/^s(\d+)c/);
      if (match && parseInt(match[1]) < fromSlot) nextScores[key] = scores[key];
    }
    patchState({ result: newResult, scores: nextScores, copied: false, isConfirmed: false, loadedPlanId: null });
  }, [computeSkill, fromSlot, fromSlotCourts, getCourtsPerSlot, getPlayersWithAvailability, players.length, preferMixedTeams, result, scores, totalSlots]);

  const regenerateRemaining = useCallback(() => {
    if (players.length < 4 || !result) return;
    if (isConfirmed) {
      patchState({ pendingOverwrite: 'regenerateRemaining' });
      return;
    }
    runRegenerateRemaining();
  }, [isConfirmed, players.length, result, runRegenerateRemaining]);

  const runClearSchedule = useCallback(() => {
    patchState({ result: null, scores: {}, fromSlot: 1, isConfirmed: false, loadedPlanId: null, shareId: null, shareToken: null });
  }, []);

  const clearSchedule = useCallback(() => {
    if (isConfirmed) {
      patchState({ pendingOverwrite: 'clear' });
      return;
    }
    runClearSchedule();
  }, [isConfirmed, runClearSchedule]);

  const confirmSchedule = useCallback(() => patchState({ isConfirmed: true }), []);
  const unconfirmSchedule = useCallback(() => patchState({ isConfirmed: false }), []);

  const executeOverwrite = useCallback(() => {
    if (result && result.schedule?.length) {
      patchState({ savedPlans: [{ id: Date.now(), tag: '', result, savedAt: new Date().toISOString() }, ...savedPlans] });
    }
    patchState({ pendingOverwrite: null });
    if (pendingOverwrite === 'generate') runGenerate();
    else if (pendingOverwrite === 'clear') runClearSchedule();
    else if (pendingOverwrite === 'import') runImport();
    else if (pendingOverwrite === 'regenerateRemaining') runRegenerateRemaining();
  }, [pendingOverwrite, result, savedPlans, runGenerate, runClearSchedule, runImport, runRegenerateRemaining]);

  const cancelOverwrite = useCallback(() => patchState({ pendingOverwrite: null }), []);

  const startSlotEdit = useCallback((slotNum) => {
    const s = result?.schedule.find(slot => slot.slot === slotNum);
    if (!s) return;
    patchState({
      editLayout: {
        courts: s.courts.map(c => [...c.teamA.map(p => p.name), ...c.teamB.map(p => p.name)]),
        sitting: s.sitting.map(p => p.name),
      },
      editingSlot: slotNum,
    });
  }, [result]);

  const assignToPosition = useCallback((pos, newName) => {
    if (!editLayout) return;
    const findPos = name => {
      for (let ci = 0; ci < editLayout.courts.length; ci++) {
        const idx = editLayout.courts[ci].indexOf(name);
        if (idx >= 0) return { type: 'court', ci, idx };
      }
      const idx = editLayout.sitting.indexOf(name);
      return idx >= 0 ? { type: 'sit', idx } : null;
    };
    const other = findPos(newName);
    if (!other) return;
    const courts = editLayout.courts.map(c => [...c]);
    const sitting = [...editLayout.sitting];
    const get = p => p.type === 'court' ? courts[p.ci][p.idx] : sitting[p.idx];
    const set = (p, value) => {
      if (p.type === 'court') courts[p.ci][p.idx] = value;
      else sitting[p.idx] = value;
    };
    const av = get(pos);
    const bv = get(other);
    set(pos, bv);
    set(other, av);
    patchState({ editLayout: { courts, sitting } });
  }, [editLayout]);

  const applySlotEdit = useCallback(() => {
    if (!editingSlot || !result || !editLayout) return;
    const slotIdx = editingSlot - 1;
    const playersWithSkill = getPlayersWithAvailability().map(p => ({ ...p, skill: computeSkill(p.name) }));
    const keptSlots = result.schedule.slice(0, slotIdx);
    const stateSnapshot = extractState(keptSlots, playersWithSkill);
    const nameToIdx = new Map(playersWithSkill.map((p, i) => [p.name, i]));
    const courtsForced = editLayout.courts.map(court => court.map(name => nameToIdx.get(name)).filter(i => i !== undefined));
    if (courtsForced.some(c => c.length !== 4)) return;
    const newResult = generateSchedule(playersWithSkill, totalSlots, getCourtsPerSlot(), slotIdx, stateSnapshot, { courts: courtsForced }, { preferMixedTeams });
    if (!newResult) return;
    const nextScores = {};
    for (const key in scores) {
      const match = key.match(/^s(\d+)c/);
      if (match && parseInt(match[1]) < editingSlot) nextScores[key] = scores[key];
    }
    patchState({ result: newResult, scores: nextScores, editingSlot: null, editLayout: null, copied: false });
  }, [computeSkill, editLayout, editingSlot, getCourtsPerSlot, getPlayersWithAvailability, result, scores, totalSlots]);

  const applySlotEditOnly = useCallback(() => {
    if (!editingSlot || !result || !editLayout) return;
    const slotIdx = editingSlot - 1;
    const nameToPlayer = new Map(players.map(p => [p.name, { name: p.name, gender: p.gender }]));
    const origSlot = result.schedule[slotIdx];
    const newCourts = editLayout.courts.map((court, ci) => ({
      court: origSlot.courts[ci]?.court ?? ci + 1,
      teamA: [nameToPlayer.get(court[0]), nameToPlayer.get(court[1])],
      teamB: [nameToPlayer.get(court[2]), nameToPlayer.get(court[3])],
    }));
    const newSitting = editLayout.sitting.map(name => nameToPlayer.get(name));
    const newScheduleRaw = result.schedule.map((slot, i) =>
      i === slotIdx ? { ...slot, courts: newCourts, sitting: newSitting } : slot
    );
    const { schedule: newSchedule, gamesPlayed } = recomputeStats(newScheduleRaw, players);
    patchState({ result: { schedule: newSchedule, gamesPlayed }, editingSlot: null, editLayout: null, copied: false });
  }, [editingSlot, editLayout, players, result]);

  const updateScore = useCallback((slot, courtIdx, aVal, bVal, teamA, teamB) => {
    if (!isAdmin) return;
    const key = `s${slot}c${courtIdx}`;
    const aNum = parseInt(aVal);
    const bNum = parseInt(bVal);
    const valid = !isNaN(aNum) && !isNaN(bNum) && isValidBadmintonScore(aNum, bNum);
    const prevEntry = scores[key];
    const nextWinLoss = JSON.parse(JSON.stringify(winLoss));
    if (prevEntry?.applied) {
      const pA = parseInt(prevEntry.a);
      const pB = parseInt(prevEntry.b);
      const winners = pA > pB ? prevEntry.teamA : prevEntry.teamB;
      const losers = pA > pB ? prevEntry.teamB : prevEntry.teamA;
      winners.forEach(name => { if (nextWinLoss[name]) nextWinLoss[name].wins = Math.max(0, nextWinLoss[name].wins - 1); });
      losers.forEach(name => { if (nextWinLoss[name]) nextWinLoss[name].losses = Math.max(0, nextWinLoss[name].losses - 1); });
    }
    if (valid) {
      const winners = aNum > bNum ? teamA : teamB;
      const losers = aNum > bNum ? teamB : teamA;
      winners.forEach(name => { nextWinLoss[name] = { wins: (nextWinLoss[name]?.wins ?? 0) + 1, losses: nextWinLoss[name]?.losses ?? 0 }; });
      losers.forEach(name => { nextWinLoss[name] = { wins: nextWinLoss[name]?.wins ?? 0, losses: (nextWinLoss[name]?.losses ?? 0) + 1 }; });
    }
    patchState({
      scores: { ...scores, [key]: { a: aVal, b: bVal, applied: valid, teamA, teamB } },
      winLoss: nextWinLoss,
    });
  }, [isAdmin, scores, winLoss]);

  const buildCopyText = useCallback((mode) => {
    if (!result) return '';
    const hasMultiCourts = result.schedule.some(s => s.courts.length > 1);
    const courtDesc = extraCourt.enabled
      ? ` · ${numCourts} court${numCourts > 1 ? 's' : ''} +1 extra (${extraCourt.startMin}–${extraCourt.startMin + extraCourt.durationMin}m)`
      : numCourts > 1 ? ` × ${numCourts} courts` : '';
    const lines = [`🏸 Badminton Schedule — ${totalSlots} slots × ${gameMinutes} min${courtDesc}\n`];
    result.schedule.forEach(s => {
      lines.push(`--- Slot ${s.slot} (${slotTime(s.slot)}) ---`);
      s.courts.forEach((court, ci) => {
        const tA = court.teamA.map(p => p.name).join(' & ');
        const tB = court.teamB.map(p => p.name).join(' & ');
        const sc = scores[`s${s.slot}c${ci}`];
        const scoreStr = sc?.applied ? `  [${sc.a}–${sc.b}]` : '';
        lines.push(`  ${hasMultiCourts ? `Court ${court.court}: ` : ''}${tA}  vs  ${tB}${scoreStr}`);
      });
      if (mode === 'full' && s.sitting?.length > 0) lines.push(`  Sit: ${s.sitting.map(p => p.name).join(', ')}`);
    });
    if (mode === 'full') {
      lines.push('\nGames per player:');
      players.forEach((p, i) => lines.push(`  ${p.name}: ${result.gamesPlayed[i]}`));
    }
    return lines.join('\n');
  }, [extraCourt, gameMinutes, numCourts, players, result, scores, slotTime, totalSlots]);

  const copySchedule = useCallback(() => {
    copyText(buildCopyText('full'), () => {
      patchState({ copied: true });
      setTimeout(() => patchState({ copied: false }), 2000);
    });
  }, [buildCopyText]);

  const copyGames = useCallback(() => {
    copyText(buildCopyText('games'), () => {
      patchState({ copiedGames: true });
      setTimeout(() => patchState({ copiedGames: false }), 2000);
    });
  }, [buildCopyText]);

  const saveAsImage = useCallback(async () => {
    if (!scheduleRef.current) return;
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    const canvas = await window.html2canvas(scheduleRef.current, { backgroundColor: C.bg, scale: 2 });
    const link = document.createElement('a');
    link.download = 'badminton-schedule.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const savePlan = useCallback((overwrite) => {
    if (!result || !saveTag.trim()) return;
    if (overwrite && loadedPlanId != null && savedPlans.some(p => p.id === loadedPlanId)) {
      patchState({
        savedPlans: savedPlans.map(p => p.id === loadedPlanId ? { ...p, tag: saveTag.trim(), result, savedAt: new Date().toISOString() } : p),
        showSavePlan: false,
        saveTag: '',
      });
    } else {
      const newId = Date.now();
      patchState({
        savedPlans: [{ id: newId, tag: saveTag.trim(), result, savedAt: new Date().toISOString() }, ...savedPlans],
        showSavePlan: false,
        saveTag: '',
        loadedPlanId: newId,
      });
    }
  }, [loadedPlanId, result, saveTag, savedPlans]);

  const loadPlan = useCallback((plan) => {
    patchState({ result: plan.result, scores: {}, activeTab: 'schedule', isConfirmed: false, loadedPlanId: plan.id, shareId: null, shareToken: null });
  }, []);

  const deletePlan = useCallback((id) => {
    patchState({
      savedPlans: savedPlans.filter(plan => plan.id !== id),
      ...(id === loadedPlanId ? { loadedPlanId: null } : {}),
    });
  }, [loadedPlanId, savedPlans]);

  const shareLink = useCallback(async (forceNew = false) => {
    const data = buildSharePayload();
    if (!data) return;

    if (isFirebaseConfigured()) {
      const existingId = !forceNew ? shareId : null;
      const id = existingId || createShare(data);
      if (existingId) updateShare(existingId, data);
      if (id) {
        patchState({ shareId: id, shareToken: null });
        const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(id)}`;
        copyText(url, () => {
          patchState({ sharedUrl: url, copiedShareUrl: true, showShareModal: true, shareIsUpdate: !!existingId });
          setTimeout(() => patchState({ copiedShareUrl: false }), 2000);
        });
        return;
      }
    }

    const apiBase = normalizeApiBase(window.SHARE_API_BASE);
    if (apiBase) {
      try {
        const existingId = !forceNew ? shareId : null;
        const existingToken = !forceNew ? shareToken : null;
        const isUpdate = !!(existingId && existingToken);

        const response = await fetch(
          isUpdate ? `${apiBase}/shares/${encodeURIComponent(existingId!)}` : `${apiBase}/shares`,
          {
            method: isUpdate ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(isUpdate ? { data, token: existingToken } : { data }),
          },
        );
        if (!response.ok) throw new Error(`Share ${isUpdate ? 'update' : 'save'} failed: ${response.status}`);
        const payload = await response.json();
        const id = isUpdate ? existingId! : payload?.id;
        const token = isUpdate ? existingToken! : payload?.token;
        if (id) {
          const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(id)}`;
          copyText(url, () => {
            patchState({ sharedUrl: url, copiedShareUrl: true, showShareModal: true, shareIsUpdate: isUpdate, shareId: id, shareToken: token });
            setTimeout(() => patchState({ copiedShareUrl: false }), 2000);
          });
          return;
        }
      } catch {}
    }

    // Fallback: encode full schedule in URL hash (no token, always new)
    const fallbackUrl = `${window.location.origin}${window.location.pathname}#share=${btoa(JSON.stringify(data))}`;
    copyText(fallbackUrl, () => {
      patchState({ sharedUrl: fallbackUrl, copiedShareUrl: true, showShareModal: true, shareIsUpdate: false });
      setTimeout(() => patchState({ copiedShareUrl: false }), 2000);
    });
  }, [buildSharePayload, shareId, shareToken]);

  const copyShareUrl = useCallback(() => {
    copyText(sharedUrl, () => {
      patchState({ copiedShareUrl: true });
      setTimeout(() => patchState({ copiedShareUrl: false }), 2000);
    });
  }, [sharedUrl]);

  const applySharePayload = useCallback((data: SharePayload) => {
    const { p: sharedPlayers, cfg, slots, scores: sharedScores, confirmed } = data;
    const n = sharedPlayers.length;
    const gp = new Array(n).fill(0);
    const cp = new Array(n).fill(0);
    const cr = new Array(n).fill(0);
    const newSchedule = slots.map(slot => {
      const playing = new Set(slot.c.flat(2));
      for (let i = 0; i < n; i++) {
        if (playing.has(i)) {
          gp[i]++;
          cp[i]++;
          cr[i] = 0;
        } else {
          cr[i]++;
          cp[i] = 0;
        }
      }
      return {
        slot: slot.s,
        courts: slot.c.map((court, ci) => ({
          court: ci + 1,
          teamA: court[0].map(i => ({ name: sharedPlayers[i][0], gender: sharedPlayers[i][1] })),
          teamB: court[1].map(i => ({ name: sharedPlayers[i][0], gender: sharedPlayers[i][1] })),
        })),
        sitting: slot.sit.map(i => ({ name: sharedPlayers[i][0], gender: sharedPlayers[i][1] })),
        playerState: sharedPlayers.map(([name, gender], i) => ({
          name,
          gender,
          total: gp[i],
          conPlayed: cp[i],
          conRested: cr[i],
          playing: playing.has(i),
          available: true,
        })),
        repeatedCourts: [],
      };
    });
    const restoredScores = {};
    newSchedule.forEach(slot => {
      slot.courts.forEach((court, ci) => {
        const key = `s${slot.slot}c${ci}`;
        const sharedScore = sharedScores?.[key];
        if (!sharedScore) return;
        restoredScores[key] = {
          a: sharedScore.a,
          b: sharedScore.b,
          applied: true,
          teamA: court.teamA.map(player => player.name),
          teamB: court.teamB.map(player => player.name),
        };
      });
    });

    patchState({
      players: sharedPlayers.map(([name, gender]) => ({ name, gender, skill: 2, availFrom: 0, availTo: slots.length - 1, group: 'full', leavesAt: null })),
      gameMinutes: cfg?.g || gameMinutes,
      numCourts: cfg?.c || numCourts,
      result: { schedule: newSchedule, gamesPlayed: [...gp] },
      scores: restoredScores,
      isConfirmed: !!confirmed,
      loadedPlanId: null,
    });
  }, [gameMinutes, numCourts]);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: FONT, padding: '24px 16px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {showPinPrompt && <PinPromptModal pinInput={pinInput} pinError={pinError} setPinInput={value => patchState({ pinInput: value, pinError: false })} submitPin={submitPin} close={() => patchState({ showPinPrompt: false, pinInput: '', pinError: false })} />}
        {showSavePlan && <SavePlanModal needsPin={window.ADMIN_PIN && !isAdmin} pinInput={pinInput} pinError={pinError} setPinInput={value => patchState({ pinInput: value, pinError: false })} submitPin={submitPin} saveTag={saveTag} setSaveTag={value => patchState({ saveTag: value })} savePlan={savePlan} canUpdate={loadedPlanId != null && savedPlans.some(p => p.id === loadedPlanId)} close={() => patchState({ showSavePlan: false, pinInput: '', pinError: false })} />}
        {showShareModal && <ShareLinkModal copiedShareUrl={copiedShareUrl} sharedUrl={sharedUrl} shareIsUpdate={shareIsUpdate} hasExisting={isFirebaseConfigured() ? !!shareId : !!(shareId && shareToken)} live={isFirebaseConfigured()} copyShareUrl={copyShareUrl} newShareLink={() => shareLink(true)} close={() => patchState({ showShareModal: false })} />}
        {showImport && <ImportModal importText={importText} importError={importError} setImportText={value => patchState({ importText: value, importError: '' })} importSchedule={importSchedule} close={() => patchState({ showImport: false, importText: '', importError: '' })} />}

        <div style={{ marginBottom: 28, borderBottom: `1px solid ${C.border}`, paddingBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Match Planner</h1>
            <p style={{ color: C.textDim, fontSize: 13, margin: '6px 0 0' }}>
              {Math.floor(totalMinutes / 60)}h{totalMinutes % 60 ? `${totalMinutes % 60}m` : ''} · {totalSlots} slots × {gameMinutes} min · {numCourts} court{numCourts > 1 ? 's' : ''}{extraCourt.enabled ? ` +1 extra (${extraCourt.startMin}–${extraCourt.startMin + extraCourt.durationMin}m)` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {isFirebaseConfigured() && <span title={dbSynced === 'synced' ? 'Win-loss synced to cloud' : dbSynced === 'syncing' ? 'Syncing…' : dbSynced === 'error' ? 'Sync failed' : 'Cloud sync ready'} style={{ fontSize: 13, color: dbSynced === 'synced' ? C.green : dbSynced === 'error' ? '#ef4444' : C.textMuted }}>{dbSynced === 'synced' ? '☁ Synced' : dbSynced === 'syncing' ? '⟳' : dbSynced === 'error' ? '☁ ✗' : '☁'}</span>}
            {window.ADMIN_PIN && (
              <button onClick={() => isAdmin ? (sessionStorage.removeItem('bp-admin'), setIsAdmin(false)) : patchState({ showPinPrompt: true })} title={isAdmin ? 'Click to lock score entry' : 'Click to unlock score entry'} style={{ background: isAdmin ? C.accentDim : C.card, color: isAdmin ? '#fff' : C.textMuted, border: `1px solid ${isAdmin ? 'transparent' : C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: FONT }}>
                {isAdmin ? '🔓 Admin' : '🔒 Lock'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[['schedule', 'Schedule'], ['archive', `Saved Plans${savedPlans.length ? ` (${savedPlans.length})` : ''}`], ['about', 'How It Works']].map(([val, label]) => (
            <button key={val} onClick={() => patchState({ activeTab: val })}
              style={{
                flex: 1, background: activeTab === val ? C.accentDim : C.card, color: activeTab === val ? '#fff' : C.textDim,
                border: `1px solid ${activeTab === val ? C.accentDim : C.border}`, borderRadius: 8, padding: '10px 14px',
                fontSize: 13, fontWeight: 700, fontFamily: FONT,
              }}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'archive' && (
          <ArchiveTab savedPlans={savedPlans} loadPlan={loadPlan} deletePlan={deletePlan} />
        )}

        {activeTab === 'about' && <AboutTab />}

        {activeTab === 'schedule' && (
        <>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: C.shadow }}>
        <h3 style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, margin: '0 0 14px' }}>Session</h3>
        <div className="settings-row" style={{ marginBottom: 0 }}>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start time</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <input type="time" value={sessionStart} onChange={e => patchState({ sessionStart: e.target.value })} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', color: sessionStart ? C.text : C.textMuted, fontSize: 13, fontFamily: FONT }} />
              {sessionStart && <button onClick={() => patchState({ sessionStart: '' })} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>}
            </div>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Session length</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input type="range" min={60} max={240} step={gameMinutes} value={totalMinutes} onChange={e => patchState({ totalMinutes: +e.target.value })} style={{ flex: 1, accentColor: C.accent }} />
              <span style={{ fontSize: 14, color: C.accent, fontWeight: 600, minWidth: 48, textAlign: 'right' }}>{Math.floor(totalMinutes / 60)}h{totalMinutes % 60 ? `${totalMinutes % 60}m` : ''}</span>
            </div>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Game length</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input type="range" min={8} max={20} value={gameMinutes} onChange={e => patchState({ gameMinutes: +e.target.value })} style={{ flex: 1, accentColor: C.accent }} />
              <span style={{ fontSize: 14, color: C.accent, fontWeight: 600, minWidth: 48, textAlign: 'right' }}>{gameMinutes}m</span>
            </div>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Courts</label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[1, 2, 3].map(nc => (
                <button key={nc} onClick={() => patchState({ numCourts: nc })} style={{ background: numCourts === nc ? C.accentDim : C.card, color: numCourts === nc ? '#fff' : C.textDim, border: `1px solid ${numCourts === nc ? C.accentDim : C.border}`, borderRadius: 6, padding: '8px 14px', fontSize: 14, fontWeight: 600, fontFamily: FONT }}>
                  {nc}
                </button>
              ))}
            </div>
          </div>
          {numCourts < 3 && (
            <div style={{ flex: '0 0 auto' }}>
              <label style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Extra court</label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                <button onClick={() => patchState({ extraCourt: { ...extraCourt, enabled: !extraCourt.enabled } })} style={{ background: extraCourt.enabled ? C.accentDim : C.card, color: extraCourt.enabled ? '#fff' : C.textDim, border: `1px solid ${extraCourt.enabled ? C.accentDim : C.border}`, borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                  {extraCourt.enabled ? 'ON' : 'OFF'}
                </button>
                {extraCourt.enabled && (
                  <>
                    <span style={{ fontSize: 11, color: C.textDim }}>@</span>
                    <input type="number" min={0} max={totalMinutes - gameMinutes} step={gameMinutes} value={extraCourt.startMin} onChange={e => patchState({ extraCourt: { ...extraCourt, startMin: +e.target.value } })} style={{ width: 44, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 6px', color: C.text, fontSize: 12, fontFamily: FONT, textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: C.textDim }}>m for</span>
                    <input type="number" min={gameMinutes} max={totalMinutes} step={gameMinutes} value={extraCourt.durationMin} onChange={e => patchState({ extraCourt: { ...extraCourt, durationMin: +e.target.value } })} style={{ width: 44, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 6px', color: C.text, fontSize: 12, fontFamily: FONT, textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: C.textDim }}>m</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Availability</label>
            <div className="avail-buttons" style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[['none', 'All here'], ['group', 'Early / Late'], ['custom', 'Per player']].map(([val, label]) => (
                <button key={val} onClick={() => patchState({ staggerMode: val })} style={{ background: staggerMode === val ? C.accentDim : C.card, color: staggerMode === val ? '#fff' : C.textDim, border: `1px solid ${staggerMode === val ? C.accentDim : C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, fontWeight: 600, fontFamily: FONT, flex: 1 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mixed teams</label>
            <div style={{ marginTop: 4 }}>
              <button onClick={() => patchState({ preferMixedTeams: !preferMixedTeams })}
                title={preferMixedTeams ? 'Each game has 1F+1M per side (2F per court)' : 'Females spread evenly across courts (1F per court when outnumbered)'}
                style={{ background: preferMixedTeams ? C.pinkDim : C.card, color: preferMixedTeams ? '#fff' : C.textDim, border: `1px solid ${preferMixedTeams ? C.pinkDim : C.border}`, borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                {preferMixedTeams ? '1F+1M / side' : 'Spread F'}
              </button>
            </div>
          </div>
        </div>
        </div>

        <PlayerList
          players={players}
          playerHistory={playerHistory}
          winLoss={winLoss}
          staggerMode={staggerMode}
          totalSlots={totalSlots}
          nameInput={nameInput}
          genderInput={genderInput}
          allDefaultsLoaded={allDefaultsLoaded}
          setNameInput={value => setField('nameInput', value)}
          setGenderInput={value => setField('genderInput', value)}
          addPlayer={addPlayer}
          addSelectedFromBank={addSelectedFromBank}
          addToBank={addToBank}
          removeFromHistory={removeFromHistory}
          loadDefaults={loadDefaults}
          resetPlayers={resetPlayers}
          clearPlayers={clearPlayers}
          clearWinLoss={clearWinLoss}
          updatePlayer={updatePlayer}
          removePlayer={removePlayer}
        />

        {players.length >= 4 && (
          <div className="action-buttons" style={{ marginBottom: result ? 8 : 24 }}>
            <button onClick={() => patchState({ showImport: true })} style={{ background: 'transparent', color: C.textDim, border: `1px dashed ${C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, fontFamily: FONT }}>Import</button>
            <button className="generate-btn" onClick={generate} disabled={isGenerating} style={{ flex: 1, background: C.accentDim, color: '#fff', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, fontWeight: 700, fontFamily: FONT, letterSpacing: '1px', textTransform: 'uppercase', opacity: isGenerating ? 0.6 : 1, boxShadow: C.shadow }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <LucideIcon name="shuffle" size={15} />
                {isGenerating ? `Slot ${genSlot} / ${totalSlots}…` : result ? 'Re-roll' : `Generate (${totalSlots} slots)`}
              </span>
            </button>
            {result && (
              isConfirmed ? (
                <button onClick={unconfirmSchedule} title="Click to unlock for editing" style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.green, color: C.bg, border: 'none', borderRadius: 8, padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
                  <LucideIcon name="check" size={15} /> Confirmed
                </button>
              ) : (
                <button onClick={confirmSchedule} title="Lock this as the schedule for the session" style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
                  <LucideIcon name="check" size={15} /> Confirm
                </button>
              )
            )}
          </div>
        )}

        {result && (
          <div className="action-buttons" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={copySchedule} title="Copy full schedule (with sit list & game counts)" style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? C.green : C.card, color: copied ? C.bg : C.text, border: `1px solid ${copied ? C.green : C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT, transition: 'all 0.2s' }}><LucideIcon name={copied ? 'check' : 'copy'} size={15} /> Copy</button>
            <button onClick={copyGames} title="Copy games only (matchups, no sit list or stats)" style={{ display: 'flex', alignItems: 'center', gap: 6, background: copiedGames ? C.green : C.card, color: copiedGames ? C.bg : C.textDim, border: `1px solid ${copiedGames ? C.green : C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 12, fontWeight: 700, fontFamily: FONT, transition: 'all 0.2s' }}>{copiedGames ? <LucideIcon name="check" size={15} /> : '⚡'} Quick Copy</button>
            <button onClick={saveAsImage} title="Save schedule as an image" style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT }}><LucideIcon name="download" size={15} /> Image</button>
            <button onClick={() => { const loaded = savedPlans.find(p => p.id === loadedPlanId); patchState({ saveTag: loaded ? loaded.tag : '', showSavePlan: true }); }} title="Save plan with tag" style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT }}><LucideIcon name="bookmark" size={15} /> Save</button>
            <button onClick={shareLink} title="Share schedule via link" style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT }}><LucideIcon name="link" size={15} /> Share</button>
            <button onClick={clearSchedule} title="Clear schedule" style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: FONT }}><LucideIcon name="trash" size={15} /> Clear</button>
          </div>
        )}

        {pendingOverwrite && (
          <ConfirmOverwriteModal onConfirm={executeOverwrite} onCancel={cancelOverwrite} />
        )}

        {hasAppliedScores && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: C.card, border: `1px solid ${C.amber}33`, borderRadius: 8, padding: '8px 14px' }}><span style={{ fontSize: 12, color: C.amber }}>⚡ Scores recorded — re-roll to use updated skill ratings in the next schedule</span></div>}

        {result && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
            <span style={{ fontSize: 12, color: C.textDim }}>Re-generate from slot</span>
            <input type="number" min={1} max={totalSlots} value={fromSlot} onChange={e => patchState({ fromSlot: Math.min(totalSlots, Math.max(1, +e.target.value)) })} style={{ width: 48, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 13, fontFamily: FONT, textAlign: 'center' }} />
            <span style={{ fontSize: 12, color: C.textDim }}>with</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3].map(n => (
                <button key={n} onClick={() => patchState({ fromSlotCourts: n })} style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600, fontFamily: FONT, borderRadius: 4, border: `1px solid ${fromSlotCourts === n ? C.accent : C.border}`, background: fromSlotCourts === n ? C.accentDim : C.bg, color: fromSlotCourts === n ? '#fff' : C.textDim, cursor: 'pointer' }}>{n === 0 ? 'auto' : `${n}C`}</button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: C.textDim, flex: 1 }}>courts onwards</span>
            <button onClick={regenerateRemaining} style={{ background: C.accentDim, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: FONT }}>Apply</button>
          </div>
        )}

        {saved && <p style={{ fontSize: 12, color: C.green, textAlign: 'center', marginTop: -16, marginBottom: 16 }}>Schedule saved — will persist on refresh</p>}

        {result && (
          <ScheduleGrid
            result={result}
            players={players}
            scores={scores}
            editingSlot={editingSlot}
            editLayout={editLayout}
            isAdmin={isAdmin}
            scheduleRef={scheduleRef}
            minGames={minGames}
            maxGames={maxGames}
            slotTime={slotTime}
            startSlotEdit={startSlotEdit}
            applySlotEdit={applySlotEdit}
            applySlotEditOnly={applySlotEditOnly}
            cancelSlotEdit={() => patchState({ editingSlot: null, editLayout: null })}
            assignToPosition={assignToPosition}
            updateScore={updateScore}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
}

export default BadmintonPlanner;
