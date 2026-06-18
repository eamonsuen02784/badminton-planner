import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  type Database,
} from 'firebase/database';

// Shares older than this are deleted the next time anyone opens them, so abandoned/forgotten
// links don't accumulate in the database forever. Saved Plans already prunes its own local
// reference to a share after 2 weeks (ARCHIVE_TTL_MS); this is a longer, server-side backstop —
// long enough that an actively-used link (e.g. reused across a multi-week season) won't expire
// out from under people still relying on it.
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  set(newRef, { ...(payload as object), createdAt: Date.now() });
  return newRef.key;
}

export function updateShare(shareId: string, payload: unknown): void {
  const database = getDb();
  if (!database) return;
  // Partial update (not set) so it never clobbers the original createdAt timestamp.
  update(ref(database, `shares/${shareId}`), payload as object);
}

export type FetchShareResult =
  | { status: 'ok'; data: any }
  | { status: 'expired' }
  | { status: 'not_found' };

export async function fetchShare(shareId: string): Promise<FetchShareResult> {
  const database = getDb();
  if (!database) return { status: 'not_found' };
  const shareRef = ref(database, `shares/${shareId}`);
  const snapshot = await get(shareRef);
  const data = snapshot.val();
  if (!data) return { status: 'not_found' };
  if (data.createdAt && Date.now() - data.createdAt > SHARE_TTL_MS) {
    remove(shareRef).catch(() => {});
    return { status: 'expired' };
  }
  return { status: 'ok', data };
}
