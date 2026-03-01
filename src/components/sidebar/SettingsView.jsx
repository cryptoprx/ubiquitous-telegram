import { Settings, Search, Shield, Activity, PictureInPicture2, FileUp, FileDown, Palette } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';
import { t } from '../../i18n';
import UpdateChecker from './UpdateChecker';
import CompanionAppCard from './CompanionAppCard';

function SettingsView() {
  const { settings, updateSettings } = useBrowserStore();
  const lang = settings.language || 'en';

  const securityToggles = [
    { key: 'adBlockEnabled', labelKey: 'adBlocker', ipc: 'setAdBlock' },
    { key: 'trackingProtection', labelKey: 'trackingProtection', ipc: 'setTrackingProtection' },
    { key: 'httpsOnly', labelKey: 'httpsOnlyMode', ipc: 'setHttpsOnly' },
    { key: 'fingerprintProtection', labelKey: 'fingerprintProtection', ipc: 'setFingerprintProtection' },
  ];

  const toggles = [
    { key: 'tabSuspensionEnabled', labelKey: 'autoSuspend' },
    { key: 'showBookmarksBar', labelKey: 'showBookmarksBar' },
  ];

  function Toggle({ active, onToggle, color = 'bg-flip-500' }) {
    return (
      <div
        className={clsx('w-8 h-4 rounded-full transition-colors duration-200 relative cursor-pointer', active ? color : 'bg-white/10')}
        onClick={onToggle}
      >
        <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200', active ? 'translate-x-4' : 'translate-x-0.5')} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {/* Security & Privacy card */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 space-y-2.5 animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={12} className="text-accent-400/70" />
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('securityPrivacy', lang)}</span>
        </div>
        {securityToggles.map((toggle) => (
          <label key={toggle.key} className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-white/70">{t(toggle.labelKey, lang)}</span>
            <Toggle
              active={settings[toggle.key]}
              color="bg-accent-400"
              onToggle={() => {
                const newVal = !settings[toggle.key];
                updateSettings({ [toggle.key]: newVal });
                if (window.flipAPI && window.flipAPI[toggle.ipc]) window.flipAPI[toggle.ipc](newVal);
              }}
            />
          </label>
        ))}
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">{t('dnsOverHttps', lang)}</span>
          <span className="text-[10px] text-accent-400/70 font-medium">{t('alwaysOnCloudflare', lang)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">{t('permissionRequests', lang)}</span>
          <span className="text-[10px] text-accent-400/70 font-medium">{t('denyByDefault', lang)}</span>
        </div>
        <button
          className="w-full text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors text-left mt-1"
          onClick={async () => {
            if (window.flipAPI?.clearBrowsingData) {
              await window.flipAPI.clearBrowsingData({ cache: true, storage: true });
              alert(t('cacheCleared', lang) || 'Cache cleared! Reload pages to see fresh content.');
            }
          }}
        >
          {t('clearCache', lang) || 'Clear Cache & Site Data'}
        </button>
      </div>

      {/* General card */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 space-y-2.5 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center gap-2 mb-1">
          <Settings size={12} className="text-flip-400/70" />
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('general', lang)}</span>
        </div>
        {toggles.map((toggle) => (
          <label key={toggle.key} className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-white/70">{t(toggle.labelKey, lang)}</span>
            <Toggle active={settings[toggle.key]} onToggle={() => updateSettings({ [toggle.key]: !settings[toggle.key] })} />
          </label>
        ))}
        <div>
          <label className="text-[10px] text-white/40 block mb-1">{t('language', lang)}</label>
          <select className="w-full input-base text-xs" value={settings.language || 'en'} onChange={(e) => updateSettings({ language: e.target.value })}>
            <option value="en">English</option>
            <option value="es">Español (US)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1">{t('searchEngine', lang)}</label>
          <select className="w-full input-base text-xs" value={settings.searchEngine} onChange={(e) => updateSettings({ searchEngine: e.target.value })}>
            <option value="https://duckduckgo.com/?q=">DuckDuckGo</option>
            <option value="https://www.bing.com/search?q=">Bing</option>
            <option value="https://search.brave.com/search?q=">Brave Search</option>
          </select>
        </div>
      </div>

      {/* Theme card */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 animate-fade-in-up" style={{ animationDelay: '75ms' }}>
        <div className="flex items-center gap-2 mb-2">
          <Palette size={12} className="text-flip-400/70" />
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('theme', lang) || 'Theme'}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: null, label: 'Warm Coral', colors: ['#ff6234', '#2dd4a8', '#1c1917'] },
            { id: 'ocean', label: 'Ocean Blue', colors: ['#3b82f6', '#22d3ee', '#0f141e'] },
            { id: 'purple', label: 'Midnight', colors: ['#a855f7', '#f472b6', '#140e1e'] },
            { id: 'forest', label: 'Forest', colors: ['#22c55e', '#a3e635', '#101810'] },
            { id: 'rose', label: 'Rose Gold', colors: ['#f43f5e', '#fbbf24', '#1c1418'] },
            { id: 'mono', label: 'Mono', colors: ['#a0a0a0', '#c8c8c8', '#161616'] },
          ].map((theme) => {
            const isActive = (settings.theme || null) === theme.id;
            return (
              <button
                key={theme.id || 'default'}
                onClick={() => {
                  updateSettings({ theme: theme.id });
                  if (theme.id) {
                    document.documentElement.setAttribute('data-theme', theme.id);
                  } else {
                    document.documentElement.removeAttribute('data-theme');
                  }
                }}
                className={clsx(
                  'flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all duration-150',
                  isActive ? 'border-flip-500 bg-white/[0.04]' : 'border-white/[0.06] hover:border-white/[0.12] opacity-70 hover:opacity-100'
                )}
              >
                <div className="flex gap-0.5">
                  {theme.colors.map((c, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-[8px] text-white/50 font-medium">{theme.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wallpaper card */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-2 mb-2">
          <PictureInPicture2 size={12} className="text-flip-400/70" />
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('wallpaper', lang)}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => updateSettings({ wallpaper: null })}
            className={clsx(
              'h-12 rounded-lg border-2 transition-all text-[9px] font-medium',
              !settings.wallpaper ? 'border-flip-500 bg-surface-0' : 'border-white/10 bg-surface-0 opacity-60 hover:opacity-100'
            )}
          >
            {t('noWallpaper', lang)}
          </button>
          {[
            { label: 'Puerto Rico', url: 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=1920&q=80&fit=crop' },
            { label: 'Boston', url: 'https://images.unsplash.com/photo-1501979376754-2ff867a4f659?w=1920&q=80&fit=crop' },
            { label: 'Pennsylvania', url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1920&q=80&fit=crop' },
            { label: 'Florida', url: 'https://images.unsplash.com/photo-1605723517503-3cadb5818a0c?w=1920&q=80&fit=crop' },
            { label: 'NYC', url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=80&fit=crop' },
            { label: 'Tech', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920&q=80&fit=crop' },
            { label: 'Space', url: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=1920&q=80&fit=crop' },
            { label: 'Nature', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80&fit=crop' },
          ].map((wp) => (
            <button
              key={wp.label}
              onClick={() => updateSettings({ wallpaper: wp.url })}
              className={clsx(
                'h-12 rounded-lg border-2 bg-cover bg-center transition-all text-[9px] font-medium text-white drop-shadow-sm',
                settings.wallpaper === wp.url ? 'border-flip-500' : 'border-white/10 opacity-60 hover:opacity-100'
              )}
              style={{ backgroundImage: `url(${wp.url})` }}
            >
              {wp.label}
            </button>
          ))}
        </div>
        <input
          className="w-full input-base text-xs mt-2"
          placeholder={t('customUrl', lang)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              updateSettings({ wallpaper: e.target.value.trim() });
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* About & Updates card */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 animate-fade-in-up" style={{ animationDelay: '125ms' }}>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={12} className="text-flip-400/70" />
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">About & Updates</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/70">Version</span>
          <span className="text-[10px] text-white/30 font-mono">v{__APP_VERSION__}</span>
        </div>
        <UpdateChecker />
      </div>

      {/* Import / Export card */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center gap-2 mb-2">
          <FileUp size={12} className="text-flip-400/70" />
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Import / Export</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <button onClick={async () => {
              const result = await window.flipAPI?.importBookmarksFile?.();
              if (result?.data) {
                const existing = useBrowserStore.getState().bookmarks;
                const merged = [...existing, ...result.data.map((b, i) => ({ ...b, id: Date.now() + i }))];
                useBrowserStore.getState().setBookmarks(merged);
                window.flipAPI?.saveBookmarks(merged);
              }
            }} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-white/[0.08] text-[9px] text-white/40 hover:text-white/60 hover:bg-white/5 transition-all">
              <FileUp size={10} /> Import Bookmarks
            </button>
            <button onClick={async () => {
              const bookmarks = useBrowserStore.getState().bookmarks;
              await window.flipAPI?.exportBookmarksFile?.(bookmarks);
            }} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-white/[0.08] text-[9px] text-white/40 hover:text-white/60 hover:bg-white/5 transition-all">
              <FileDown size={10} /> Export Bookmarks
            </button>
          </div>
          <div className="flex gap-1.5">
            <button onClick={async () => {
              const result = await window.flipAPI?.importPasswordsFile?.();
              if (result?.data) {
                const existing = await window.flipAPI?.getPasswords?.() || [];
                const merged = [...existing, ...result.data];
                await window.flipAPI?.savePasswords(merged);
              }
            }} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-white/[0.08] text-[9px] text-white/40 hover:text-white/60 hover:bg-white/5 transition-all">
              <FileUp size={10} /> Import Passwords
            </button>
            <button onClick={async () => {
              const passwords = await window.flipAPI?.getPasswords?.() || [];
              await window.flipAPI?.exportPasswordsFile?.(passwords);
            }} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-white/[0.08] text-[9px] text-white/40 hover:text-white/60 hover:bg-white/5 transition-all">
              <FileDown size={10} /> Export Passwords
            </button>
          </div>
          <p className="text-[8px] text-white/15 mt-1">Import Chrome/Firefox bookmarks (HTML) or passwords (CSV)</p>
        </div>
      </div>

      {/* Companion App card */}
      <CompanionAppCard />
    </div>
  );
}

export default SettingsView;
