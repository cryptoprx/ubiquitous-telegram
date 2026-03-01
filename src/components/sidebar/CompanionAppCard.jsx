import React, { useState } from 'react';
import { Smartphone, QrCode, Unlink } from 'lucide-react';
import { isPaired, startSync, unpair, createPairingSession, listenForPairingClaim, cancelPairing } from '../../lib/companionSync';
import QRCode from 'qrcode';

function CompanionAppCard() {
  const [paired, setPaired] = useState(isPaired());
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [status, setStatus] = useState('');
  const [countdown, setCountdown] = useState(0);

  async function startPairing() {
    setStatus('Generating secure pairing code…');
    try {
      const session = await createPairingSession();
      // Generate QR code as data URL
      const dataUrl = await QRCode.toDataURL(session.qrPayload, {
        width: 200, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setPairingCode(session.code);
      setShowQR(true);
      setStatus('Scan this QR code with the Flip companion app');
      setCountdown(300); // 5 min

      // Countdown timer
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); handleCancelPairing(); return 0; }
          return c - 1;
        });
      }, 1000);

      // Listen for companion to claim the session
      listenForPairingClaim(session.code, session.secret, (pairingData) => {
        clearInterval(timer);
        setPaired(true);
        setShowQR(false);
        setQrDataUrl('');
        setCountdown(0);
        startSync();
        setStatus('Paired & syncing!');
        setTimeout(() => setStatus(''), 4000);
      });
    } catch (e) {
      setStatus('Failed to create pairing session');
      setTimeout(() => setStatus(''), 3000);
    }
  }

  function handleCancelPairing() {
    cancelPairing();
    setShowQR(false);
    setQrDataUrl('');
    setPairingCode('');
    setCodeCopied(false);
    setCountdown(0);
    setStatus('');
  }

  function handleUnpair() {
    unpair();
    setPaired(false);
    setStatus('Unpaired');
    setTimeout(() => setStatus(''), 2000);
  }

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 animate-fade-in-up" style={{ animationDelay: '175ms' }}>
      <div className="flex items-center gap-2 mb-2">
        <Smartphone size={12} className="text-flip-400/70" />
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Companion App</span>
      </div>

      {paired ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/60">Connected & syncing</span>
          </div>
          <button
            onClick={handleUnpair}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-red-500/20 text-[9px] text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <Unlink size={10} /> Unpair Device
          </button>
        </div>
      ) : showQR ? (
        <div className="space-y-2 flex flex-col items-center">
          {qrDataUrl && (
            <div className="bg-white/[0.06] rounded-xl p-2">
              <img src={qrDataUrl} alt="Pairing QR" className="w-full max-w-[180px] rounded-lg" />
            </div>
          )}
          <p className="text-[9px] text-white/25 text-center">Open Flip companion app → More → Scan QR</p>
          {pairingCode && (
            <div className="w-full">
              <p className="text-[8px] text-white/20 text-center mb-1">Or enter this PIN manually:</p>
              <button
                onClick={() => { navigator.clipboard.writeText(pairingCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                className="w-full px-2 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] font-mono text-white/70 hover:text-white tracking-[0.25em] text-center transition-colors font-bold uppercase"
                title="Click to copy"
              >
                {codeCopied ? '✓ Copied!' : pairingCode}
              </button>
            </div>
          )}
          {countdown > 0 && (
            <p className="text-[9px] text-white/15 font-mono">Expires in {mins}:{secs.toString().padStart(2, '0')}</p>
          )}
          <button
            onClick={handleCancelPairing}
            className="w-full px-2 py-1.5 rounded-lg border border-white/[0.08] text-[9px] text-white/30 hover:text-white/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-white/30">Sync tabs, send files, and control this browser from your phone.</p>
          <button
            onClick={startPairing}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-flip-500/10 border border-flip-500/20 text-[9px] text-flip-400 hover:bg-flip-500/15 transition-all"
          >
            <QrCode size={10} /> Show Pairing QR Code
          </button>
        </div>
      )}
      {status && <p className="text-[9px] text-green-400/70 mt-1.5 text-center">{status}</p>}
    </div>
  );
}

export default CompanionAppCard;
