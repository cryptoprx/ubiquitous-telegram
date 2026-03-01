import React, { useState } from 'react';
import { Settings, Trash2, Globe2 } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

function SiteSettingsView() {
  const { siteSettings, setSiteSettings, updateSiteSetting, tabs, activeTabId } = useBrowserStore();
  const [newDomain, setNewDomain] = useState('');

  const activeTab = tabs.find(t => t.id === activeTabId);
  let currentDomain = '';
  try {
    if (activeTab?.url && !activeTab.url.startsWith('flip://')) {
      currentDomain = new URL(activeTab.url).hostname;
    }
  } catch {}

  function addDomain(domain) {
    if (!domain || siteSettings[domain]) return;
    updateSiteSetting(domain, { zoom: 100, jsEnabled: true, cookiesEnabled: true });
    const next = { ...useBrowserStore.getState().siteSettings };
    window.flipAPI?.saveSiteSettings(next);
    setNewDomain('');
  }

  function updateAndSave(domain, partial) {
    updateSiteSetting(domain, partial);
    setTimeout(() => {
      window.flipAPI?.saveSiteSettings(useBrowserStore.getState().siteSettings);
    }, 0);
  }

  function removeDomain(domain) {
    const next = { ...siteSettings };
    delete next[domain];
    setSiteSettings(next);
    window.flipAPI?.saveSiteSettings(next);
  }

  const domains = Object.keys(siteSettings);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <Globe2 size={14} className="text-flip-400" />
          Site Settings
        </h2>
        <p className="text-[9px] text-white/25 mt-1">Per-site zoom, JavaScript, and cookie preferences.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Quick add current site */}
        {currentDomain && !siteSettings[currentDomain] && (
          <button
            onClick={() => addDomain(currentDomain)}
            className="w-full px-3 py-2 rounded-lg border border-flip-500/20 bg-flip-500/5 text-[10px] text-flip-400 hover:bg-flip-500/10 transition-colors text-left"
          >
            + Add settings for <span className="font-mono font-medium">{currentDomain}</span>
          </button>
        )}

        {/* Add custom domain */}
        <div className="flex gap-2">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDomain(newDomain.trim())}
            placeholder="Add domain (e.g. example.com)..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/25 outline-none focus:border-flip-500/30"
          />
          <button
            onClick={() => addDomain(newDomain.trim())}
            disabled={!newDomain.trim()}
            className="px-3 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/25 text-[10px] text-flip-400 font-medium hover:bg-flip-500/30 transition-colors disabled:opacity-30"
          >
            Add
          </button>
        </div>

        {/* Domain list */}
        {domains.length === 0 && (
          <div className="text-[10px] text-white/20 text-center py-6">No site-specific settings yet.</div>
        )}
        {domains.map((domain) => {
          const s = siteSettings[domain] || {};
          return (
            <div key={domain} className="rounded-xl border border-white/5 bg-white/[0.01] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/70 font-mono font-medium">{domain}</span>
                <button onClick={() => removeDomain(domain)} className="p-1 rounded hover:bg-white/10 text-white/20 hover:text-red-400 transition-colors">
                  <Trash2 size={10} />
                </button>
              </div>
              {/* Zoom */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">Zoom</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateAndSave(domain, { zoom: Math.max(50, (s.zoom || 100) - 10) })} className="w-5 h-5 rounded bg-white/5 text-white/40 hover:bg-white/10 text-[10px] flex items-center justify-center">-</button>
                  <span className="text-[10px] text-white/60 font-mono w-8 text-center">{s.zoom || 100}%</span>
                  <button onClick={() => updateAndSave(domain, { zoom: Math.min(200, (s.zoom || 100) + 10) })} className="w-5 h-5 rounded bg-white/5 text-white/40 hover:bg-white/10 text-[10px] flex items-center justify-center">+</button>
                </div>
              </div>
              {/* JavaScript */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">JavaScript</span>
                <button
                  onClick={() => updateAndSave(domain, { jsEnabled: !(s.jsEnabled !== false) })}
                  className={clsx(
                    'w-8 h-4.5 rounded-full transition-colors relative',
                    s.jsEnabled !== false ? 'bg-flip-500/50' : 'bg-white/10'
                  )}
                >
                  <div className={clsx('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all', s.jsEnabled !== false ? 'left-4' : 'left-0.5')} />
                </button>
              </div>
              {/* Cookies */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">Cookies</span>
                <button
                  onClick={() => updateAndSave(domain, { cookiesEnabled: !(s.cookiesEnabled !== false) })}
                  className={clsx(
                    'w-8 h-4.5 rounded-full transition-colors relative',
                    s.cookiesEnabled !== false ? 'bg-flip-500/50' : 'bg-white/10'
                  )}
                >
                  <div className={clsx('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all', s.cookiesEnabled !== false ? 'left-4' : 'left-0.5')} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SiteSettingsView;
