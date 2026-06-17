import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  onValue,
  type Database,
} from 'firebase/database';

declare global {
  interface Window {
    FIREBASE_CONFIG: Record<string, string> | null;
    RECAPTCHA_SITE_KEY: string | null;
    ADMIN_PIN: string | null;
    SHARE_API_BASE: string | null;
  }
}

let app: FirebaseApp | null = null;
let db: Database | null = null;

function getDb(): Database | null {
  if (db) return db;
  if (!window.FIREBASE_CONFIG) return null;
  app = initializeApp(window.FIREBASE_CONFIG);
  if (window.RECAPTCHA_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(window.RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
  db = getDatabase(app);
  return db;
}

export function isFirebaseConfigured(): boolean {
  return !!window.FIREBASE_CONFIG;
}

// ─── Win/loss sync (legacy bp-winloss path, unchanged shape) ──────────────────

export function loadWinLoss(): Promise<Record<string, { wins: number; losses: number }>> {
  const database = getDb();
  if (!database) return Promise.resolve({});
  return new Promise(resolve => {
    onValue(ref(database, 'winLoss'), snapshot => resolve(snapshot.val() || {}), { onlyOnce: true });
  });
}

export function saveWinLoss(data: Record<string, { wins: number; losses: number }>): Promise<void> {
  const database = getDb();
  if (!database) return Promise.resolve();
  return set(ref(database, 'winLoss'), data);
}

// ─── Shared schedule live sync ─────────────────────────────────────────────

export function createShare(payload: unknown): string | null {
  const database = getDb();
  if (!database) return null;
  const newRef = push(ref(database, 'shares'));
  set(newRef, payload);
  return newRef.key;
}

export function updateShare(shareId: string, payload: unknown): void {
  const database = getDb();
  if (!database) return;
  set(ref(database, `shares/${shareId}`), payload);
}

export async function fetchShare(shareId: string): Promise<unknown | null> {
  const database = getDb();
  if (!database) return null;
  const snapshot = await get(ref(database, `shares/${shareId}`));
  return snapshot.val();
}
