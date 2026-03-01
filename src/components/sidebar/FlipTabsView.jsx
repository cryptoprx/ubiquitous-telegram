import React, { useState } from 'react';
import { Globe, Plus, X, Pin, Search, ChevronDown, Layers, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';
import { STACK_COLORS, getDomain } from './tabHelpers';
import TabCard from './TabCard';

function FlipTabsView({ tabs: allTabs, pinnedTabs, activeTabId, searchQuery, setSearchQuery, setActiveTab, closeTab, addTab, handleTabContext }) {
  const { tabStacks, toggleStack, tabGroups, toggleTabGroup, createTabGroup, deleteTabGroup, renameTabGroup,
    workspaces, activeWorkspaceId, saveWorkspace, switchWorkspace, loadWorkspace, deleteWorkspace, renameWorkspace, createWorkspaceFromTemplate,
  } = useBrowserStore();
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [wsName, setWsName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingWs, setEditingWs] = useState(null);
  const [editWsName, setEditWsName] = useState('');

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
          <div className="mx-2 mb-2 flex items-center gap-2">
            <button
              onClick={() => setShowNewGroup(true)}
              className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/50 transition-colors"
            >
              <Plus size={10} /> New Group
            </button>
            <button
              onClick={() => useBrowserStore.getState().autoGroupByDomain()}
              className="flex items-center gap-1 text-[10px] text-white/25 hover:text-accent-400/70 transition-colors"
              title="Auto-group tabs by domain"
            >
              <Layers size={9} /> Auto
            </button>
            {Object.keys(tabGroups).length > 0 && (
              <button
                onClick={() => useBrowserStore.getState().ungroupAll()}
                className="flex items-center gap-1 text-[10px] text-white/25 hover:text-red-400/70 transition-colors"
                title="Remove all groups"
              >
                <X size={9} /> Clear
              </button>
            )}
          </div>
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
            <div className="flex items-center justify-between px-1">
              <div className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">Workspaces</div>
              <span className="text-[7px] text-white/15">Ctrl+Alt+1-9</span>
            </div>

            {/* Active workspace indicator */}
            {activeWorkspaceId && (() => {
              const aws = workspaces.find(w => w.id === activeWorkspaceId);
              return aws ? (
                <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-flip-500/10 border border-flip-500/20">
                  <div className="w-2 h-2 rounded-full" style={{ background: aws.color || '#f97316' }} />
                  <span className="text-[9px] text-flip-400 font-medium truncate">{aws.name}</span>
                  <span className="text-[7px] text-white/20 ml-auto">active</span>
                </div>
              ) : null;
            })()}

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

            {/* Templates */}
            <div>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-[8px] text-white/25 hover:text-white/50 transition-colors px-1"
              >
                {showTemplates ? '▾ Templates' : '▸ Templates'}
              </button>
              {showTemplates && (
                <div className="flex flex-wrap gap-1 mt-1 px-1">
                  {['development', 'research', 'shopping', 'social'].map(tpl => (
                    <button
                      key={tpl}
                      onClick={() => { createWorkspaceFromTemplate(tpl); setShowTemplates(false); }}
                      className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[8px] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors capitalize"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Saved workspaces list */}
            {workspaces.length === 0 && (
              <div className="text-[9px] text-white/15 px-1 italic">No saved workspaces</div>
            )}
            {workspaces.map((ws, idx) => (
              <div
                key={ws.id}
                className={clsx(
                  'flex items-center gap-1.5 px-1.5 py-1 rounded-lg group/ws transition-colors',
                  activeWorkspaceId === ws.id ? 'bg-flip-500/8 border border-flip-500/15' : 'hover:bg-white/[0.03]'
                )}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ws.color || '#f97316' }} />
                <div className="flex-1 min-w-0">
                  {editingWs === ws.id ? (
                    <input
                      className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white outline-none w-full"
                      value={editWsName}
                      onChange={e => setEditWsName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && editWsName.trim()) { renameWorkspace(ws.id, editWsName.trim()); setEditingWs(null); }
                        if (e.key === 'Escape') setEditingWs(null);
                      }}
                      onBlur={() => { if (editWsName.trim()) renameWorkspace(ws.id, editWsName.trim()); setEditingWs(null); }}
                      autoFocus
                    />
                  ) : (
                    <div
                      className="text-[10px] text-white/50 truncate font-medium cursor-pointer"
                      onDoubleClick={() => { setEditingWs(ws.id); setEditWsName(ws.name); }}
                    >
                      {ws.name}
                    </div>
                  )}
                  <div className="text-[8px] text-white/20">{ws.tabs.length} tabs{idx < 9 ? ` · Ctrl+Alt+${idx + 1}` : ''}</div>
                </div>
                <button
                  onClick={() => switchWorkspace(ws.id)}
                  className={clsx(
                    'px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors',
                    activeWorkspaceId === ws.id
                      ? 'text-flip-400/50'
                      : 'text-accent-400/70 hover:text-accent-400 hover:bg-accent-400/10 opacity-0 group-hover/ws:opacity-100'
                  )}
                >
                  {activeWorkspaceId === ws.id ? 'Active' : 'Switch'}
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

export default FlipTabsView;
