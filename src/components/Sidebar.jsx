import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe, Plus, X, Pin, PanelLeftClose,
  Bookmark, Clock, Puzzle, Settings, Search,
  Shield, ChevronDown, MoreHorizontal, Copy,
  Volume2, VolumeX, Bitcoin, TrendingUp, TrendingDown,
  RefreshCw, ArrowUpRight, ArrowDownRight, Layers,
  Download, KeyRound, BookOpen, ShieldCheck, Wifi, WifiOff,
  Eye, EyeOff, Server, Lock, Unlock, AlertTriangle, CheckCircle2,
  CreditCard, BellRing, Activity, Keyboard, PictureInPicture2,
  MapPin, User, Trash2, FileUp, FileDown, RotateCcw,
  BellOff, Gauge, Cpu, HardDrive, Zap as ZapIcon,
  UserCircle2, Globe2, BookOpenCheck, Pause, Palette, Smartphone, QrCode, Unlink,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../store/browserStore';
import { t } from '../i18n';
import {
  isPaired, startSync, stopSync, unpair, forwardNotification,
  createPairingSession, listenForPairingClaim, cancelPairing, getPairedUserId,
} from '../lib/companionSync';
import QRCode from 'qrcode';

// ── Flip Rail: Thin icon rail + floating overlay panels ──────────
// The rail is always visible (48px). Panels float over content.
const RAIL_WIDTH = 48;

// Primary items: always visible in the rail
const PRIMARY_NAV = [
  { id: 'tabs', icon: Layers, labelKey: 'tabStacks' },
  { id: 'bookmarks', icon: Bookmark, labelKey: 'bookmarks' },
  { id: 'history', icon: Clock, labelKey: 'history' },
  { id: 'downloads', icon: Download, labelKey: 'downloads' },
  { id: 'passwords', icon: KeyRound, labelKey: 'passwords' },
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
          {activePanel === 'crypto' && <CryptoView />}
          {activePanel === 'vpn' && <VpnView />}
          {activePanel === 'autofill' && <AutofillView />}
          {activePanel === 'notifications' && <NotificationsView />}
          {activePanel === 'performance' && <PerformanceView />}
          {activePanel === 'shortcuts' && <ShortcutsView />}
          {activePanel === 'profiles' && <ProfilesView />}
          {activePanel === 'reader' && <ReaderSettingsView />}
          {activePanel === 'siteSettings' && <SiteSettingsView />}
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

// ── Flip Stacks: Unique card-based tab model ──────────────────────
// Tabs auto-group by domain. Stacks are collapsible. Age indicator shows freshness.
const STACK_COLORS = ['#ff6234', '#2dd4a8', '#a78bfa', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

function getDomain(url) {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    return h;
  } catch {
    return null;
  }
}

function getAgeFade(lastActive) {
  if (!lastActive) return 0.15;
  const age = Date.now() - lastActive;
  const mins = age / 60000;
  if (mins < 1) return 1;
  if (mins < 5) return 0.8;
  if (mins < 30) return 0.5;
  if (mins < 120) return 0.3;
  return 0.15;
}

function FlipTabsView({ tabs: allTabs, pinnedTabs, activeTabId, searchQuery, setSearchQuery, setActiveTab, closeTab, addTab, handleTabContext }) {
  const { tabStacks, toggleStack, tabGroups, toggleTabGroup, createTabGroup, deleteTabGroup, renameTabGroup, workspaces, saveWorkspace, loadWorkspace, deleteWorkspace } = useBrowserStore();
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [wsName, setWsName] = useState('');

  const tabs = allTabs.filter((t) => !t.isSplitTab);
  const unpinnedTabs = tabs.filter((t) => !t.pinned);

  // Search filter
  const filteredTabs = searchQuery
    ? tabs.filter(
        (t) =>
          t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.url?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  // Separate manually grouped tabs from ungrouped
  const groupedTabIds = new Set();
  const manualGroups = Object.entries(tabGroups).map(([gid, g]) => {
    const gTabs = unpinnedTabs.filter((t) => t.group === gid);
    gTabs.forEach((t) => groupedTabIds.add(t.id));
    return { id: gid, ...g, tabs: gTabs };
  }).filter((g) => g.tabs.length > 0 || true); // show empty groups too

  const ungroupedTabs = unpinnedTabs.filter((t) => !groupedTabIds.has(t.id));

  // Auto-group ungrouped tabs by domain
  const domainGroups = {};
  const soloTabs = [];

  if (!filteredTabs) {
    ungroupedTabs.forEach((tab) => {
      const domain = getDomain(tab.url);
      if (domain && domain !== 'flip') {
        if (!domainGroups[domain]) domainGroups[domain] = [];
        domainGroups[domain].push(tab);
      } else {
        soloTabs.push(tab);
      }
    });
  }

  // Separate stacked (2+ tabs) from single-domain tabs
  const stacks = [];
  Object.entries(domainGroups).forEach(([domain, domTabs]) => {
    if (domTabs.length >= 2) {
      stacks.push({ domain, tabs: domTabs });
    } else {
      soloTabs.push(domTabs[0]);
    }
  });

  // Assign stable colors to stacks
  const stackColorMap = {};
  stacks.forEach((s, i) => {
    stackColorMap[s.domain] = STACK_COLORS[i % STACK_COLORS.length];
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
          <Search size={12} className="text-white/30" />
          <input
            type="text"
            placeholder="Search tabs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none"
          />
          <span className="text-[10px] text-white/20">{tabs.length}</span>
        </div>
      </div>

      {/* Pinned tabs — favicon orbit strip */}
      {pinnedTabs.length > 0 && !searchQuery && (
        <div className="px-3 pb-2">
          <div className="sidebar-section flex items-center gap-1 mb-1">
            <Pin size={10} /> Pinned
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {pinnedTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onContextMenu={(e) => handleTabContext(e, tab)}
                className={clsx(
                  'relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 group',
                  tab.id === activeTabId
                    ? 'bg-flip-500/20 ring-2 ring-flip-500/50 scale-110'
                    : 'bg-white/5 hover:bg-white/10 hover:scale-105'
                )}
                title={tab.title || tab.url}
              >
                {tab.favicon ? (
                  <img src={tab.favicon} className="w-4 h-4 rounded-sm" alt="" />
                ) : (
                  <Globe size={13} className="text-white/40" />
                )}
                {tab.loading && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-flip-400 animate-pulse-subtle" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-surface-3 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={8} className="text-white/60" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable tab area */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {/* Search results — flat list */}
        {filteredTabs && filteredTabs.map((tab, i) => (
          <TabCard
            key={tab.id}
            tab={tab}
            index={i}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onContext={(e) => handleTabContext(e, tab)}
          />
        ))}

        {/* Manual tab groups */}
        {!filteredTabs && manualGroups.length > 0 && manualGroups.map((group) => {
          const isCollapsed = group.collapsed;
          return (
            <div key={group.id} className="mb-1.5">
              <button
                onClick={() => toggleTabGroup(group.id)}
                className={clsx(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] transition-all duration-200 group/hdr',
                  group.tabs.some(t => t.id === activeTabId) ? 'bg-white/5' : 'hover:bg-white/3'
                )}
              >
                <div
                  className="w-1 rounded-full transition-all duration-300"
                  style={{ backgroundColor: group.color, height: isCollapsed ? 12 : 20, opacity: group.tabs.some(t => t.id === activeTabId) ? 1 : 0.6 }}
                />
                <ChevronDown size={11} className={clsx('text-white/30 transition-transform duration-200', isCollapsed && '-rotate-90')} />
                {editingGroup === group.id ? (
                  <input
                    autoFocus
                    className="flex-1 bg-transparent text-xs text-white outline-none border-b border-white/20"
                    defaultValue={group.name}
                    onBlur={(e) => { renameTabGroup(group.id, e.target.value || group.name); setEditingGroup(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { renameTabGroup(group.id, e.target.value || group.name); setEditingGroup(null); } }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="text-white/50 truncate flex-1 text-left font-medium"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingGroup(group.id); }}
                  >
                    {group.name}
                  </span>
                )}
                <span className="text-[9px] font-medium rounded-full px-1.5 py-0.5 min-w-[18px] text-center" style={{ backgroundColor: group.color + '20', color: group.color }}>
                  {group.tabs.length}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTabGroup(group.id); }}
                  className="opacity-0 group-hover/hdr:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all text-white/30 hover:text-white/60"
                >
                  <X size={10} />
                </button>
              </button>
              {!isCollapsed && (
                <div className="ml-2 border-l-2 rounded-bl-lg" style={{ borderColor: group.color + '25' }}>
                  {group.tabs.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-white/20 italic">Right-click a tab → Move to Group</div>
                  ) : (
                    group.tabs.map((tab, i) => (
                      <TabCard
                        key={tab.id}
                        tab={tab}
                        index={i}
                        isActive={tab.id === activeTabId}
                        onClick={() => setActiveTab(tab.id)}
                        onClose={() => closeTab(tab.id)}
                        onContext={(e) => handleTabContext(e, tab)}
                        accentColor={group.color}
                        compact
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Create group inline */}
        {!filteredTabs && showNewGroup && (
          <div className="mx-2 mb-2 flex items-center gap-1.5">
            <input
              autoFocus
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none"
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newGroupName.trim()) {
                  const colors = STACK_COLORS;
                  createTabGroup(newGroupName.trim(), colors[Object.keys(tabGroups).length % colors.length]);
                  setNewGroupName('');
                  setShowNewGroup(false);
                }
                if (e.key === 'Escape') setShowNewGroup(false);
              }}
            />
            <button onClick={() => setShowNewGroup(false)} className="text-white/30 hover:text-white/60"><X size={12} /></button>
          </div>
        )}
        {!filteredTabs && !showNewGroup && (
          <button
            onClick={() => setShowNewGroup(true)}
            className="mx-2 mb-2 flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/50 transition-colors"
          >
            <Plus size={10} /> New Group
          </button>
        )}

        {/* Domain stacks */}
        {!filteredTabs && stacks.map(({ domain, tabs: stackTabs }) => {
          const isCollapsed = tabStacks[domain]?.collapsed;
          const color = stackColorMap[domain];
          const hasActive = stackTabs.some(t => t.id === activeTabId);
          const customName = tabStacks[domain]?.name;

          return (
            <div key={domain} className="mb-1.5">
              {/* Stack header */}
              <button
                onClick={() => toggleStack(domain)}
                className={clsx(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] transition-all duration-200 group',
                  hasActive ? 'bg-white/5' : 'hover:bg-white/3'
                )}
              >
                <div
                  className="w-1 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: color,
                    height: isCollapsed ? 12 : 20,
                    opacity: hasActive ? 1 : 0.5,
                  }}
                />
                <ChevronDown
                  size={11}
                  className={clsx(
                    'text-white/30 transition-transform duration-200',
                    isCollapsed && '-rotate-90'
                  )}
                />
                <span className="text-white/50 truncate flex-1 text-left font-medium">
                  {customName || domain}
                </span>
                <span
                  className="text-[9px] font-medium rounded-full px-1.5 py-0.5 min-w-[18px] text-center"
                  style={{ backgroundColor: color + '20', color: color }}
                >
                  {stackTabs.length}
                </span>
              </button>

              {/* Stack tabs */}
              {!isCollapsed && (
                <div className="ml-2 border-l-2 rounded-bl-lg" style={{ borderColor: color + '25' }}>
                  {stackTabs.map((tab, i) => (
                    <TabCard
                      key={tab.id}
                      tab={tab}
                      index={i}
                      isActive={tab.id === activeTabId}
                      onClick={() => setActiveTab(tab.id)}
                      onClose={() => closeTab(tab.id)}
                      onContext={(e) => handleTabContext(e, tab)}
                      accentColor={color}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Solo tabs (ungrouped) */}
        {!filteredTabs && soloTabs.length > 0 && (
          <>
            {stacks.length > 0 && (
              <div className="sidebar-section flex items-center gap-1 mt-1">
                <Globe size={10} /> Other
              </div>
            )}
            {soloTabs.map((tab, i) => (
              <TabCard
                key={tab.id}
                tab={tab}
                index={i}
                isActive={tab.id === activeTabId}
                onClick={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                onContext={(e) => handleTabContext(e, tab)}
              />
            ))}
          </>
        )}
      </div>

      {/* New tab button + workspace toggle */}
      <div className="px-3 py-2 border-t border-white/5 space-y-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => addTab()}
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-full text-white/40 hover:text-white hover:bg-flip-500/10 transition-all duration-200 text-xs"
          >
            <Plus size={14} />
            New Tab
          </button>
          <button
            onClick={() => setShowWorkspaces(!showWorkspaces)}
            className={clsx(
              'p-2 rounded-full transition-all duration-200 text-xs',
              showWorkspaces ? 'bg-flip-500/15 text-flip-400' : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            )}
            title="Workspaces"
          >
            <Layers size={14} />
          </button>
        </div>

        {/* Workspace panel */}
        {showWorkspaces && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2 space-y-1.5 animate-fade-in">
            <div className="text-[9px] text-white/30 uppercase tracking-widest font-semibold px-1">Workspaces</div>

            {/* Save current tabs as workspace */}
            <div className="flex items-center gap-1">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white outline-none placeholder-white/20"
                placeholder="Save current tabs as..."
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && wsName.trim()) {
                    saveWorkspace(wsName.trim());
                    setWsName('');
                  }
                }}
              />
              <button
                onClick={() => { if (wsName.trim()) { saveWorkspace(wsName.trim()); setWsName(''); } }}
                className="px-2 py-1 rounded-lg bg-flip-500/15 text-flip-400 text-[9px] font-medium hover:bg-flip-500/25 transition-colors"
              >
                Save
              </button>
            </div>

            {/* Saved workspaces list */}
            {workspaces.length === 0 && (
              <div className="text-[9px] text-white/15 px-1 italic">No saved workspaces</div>
            )}
            {workspaces.map((ws) => (
              <div key={ws.id} className="flex items-center gap-1.5 px-1 py-1 rounded-lg hover:bg-white/[0.03] group/ws transition-colors">
                <Layers size={10} className="text-white/20 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white/50 truncate font-medium">{ws.name}</div>
                  <div className="text-[8px] text-white/20">{ws.tabs.length} tabs</div>
                </div>
                <button
                  onClick={() => loadWorkspace(ws.id)}
                  className="px-1.5 py-0.5 rounded text-[8px] text-accent-400/70 hover:text-accent-400 hover:bg-accent-400/10 transition-colors opacity-0 group-hover/ws:opacity-100"
                >
                  Open
                </button>
                <button
                  onClick={() => deleteWorkspace(ws.id)}
                  className="p-0.5 rounded text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors opacity-0 group-hover/ws:opacity-100"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab Card: Individual tab with age indicator ──
function TabCard({ tab, isActive, onClick, onClose, onContext, accentColor, compact, index = 0 }) {
  const ageFade = getAgeFade(tab.lastActive);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContext}
      className={clsx(
        'group flex items-center gap-2.5 cursor-pointer transition-all duration-200 relative animate-fade-in-up',
        compact ? 'px-3 py-1.5 ml-1' : 'px-3 py-2 mx-1 rounded-xl mb-0.5',
        isActive
          ? 'bg-white/[0.06] shadow-[0_0_12px_rgba(255,98,52,0.06)]'
          : 'hover:bg-white/[0.03]'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Age indicator bar */}
      {!compact && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-500"
          style={{
            height: isActive ? 20 : 14,
            backgroundColor: accentColor || (isActive ? '#ff6234' : `rgba(255,255,255,${ageFade * 0.4})`),
            opacity: isActive ? 1 : ageFade,
          }}
        />
      )}

      {/* Favicon */}
      {tab.favicon ? (
        <img src={tab.favicon} className={clsx('rounded-sm flex-shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} alt="" />
      ) : (
        <Globe size={compact ? 13 : 14} className="flex-shrink-0 text-white/30" />
      )}

      {/* Title & meta */}
      <div className="flex-1 min-w-0">
        <div className={clsx('truncate leading-tight', compact ? 'text-[11px]' : 'text-xs')}
          style={{ opacity: isActive ? 1 : Math.max(ageFade, 0.5) }}
        >
          {tab.title || 'New Tab'}
        </div>
        {tab.suspended && (
          <div className="text-[9px] text-flip-400/60">Suspended</div>
        )}
      </div>

      {/* Audio indicator + mute toggle */}
      {tab.isAudible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('flip-mute-tab', { detail: { tabId: tab.id } }));
          }}
          className="p-0.5 rounded hover:bg-white/10 transition-all flex-shrink-0"
          title={tab.isMuted ? 'Unmute tab' : 'Mute tab'}
        >
          {tab.isMuted ? (
            <VolumeX size={compact ? 10 : 12} className="text-red-400/70" />
          ) : (
            <Volume2 size={compact ? 10 : 12} className="text-flip-400/70" />
          )}
        </button>
      )}

      {/* Loading pulse */}
      {tab.loading && (
        <div className="w-2 h-2 rounded-full bg-flip-400 animate-pulse-subtle flex-shrink-0" />
      )}

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all text-white/40 hover:text-white flex-shrink-0"
      >
        <X size={compact ? 10 : 12} />
      </button>
    </div>
  );
}

function BookmarksView() {
  const { bookmarks, removeBookmark, addTab } = useBrowserStore();

  return (
    <div className="flex-1 overflow-y-auto px-1 py-2">
      <div className="sidebar-section">Bookmarks</div>
      {bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
            <Bookmark size={18} className="text-white/15" />
          </div>
          <p className="text-xs text-white/30 mb-1">No bookmarks yet</p>
          <p className="text-[10px] text-white/15">Click the star in the address bar to save one</p>
        </div>
      ) : (
        bookmarks.map((bm) => (
          <div
            key={bm.id}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-1 mb-0.5 cursor-pointer text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => addTab(bm.url)}
          >
            <Bookmark size={12} className="flex-shrink-0" />
            <span className="text-xs truncate flex-1">{bm.title || bm.url}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10"
            >
              <X size={10} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function HistoryView() {
  const { history, addTab } = useBrowserStore();
  const [histSearch, setHistSearch] = useState('');

  const filtered = histSearch
    ? history.filter((e) =>
        (e.title || '').toLowerCase().includes(histSearch.toLowerCase()) ||
        (e.url || '').toLowerCase().includes(histSearch.toLowerCase())
      )
    : history;

  const grouped = filtered.reduce((acc, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto px-1 py-2">
      <div className="sidebar-section">History</div>
      {/* Search */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Search size={12} className="text-white/25" />
          <input
            value={histSearch}
            onChange={(e) => setHistSearch(e.target.value)}
            placeholder="Search history..."
            className="flex-1 bg-transparent text-xs text-white/80 placeholder-white/25 outline-none"
          />
          {histSearch && (
            <button onClick={() => setHistSearch('')} className="text-white/30 hover:text-white/60">
              <X size={11} />
            </button>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-white/30">
          {histSearch ? 'No results found.' : 'No browsing history yet.'}
        </div>
      ) : (
        Object.entries(grouped).slice(0, 10).map(([date, entries]) => (
          <div key={date}>
            <div className="px-3 py-1 text-[10px] text-white/25 font-medium">{date}</div>
            {entries.slice(0, 20).map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1 rounded-lg mx-1 mb-0.5 cursor-pointer text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => addTab(entry.url)}
              >
                <Clock size={11} className="flex-shrink-0 text-white/20" />
                <span className="text-xs truncate">{entry.title || entry.url}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

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

function PasswordsView() {
  const [passwords, setPasswords] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [revealId, setRevealId] = useState(null);

  useEffect(() => {
    if (window.flipAPI) {
      window.flipAPI.getPasswords().then((p) => { if (p) setPasswords(p); });
    }
  }, []);

  function save(list) {
    setPasswords(list);
    if (window.flipAPI) window.flipAPI.savePasswords(list);
  }

  function handleAdd() {
    if (!newSite.trim() || !newUser.trim()) return;
    const entry = { id: Date.now(), site: newSite.trim(), username: newUser.trim(), password: newPass, createdAt: Date.now() };
    save([entry, ...passwords]);
    setNewSite(''); setNewUser(''); setNewPass(''); setShowAdd(false);
  }

  function handleDelete(id) {
    save(passwords.filter((p) => p.id !== id));
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="sidebar-section px-0 flex items-center justify-between">
        <span>Passwords</span>
        <button onClick={() => setShowAdd(!showAdd)} className="text-flip-400 hover:text-flip-300 text-[10px] font-medium">
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showAdd && (
        <div className="mt-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
          <input value={newSite} onChange={(e) => setNewSite(e.target.value)} placeholder="Site (e.g. github.com)" className="w-full input-base text-xs" />
          <input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="Username / Email" className="w-full input-base text-xs" />
          <input value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" type="password" className="w-full input-base text-xs" />
          <button onClick={handleAdd} className="w-full py-1.5 rounded-lg bg-flip-500/20 text-flip-400 text-xs font-medium hover:bg-flip-500/30 transition-colors">
            Save Credential
          </button>
        </div>
      )}

      {passwords.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
            <KeyRound size={18} className="text-white/15" />
          </div>
          <p className="text-xs text-white/30 mb-1">No saved passwords</p>
          <p className="text-[10px] text-white/15">Passwords you save will be encrypted & stored here</p>
        </div>
      ) : (
        <div className="space-y-1.5 mt-2">
          {passwords.map((pw) => (
            <div key={pw.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/70 font-medium truncate">{pw.site}</span>
                <button onClick={() => handleDelete(pw.id)} className="text-white/20 hover:text-red-400 transition-colors">
                  <X size={11} />
                </button>
              </div>
              <div className="text-[10px] text-white/40">{pw.username}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-white/25 font-mono">
                  {revealId === pw.id ? pw.password : '••••••••'}
                </span>
                <button
                  onClick={() => setRevealId(revealId === pw.id ? null : pw.id)}
                  className="text-[9px] text-white/30 hover:text-white/60"
                >
                  {revealId === pw.id ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(pw.password)}
                  className="text-[9px] text-white/30 hover:text-white/60"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
            { label: 'Puerto Rico', url: './pr.jpg' },
            { label: 'Boston', url: './boston.jpg' },
            { label: 'Pennsylvania', url: './penn.jpg' },
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

function CompanionAppCard() {
  const [paired, setPaired] = useState(isPaired());
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [status, setStatus] = useState('');
  const [countdown, setCountdown] = useState(0);

  async function startPairing() {
    setStatus('Generating secure pairing code…');
    try {
      const session = await createPairingSession();
      // Generate QR code as data URL
      const dataUrl = await QRCode.toDataURL(session.qrPayload, {
        width: 200, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setPairingCode(session.code);
      setShowQR(true);
      setStatus('Scan this QR code with the Flip companion app');
      setCountdown(300); // 5 min

      // Countdown timer
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); handleCancelPairing(); return 0; }
          return c - 1;
        });
      }, 1000);

      // Listen for companion to claim the session
      listenForPairingClaim(session.code, session.secret, (pairingData) => {
        clearInterval(timer);
        setPaired(true);
        setShowQR(false);
        setQrDataUrl('');
        setCountdown(0);
        startSync();
        setStatus('Paired & syncing!');
        setTimeout(() => setStatus(''), 4000);
      });
    } catch (e) {
      setStatus('Failed to create pairing session');
      setTimeout(() => setStatus(''), 3000);
    }
  }

  function handleCancelPairing() {
    cancelPairing();
    setShowQR(false);
    setQrDataUrl('');
    setPairingCode('');
    setCodeCopied(false);
    setCountdown(0);
    setStatus('');
  }

  function handleUnpair() {
    unpair();
    setPaired(false);
    setStatus('Unpaired');
    setTimeout(() => setStatus(''), 2000);
  }

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 animate-fade-in-up" style={{ animationDelay: '175ms' }}>
      <div className="flex items-center gap-2 mb-2">
        <Smartphone size={12} className="text-flip-400/70" />
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Companion App</span>
      </div>

      {paired ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/60">Connected & syncing</span>
          </div>
          <button
            onClick={handleUnpair}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-red-500/20 text-[9px] text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <Unlink size={10} /> Unpair Device
          </button>
        </div>
      ) : showQR ? (
        <div className="space-y-2 flex flex-col items-center">
          {qrDataUrl && (
            <div className="bg-white/[0.06] rounded-xl p-2">
              <img src={qrDataUrl} alt="Pairing QR" className="w-full max-w-[180px] rounded-lg" />
            </div>
          )}
          <p className="text-[9px] text-white/25 text-center">Open Flip companion app → More → Scan QR</p>
          {pairingCode && (
            <div className="w-full">
              <p className="text-[8px] text-white/20 text-center mb-1">Or enter this PIN manually:</p>
              <button
                onClick={() => { navigator.clipboard.writeText(pairingCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                className="w-full px-2 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] font-mono text-white/70 hover:text-white tracking-[0.25em] text-center transition-colors font-bold uppercase"
                title="Click to copy"
              >
                {codeCopied ? '✓ Copied!' : pairingCode}
              </button>
            </div>
          )}
          {countdown > 0 && (
            <p className="text-[9px] text-white/15 font-mono">Expires in {mins}:{secs.toString().padStart(2, '0')}</p>
          )}
          <button
            onClick={handleCancelPairing}
            className="w-full px-2 py-1.5 rounded-lg border border-white/[0.08] text-[9px] text-white/30 hover:text-white/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-white/30">Sync tabs, send files, and control this browser from your phone.</p>
          <button
            onClick={startPairing}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-flip-500/10 border border-flip-500/20 text-[9px] text-flip-400 hover:bg-flip-500/15 transition-all"
          >
            <QrCode size={10} /> Show Pairing QR Code
          </button>
        </div>
      )}
      {status && <p className="text-[9px] text-green-400/70 mt-1.5 text-center">{status}</p>}
    </div>
  );
}

function CryptoView() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCoins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h'
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCoins(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoins();
    const interval = setInterval(fetchCoins, 60000);
    return () => clearInterval(interval);
  }, [fetchCoins]);

  const formatPrice = (price) => {
    if (price >= 1) return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '$' + price.toFixed(6);
  };

  const formatMcap = (mcap) => {
    if (mcap >= 1e12) return '$' + (mcap / 1e12).toFixed(2) + 'T';
    if (mcap >= 1e9) return '$' + (mcap / 1e9).toFixed(2) + 'B';
    if (mcap >= 1e6) return '$' + (mcap / 1e6).toFixed(2) + 'M';
    return '$' + mcap.toLocaleString();
  };

  return (
    <div className="flex-1 overflow-y-auto px-1 py-2">
      <div className="flex items-center justify-between px-2 mb-1">
        <div className="sidebar-section px-0 py-0">Crypto Top 10</div>
        <button
          onClick={fetchCoins}
          disabled={loading}
          className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {lastUpdated && (
        <div className="px-3 mb-2 text-[9px] text-white/15">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {error && (
        <div className="mx-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 mb-2">
          {error} — <button onClick={fetchCoins} className="underline">retry</button>
        </div>
      )}

      {loading && coins.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-white/20">
          <RefreshCw size={18} className="animate-spin mb-2" />
          <span className="text-[10px]">Loading prices...</span>
        </div>
      ) : (
        <div className="space-y-0.5">
          {coins.map((coin, i) => {
            const change = coin.price_change_percentage_24h || 0;
            const isUp = change >= 0;

            return (
              <div
                key={coin.id}
                className="group flex items-center gap-2 px-2 py-2 rounded-lg mx-1 hover:bg-white/5 transition-colors cursor-default"
              >
                <span className="text-[9px] text-white/20 w-3 text-right font-mono">{i + 1}</span>
                <img
                  src={coin.image}
                  alt={coin.symbol}
                  className="w-5 h-5 rounded-full"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-white/80 font-medium truncate">{coin.name}</span>
                    <span className="text-[9px] text-white/25 uppercase">{coin.symbol}</span>
                  </div>
                  <div className="text-[9px] text-white/20">{formatMcap(coin.market_cap)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-white/80 font-mono">{formatPrice(coin.current_price)}</div>
                  <div className={clsx(
                    'flex items-center justify-end gap-0.5 text-[9px] font-medium',
                    isUp ? 'text-accent-400' : 'text-red-400'
                  )}>
                    {isUp ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
                    {Math.abs(change).toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-3 pt-3 pb-1 text-[8px] text-white/10 text-center">
        Data from CoinGecko · Auto-refreshes every 60s
      </div>
    </div>
  );
}

// ── Preset proxy servers (free community proxies for demo) ──────
// No preset proxies — user must provide their own server details

function VpnView() {
  const { vpn, setVpn } = useBrowserStore();
  const [localHost, setLocalHost] = useState(vpn.host || '');
  const [localPort, setLocalPort] = useState(vpn.port || '');
  const [localType, setLocalType] = useState(vpn.type || 'socks5');
  const [localUser, setLocalUser] = useState(vpn.username || '');
  const [localPass, setLocalPass] = useState(vpn.password || '');
  const [showAuth, setShowAuth] = useState(false);

  // Check IP on mount
  useEffect(() => {
    checkCurrentIp();
  }, []);

  async function checkCurrentIp() {
    if (window.flipAPI?.checkIp) {
      const result = await window.flipAPI.checkIp();
      if (result.ip) setVpn({ currentIp: result.ip });
    }
  }

  async function handleConnect() {
    if (!localHost || !localPort) {
      setVpn({ error: 'Host and port are required' });
      return;
    }
    setVpn({ connecting: true, error: null });
    try {
      const result = await window.flipAPI?.setProxy({
        type: localType,
        host: localHost,
        port: localPort,
        username: localUser || undefined,
        password: localPass || undefined,
      });
      if (result?.error) {
        setVpn({ connecting: false, error: result.error });
      } else {
        setVpn({
          active: true,
          connecting: false,
          host: localHost,
          port: localPort,
          type: localType,
          username: localUser,
          password: localPass,
          error: null,
        });
        // Re-check IP after connecting
        setTimeout(checkCurrentIp, 1500);
      }
    } catch (e) {
      setVpn({ connecting: false, error: e.message });
    }
  }

  async function handleDisconnect() {
    setVpn({ connecting: true });
    try {
      await window.flipAPI?.clearProxy();
      setVpn({ active: false, connecting: false, error: null });
      setTimeout(checkCurrentIp, 1000);
    } catch (e) {
      setVpn({ connecting: false, error: e.message });
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <ShieldCheck size={14} className="text-flip-400" />
          VPN / Proxy
        </h2>
        <p className="text-[9px] text-white/25 mt-0.5">Route browser traffic through a proxy</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Connection status card */}
        <div className={clsx(
          'rounded-xl border p-3 transition-all',
          vpn.active
            ? 'border-accent-400/25 bg-accent-400/5'
            : 'border-white/[0.06] bg-white/[0.02]'
        )}>
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              vpn.active ? 'bg-accent-400/15' : 'bg-white/5'
            )}>
              {vpn.active
                ? <ShieldCheck size={16} className="text-accent-400" />
                : <Shield size={16} className="text-white/25" />
              }
            </div>
            <div className="flex-1">
              <div className={clsx(
                'text-[11px] font-semibold',
                vpn.active ? 'text-accent-400' : 'text-white/50'
              )}>
                {vpn.active ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-[9px] text-white/20">
                {vpn.active
                  ? `${vpn.type.toUpperCase()} · ${vpn.host}:${vpn.port}`
                  : 'Direct connection'
                }
              </div>
            </div>
            <div className={clsx(
              'w-2.5 h-2.5 rounded-full',
              vpn.active ? 'bg-accent-400 animate-pulse' : 'bg-white/15'
            )} />
          </div>

          {/* IP display */}
          {vpn.currentIp && (
            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-2">
              <Globe size={10} className="text-white/20" />
              <span className="text-[9px] text-white/30 font-mono">{vpn.currentIp}</span>
              <button
                onClick={checkCurrentIp}
                className="ml-auto p-0.5 rounded text-white/15 hover:text-white/40 transition-colors"
                title="Refresh IP"
              >
                <RefreshCw size={9} />
              </button>
            </div>
          )}
        </div>

        {/* Quick connect / disconnect */}
        {vpn.active ? (
          <button
            onClick={handleDisconnect}
            disabled={vpn.connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all text-[11px] font-medium disabled:opacity-50"
          >
            {vpn.connecting ? (
              <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <WifiOff size={13} />
            )}
            {vpn.connecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <>
            {/* Proxy server config */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-white/25 block mb-1">Host</label>
                  <input
                    type="text"
                    value={localHost}
                    onChange={(e) => setLocalHost(e.target.value)}
                    placeholder="e.g. proxy.example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 font-mono outline-none focus:border-flip-500/40 placeholder:text-white/10"
                  />
                </div>
                <div className="w-20">
                  <label className="text-[9px] text-white/25 block mb-1">Port</label>
                  <input
                    type="text"
                    value={localPort}
                    onChange={(e) => setLocalPort(e.target.value.replace(/\D/g, ''))}
                    placeholder="1080"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 font-mono outline-none focus:border-flip-500/40 placeholder:text-white/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-white/25 block mb-1">Protocol</label>
                <select
                  value={localType}
                  onChange={(e) => setLocalType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40"
                >
                  <option value="socks5">SOCKS5</option>
                  <option value="socks4">SOCKS4</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>

              {/* Auth toggle */}
              <button
                onClick={() => setShowAuth(!showAuth)}
                className="flex items-center gap-1.5 text-[9px] text-white/25 hover:text-white/40 transition-colors"
              >
                {showAuth ? <EyeOff size={9} /> : <Eye size={9} />}
                {showAuth ? 'Hide' : 'Show'} authentication
              </button>

              {showAuth && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-white/25 block mb-1">Username</label>
                    <input
                      type="text"
                      value={localUser}
                      onChange={(e) => setLocalUser(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/10"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-white/25 block mb-1">Password</label>
                    <input
                      type="password"
                      value={localPass}
                      onChange={(e) => setLocalPass(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/10"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Connect button */}
            <button
              onClick={handleConnect}
              disabled={vpn.connecting || !localHost || !localPort}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-flip-500/15 to-accent-400/15 border border-flip-500/20 text-flip-400 hover:from-flip-500/25 hover:to-accent-400/25 transition-all text-[11px] font-medium disabled:opacity-40"
            >
              {vpn.connecting ? (
                <div className="w-3 h-3 border-2 border-flip-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wifi size={13} />
              )}
              {vpn.connecting ? 'Connecting...' : 'Connect'}
            </button>
          </>
        )}

        {/* Error display */}
        {vpn.error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/15">
            <AlertTriangle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
            <span className="text-[9px] text-red-300">{vpn.error}</span>
          </div>
        )}

        {/* Info section */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-start gap-2">
            <Lock size={9} className="text-white/15 mt-0.5" />
            <span className="text-[9px] text-white/20 leading-relaxed">
              All browser traffic is routed through the proxy. DNS queries use encrypted DoH (Cloudflare).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={9} className="text-white/15 mt-0.5" />
            <span className="text-[9px] text-white/20 leading-relaxed">
              Combined with ad blocking, tracker protection, and fingerprint defense for maximum privacy.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle size={9} className="text-amber-400/30 mt-0.5" />
            <span className="text-[9px] text-white/20 leading-relaxed">
              Free proxies may be slow or unreliable. For best performance, use your own SOCKS5 or VPN provider.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Autofill View ───────────────────────────────────────────────
function AutofillView() {
  const { autofill, setAutofill } = useBrowserStore();
  const [tab, setTab] = useState('addresses'); // 'addresses' | 'payments'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    window.flipAPI?.getAutofill?.().then(data => { if (data) setAutofill(data); });
  }, []);

  function saveData(newData) {
    setAutofill(newData);
    window.flipAPI?.saveAutofill?.(newData);
  }

  function addAddress() {
    setEditing('new-addr');
    setForm({ name: '', street: '', city: '', state: '', zip: '', country: '', phone: '', email: '' });
  }

  function addPayment() {
    setEditing('new-pay');
    setForm({ label: '', number: '', expiry: '', name: '' });
  }

  function saveAddress() {
    const addresses = [...(autofill.addresses || []), { ...form, id: Date.now() }];
    saveData({ ...autofill, addresses });
    setEditing(null);
  }

  function savePayment() {
    const masked = { ...form, number: '****' + (form.number || '').slice(-4), id: Date.now() };
    const payments = [...(autofill.payments || []), masked];
    saveData({ ...autofill, payments });
    setEditing(null);
  }

  function deleteAddress(id) {
    saveData({ ...autofill, addresses: autofill.addresses.filter(a => a.id !== id) });
  }

  function deletePayment(id) {
    saveData({ ...autofill, payments: autofill.payments.filter(p => p.id !== id) });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <CreditCard size={14} className="text-flip-400" />
          Autofill
        </h2>
        <div className="flex gap-1 mt-2">
          {['addresses', 'payments'].map(t => (
            <button key={t} onClick={() => { setTab(t); setEditing(null); }}
              className={clsx('px-3 py-1 rounded-lg text-[10px] font-medium transition-all',
                tab === t ? 'bg-flip-500/15 text-flip-400' : 'text-white/30 hover:text-white/50'
              )}>{t === 'addresses' ? 'Addresses' : 'Payments'}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {tab === 'addresses' && (
          <>
            {(autofill.addresses || []).map(addr => (
              <div key={addr.id} className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/70 font-medium">{addr.name}</div>
                  <button onClick={() => deleteAddress(addr.id)} className="text-white/15 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                </div>
                <div className="text-[9px] text-white/30 mt-0.5">{addr.street}, {addr.city} {addr.state} {addr.zip}</div>
                {addr.email && <div className="text-[9px] text-white/20 mt-0.5">{addr.email}</div>}
              </div>
            ))}
            {editing === 'new-addr' ? (
              <div className="space-y-1.5 p-2.5 rounded-lg border border-flip-500/20 bg-flip-500/5">
                {['name', 'street', 'city', 'state', 'zip', 'country', 'phone', 'email'].map(f => (
                  <input key={f} type="text" placeholder={f.charAt(0).toUpperCase() + f.slice(1)} value={form[f] || ''}
                    onChange={e => setForm({ ...form, [f]: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                ))}
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => setEditing(null)} className="flex-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] text-white/40">Cancel</button>
                  <button onClick={saveAddress} className="flex-1 px-2 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/20 text-[9px] text-flip-400 font-medium">Save</button>
                </div>
              </div>
            ) : (
              <button onClick={addAddress} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-[10px] text-white/25 hover:text-white/40 hover:border-white/20 transition-all">
                <Plus size={11} /> Add Address
              </button>
            )}
          </>
        )}
        {tab === 'payments' && (
          <>
            {(autofill.payments || []).map(pay => (
              <div key={pay.id} className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/70 font-medium flex items-center gap-1.5">
                    <CreditCard size={10} className="text-white/25" />{pay.label || 'Card'}
                  </div>
                  <button onClick={() => deletePayment(pay.id)} className="text-white/15 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                </div>
                <div className="text-[9px] text-white/30 font-mono mt-0.5">{pay.number}</div>
                <div className="text-[9px] text-white/20">{pay.name} · {pay.expiry}</div>
              </div>
            ))}
            {editing === 'new-pay' ? (
              <div className="space-y-1.5 p-2.5 rounded-lg border border-flip-500/20 bg-flip-500/5">
                <input type="text" placeholder="Card Label (e.g. Personal Visa)" value={form.label || ''}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                <input type="text" placeholder="Card Number" value={form.number || ''}
                  onChange={e => setForm({ ...form, number: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 font-mono outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                <div className="flex gap-1.5">
                  <input type="text" placeholder="MM/YY" value={form.expiry || ''}
                    onChange={e => setForm({ ...form, expiry: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 font-mono outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                  <input type="text" placeholder="Name on Card" value={form.name || ''}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => setEditing(null)} className="flex-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] text-white/40">Cancel</button>
                  <button onClick={savePayment} className="flex-1 px-2 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/20 text-[9px] text-flip-400 font-medium">Save</button>
                </div>
              </div>
            ) : (
              <button onClick={addPayment} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-[10px] text-white/25 hover:text-white/40 hover:border-white/20 transition-all">
                <Plus size={11} /> Add Payment Method
              </button>
            )}
          </>
        )}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-start gap-2">
            <Lock size={9} className="text-white/15 mt-0.5" />
            <span className="text-[9px] text-white/20">Autofill data is encrypted and stored locally using OS-level encryption.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Notifications View ──────────────────────────────────────────
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

// ── Performance View ────────────────────────────────────────────
function PerformanceView() {
  const { tabs } = useBrowserStore();
  const [metrics, setMetrics] = useState([]);
  const [memInfo, setMemInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    const [m, mem] = await Promise.all([
      window.flipAPI?.getAppMetrics?.() || [],
      window.flipAPI?.getProcessMemory?.() || {},
    ]);
    setMetrics(m || []);
    setMemInfo(mem);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMetrics();
    const iv = setInterval(fetchMetrics, 3000);
    return () => clearInterval(iv);
  }, [fetchMetrics]);

  const totalMem = metrics.reduce((sum, m) => sum + (m.memory?.workingSetSize || 0), 0);
  const totalCpu = metrics.reduce((sum, m) => sum + (m.cpu?.percentCPUUsage || 0), 0);

  function formatKB(kb) {
    if (kb > 1048576) return (kb / 1048576).toFixed(1) + ' GB';
    if (kb > 1024) return (kb / 1024).toFixed(1) + ' MB';
    return kb + ' KB';
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <Activity size={14} className="text-flip-400" />
            Performance
          </h2>
          <button onClick={fetchMetrics} className="p-1 rounded-lg text-white/20 hover:text-white/50 transition-colors"><RefreshCw size={11} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1">
              <HardDrive size={10} className="text-sky-400/60" />
              <span className="text-[9px] text-white/30">Memory</span>
            </div>
            <div className="text-[13px] font-bold text-white/80">{formatKB(totalMem)}</div>
          </div>
          <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1">
              <Cpu size={10} className="text-amber-400/60" />
              <span className="text-[9px] text-white/30">CPU</span>
            </div>
            <div className="text-[13px] font-bold text-white/80">{totalCpu.toFixed(1)}%</div>
          </div>
          <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers size={10} className="text-accent-400/60" />
              <span className="text-[9px] text-white/30">Open Tabs</span>
            </div>
            <div className="text-[13px] font-bold text-white/80">{tabs.length}</div>
          </div>
          <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1">
              <ZapIcon size={10} className="text-emerald-400/60" />
              <span className="text-[9px] text-white/30">Processes</span>
            </div>
            <div className="text-[13px] font-bold text-white/80">{metrics.length}</div>
          </div>
        </div>

        {/* Process list */}
        <div>
          <div className="text-[10px] text-white/35 font-medium mb-1.5">Processes</div>
          <div className="space-y-1">
            {metrics.map((m, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01]">
                <div className={clsx('w-1.5 h-1.5 rounded-full',
                  m.type === 'Browser' ? 'bg-flip-400' : m.type === 'GPU' ? 'bg-amber-400' : 'bg-sky-400'
                )} />
                <span className="flex-1 text-[9px] text-white/50 truncate">{m.type}{m.name && m.name !== m.type ? ` · ${m.name}` : ''}</span>
                <span className="text-[8px] text-white/25 font-mono">{formatKB(m.memory?.workingSetSize || 0)}</span>
                <span className="text-[8px] text-white/25 font-mono w-10 text-right">{(m.cpu?.percentCPUUsage || 0).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[8px] text-white/10 text-center pt-1">Auto-refreshes every 3s</div>
      </div>
    </div>
  );
}

// ── Shortcuts View ──────────────────────────────────────────────
const SHORTCUT_LABELS = {
  newTab: 'New Tab',
  closeTab: 'Close Tab',
  reopenTab: 'Reopen Closed Tab',
  commandPalette: 'Command Palette',
  focusAddress: 'Focus Address Bar',
  toggleSidebar: 'Toggle Sidebar',
  splitView: 'Split View',
  devTools: 'Developer Tools',
  reload: 'Reload Page',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  zoomReset: 'Zoom Reset',
  pip: 'Picture-in-Picture',
};

function ShortcutsView() {
  const { shortcuts, setShortcuts } = useBrowserStore();
  const [recording, setRecording] = useState(null);

  useEffect(() => {
    window.flipAPI?.getShortcuts?.().then(s => { if (s) setShortcuts(s); });
  }, []);

  function startRecording(key) {
    setRecording(key);
  }

  useEffect(() => {
    if (!recording) return;
    function handleKey(e) {
      e.preventDefault();
      e.stopPropagation();
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Meta');
      const key = e.key;
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        const combo = parts.join('+');
        const updated = { ...shortcuts, [recording]: combo };
        setShortcuts(updated);
        window.flipAPI?.saveShortcuts?.(updated);
        setRecording(null);
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [recording, shortcuts]);

  function resetDefaults() {
    const defaults = {
      newTab: 'Ctrl+T', closeTab: 'Ctrl+W', reopenTab: 'Ctrl+Shift+T',
      commandPalette: 'Ctrl+K', focusAddress: 'Ctrl+L', toggleSidebar: 'Ctrl+B',
      splitView: 'Ctrl+Shift+S', devTools: 'F12', reload: 'Ctrl+R',
      zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', zoomReset: 'Ctrl+0', pip: 'Ctrl+Shift+P',
    };
    setShortcuts(defaults);
    window.flipAPI?.saveShortcuts?.(defaults);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <Keyboard size={14} className="text-flip-400" />
            Keyboard Shortcuts
          </h2>
          <button onClick={resetDefaults} className="text-[9px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1">
            <RotateCcw size={9} /> Reset
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {Object.entries(SHORTCUT_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <span className="text-[10px] text-white/50">{label}</span>
            <button
              onClick={() => startRecording(key)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-[9px] font-mono border transition-all',
                recording === key
                  ? 'border-flip-500/40 bg-flip-500/10 text-flip-400 animate-pulse'
                  : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
              )}
            >
              {recording === key ? 'Press keys...' : shortcuts[key] || '—'}
            </button>
          </div>
        ))}
        <div className="pt-2 border-t border-white/5 mt-2">
          <div className="flex items-start gap-2">
            <Keyboard size={9} className="text-white/15 mt-0.5" />
            <span className="text-[9px] text-white/20">Click a shortcut to rebind it. Press your desired key combination.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profiles View ───────────────────────────────────────────────
function ProfilesView() {
  const { profiles, setProfiles } = useBrowserStore();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const [switching, setSwitching] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    const result = await window.flipAPI?.createProfile(newName.trim());
    if (result?.error) { setError(result.error); return; }
    if (result?.profiles) setProfiles(result.profiles);
    setNewName('');
    setError(null);
  }

  async function handleSwitch(name) {
    if (name === profiles.active) return;
    setSwitching(true);
    const result = await window.flipAPI?.switchProfile(name);
    if (result?.profiles) {
      setProfiles(result.profiles);
      // Reload data for new profile
      const bm = await window.flipAPI.getBookmarks();
      if (bm) useBrowserStore.getState().setBookmarks(bm);
      const hist = await window.flipAPI.getHistory();
      if (hist) useBrowserStore.getState().setHistory(hist);
      const savedSettings = await window.flipAPI.getSettings();
      if (savedSettings) useBrowserStore.getState().updateSettings(savedSettings);
    }
    setSwitching(false);
  }

  async function handleDelete(name) {
    const result = await window.flipAPI?.deleteProfile(name);
    if (result?.error) { setError(result.error); return; }
    if (result?.profiles) setProfiles(result.profiles);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <UserCircle2 size={14} className="text-flip-400" />
          User Profiles
        </h2>
        <p className="text-[9px] text-white/25 mt-1">Each profile has separate bookmarks, history, and passwords.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {profiles.profiles?.map((p) => (
          <div
            key={p.name}
            className={clsx(
              'flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer',
              p.name === profiles.active
                ? 'border-flip-500/30 bg-flip-500/10'
                : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
            )}
            onClick={() => handleSwitch(p.name)}
          >
            <div className="flex items-center gap-2.5">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                p.name === profiles.active ? 'bg-flip-500/20 text-flip-400' : 'bg-white/5 text-white/40'
              )}>
                {p.name[0].toUpperCase()}
              </div>
              <div>
                <div className="text-[11px] text-white/80 font-medium">{p.name}</div>
                {p.name === profiles.active && (
                  <div className="text-[8px] text-flip-400 font-semibold uppercase tracking-wider">Active</div>
                )}
              </div>
            </div>
            {p.name !== 'Default' && p.name !== profiles.active && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                className="p-1 rounded-lg hover:bg-white/10 text-white/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        {switching && <div className="text-[10px] text-flip-400 text-center animate-pulse">Switching profile...</div>}
        {error && <div className="text-[10px] text-red-400 text-center">{error}</div>}
        <div className="pt-3 border-t border-white/5 mt-2">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New profile name..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/25 outline-none focus:border-flip-500/30"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/25 text-[10px] text-flip-400 font-medium hover:bg-flip-500/30 transition-colors disabled:opacity-30"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reader Settings View ────────────────────────────────────────
function ReaderSettingsView() {
  const { readerSettings, setReaderSettings } = useBrowserStore();
  const [local, setLocal] = useState({ ...readerSettings });

  function update(partial) {
    const next = { ...local, ...partial };
    setLocal(next);
    setReaderSettings(next);
    window.flipAPI?.saveReaderSettings(next);
  }

  const BG_PRESETS = [
    { label: 'Dark', bg: '#1a1a1a', text: '#e0e0e0' },
    { label: 'Sepia', bg: '#f4ecd8', text: '#5b4636' },
    { label: 'Light', bg: '#ffffff', text: '#1a1a1a' },
    { label: 'Night', bg: '#0d1117', text: '#c9d1d9' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <BookOpenCheck size={14} className="text-flip-400" />
          Reader Settings
        </h2>
        <p className="text-[9px] text-white/25 mt-1">Customize reading mode appearance.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Font size */}
        <div>
          <label className="text-[10px] text-white/40 mb-1.5 block">Font Size: {local.fontSize}px</label>
          <input
            type="range"
            min={12}
            max={32}
            value={local.fontSize}
            onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
            className="w-full accent-flip-500"
          />
          <div className="flex justify-between text-[8px] text-white/20 mt-0.5">
            <span>12px</span><span>32px</span>
          </div>
        </div>

        {/* Font family */}
        <div>
          <label className="text-[10px] text-white/40 mb-1.5 block">Font Family</label>
          <div className="flex gap-2">
            {['serif', 'sans', 'mono'].map((ff) => (
              <button
                key={ff}
                onClick={() => update({ fontFamily: ff })}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg border text-[10px] font-medium transition-all',
                  local.fontFamily === ff
                    ? 'border-flip-500/30 bg-flip-500/10 text-flip-400'
                    : 'border-white/10 bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'
                )}
                style={{ fontFamily: ff === 'serif' ? 'Georgia, serif' : ff === 'sans' ? 'system-ui, sans-serif' : 'monospace' }}
              >
                {ff === 'serif' ? 'Serif' : ff === 'sans' ? 'Sans' : 'Mono'}
              </button>
            ))}
          </div>
        </div>

        {/* Background presets */}
        <div>
          <label className="text-[10px] text-white/40 mb-1.5 block">Theme</label>
          <div className="grid grid-cols-2 gap-2">
            {BG_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => update({ bgColor: preset.bg, textColor: preset.text })}
                className={clsx(
                  'px-3 py-2.5 rounded-lg border text-[10px] font-medium transition-all',
                  local.bgColor === preset.bg
                    ? 'border-flip-500/30 ring-1 ring-flip-500/20'
                    : 'border-white/10 hover:border-white/20'
                )}
                style={{ background: preset.bg, color: preset.text }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mt-2">
          <label className="text-[10px] text-white/40 mb-1.5 block">Preview</label>
          <div
            className="rounded-lg p-4 border border-white/10"
            style={{ background: local.bgColor, color: local.textColor, fontFamily: local.fontFamily === 'serif' ? 'Georgia, serif' : local.fontFamily === 'sans' ? 'system-ui, sans-serif' : 'monospace', fontSize: `${local.fontSize}px`, lineHeight: 1.8 }}
          >
            The quick brown fox jumps over the lazy dog. Reading mode makes articles clean and focused.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Site-Specific Settings View ─────────────────────────────────
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

function CtxItem({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
    >
      {Icon && <Icon size={12} className="text-white/30" />}
      {label}
    </button>
  );
}
