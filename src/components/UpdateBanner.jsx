import React, { useState, useEffect } from 'react';
import ReleaseNotes from './ReleaseNotes';

/** Auto-update notification banner */
export default function UpdateBanner() {
  const [update, setUpdate] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.flipAPI?.onUpdateStatus) {
      window.flipAPI.onUpdateStatus((data) => {
        setUpdate(data);
        if (data.status === 'available' || data.status === 'ready') {
          setDismissed(false);
        }
      });
    }
  }, []);

  if (dismissed || !update) return null;
  if (update.status !== 'available' && update.status !== 'downloading' && update.status !== 'ready') return null;

  const XIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-[340px] animate-fade-in">
      <div className="relative vibrancy border border-white/[0.08] rounded-[18px] shadow-mac-xl overflow-hidden">
        {/* Tron accent line at top */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-flip-500 to-transparent" />

        <div className="p-4">
          {update.status === 'available' && (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-flip-500/20 to-accent-400/10 border border-flip-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-flip-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white/90">Update Available</p>
                  <p className="text-[9px] text-white/30 font-mono">v{update.version}</p>
                </div>
                <button onClick={() => setDismissed(true)} className="w-6 h-6 rounded-[8px] flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-colors shrink-0">
                  <XIcon />
                </button>
              </div>
              <ReleaseNotes notes={update.releaseNotes} />
              <div className="flex gap-2">
                <button
                  onClick={() => setDismissed(true)}
                  className="flex-1 px-3 py-2 rounded-[10px] border border-white/[0.06] text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                >
                  Later
                </button>
                <button
                  onClick={() => window.flipAPI?.downloadUpdate?.()}
                  className="flex-1 px-3 py-2 rounded-[10px] bg-flip-500/15 border border-flip-500/20 text-[10px] text-flip-400 font-medium hover:bg-flip-500/25 transition-colors"
                >
                  Download
                </button>
              </div>
            </>
          )}

          {update.status === 'downloading' && (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-flip-500/20 to-accent-400/10 border border-flip-500/20 flex items-center justify-center shrink-0">
                  <div className="w-3.5 h-3.5 border-2 border-flip-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white/90">Downloading...</p>
                  <p className="text-[9px] text-white/30 font-mono">{Math.round(update.percent || 0)}% complete</p>
                </div>
              </div>
              <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round(update.percent || 0)}%`,
                    background: 'linear-gradient(90deg, #ff6234, #f97316, #fbbf24)',
                    boxShadow: '0 0 8px rgba(249,115,22,0.4)',
                  }}
                />
              </div>
            </>
          )}

          {update.status === 'ready' && (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-accent-400/20 to-flip-500/10 border border-accent-400/20 flex items-center justify-center shrink-0">
                  <CheckIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white/90">Ready to Install</p>
                  <p className="text-[9px] text-white/30 font-mono">v{update.version}</p>
                </div>
                <button onClick={() => setDismissed(true)} className="w-6 h-6 rounded-[8px] flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-colors shrink-0">
                  <XIcon />
                </button>
              </div>
              <ReleaseNotes notes={update.releaseNotes} />
              <div className="flex gap-2">
                <button
                  onClick={() => setDismissed(true)}
                  className="flex-1 px-3 py-2 rounded-[10px] border border-white/[0.06] text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                >
                  Later
                </button>
                <button
                  onClick={() => window.flipAPI?.installUpdate?.()}
                  className="flex-1 px-3 py-2 rounded-[10px] bg-accent-400/15 border border-accent-400/20 text-[10px] text-accent-400 font-medium hover:bg-accent-400/25 transition-colors"
                >
                  Restart & Update
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
