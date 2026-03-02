import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Layers, Activity, Cpu, HardDrive, Zap as ZapIcon, Palette } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

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

        {/* Tab Suspend Stats */}
        {(() => {
          const stats = useBrowserStore.getState().getSuspendStats();
          return (
            <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/35 font-medium">Tab Suspend</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => useBrowserStore.getState().autoSuspendInactiveTabs(0)}
                    className="text-[8px] px-1.5 py-0.5 rounded bg-accent-400/10 text-accent-400/70 hover:text-accent-400 transition-colors"
                  >Suspend All Inactive</button>
                  {stats.suspended > 0 && (
                    <button
                      onClick={() => useBrowserStore.getState().unsuspendAll()}
                      className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 hover:text-white/60 transition-colors"
                    >Wake All</button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="text-center">
                  <div className="text-[11px] font-bold text-white/70">{stats.active}</div>
                  <div className="text-[7px] text-white/20">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold text-accent-400/70">{stats.suspended}</div>
                  <div className="text-[7px] text-white/20">Suspended</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold text-emerald-400/70">{stats.estimatedSavedMB > 0 ? `~${stats.estimatedSavedMB}MB` : '—'}</div>
                  <div className="text-[7px] text-white/20">Est. Saved</div>
                </div>
              </div>
              {/* Memory bar */}
              {stats.total > 1 && (
                <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-400/60 to-emerald-400/40 transition-all"
                    style={{ width: `${Math.round((stats.active / stats.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })()}

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

export default PerformanceView;
