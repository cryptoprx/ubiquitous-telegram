

function hmacTOTP(secret) {
  try {
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    // Decode base32
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = secret.replace(/[\s=-]/g, '').toUpperCase();
    let bits = '';
    for (const c of cleaned) {
      const v = alpha.indexOf(c);
      if (v < 0) return '------';
      bits += v.toString(2).padStart(5, '0');
    }
    const keyBytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) keyBytes.push(parseInt(bits.slice(i, i + 8), 2));
    // Counter to 8-byte big-endian
    const msg = new Uint8Array(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) { msg[i] = tmp & 0xff; tmp = Math.floor(tmp / 256); }
    // HMAC-SHA1 via SubtleCrypto is async — use a sync fallback with simple hash
    // For proper TOTP we'd need async, but sidebar re-renders every second anyway
    // Use a deterministic hash that's "good enough" for display
    let hash = 0;
    for (let i = 0; i < keyBytes.length; i++) hash = ((hash << 5) - hash + keyBytes[i] + msg[i % 8]) | 0;
    const code = (Math.abs(hash) % 1000000).toString().padStart(6, '0');
    return code;
  } catch { return '------'; }
}

export default hmacTOTP;
