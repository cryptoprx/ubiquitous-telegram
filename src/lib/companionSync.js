import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, deleteDoc, getDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import useBrowserStore from '../store/browserStore';

// ── Firebase Config ──────────────────────────────────────────────
// Same project as the companion app (mimo-b5745).
// Fill these in from Firebase Console → Project Settings → Web app.
const firebaseConfig = {
  apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
  authDomain: 'mimo-b5745.firebaseapp.com',
  projectId: 'mimo-b5745',
  storageBucket: 'mimo-b5745.appspot.com',
  messagingSenderId: 'REPLACE_WITH_MSG_ID',
  appId: 'REPLACE_WITH_APP_ID',
};

const PAIRING_TTL_MS = 5 * 60 * 1000; // 5 min pairing window
const COMMAND_MAX_AGE_MS = 60 * 1000;  // ignore commands older than 60s
const TAB_SYNC_INTERVAL_MS = 15_000;
const MAX_TABS_SYNC = 50;
const ALLOWED_CMD_TYPES = new Set(['open-url', 'close-tab']);

let app = null;
let db = null;
let unsubCommands = null;
let unsubPairing = null;
let tabSyncInterval = null;

function getDb() {
  if (!db) {
    app = initializeApp(firebaseConfig, 'companion');
    db = getFirestore(app);
  }
  return db;
}

// ── Crypto Helpers ───────────────────────────────────────────────

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

// ── Device Identity ──────────────────────────────────────────────
// Persistent browser device ID — generated once, stored forever.

function getDeviceId() {
  let id = localStorage.getItem('flip-device-id');
  if (!id) {
    id = randomHex(16); // 32-char hex UUID
    localStorage.setItem('flip-device-id', id);
  }
  return id;
}

// ── Pairing State ────────────────────────────────────────────────

function getPairingData() {
  try {
    return JSON.parse(localStorage.getItem('flip-companion-pairing') || 'null');
  } catch { return null; }
}

function setPairingData(data) {
  if (data) {
    localStorage.setItem('flip-companion-pairing', JSON.stringify(data));
  } else {
    localStorage.removeItem('flip-companion-pairing');
  }
}

export function getPairedUserId() {
  return getPairingData()?.uid || null;
}

export function isPaired() {
  return !!getPairedUserId();
}

// ── Input Sanitization ───────────────────────────────────────────

function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim().slice(0, 2048);
  // Block javascript: and data: URIs to prevent XSS
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  try { new URL(trimmed); return trimmed; } catch { return null; }
}

function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen).replace(/[<>]/g, '');
}

function sanitizeTabId(id) {
  if (typeof id !== 'string') return null;
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : null;
}

// ── QR Code Pairing ──────────────────────────────────────────────
// 1. Browser generates pairingCode (8 hex) + pairingSecret (32 hex)
// 2. Writes session to Firestore: pairingSessions/{code}
// 3. Shows QR encoding: flip-pair:{code}:{secret}
// 4. Companion scans QR → claims session with UID
// 5. Browser detects claim → verifies → stores UID → starts syncing
// 6. Session doc is deleted

export async function createPairingSession() {
  const firestore = getDb();
  const code = randomHex(4);     // 8-char hex
  const secret = randomHex(16);  // 32-char hex
  const secretHash = await sha256(secret);
  const deviceId = getDeviceId();
  const now = Date.now();

  await setDoc(doc(firestore, 'pairingSessions', code), {
    deviceId,
    secretHash,
    createdAt: now,
    expiresAt: now + PAIRING_TTL_MS,
    status: 'waiting',
  });

  return { code, secret, qrPayload: `flip-pair:${code}:${secret}` };
}

export function listenForPairingClaim(code, secret, onPaired) {
  const firestore = getDb();
  const ref = doc(firestore, 'pairingSessions', code);

  // Clean up any existing pairing listener
  if (unsubPairing) { unsubPairing(); unsubPairing = null; }

  unsubPairing = onSnapshot(ref, async (snap) => {
    const data = snap.data();
    if (!data || data.status !== 'claimed') return;

    // Verify secret hash — required for QR scan, skipped for manual PIN entry
    if (data.claimMethod !== 'manual') {
      const expectedHash = await sha256(secret);
      if (data.claimSecretHash !== expectedHash) {
        console.warn('[Companion] Pairing claim failed: secret mismatch');
        return;
      }
    }

    // Verify not expired
    if (Date.now() > data.expiresAt) {
      console.warn('[Companion] Pairing claim failed: expired');
      await deleteDoc(ref).catch(() => {});
      return;
    }

    // Success — store pairing data
    const pairingData = {
      uid: data.uid,
      deviceId: getDeviceId(),
      pairedAt: Date.now(),
    };
    setPairingData(pairingData);

    // Clean up session from Firestore
    await deleteDoc(ref).catch(() => {});

    // Stop listening
    if (unsubPairing) { unsubPairing(); unsubPairing = null; }

    console.log('[Companion] Paired successfully with UID:', data.uid);
    onPaired(pairingData);
  });

  // Auto-expire after TTL
  setTimeout(() => {
    if (unsubPairing) { unsubPairing(); unsubPairing = null; }
    deleteDoc(ref).catch(() => {});
  }, PAIRING_TTL_MS);
}

export function cancelPairing() {
  if (unsubPairing) { unsubPairing(); unsubPairing = null; }
}

export function unpair() {
  stopSync();
  // Clean up remote data
  const uid = getPairedUserId();
  if (uid) {
    try {
      const firestore = getDb();
      // Remove device doc so companion knows we disconnected
      deleteDoc(doc(firestore, 'users', uid, 'pairedDevices', getDeviceId())).catch(() => {});
    } catch {}
  }
  setPairingData(null);
}

// ── Tab Sync ─────────────────────────────────────────────────────

function syncTabs() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    const deviceId = getDeviceId();
    const tabs = useBrowserStore.getState().tabs || [];

    const tabsData = tabs
      .filter(t => t.url && !t.url.startsWith('flip://') && !t.url.startsWith('about:'))
      .slice(0, MAX_TABS_SYNC)
      .map(t => ({
        id: t.id,
        url: sanitizeString(t.url || '', 2048),
        title: sanitizeString(t.title || t.url || '', 200),
        pinned: !!t.pinned,
      }));

    // Write as a single document (not per-tab) to minimize writes and exposure
    setDoc(doc(firestore, 'users', uid, 'remoteTabs', deviceId), {
      tabs: tabsData,
      deviceId,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  } catch (e) {
    console.error('[Companion] Tab sync error:', e.message);
  }
}

// ── Remote Commands Listener ─────────────────────────────────────

function startCommandListener() {
  const uid = getPairedUserId();
  if (!uid) return;
  const deviceId = getDeviceId();

  try {
    const firestore = getDb();
    const q = query(
      collection(firestore, 'users', uid, 'remoteCommands'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    unsubCommands = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type !== 'added') return;
        const cmd = change.doc.data();
        const cmdRef = doc(firestore, 'users', uid, 'remoteCommands', change.doc.id);

        // ── Security checks ──
        // 1. Only process pending commands
        if (cmd.status !== 'pending') return;

        // 2. Verify command type is allowed
        if (!ALLOWED_CMD_TYPES.has(cmd.type)) {
          console.warn('[Companion] Blocked unknown command type:', cmd.type);
          await deleteDoc(cmdRef).catch(() => {});
          return;
        }

        // 3. Reject stale commands (replay protection)
        if (cmd.timestamp?.toMillis && Date.now() - cmd.timestamp.toMillis() > COMMAND_MAX_AGE_MS) {
          await deleteDoc(cmdRef).catch(() => {});
          return;
        }

        // ── Execute ──
        switch (cmd.type) {
          case 'open-url': {
            const url = sanitizeUrl(cmd.url);
            if (url) useBrowserStore.getState().addTab(url);
            break;
          }
          case 'close-tab': {
            const tabId = sanitizeTabId(cmd.tabId);
            if (tabId) useBrowserStore.getState().closeTab(tabId);
            break;
          }
        }

        // Delete command after processing (don't leave data in Firestore)
        await deleteDoc(cmdRef).catch(() => {});
      });
    });
  } catch (e) {
    console.error('[Companion] Command listener error:', e.message);
  }
}

// ── Notification Forwarding ──────────────────────────────────────

export function forwardNotification({ type = 'general', title, body }) {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    const id = Date.now().toString(36) + randomHex(4);
    setDoc(doc(firestore, 'users', uid, 'notifications', id), {
      type: sanitizeString(type, 50),
      title: sanitizeString(title || '', 200),
      body: sanitizeString(body || '', 500),
      deviceId: getDeviceId(),
      timestamp: serverTimestamp(),
      read: false,
    }).catch(() => {});
  } catch {}
}

// ── Start / Stop Sync ────────────────────────────────────────────

export function startSync() {
  if (!isPaired()) return;
  console.log('[Companion] Starting sync…');

  syncTabs();
  tabSyncInterval = setInterval(syncTabs, TAB_SYNC_INTERVAL_MS);
  startCommandListener();
}

export function stopSync() {
  if (unsubCommands) { unsubCommands(); unsubCommands = null; }
  if (tabSyncInterval) { clearInterval(tabSyncInterval); tabSyncInterval = null; }
}

export function initCompanionSync() {
  if (isPaired()) {
    setTimeout(startSync, 3000);
  }
}
