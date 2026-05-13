import { useEffect, useReducer } from 'react';
import { DEFAULT_GAME_MINUTES, DEFAULT_TOTAL_MINUTES } from '../constants';
import type { PlannerPersistedState, PlannerState } from '../types';

const STORAGE_KEYS = {
  players: 'bp-players',
  totalMinutes: 'bp-totalMinutes',
  gameMinutes: 'bp-gameMinutes',
  numCourts: 'bp-numCourts',
  extraCourt: 'bp-extraCourt',
  staggerMode: 'bp-staggerMode',
  sessionStart: 'bp-sessionStart',
  result: 'bp-result',
  scores: 'bp-scores',
  winLoss: 'bp-winloss',
  savedPlans: 'bp-saved-plans',
  shareId: 'bp-share-id',
  shareToken: 'bp-share-token',
  preferMixedTeams: 'bp-prefer-mixed-teams',
} as const;

function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function createInitialState(): PlannerState {
  return {
    players: loadState(STORAGE_KEYS.players, []),
    nameInput: '',
    genderInput: 'M',
    totalMinutes: loadState(STORAGE_KEYS.totalMinutes, DEFAULT_TOTAL_MINUTES),
    gameMinutes: loadState(STORAGE_KEYS.gameMinutes, DEFAULT_GAME_MINUTES),
    numCourts: loadState(STORAGE_KEYS.numCourts, 1),
    extraCourt: loadState(STORAGE_KEYS.extraCourt, { enabled: false, startMin: 60, durationMin: 90 }),
    staggerMode: loadState(STORAGE_KEYS.staggerMode, 'none'),
    sessionStart: loadState(STORAGE_KEYS.sessionStart, ''),
    result: loadState(STORAGE_KEYS.result, null),
    scores: loadState(STORAGE_KEYS.scores, {}),
    winLoss: loadState(STORAGE_KEYS.winLoss, {}),
    fromSlot: 1,
    fromSlotCourts: 0,
    copied: false,
    copiedGames: false,
    saved: false,
    isGenerating: false,
    genSlot: 0,
    showPinPrompt: false,
    pinInput: '',
    pinError: false,
    showImport: false,
    importText: '',
    importError: '',
    savedPlans: loadState(STORAGE_KEYS.savedPlans, []),
    showSavePlan: false,
    saveTag: '',
    showSavedList: false,
    editingSlot: null,
    editLayout: null,
    pendingShare: null,
    showShareLoad: false,
    showShareModal: false,
    sharedUrl: '',
    copiedShareUrl: false,
    shareIsUpdate: false,
    shareId: loadState(STORAGE_KEYS.shareId, null),
    shareToken: loadState(STORAGE_KEYS.shareToken, null),
    preferMixedTeams: loadState(STORAGE_KEYS.preferMixedTeams, false),
  };
}

type PlannerAction =
  | { type: 'set'; key: keyof PlannerState; value: PlannerState[keyof PlannerState] }
  | { type: 'patch'; value: Partial<PlannerState> };

function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'patch':
      return { ...state, ...action.value };
    default:
      return state;
  }
}

export function usePlannerState() {
  const [state, dispatch] = useReducer(plannerReducer, undefined, createInitialState);

  useEffect(() => {
    const persisted: PlannerPersistedState = {
      players: state.players,
      totalMinutes: state.totalMinutes,
      gameMinutes: state.gameMinutes,
      numCourts: state.numCourts,
      extraCourt: state.extraCourt,
      staggerMode: state.staggerMode,
      sessionStart: state.sessionStart,
      result: state.result,
      scores: state.scores,
      winLoss: state.winLoss,
      savedPlans: state.savedPlans,
      shareId: state.shareId,
      shareToken: state.shareToken,
      preferMixedTeams: state.preferMixedTeams,
    };

    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      const value = persisted[key as keyof PlannerPersistedState];
      if (key === 'result' && !value) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(value));
    }
  }, [
    state.players,
    state.totalMinutes,
    state.gameMinutes,
    state.numCourts,
    state.extraCourt,
    state.staggerMode,
    state.sessionStart,
    state.result,
    state.scores,
    state.winLoss,
    state.savedPlans,
    state.shareId,
    state.shareToken,
    state.preferMixedTeams,
  ]);

  const setField = <K extends keyof PlannerState>(key: K, value: PlannerState[K]) =>
    dispatch({ type: 'set', key, value });
  const patchState = (value: Partial<PlannerState>) => dispatch({ type: 'patch', value });

  return { state, setField, patchState };
}
