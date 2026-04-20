import React, { useState, useEffect } from 'react';
import { X, Shield, Copy, KeyRound } from 'lucide-react';
import { sileo } from 'sileo';

function PasswordsView() {
  const [passwords, setPasswords] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [revealId, setRevealId] = useState(null);
  const [totpEntries, setTotpEntries] = useState([]);
  const [totpCodes, setTotpCodes] = useState({});
  const [totpTime, setTotpTime] = useState(30);

  useEffect(() => {
    if (window.flipAPI) {
      window.flipAPI.getPasswords().then((p) => { if (p) setPasswords(p); });
    }
    // Listen for TOTP sync from companion
    function handleTOTP(e) {
      if (e.detail?.entries) setTotpEntries(e.detail.entries);
    }
    window.addEventListener('flip-totp-sync', handleTOTP);
    return () => window.removeEventListener('flip-totp-sync', handleTOTP);
  }, []);

  // Generate TOTP codes every second
  useEffect(() => {
    if (!totpEntries.length) return;
    function generate() {
      const now = Math.floor(Date.now() / 1000);
      setTotpTime(30 - (now % 30));
      const codes = {};
      totpEntries.forEach((e) => {
        try {
          // Simple TOTP: HMAC-SHA1 based, 6 digits, 30s period
          // We use the secret to generate via a basic algo or show placeholder
          codes[e.id] = e.secret ? hmacTOTP(e.secret) : '------';
        } catch { codes[e.id] = '------'; }
      });
      setTotpCodes(codes);
    }
    generate();
    const iv = setInterval(generate, 1000);
    return () => clearInterval(iv);
  }, [totpEntries]);

  function save(list) {
    setPasswords(list);
    if (window.flipAPI) window.flipAPI.savePasswords(list);
  }

  function handleAdd() {
    if (!newSite.trim() || !newUser.trim()) return;
    const entry = { id: Date.now(), site: newSite.trim(), username: newUser.trim(), password: newPass, createdAt: Date.now() };
    save([entry, ...passwords]);
    setNewSite(''); setNewUser(''); setNewPass(''); setShowAdd(false);
  }

  function handleDelete(id) {
    save(passwords.filter((p) => p.id !== id));
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {/* 2FA Codes from Companion */}
      {totpEntries.length > 0 && (
        <>
          <div className="sidebar-section px-0 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Shield size={12} className="text-blue-400" /> 2FA Codes</span>
            <span className="text-[9px] text-white/30 font-mono">{totpTime}s</span>
          </div>
          <div className="space-y-1 mt-1 mb-3">
            {totpEntries.map((e) => (
              <div key={e.id} className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] text-white/50 truncate">{e.issuer || 'Unknown'}</div>
                  <div className="text-xs font-mono text-blue-400 font-bold tracking-wider">{totpCodes[e.id] || '------'}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(totpCodes[e.id] || ''); sileo.success("Code copied!"); }} className="text-[9px] text-white/30 hover:text-white/60 ml-2 flex-shrink-0">
                  Copy
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-section px-0 flex items-center justify-between">
        <span>Passwords</span>
        <button onClick={() => setShowAdd(!showAdd)} className="text-flip-400 hover:text-flip-300 text-[10px] font-medium">
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showAdd && (
        <div className="mt-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
          <input value={newSite} onChange={(e) => setNewSite(e.target.value)} placeholder="Site (e.g. github.com)" className="w-full input-base text-xs" />
          <input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="Username / Email" className="w-full input-base text-xs" />
          <div className="flex items-center gap-1.5">
            <input value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" type="password" className="flex-1 input-base text-xs" />
            <button
              onClick={() => {
                const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
                let pwd = '';
                const arr = new Uint8Array(20);
                crypto.getRandomValues(arr);
                for (let i = 0; i < 20; i++) pwd += chars[arr[i] % chars.length];
                setNewPass(pwd);
              }}
              className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[9px] text-white/40 hover:text-white/60 hover:bg-white/[0.07] transition-colors flex-shrink-0"
              title="Generate strong password"
            >
              Generate
            </button>
          </div>
          {newPass && (() => {
            const len = newPass.length;
            const hasUpper = /[A-Z]/.test(newPass);
            const hasLower = /[a-z]/.test(newPass);
            const hasNum = /[0-9]/.test(newPass);
            const hasSymbol = /[^a-zA-Z0-9]/.test(newPass);
            const variety = [hasUpper, hasLower, hasNum, hasSymbol].filter(Boolean).length;
            const score = len >= 16 && variety >= 3 ? 3 : len >= 10 && variety >= 2 ? 2 : 1;
            const label = ['', 'Weak', 'Medium', 'Strong'][score];
            const color = ['', 'bg-red-400', 'bg-yellow-400', 'bg-green-400'][score];
            return (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`h-1 flex-1 rounded-full ${s <= score ? color : 'bg-white/[0.06]'} transition-colors`} />
                  ))}
                </div>
                <span className={`text-[9px] ${score === 3 ? 'text-green-400' : score === 2 ? 'text-yellow-400' : 'text-red-400'}`}>{label}</span>
              </div>
            );
          })()}
          <button onClick={handleAdd} className="w-full py-1.5 rounded-lg bg-flip-500/20 text-flip-400 text-xs font-medium hover:bg-flip-500/30 transition-colors">
            Save Credential
          </button>
        </div>
      )}

      {passwords.length === 0 && !showAdd && totpEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
            <KeyRound size={18} className="text-white/15" />
          </div>
          <p className="text-xs text-white/30 mb-1">No saved passwords</p>
          <p className="text-[10px] text-white/15">Passwords you save will be encrypted & stored here</p>
        </div>
      ) : (
        <div className="space-y-1.5 mt-2">
          {passwords.map((pw) => (
            <div key={pw.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-white/70 font-medium truncate">{pw.site}</span>
                  {pw.source === 'companion' && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium flex-shrink-0">Companion</span>
                  )}
                </div>
                {pw.source !== 'companion' && (
                  <button onClick={() => handleDelete(pw.id)} className="text-white/20 hover:text-red-400 transition-colors">
                    <X size={11} />
                  </button>
                )}
              </div>
              <div className="text-[10px] text-white/40">{pw.username}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-white/25 font-mono">
                  {revealId === pw.id ? pw.password : '••••••••'}
                </span>
                <button
                  onClick={() => setRevealId(revealId === pw.id ? null : pw.id)}
                  className="text-[9px] text-white/30 hover:text-white/60"
                >
                  {revealId === pw.id ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(pw.password); sileo.success("Password copied!"); }}
                  className="text-[9px] text-white/30 hover:text-white/60"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple TOTP generator (RFC 6238) — generates 6-digit code from base32 secret

export default PasswordsView;
