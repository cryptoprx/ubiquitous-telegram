import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Grid3X3, Store, X, Puzzle,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';
import ExtensionManager from './ExtensionManager';
import ExtensionHost from './ExtensionHost';
import { EXT_ICONS } from '../../lib/extIcons';


const HIDE_DELAY = 800;   // ms before dock hides after pointer leaves
const PROXIMITY = 48;     // px from bottom edge to trigger reveal

export default function ExtensionDock() {
  const { extensions, setExtensions, addTab } = useBrowserStore();
  const [activeExtId, setActiveExtId] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);
  const panelRef = useRef(null);
  const dockAreaRef = useRef(null);
  const hideTimerRef = useRef(null);
  const initialTimerRef = useRef(null);

  // Load extensions on mount
  useEffect(() => {
    async function loadExts() {
      if (window.flipAPI && extensions.length === 0) {
        const exts = await window.flipAPI.loadExtensions();
        if (exts) setExtensions(exts);
      }
    }
    loadExts();
  }, []);

  // Listen for toolbar action clicks from AddressBar / WebContent
  useEffect(() => {
    function handleOpenExt(e) {
      const id = e.detail?.extensionId;
      if (id) {
        setActiveExtId(id);
        setShowManager(false);
      }
    }
    function handleOpenManager() {
      setShowManager(true);
      setActiveExtId(null);
    }
    window.addEventListener('flip-open-extension', handleOpenExt);
    window.addEventListener('flip-open-extension-manager', handleOpenManager);
    return () => {
      window.removeEventListener('flip-open-extension', handleOpenExt);
      window.removeEventListener('flip-open-extension-manager', handleOpenManager);
    };
  }, []);

  // Auto-hide: hide dock after initial delay, then proximity-based show/hide
  useEffect(() => {
    // Show dock initially for 3s so users see it, then auto-hide
    initialTimerRef.current = setTimeout(() => {
      // Only auto-hide if no panel is open
      if (!activeExtId && !showManager) setDockVisible(false);
    }, 3000);
    return () => clearTimeout(initialTimerRef.current);
  }, []);

  // Proximity detection: reveal dock when pointer near bottom edge
  useEffect(() => {
    function handleMouseMove(e) {
      const nearBottom = window.innerHeight - e.clientY <= PROXIMITY;
      const overDock = dockAreaRef.current?.contains(e.target);
      const overPanel = panelRef.current?.contains(e.target);

      if (nearBottom || overDock || overPanel) {
        clearTimeout(hideTimerRef.current);
        setDockVisible(true);
      } else if (!activeExtId && !showManager) {
        // Start hide timer only if no panel is open
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setDockVisible(false), HIDE_DELAY);
      }
    }
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimerRef.current);
    };
  }, [activeExtId, showManager]);

  // Keep dock visible while panel is open
  useEffect(() => {
    if (activeExtId || showManager) {
      clearTimeout(hideTimerRef.current);
      setDockVisible(true);
    }
  }, [activeExtId, showManager]);

  // Close panel on outside click
  useEffect(() => {
    if (!activeExtId && !showManager) return;
    function handleClick(e) {
      const dock = document.getElementById('extension-dock');
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        dock && !dock.contains(e.target)
      ) {
        setActiveExtId(null);
        setShowManager(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeExtId, showManager]);

  const enabledSidebarExts = extensions.filter(
    (e) => e.enabled && (e.manifest.type === 'sidebar' || !e.manifest.type)
  );

  const activeExt = enabledSidebarExts.find((e) => e.id === activeExtId);
  const isWebview = activeExt?.manifest.content_type === 'webview';
  const panelWidth = showManager ? 320 : (isWebview ? 390 : 360);
  const showPanel = !!(activeExtId && activeExt) || showManager;

  function toggleExtension(extId) {
    if (activeExtId === extId) {
      setActiveExtId(null);
    } else {
      setActiveExtId(extId);
      setShowManager(false);
    }
  }

  function toggleManager() {
    if (showManager) {
      setShowManager(false);
    } else {
      setShowManager(true);
      setActiveExtId(null);
    }
  }

  function closePanel() {
    setActiveExtId(null);
    setShowManager(false);
  }

  return (
    <>
      {/* ── Floating extension panel — portal to body, fixed position ── */}
      {showPanel && createPortal(
        <div
          ref={panelRef}
          className="fixed flex flex-col vibrancy border border-white/[0.08] rounded-[16px] shadow-mac-xl animate-slide-right"
          style={{ right: 8, top: 44, bottom: dockVisible ? 56 : 16, width: panelWidth, zIndex: 50, transition: 'bottom 300ms ease' }}
        >
          {/* Panel header */}
          <div className="relative px-4 py-3 border-b border-white/[0.06] overflow-hidden rounded-t-[16px]">
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-flip-500/40 via-accent-400/20 to-transparent" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {showManager ? (
                  <Grid3X3 size={14} className="text-flip-400/60" />
                ) : activeExt ? (
                  (() => {
                    const ei = EXT_ICONS[activeExt.id];
                    return ei
                      ? React.createElement(ei.icon, { size: 14, className: 'text-flip-400/60' })
                      : <Puzzle size={14} className="text-flip-400/60" />;
                  })()
                ) : null}
                <span className="text-[12px] font-medium text-white/65 uppercase tracking-wider">
                  {showManager ? 'Extensions' : activeExt?.manifest.name || 'Extension'}
                </span>
              </div>
              <button
                onClick={closePanel}
                className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white/25 hover:text-white/55 hover:bg-white/[0.06] transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden bg-surface-0/30 rounded-b-[16px]">
            {showManager ? (
              <ExtensionManager />
            ) : activeExt ? (
              <ExtensionHost extension={activeExt} width="100%" height="100%" />
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {/* ── Dock area — auto-hides when pointer not near ── */}
      <div
        ref={dockAreaRef}
        className="relative flex items-center justify-center flex-shrink-0"
        style={{ minHeight: dockVisible ? 48 : 6, transition: 'min-height 300ms ease' }}
        onMouseEnter={() => { clearTimeout(hideTimerRef.current); setDockVisible(true); }}
        onMouseLeave={() => {
          if (!activeExtId && !showManager) {
            hideTimerRef.current = setTimeout(() => setDockVisible(false), HIDE_DELAY);
          }
        }}
      >
        {/* Hidden-state indicator — subtle pill that hints the dock exists */}
        <div
          className={clsx(
            'absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-white/15 transition-all duration-300 cursor-pointer',
            dockVisible ? 'w-0 h-0 opacity-0' : 'w-10 h-[3px] opacity-100'
          )}
          onClick={() => setDockVisible(true)}
          title="Show extension dock"
        />

        {/* Dock pill — slides down when hidden */}
        <div
          id="extension-dock"
          className={clsx(
            'flex items-center gap-1 px-2.5 py-1.5 vibrancy rounded-[16px] shadow-mac border border-white/[0.06] transition-all duration-300',
            dockVisible
              ? 'opacity-100 translate-y-0 scale-100 my-1.5'
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none h-0 my-0 py-0 overflow-hidden'
          )}
        >
          {/* Manager button */}
          <button
            onClick={toggleManager}
            className={clsx(
              'flex items-center justify-center w-9 h-9 rounded-[12px] transition-all duration-200',
              showManager
                ? 'bg-flip-500/10 text-flip-400 ring-1 ring-flip-500/15'
                : 'text-white/30 hover:text-white/50 hover:bg-white/[0.05]'
            )}
            title="Extension Manager"
          >
            <Grid3X3 size={15} />
          </button>

          {enabledSidebarExts.length > 0 && (
            <div className="w-px h-5 bg-white/[0.06] mx-0.5" />
          )}

          {/* Extension icons */}
          {enabledSidebarExts.map((ext) => {
            const extIcon = EXT_ICONS[ext.id];
            const isActive = activeExtId === ext.id;
            return (
              <button
                key={ext.id}
                onClick={() => toggleExtension(ext.id)}
                className={clsx(
                  'relative flex items-center justify-center w-9 h-9 rounded-[12px] transition-all duration-200 group',
                  isActive
                    ? 'bg-flip-500/10 ring-1 ring-flip-500/15 scale-110'
                    : 'hover:bg-white/[0.05] hover:scale-110'
                )}
                title={ext.manifest.name || ext.id}
              >
                {extIcon
                  ? React.createElement(extIcon.icon, { size: 15, className: isActive ? extIcon.color : 'text-white/40' })
                  : <span className="text-[11px] font-semibold text-white/40">{ext.manifest.name?.[0] || '?'}</span>}
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-flip-500" />
                )}
              </button>
            );
          })}

          <div className="w-px h-5 bg-white/[0.06] mx-0.5" />

          {/* Marketplace button */}
          <button
            onClick={() => addTab('flip://marketplace')}
            className="flex items-center justify-center w-9 h-9 rounded-[12px] text-white/20 hover:text-flip-400 hover:bg-flip-500/10 transition-all duration-200"
            title="Get Extensions"
          >
            <Store size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

