import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import clsx from 'clsx';
import { forwardNotification } from '../../lib/companionSync';

function DownloadsView() {
  const [downloads, setDownloads] = useState([]);

  useEffect(() => {
    if (window.flipAPI) {
      window.flipAPI.getDownloads().then((dl) => { if (dl) setDownloads([...dl]); });
      window.flipAPI.onDownloadStarted((dl) => {
        setDownloads((p) => [dl, ...p]);
        forwardNotification({ type: 'download', title: 'Download Started', body: dl.filename || dl.url || '' });
      });
      window.flipAPI.onDownloadUpdated((dl) => setDownloads((p) => p.map((d) => d.id === dl.id ? dl : d)));
      window.flipAPI.onDownloadDone((dl) => {
        setDownloads((p) => p.map((d) => d.id === dl.id ? dl : d));
        // Forward to companion app
        forwardNotification({ type: 'download', title: 'Download Complete', body: dl.filename || dl.url || '' });
      });
    }
  }, []);

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="sidebar-section px-0">Downloads</div>
      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
            <Download size={18} className="text-white/15" />
          </div>
          <p className="text-xs text-white/30 mb-1">No downloads yet</p>
          <p className="text-[10px] text-white/15">Files you download will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 mt-2">
          {downloads.map((dl) => {
            const progress = dl.totalBytes ? Math.round((dl.receivedBytes / dl.totalBytes) * 100) : 0;
            const done = dl.state === 'completed';
            const failed = dl.state === 'cancelled' || dl.state === 'interrupted';
            return (
              <div key={dl.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Download size={12} className={clsx(done ? 'text-green-400' : failed ? 'text-red-400' : 'text-flip-400')} />
                  <span className="text-xs text-white/70 truncate flex-1">{dl.filename}</span>
                </div>
                {!done && !failed && (
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-flip-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-white/30">
                    {done ? 'Completed' : failed ? 'Failed' : `${formatBytes(dl.receivedBytes)} / ${formatBytes(dl.totalBytes)}`}
                    {dl.source && <span className="ml-1 text-flip-400/60">via {dl.source}</span>}
                  </span>
                  <span className="text-[10px] text-white/20">
                    {new Date(dl.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DownloadsView;
