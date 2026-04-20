import React, { useState, useEffect } from 'react';
import { Puzzle, Grid3X3, Store } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';
import ExtensionManager from './ExtensionManager';
import ExtensionHost from './ExtensionHost';
import { EXT_ICONS } from '../../lib/extIcons';


export default function ExtensionPanel() {
  const { extensions, setExtensions } = useBrowserStore();
  const [activeExtId, setActiveExtId] = useState(null);

  // Lazy-load extensions on mount if store is empty
  useEffect(() => {
    async function loadExts() {
      if (window.flipAPI && extensions.length === 0) {
        const exts = await window.flipAPI.loadExtensions();
        if (exts) setExtensions(exts);
      }
    }
    loadExts();
    // NOTE: intentionally no cleanup — clearing extensions from the global store
    // on unmount would wipe them for every other component that shares the store.
  }, []);

  // Listen for toolbar action clicks from AddressBar
  useEffect(() => {
    function handleOpenExt(e) {
      const id = e.detail?.extensionId;
      if (id) setActiveExtId(id);
    }
    window.addEventListener('flip-open-extension', handleOpenExt);
    return () => window.removeEventListener('flip-open-extension', handleOpenExt);
  }, []);

  const enabledSidebarExts = extensions.filter(
    (e) => e.enabled && (e.manifest.type === 'sidebar' || !e.manifest.type)
  );

  const activeExt = enabledSidebarExts.find((e) => e.id === activeExtId);
  const isWebview = activeExt?.manifest.content_type === 'webview';
  const panelWidth = isWebview ? 390 : 360;

  return (
    <div
      className="flex flex-col h-full vibrancy border-l border-white/[0.06] animate-slide-right"
      style={{ width: panelWidth, minWidth: panelWidth, maxWidth: 420 }}
    >
      {/* Extension dock bar */}
      <div className="flex items-center gap-1.5 px-2.5 py-2.5 border-b border-white/[0.06]">
        {/* Manager button */}
        <button
          onClick={() => setActiveExtId(null)}
          className={clsx(
            'flex items-center justify-center w-9 h-9 rounded-[12px] transition-all duration-200',
            !activeExtId
              ? 'bg-flip-500/10 text-flip-400 ring-1 ring-flip-500/15'
              : 'text-white/30 hover:text-white/50 hover:bg-white/[0.05]'
          )}
          title="Extension Manager"
        >
          <Grid3X3 size={14} />
        </button>

        <div className="w-px h-5 bg-white/[0.06] mx-1" />

        {/* Extension icon buttons */}
        {enabledSidebarExts.map((ext) => {
          const extIcon = EXT_ICONS[ext.id];
          const isActive = activeExtId === ext.id;

          return (
            <button
              key={ext.id}
              onClick={() => setActiveExtId(ext.id)}
              className={clsx(
                'relative flex items-center justify-center w-9 h-9 rounded-[12px] transition-all duration-200 group',
                isActive
                  ? 'bg-flip-500/10 ring-1 ring-flip-500/15 scale-105'
                  : 'hover:bg-white/[0.05] hover:scale-105'
              )}
              title={ext.manifest.name || ext.id}
            >
              {extIcon
                ? React.createElement(extIcon.icon, { size: 14, className: isActive ? extIcon.color : 'text-white/40' })
                : <span className="text-sm text-white/40">{ext.manifest.name?.[0] || '?'}</span>}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-flip-500" />
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Active extension name */}
        {activeExt && (
          <span className="text-[10px] text-white/25 truncate max-w-24 mr-1">
            {activeExt.manifest.name}
          </span>
        )}

        {/* Marketplace link */}
        <button
          onClick={() => useBrowserStore.getState().addTab('flip://marketplace')}
          className="flex items-center justify-center w-9 h-9 rounded-[12px] text-white/20 hover:text-flip-400 hover:bg-flip-500/10 transition-all duration-200"
          title="Get Extensions"
        >
          <Store size={14} />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden bg-surface-0/30">
        {activeExt ? (
          <ExtensionHost
            extension={activeExt}
            width="100%"
            height="100%"
          />
        ) : (
          <ExtensionManager />
        )}
      </div>
    </div>
  );
}
