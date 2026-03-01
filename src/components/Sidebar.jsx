import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe, Plus, X, Pin, Copy, Layers, Pause,
  Bookmark, Clock, Download, KeyRound, Puzzle, Settings, Wallet,
  Shield, MoreHorizontal,
  Bitcoin, ShieldCheck, CreditCard, BellRing, Activity, Keyboard,
  UserCircle2, Globe2, BookOpenCheck, Bot,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../store/browserStore';
import { t } from '../i18n';
import AiTabAssistant from './AiTabAssistant';
import FlipTabsView from './sidebar/FlipTabsView';
import BookmarksView from './sidebar/BookmarksView';
import HistoryView from './sidebar/HistoryView';
import DownloadsView from './sidebar/DownloadsView';
import PasswordsView from './sidebar/PasswordsView';
import WalletView from './sidebar/WalletView';
import CryptoView from './sidebar/CryptoView';
import VpnView from './sidebar/VpnView';
import AutofillView from './sidebar/AutofillView';
import NotificationsView from './sidebar/NotificationsView';
import PerformanceView from './sidebar/PerformanceView';
import ShortcutsView from './sidebar/ShortcutsView';
import ProfilesView from './sidebar/ProfilesView';
import ReaderSettingsView from './sidebar/ReaderSettingsView';
import SiteSettingsView from './sidebar/SiteSettingsView';
import SettingsView from './sidebar/SettingsView';
import CtxItem from './sidebar/CtxItem';

// The rail is always visible (48px). Panels float over content.
const RAIL_WIDTH = 48;

// Primary items: always visible in the rail
const PRIMARY_NAV = [
  { id: 'tabs', icon: Layers, labelKey: 'tabStacks' },
  { id: 'bookmarks', icon: Bookmark, labelKey: 'bookmarks' },
  { id: 'history', icon: Clock, labelKey: 'history' },
  { id: 'downloads', icon: Download, labelKey: 'downloads' },
  { id: 'passwords', icon: KeyRound, labelKey: 'passwords' },
  { id: 'wallet', icon: Wallet, labelKey: 'wallet' },
  { id: 'extensions', icon: Puzzle, labelKey: 'extensions' },
  { id: 'settings', icon: Settings, labelKey: 'settings' },
];

// Secondary items: shown in "More tools" popup grid
const MORE_NAV = [
  { id: 'crypto', icon: Bitcoin, labelKey: 'crypto' },
  { id: 'vpn', icon: ShieldCheck, labelKey: 'vpn' },
  { id: 'autofill', icon: CreditCard, labelKey: 'autofill' },
  { id: 'notifications', icon: BellRing, labelKey: 'notifications' },
  { id: 'performance', icon: Activity, labelKey: 'performance' },
  { id: 'shortcuts', icon: Keyboard, labelKey: 'shortcuts' },
  { id: 'profiles', icon: UserCircle2, labelKey: 'profiles' },
  { id: 'reader', icon: BookOpenCheck, labelKey: 'readerSettings' },
  { id: 'siteSettings', icon: Globe2, labelKey: 'siteSettings' },
  { id: 'aiChat', icon: Bot, labelKey: 'aiChat' },
];

// Combined for panel header lookups
const NAV_ITEMS = [...PRIMARY_NAV, ...MORE_NAV];

export default function Sidebar() {
  const {
    tabs, activeTabId, sidebarView, blockedCount, settings,
    setActiveTab, closeTab, addTab, pinTab, duplicateTab,
    setSidebarView, toggleSidebar, suspendTab,
  } = useBrowserStore();
  const lang = settings.language || 'en';

  const [panelOpen, setPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const panelRef = useRef(null);
  const moreRef = useRef(null);

  const visibleTabs = tabs.filter((t) => !t.isSplitTab);
  const pinnedTabs = visibleTabs.filter((t) => t.pinned);
  const recentTabs = visibleTabs.filter((t) => !t.pinned).slice(0, 8);

  function openMoreItem(viewId) {
    setMoreOpen(false);
    openPanel(viewId);
  }

  function openPanel(viewId) {
    // Extensions open in the right-side ExtensionPanel, not the floating panel
    if (viewId === 'extensions') {
      setPanelOpen(false);
      setActivePanel(null);
      const current = useBrowserStore.getState().sidebarView;
      setSidebarView(current === 'extensions' ? 'tabs' : 'extensions');
      return;
    }
    if (activePanel === viewId && panelOpen) {
      setPanelOpen(false);
      setActivePanel(null);
    } else {
      setActivePanel(viewId);
      setSidebarView(viewId);
      setPanelOpen(true);
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setActivePanel(null);
  }

  function handleTabContext(e, tab) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
  }

  function handleContextAction(action) {
    const tabId = contextMenu?.tabId;
    if (!tabId) return;
    switch (action) {
      case 'close': closeTab(tabId); break;
      case 'pin': pinTab(tabId); break;
      case 'duplicate': duplicateTab(tabId); break;
      case 'suspend': suspendTab(tabId); break;
      default:
        if (action.startsWith('group:')) {
          const groupId = action.slice(6) || null;
          useBrowserStore.getState().assignTabToGroup(tabId, groupId);
        }
        break;
    }
    setContextMenu(null);
  }

  // Close panel / more popup when clicking outside
  useEffect(() => {
    function handleClick(e) {
      const rail = document.getElementById('flip-rail');
      if (panelOpen && panelRef.current && !panelRef.current.contains(e.target)) {
        if (rail && !rail.contains(e.target)) {
          closePanel();
        }
      }
      if (moreOpen && moreRef.current && !moreRef.current.contains(e.target)) {
        if (rail && !rail.contains(e.target)) {
          setMoreOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen, moreOpen]);

  return (
    <div className="relative flex h-full" style={{ zIndex: 20 }}>
      {/* ── Icon Rail ── */}
      <div
        id="flip-rail"
        className="flex flex-col items-center h-full bg-surface-1 border-r border-white/5"
        style={{ width: RAIL_WIDTH, minWidth: RAIL_WIDTH }}
      >
        {/* Tab favicon strip — scrollable, no scrollbar */}
        <div className="flex flex-col items-center gap-1 py-2 w-full border-b border-white/5 overflow-y-auto scrollbar-none" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          {recentTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => handleTabContext(e, tab)}
              className={clsx(
                'relative w-8 h-8 rounded-xl flex items-center justify-center group',
                'transition-all duration-200',
                tab.id === activeTabId
                  ? 'bg-flip-500/10 ring-1 ring-flip-500/20'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] hover:scale-105'
              )}
              title={tab.title || 'New Tab'}
            >
              {tab.favicon ? (
                <img src={tab.favicon} className={clsx('w-4 h-4 rounded transition-transform duration-200', tab.id === activeTabId && 'scale-110')} alt="" />
              ) : (
                <Globe size={14} className={tab.id === activeTabId ? 'text-flip-400' : 'text-white/30'} />
              )}
              {tab.loading && (
                <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-flip-400 animate-pulse-subtle" />
              )}
            </button>
          ))}
          {/* New tab */}
          <button
            onClick={() => addTab()}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-all"
            title="New Tab"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Primary nav icons */}
        <div className="flex flex-col items-center gap-1 py-3 flex-1">
          {PRIMARY_NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => openPanel(item.id)}
              className={clsx(
                'relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                (activePanel === item.id && panelOpen) || (item.id === 'extensions' && sidebarView === 'extensions')
                  ? 'bg-flip-500/15 text-flip-400'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              )}
              title={t(item.labelKey, lang)}
            >
              <item.icon size={16} />
              {activePanel === item.id && panelOpen && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-flip-500" />
              )}
            </button>
          ))}

          {/* More tools button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={clsx(
              'relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
              moreOpen || MORE_NAV.some(n => n.id === activePanel && panelOpen)
                ? 'bg-flip-500/15 text-flip-400'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            )}
            title="More tools"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Bottom: privacy + version */}
        <div className="flex flex-col items-center gap-1 pb-2 border-t border-white/5 pt-2 w-full">
          <div className="flex flex-col items-center" title={`${blockedCount} trackers blocked`}>
            <Shield size={13} className="text-accent-400/40" />
            <span className="text-[8px] text-white/20 mt-0.5">{blockedCount}</span>
          </div>
          {tabs.length > 6 && (
            <button
              onClick={() => openPanel('tabs')}
              className="text-[9px] text-white/20 hover:text-white/50 transition-colors"
              title={`${tabs.length} tabs open`}
            >
              +{tabs.length - 6}
            </button>
          )}
          <span className="text-[7px] text-white/15 mt-0.5 select-text" title="Flip Browser version">v{__APP_VERSION__}</span>
        </div>
      </div>

      {/* ── More Tools Popup ── */}
      {moreOpen && (
        <div
          ref={moreRef}
          className="absolute bottom-12 bg-surface-2/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-3 animate-scale-in"
          style={{ left: RAIL_WIDTH + 8, width: 220, zIndex: 50, transformOrigin: 'bottom left' }}
        >
          <div className="text-[9px] font-semibold text-white/30 uppercase tracking-wider mb-2 px-1">More Tools</div>
          <div className="grid grid-cols-3 gap-1.5">
            {MORE_NAV.map((item, i) => (
              <button
                key={item.id}
                onClick={() => openMoreItem(item.id)}
                className={clsx(
                  'group flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all duration-150 animate-fade-in-up',
                  activePanel === item.id && panelOpen
                    ? 'bg-flip-500/15 text-flip-400 ring-1 ring-flip-500/20'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.06] hover:shadow-sm'
                )}
                style={{ animationDelay: `${i * 25}ms` }}
                title={t(item.labelKey, lang)}
              >
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150',
                  activePanel === item.id && panelOpen
                    ? 'bg-flip-500/20'
                    : 'bg-white/[0.03] group-hover:bg-white/[0.08] group-hover:scale-105'
                )}>
                  <item.icon size={14} />
                </div>
                <span className="text-[8px] leading-tight text-center">{t(item.labelKey, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Floating Panel (overlay) ── */}
      {panelOpen && (
        <div
          ref={panelRef}
          className="absolute top-0 bottom-0 flex flex-col bg-surface-0/95 backdrop-blur-2xl border-r border-white/[0.06] shadow-2xl shadow-black/50 animate-slide-right"
          style={{ left: RAIL_WIDTH, width: 280 }}
        >
          {/* Panel header */}
          {(() => {
            const navItem = NAV_ITEMS.find(n => n.id === activePanel);
            const PanelIcon = navItem?.icon;
            return (
              <div className="relative px-3 py-2.5 border-b border-white/5 overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-flip-500/60 via-accent-400/40 to-transparent" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {PanelIcon && <PanelIcon size={13} className="text-flip-400/70" />}
                    <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                      {t(navItem?.labelKey, lang) || 'Panel'}
                    </span>
                  </div>
                  <button
                    onClick={closePanel}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Panel content */}
          {activePanel === 'tabs' && (
            <FlipTabsView
              tabs={tabs}
              pinnedTabs={pinnedTabs}
              activeTabId={activeTabId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setActiveTab={(id) => { setActiveTab(id); }}
              closeTab={closeTab}
              addTab={addTab}
              handleTabContext={handleTabContext}
            />
          )}
          {activePanel === 'bookmarks' && <BookmarksView />}
          {activePanel === 'history' && <HistoryView />}
          {activePanel === 'downloads' && <DownloadsView />}
          {activePanel === 'passwords' && <PasswordsView />}
          {activePanel === 'wallet' && <WalletView />}
          {activePanel === 'crypto' && <CryptoView />}
          {activePanel === 'vpn' && <VpnView />}
          {activePanel === 'autofill' && <AutofillView />}
          {activePanel === 'notifications' && <NotificationsView />}
          {activePanel === 'performance' && <PerformanceView />}
          {activePanel === 'shortcuts' && <ShortcutsView />}
          {activePanel === 'profiles' && <ProfilesView />}
          {activePanel === 'reader' && <ReaderSettingsView />}
          {activePanel === 'siteSettings' && <SiteSettingsView />}
          {activePanel === 'aiChat' && <AiTabAssistant onClose={closePanel} />}
          {activePanel === 'settings' && <SettingsView />}
        </div>
      )}

      {/* Context menu — rendered via portal to escape sidebar stacking context */}
      {contextMenu && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9990 }} onClick={() => setContextMenu(null)} />
          <div
            className="fixed w-48 py-1.5 rounded-xl bg-surface-3/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 animate-scale-in"
            style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 9991 }}
          >
            <CtxItem icon={X} label="Close Tab" onClick={() => handleContextAction('close')} />
            <CtxItem icon={Pin} label="Pin Tab" onClick={() => handleContextAction('pin')} />
            <CtxItem icon={Copy} label="Duplicate Tab" onClick={() => handleContextAction('duplicate')} />
            <div className="my-1 mx-2 border-t border-white/5" />
            <CtxItem icon={Pause} label="Suspend Tab" onClick={() => handleContextAction('suspend')} />
            {Object.keys(useBrowserStore.getState().tabGroups).length > 0 && (
              <>
                <div className="my-1 mx-2 border-t border-white/5" />
                <div className="px-2 py-1 text-[8px] text-white/25 uppercase tracking-wider">Move to Group</div>
                {Object.entries(useBrowserStore.getState().tabGroups).map(([gid, g]) => (
                  <CtxItem key={gid} icon={Layers} label={g.name} onClick={() => handleContextAction('group:' + gid)} />
                ))}
                <CtxItem icon={X} label="Remove from Group" onClick={() => handleContextAction('group:')} />
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

