import React, { useState } from 'react';
import { KeyRound, Loader2, AlertCircle, Globe } from 'lucide-react';

export default function LicenseGate({ onActivated }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-format input as FLIP-XXXX-XXXX-XXXX
  function handleKeyChange(e) {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // Auto-insert dashes after FLIP and every 4 chars
    const raw = val.replace(/-/g, '');
    if (raw.length > 4) {
      val = raw.slice(0, 4) + '-' + raw.slice(4, 8) + (raw.length > 8 ? '-' + raw.slice(8, 12) + (raw.length > 12 ? '-' + raw.slice(12, 16) : '') : '');
    }
    setKey(val.slice(0, 19)); // FLIP-XXXX-XXXX-XXXX = 19 chars
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!key || key.length < 16) {
      setError('Please enter a valid license key');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await window.flipAPI?.licenseActivate?.(key);
      if (result?.valid) {
        onActivated();
      } else {
        setError(result?.error || 'Invalid license key');
      }
    } catch (err) {
      setError(err.message || 'Connection failed');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-orange-500/30">
            <Globe size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white/90">Welcome to Flip Browser</h1>
          <p className="text-sm text-white/30 mt-1">Enter your license key to activate</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <div className="mb-4">
            <label className="block text-[10px] text-white/30 mb-1.5 uppercase tracking-wider font-medium">
              License Key
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/15" />
              <input
                type="text"
                value={key}
                onChange={handleKeyChange}
                placeholder="FLIP-XXXX-XXXX-XXXX"
                autoFocus
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3.5 text-sm text-white/80 font-mono tracking-widest placeholder:text-white/10 placeholder:tracking-widest outline-none focus:border-orange-500/40 transition-colors text-center"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || key.length < 16}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Validating...
              </>
            ) : (
              'Activate'
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-white/10 mt-6">
          Don't have a key? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
