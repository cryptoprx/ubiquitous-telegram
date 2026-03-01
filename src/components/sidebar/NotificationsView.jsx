import React, { useEffect } from 'react';
import { Globe, X, BellRing, Trash2, BellOff } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

function NotificationsView() {
  const { notificationPerms, setNotificationPerms } = useBrowserStore();

  useEffect(() => {
    window.flipAPI?.getNotificationPermissions?.().then(p => { if (p) setNotificationPerms(p); });
  }, []);

  function updatePerm(domain, value) {
    const updated = { ...notificationPerms, [domain]: value };
    setNotificationPerms(updated);
    window.flipAPI?.saveNotificationPermissions?.(updated);
  }

  function removePerm(domain) {
    const updated = { ...notificationPerms };
    delete updated[domain];
    setNotificationPerms(updated);
    window.flipAPI?.saveNotificationPermissions?.(updated);
  }

  function clearAll() {
    setNotificationPerms({});
    window.flipAPI?.saveNotificationPermissions?.({});
  }

  const domains = Object.entries(notificationPerms);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <BellRing size={14} className="text-flip-400" />
          Notifications
        </h2>
        <p className="text-[9px] text-white/25 mt-0.5">Manage which sites can send notifications</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {domains.length === 0 ? (
          <div className="text-center py-8">
            <BellOff size={24} className="text-white/10 mx-auto mb-2" />
            <p className="text-[10px] text-white/25">No notification permissions yet</p>
            <p className="text-[9px] text-white/15 mt-1">Sites will ask for permission when they want to send notifications</p>
          </div>
        ) : (
          <>
            {domains.map(([domain, status]) => (
              <div key={domain} className="flex items-center gap-2 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <Globe size={11} className="text-white/20 flex-shrink-0" />
                <span className="flex-1 text-[10px] text-white/60 truncate font-mono">{domain}</span>
                <select value={status}
                  onChange={e => updatePerm(domain, e.target.value)}
                  className={clsx('text-[9px] px-2 py-1 rounded-lg border outline-none',
                    status === 'allow' ? 'bg-accent-400/10 border-accent-400/20 text-accent-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  )}>
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
                <button onClick={() => removePerm(domain)} className="text-white/15 hover:text-red-400 transition-colors"><X size={10} /></button>
              </div>
            ))}
            <button onClick={clearAll} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/15 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all">
              <Trash2 size={10} /> Clear All Permissions
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default NotificationsView;
