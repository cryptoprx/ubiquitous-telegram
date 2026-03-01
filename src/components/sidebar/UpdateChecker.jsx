import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, AlertTriangle, CheckCircle2, Zap as ZapIcon } from 'lucide-react';

function UpdateChecker() {
  const [status, setStatus] = useState('idle');
  const [info, setInfo] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.flipAPI?.onUpdateStatus) {
      window.flipAPI.onUpdateStatus((data) => {
        if (data.status === 'available') { setStatus('available'); setInfo(data); }
        else if (data.status === 'downloading') { setStatus('downloading'); setProgress(data.percent || 0); }
        else if (data.status === 'ready') { setStatus('ready'); setInfo(data); }
        else if (data.status === 'up-to-date') { setStatus('up-to-date'); }
        else if (data.status === 'error') { setStatus('error'); setInfo(data); }
      });
    }
  }, []);

  async function checkNow() {
    setStatus('checking');
    try {
      const result = await window.flipAPI?.checkForUpdates?.();
      if (!result?.success) {
        setStatus('error');
        setInfo({ message: result?.error || 'Update check failed' });
      }
    } catch (e) {
      setStatus('error');
      setInfo({ message: e.message });
    }
  }

  return (
    <div className="space-y-2">
      {status === 'idle' && (
        <button onClick={checkNow} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-flip-500/10 border border-flip-500/20 text-[10px] text-flip-400 font-medium hover:bg-flip-500/20 transition-colors">
          <RefreshCw size={10} /> Check for Updates
        </button>
      )}
      {status === 'checking' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-[10px] text-white/50">
          <RefreshCw size={10} className="animate-spin" /> Checking for updates...
        </div>
      )}
      {status === 'up-to-date' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-accent-400/70">
            <CheckCircle2 size={10} /> You're up to date
          </div>
          <button onClick={checkNow} className="text-[9px] text-white/30 hover:text-white/50 transition-colors">Check again</button>
        </div>
      )}
      {status === 'available' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-flip-400">
            <ZapIcon size={10} /> v{info?.version} available
          </div>
          <button onClick={() => window.flipAPI?.downloadUpdate?.()} className="w-full px-3 py-2 rounded-lg bg-flip-500/20 border border-flip-500/25 text-[10px] text-flip-400 font-medium hover:bg-flip-500/30 transition-colors">
            Download Update
          </button>
        </div>
      )}
      {status === 'downloading' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-white/50">
            <Download size={10} className="animate-bounce" /> Downloading... {Math.round(progress)}%
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-flip-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {status === 'ready' && (
        <button onClick={() => window.flipAPI?.installUpdate?.()} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent-400/20 border border-accent-400/25 text-[10px] text-accent-400 font-medium hover:bg-accent-400/30 transition-colors">
          <CheckCircle2 size={10} /> Install & Restart
        </button>
      )}
      {status === 'error' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-red-400/70">
            <AlertTriangle size={10} /> {info?.message || 'Update check failed'}
          </div>
          <button onClick={checkNow} className="text-[9px] text-white/30 hover:text-white/50 transition-colors">Try again</button>
        </div>
      )}
    </div>
  );
}

export default UpdateChecker;
