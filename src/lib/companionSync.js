import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, deleteDoc, getDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import useBrowserStore from '../store/browserStore';

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
let unsubAI = null;
let unsubFiles = null;
let unsubIncomingCall = null;
let unsubTOTP = null;
let unsubVaultPull = null;
let unsubNotifications = null;
let tabSyncInterval = null;
let passwordSyncInterval = null;

function getDb() {
  if (!db) {
    app = initializeApp(firebaseConfig, 'companion');
    db = getFirestore(app);
  }
  return db;
}


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

// Persistent browser device ID — generated once, stored forever.

function getDeviceId() {
  let id = localStorage.getItem('flip-device-id');
  if (!id) {
    id = randomHex(16); // 32-char hex UUID
    localStorage.setItem('flip-device-id', id);
  }
  return id;
}


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

// Companion writes user messages to Firestore → Browser injects them into
// the AI chat extension (full tools, system prompt, browser actions) →
// captures streamed response → writes it back to Firestore for companion.

let aiRelayPending = null; // { msgRef, docId, uid, relayId } — tracks the companion message being processed
let aiRelayBuffer = '';    // collects streamed AI response tokens
let unsubRelayToken = null;
let unsubRelayDone = null;

function startAIRelay() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();

    // Cleanup any previous relay stream listeners
    if (unsubRelayToken) { unsubRelayToken(); unsubRelayToken = null; }
    if (unsubRelayDone) { unsubRelayDone(); unsubRelayDone = null; }

    // Listen for AI stream events to capture responses for companion
    if (window.flipAPI?.onAiStreamToken) {
      unsubRelayToken = window.flipAPI.onAiStreamToken((token) => {
        if (aiRelayPending) aiRelayBuffer += token;
      });
    }
    if (window.flipAPI?.onAiStreamDone) {
      unsubRelayDone = window.flipAPI.onAiStreamDone(async () => {
        if (!aiRelayPending) return;
        const { msgRef, docId, uid: relayUid } = aiRelayPending;
        const reply = aiRelayBuffer || 'No response from AI';
        aiRelayPending = null;
        aiRelayBuffer = '';
        try {
          const replyId = Date.now().toString(36) + randomHex(4);
          await setDoc(doc(firestore, 'users', relayUid, 'companionAI', replyId), {
            role: 'assistant',
            content: reply,
            replyTo: docId,
            status: 'done',
            createdAt: serverTimestamp(),
          });
          await setDoc(msgRef, { status: 'done' }, { merge: true }).catch(() => {});
        } catch {}
      });
    }

    const q = query(
      collection(firestore, 'users', uid, 'companionAI'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    unsubAI = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type !== 'added') return;
        const msg = change.doc.data();
        const msgRef = doc(firestore, 'users', uid, 'companionAI', change.doc.id);
        // Only process pending user messages
        if (msg.status !== 'pending' || msg.role !== 'user') return;
        // Skip if already processing another message (prevent race condition)
        if (aiRelayPending) {
          console.warn('[Companion] AI relay busy, skipping message:', change.doc.id);
          return;
        }
        // Mark as processing
        await setDoc(msgRef, { ...msg, status: 'processing' }, { merge: true }).catch(() => {});

        // Track this as the active companion relay message
        aiRelayPending = { msgRef, docId: change.doc.id, uid };
        aiRelayBuffer = '';

        // Open sidebar to AI chat extension so the message is visible
        try {
          const store = useBrowserStore.getState();
          if (store.setSidebarView) store.setSidebarView('extensions');
          if (!store.sidebarOpen && store.toggleSidebar) store.toggleSidebar();
          // Switch to AI chat extension specifically
          window.dispatchEvent(new CustomEvent('flip-open-extension', { detail: { extensionId: 'ai-chat' } }));
        } catch {}

        // Inject the message into the browser's AI chat extension after a short
        // delay to ensure the extension iframe has mounted and registered its listener
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('flip-ai-prompt', {
            detail: { prompt: msg.content },
          }));
        }, 1200);
      });
    });
  } catch (e) {
    console.error('[Companion] AI relay error:', e.message);
  }
}

// Push browser saved passwords to Firestore so companion vault can show them.
// Encrypted with UID-derived key (same AES-256-GCM as wallet sync).

async function encryptForSync(plaintext, uid) {
  const password = 'flip-sync-' + uid + '-' + getDeviceId();
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const buf = new Uint8Array(salt.length + iv.length + ct.byteLength);
  buf.set(salt, 0);
  buf.set(iv, salt.length);
  buf.set(new Uint8Array(ct), salt.length + iv.length);
  return btoa(String.fromCharCode(...buf));
}

async function syncPasswordsToFirestore() {
  const uid = getPairedUserId();
  if (!uid || !window.flipAPI?.getPasswords) return;
  try {
    const passwords = await window.flipAPI.getPasswords();
    if (!passwords || !passwords.length) return;
    const firestore = getDb();
    const batch = writeBatch(firestore);
    for (const pw of passwords) {
      const id = 'browser_' + (pw.id || Date.now());
      const encrypted = await encryptForSync(pw.password || '', uid);
      batch.set(doc(firestore, 'users', uid, 'vault', id), {
        site: pw.site || '',
        username: pw.username || '',
        encrypted,
        source: 'browser',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
    console.log('[Companion] Passwords synced to Firestore:', passwords.length);
  } catch (e) {
    console.error('[Companion] Password sync error:', e.message);
  }
}

// Companion can call the browser user. Listen for incoming call signals.

function startCallListener() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    unsubIncomingCall = onSnapshot(doc(firestore, 'users', uid, 'incomingCall', 'current'), async (snap) => {
      const data = snap.data();
      if (!data || !data.code || data.status !== 'ringing') return;
      // Don't answer calls older than 30 seconds
      const age = data.timestamp?.toMillis ? Date.now() - data.timestamp.toMillis() : 0;
      if (age > 30000 && data.timestamp) return;

      console.log('[Companion] Incoming call:', data.code, data.type);
      forwardNotification({ type: 'chat', title: 'Incoming Call', body: (data.type === 'video' ? 'Video' : 'Voice') + ' call from Companion' });

      // Dispatch event so browser UI can show incoming call overlay
      window.dispatchEvent(new CustomEvent('flip-incoming-call', {
        detail: { code: data.code, type: data.type || 'voice', from: data.from || 'Companion' },
      }));
    });
  } catch (e) {
    console.error('[Companion] Call listener error:', e.message);
  }
}

// Accept a call — join the WebRTC room from the browser side
export async function acceptCall(code, type = 'voice') {
  const uid = getPairedUserId();
  if (!uid || !code) return null;
  try {
    const firestore = getDb();
    // Mark call as accepted
    await setDoc(doc(firestore, 'users', uid, 'incomingCall', 'current'), { status: 'accepted' }, { merge: true });

    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    const callDoc = doc(firestore, 'calls', code);
    const offerCandidates = collection(firestore, 'calls', code, 'offerCandidates');
    const answerCandidates = collection(firestore, 'calls', code, 'answerCandidates');

    // Send our ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) setDoc(doc(answerCandidates), e.candidate.toJSON()).catch(() => {});
    };

    // Get the offer
    const callSnap = await getDoc(callDoc);
    const callData = callSnap.data();
    if (!callData?.offer) return null;

    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await setDoc(callDoc, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

    // Listen for offer ICE candidates
    onSnapshot(offerCandidates, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
        }
      });
    });

    return { pc, localStream: stream };
  } catch (e) {
    console.error('[Companion] Accept call error:', e.message);
    return null;
  }
}

export async function rejectCall() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    await setDoc(doc(firestore, 'users', uid, 'incomingCall', 'current'), { status: 'rejected' }, { merge: true });
  } catch {}
}

// Listen for TOTP entries from companion Firestore and expose to browser UI.

function startTOTPListener() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    unsubTOTP = onSnapshot(collection(firestore, 'users', uid, 'totp'), (snap) => {
      const entries = [];
      snap.forEach((d) => entries.push({ id: d.id, ...d.data() }));
      // Expose to browser UI via custom event
      window.dispatchEvent(new CustomEvent('flip-totp-sync', { detail: { entries } }));
      console.log('[Companion] TOTP entries synced:', entries.length);
    });
  } catch (e) {
    console.error('[Companion] TOTP listener error:', e.message);
  }
}

// Listen for companion-added vault entries and merge into local passwords.

function startVaultPullListener() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    let firstSnapshot = true;
    unsubVaultPull = onSnapshot(collection(firestore, 'users', uid, 'vault'), async (snap) => {
      if (firstSnapshot) { firstSnapshot = false; return; }
      // Get companion entries (not from browser)
      const companionEntries = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.source !== 'browser') companionEntries.push({ id: d.id, ...data });
      });
      if (!companionEntries.length || !window.flipAPI?.getPasswords) return;
      try {
        const localPasswords = await window.flipAPI.getPasswords() || [];
        let changed = false;
        for (const entry of companionEntries) {
          const existingIdx = localPasswords.findIndex((p) => p.id === 'companion_' + entry.id);
          const pw = {
            id: 'companion_' + entry.id,
            site: entry.site || 'Unknown',
            username: entry.username || '',
            password: entry.encrypted ? '(encrypted on companion)' : '',
            source: 'companion',
            createdAt: Date.now(),
          };
          if (existingIdx >= 0) {
            localPasswords[existingIdx] = pw;
          } else {
            localPasswords.push(pw);
          }
          changed = true;
        }
        if (changed) await window.flipAPI.savePasswords(localPasswords);
      } catch (e) {
        console.error('[Companion] Vault pull error:', e.message);
      }
    });
  } catch (e) {
    console.error('[Companion] Vault pull listener error:', e.message);
  }
}

// Listen for notifications written by companion and show them in browser.

function startNotificationListener() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    const q = query(
      collection(firestore, 'users', uid, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    let firstSnapshot = true;
    unsubNotifications = onSnapshot(q, (snap) => {
      if (firstSnapshot) { firstSnapshot = false; return; }
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const notif = change.doc.data();
        // Only show notifications NOT from this browser
        if (notif.deviceId === getDeviceId()) return;
        console.log('[Companion] Notification from companion:', notif.title);
        // Show native OS notification
        if (window.flipAPI?.showNotification) {
          window.flipAPI.showNotification(notif.title || 'Companion', notif.body || '');
        } else if (Notification?.permission === 'granted') {
          new Notification(notif.title || 'Companion', { body: notif.body || '' });
        }
      });
    });
  } catch (e) {
    console.error('[Companion] Notification listener error:', e.message);
  }
}

// When companion uploads a file, browser sees it and notifies user.

export function startFileBridgeListener() {
  const uid = getPairedUserId();
  if (!uid) return;
  try {
    const firestore = getDb();
    const q = query(
      collection(firestore, 'users', uid, 'sharedFiles'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    let firstSnapshot = true;
    unsubFiles = onSnapshot(q, (snap) => {
      if (firstSnapshot) { firstSnapshot = false; return; } // skip initial load
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const file = change.doc.data();
        if (file.source === 'browser') return; // ignore our own uploads
        console.log('[Companion] New shared file from companion:', file.name);
        // Notify user and auto-open in new tab
        forwardNotification({ type: 'download', title: 'File from Companion', body: file.name || 'New file' });
        if (file.url) {
          // Open the file URL in browser so user can download/view it
          const { addTab } = useBrowserStore.getState();
          if (addTab) addTab(file.url);
        }
      });
    });
  } catch (e) {
    console.error('[Companion] File bridge listener error:', e.message);
  }
}


export function startSync() {
  if (!isPaired()) return;
  console.log('[Companion] Starting sync…');

  syncTabs();
  tabSyncInterval = setInterval(syncTabs, TAB_SYNC_INTERVAL_MS);
  startCommandListener();
  startAIRelay();
  startFileBridgeListener();
  startCallListener();
  startTOTPListener();
  startVaultPullListener();
  startNotificationListener();

  // Push browser passwords to Firestore on startup + every 60s
  syncPasswordsToFirestore();
  passwordSyncInterval = setInterval(syncPasswordsToFirestore, 60_000);

  // Let companion know the browser is online and syncing
  forwardNotification({ type: 'general', title: 'Browser Connected', body: 'Flip Browser is online and syncing.' });
}

export function stopSync() {
  if (unsubCommands) { unsubCommands(); unsubCommands = null; }
  if (unsubAI) { unsubAI(); unsubAI = null; }
  if (unsubFiles) { unsubFiles(); unsubFiles = null; }
  if (unsubIncomingCall) { unsubIncomingCall(); unsubIncomingCall = null; }
  if (unsubTOTP) { unsubTOTP(); unsubTOTP = null; }
  if (unsubVaultPull) { unsubVaultPull(); unsubVaultPull = null; }
  if (unsubNotifications) { unsubNotifications(); unsubNotifications = null; }
  if (unsubRelayToken) { unsubRelayToken(); unsubRelayToken = null; }
  if (unsubRelayDone) { unsubRelayDone(); unsubRelayDone = null; }
  aiRelayPending = null;
  aiRelayBuffer = '';
  if (tabSyncInterval) { clearInterval(tabSyncInterval); tabSyncInterval = null; }
  if (passwordSyncInterval) { clearInterval(passwordSyncInterval); passwordSyncInterval = null; }
}

export function initCompanionSync() {
  if (isPaired()) {
    setTimeout(startSync, 3000);
  }
}
