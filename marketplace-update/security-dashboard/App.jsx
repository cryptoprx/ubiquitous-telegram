const { useState, useEffect, useCallback, useRef } = React;

const ACCENT = '#6366f1';
const ACCENT_BG = 'rgba(99,102,241,0.10)';
const GREEN = '#22c55e';
const GREEN_BG = 'rgba(34,197,94,0.10)';
const RED = '#ef4444';
const RED_BG = 'rgba(239,68,68,0.08)';
const AMBER = '#f59e0b';
const AMBER_BG = 'rgba(245,158,11,0.08)';
const CARD_BG = 'rgba(255,255,255,0.025)';
const CARD_BORDER = 'rgba(255,255,255,0.06)';
const MUTED = 'rgba(255,255,255,0.35)';
const TEXT = 'rgba(255,255,255,0.8)';

const I = {
  shield: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  shieldCheck: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  shieldX: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>,
  wifi: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  globe: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  activity: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  alert: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  refresh: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  play: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>,
  server: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
  zap: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  file: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  eye: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  lock: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  loader: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>,
  radio: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>,
  hdd: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>,
  check: (s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 5 13"/></svg>,
};

function Icon({ name, size=16, color='currentColor' }) {
  const fn = I[name];
  return fn ? fn(size, color) : null;
}

const SEVERITY_STYLES = {
  high:   { bg: RED_BG, border: 'rgba(239,68,68,0.2)', color: RED, label: 'HIGH' },
  medium: { bg: AMBER_BG, border: 'rgba(245,158,11,0.2)', color: AMBER, label: 'MED' },
  low:    { bg: 'rgba(255,255,255,0.03)', border: CARD_BORDER, color: MUTED, label: 'LOW' },
};

const STATE_COLORS = {
  ESTABLISHED: GREEN,
  TIME_WAIT: AMBER,
  CLOSE_WAIT: AMBER,
  SYN_SENT: '#3b82f6',
  LISTENING: ACCENT,
  STATELESS: MUTED,
};

function Dot({ color, size=6 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function App() {
  const [tab, setTab] = useState('overview');
  const [connections, setConnections] = useState(null);
  const [listening, setListening] = useState(null);
  const [threats, setThreats] = useState(null);
  const [startup, setStartup] = useState(null);
  const [processNames, setProcessNames] = useState({});
  const [loading, setLoading] = useState({});
  const [lastScan, setLastScan] = useState(null);
  const [adblockStats, setAdblockStats] = useState(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [settings, setSettings] = useState(null);
  const [diskUsage, setDiskUsage] = useState(null);
  const [proxyStatus, setProxyStatus] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const setLoad = (key, val) => setLoading(p => ({ ...p, [key]: val }));

  const loadAll = async () => {
    loadConnections();
    loadThreats();
    loadListening();
    loadStartup();
    loadProtectionStatus();
  };

  const loadProtectionStatus = async () => {
    try {
      const [stats, blocked, secStatus, disk, proxy] = await Promise.all([
        Flip.adblock.getStats().catch(() => null),
        Flip.adblock.getBlockedCount().catch(() => 0),
        Flip.browser.getSecurityStatus().catch(() => null),
        Flip.fs.getDiskUsage().catch(() => null),
        Flip.proxy.getStatus().catch(() => null),
      ]);
      setAdblockStats(stats);
      setBlockedCount(typeof blocked === 'number' ? blocked : 0);
      setSettings(secStatus);
      setDiskUsage(disk);
      setProxyStatus(proxy);
    } catch {}
  };

  const loadConnections = async () => {
    setLoad('conn', true);
    try {
      const res = await Flip.security.getConnections();
      setConnections(res?.connections || []);
      const pids = [...new Set((res?.connections || []).map(c => c.pid).filter(Boolean))];
      for (const pid of pids.slice(0, 30)) {
        try {
          const r = await Flip.security.getProcessName(pid);
          if (r?.name) setProcessNames(p => ({ ...p, [pid]: r.name }));
        } catch {}
      }
    } catch {}
    setLoad('conn', false);
  };

  const loadListening = async () => {
    setLoad('listen', true);
    try {
      const res = await Flip.security.getListening();
      setListening(res?.ports || []);
      const pids = [...new Set((res?.ports || []).map(c => c.pid).filter(Boolean))];
      for (const pid of pids.slice(0, 30)) {
        if (processNames[pid]) continue;
        try {
          const r = await Flip.security.getProcessName(pid);
          if (r?.name) setProcessNames(p => ({ ...p, [pid]: r.name }));
        } catch {}
      }
    } catch {}
    setLoad('listen', false);
  };

  const loadThreats = async () => {
    setLoad('threats', true);
    try {
      const res = await Flip.security.scan();
      setThreats(res?.threats || []);
      setLastScan(new Date());
    } catch {}
    setLoad('threats', false);
  };

  const loadStartup = async () => {
    setLoad('startup', true);
    try {
      const res = await Flip.security.getStartup();
      setStartup(res?.items || []);
    } catch {}
    setLoad('startup', false);
  };

  const highThreats = (threats || []).filter(t => t.severity === 'high').length;
  const medThreats = (threats || []).filter(t => t.severity === 'medium').length;
  const totalConns = (connections || []).length;
  const establishedConns = (connections || []).filter(c => c.state === 'ESTABLISHED').length;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'shield' },
    { id: 'connections', label: 'Network', icon: 'globe' },
    { id: 'threats', label: 'Threats', icon: 'alert' },
    { id: 'startup', label: 'Startup', icon: 'zap' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: highThreats > 0 ? RED_BG : GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={highThreats > 0 ? 'shieldX' : 'shieldCheck'} size={16} color={highThreats > 0 ? RED : GREEN} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'white' }}>Security</div>
            <div style={{ fontSize: 10, color: MUTED }}>{highThreats > 0 ? `${highThreats} threat(s) found` : 'System looks clean'}</div>
          </div>
        </div>
        <button onClick={loadAll} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 6, cursor: 'pointer' }}>
          <Icon name="refresh" size={13} color={MUTED} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 3, marginBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500,
              background: tab === t.id ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: tab === t.id ? 'white' : MUTED,
              transition: 'all 0.15s',
            }}>
            <Icon name={t.icon} size={11} color={tab === t.id ? ACCENT : MUTED} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tab === 'overview' && (
          <OverviewTab
            connections={connections} threats={threats} listening={listening} startup={startup}
            highThreats={highThreats} medThreats={medThreats}
            totalConns={totalConns} establishedConns={establishedConns}
            lastScan={lastScan} loading={loading}
            onScan={loadThreats} onRefreshConns={loadConnections}
            adblockStats={adblockStats} blockedCount={blockedCount}
            settings={settings} diskUsage={diskUsage} proxyStatus={proxyStatus}
          />
        )}
        {tab === 'connections' && (
          <ConnectionsTab connections={connections} processNames={processNames} loading={loading.conn} onRefresh={loadConnections} />
        )}
        {tab === 'threats' && (
          <ThreatsTab threats={threats} loading={loading.threats} onScan={loadThreats} lastScan={lastScan} />
        )}
        {tab === 'startup' && (
          <StartupTab startup={startup} loading={loading.startup} onRefresh={loadStartup} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ connections, threats, listening, startup, highThreats, medThreats, totalConns, establishedConns, lastScan, loading, onScan, onRefreshConns, adblockStats, blockedCount, settings, diskUsage, proxyStatus }) {
  const isClean = highThreats === 0 && medThreats === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Status banner */}
      <div style={{
        background: isClean ? GREEN_BG : RED_BG,
        border: `1px solid ${isClean ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        borderRadius: 12, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: isClean ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={isClean ? 'shieldCheck' : 'shieldX'} size={18} color={isClean ? GREEN : RED} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: isClean ? GREEN : RED }}>
            {isClean ? 'No Threats Detected' : `${highThreats + medThreats} Threat(s) Found`}
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>
            {lastScan ? `Last scan: ${lastScan.toLocaleTimeString()}` : 'Run a scan to check'}
          </div>
        </div>
      </div>

      {/* Protection status cards */}
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Protection Status</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <ProtectionBadge label="Ad Blocker" active={settings?.adBlock !== false} icon="shield" />
        <ProtectionBadge label="Tracking" active={settings?.trackingProtection !== false} icon="eye" />
        <ProtectionBadge label="VPN" active={proxyStatus?.active === true} icon="globe" />
      </div>

      {/* Quick stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <StatCard icon="globe" label="Connections" value={totalConns ?? '—'} sub={`${establishedConns} active`} color="#3b82f6" loading={loading.conn} />
        <StatCard icon="radio" label="Listening" value={listening?.length ?? '—'} sub="open ports" color={ACCENT} loading={loading.listen} />
        <StatCard icon="alert" label="Threats" value={(threats?.length ?? '—')} sub={highThreats > 0 ? `${highThreats} high` : 'none found'} color={highThreats > 0 ? RED : GREEN} loading={loading.threats} />
        <StatCard icon="zap" label="Startup" value={startup?.length ?? '—'} sub="auto-run items" color={AMBER} loading={loading.startup} />
        <StatCard icon="shield" label="Blocked" value={blockedCount.toLocaleString()} sub="requests this session" color={GREEN} />
        <StatCard icon="hdd" label="Disk" value={diskUsage ? Math.round((diskUsage.used / diskUsage.total) * 100) + '%' : '—'} sub={diskUsage ? `${formatBytes(diskUsage.free)} free` : 'checking...'} color={diskUsage && (diskUsage.free / diskUsage.total) < 0.1 ? RED : '#06b6d4'} />
      </div>

      {/* Ad blocker details */}
      {adblockStats && (
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Icon name="shield" size={12} color={GREEN} />
            <span style={{ fontSize: 10, fontWeight: 600, color: TEXT }}>Ad Blocker Details</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9, color: MUTED }}>
            <div>Filter rules: <strong style={{ color: TEXT }}>{(adblockStats.totalFilters || 0).toLocaleString()}</strong></div>
            <div>Blocked domains: <strong style={{ color: TEXT }}>{(adblockStats.blockedDomains || 0).toLocaleString()}</strong></div>
            <div>Pattern rules: <strong style={{ color: TEXT }}>{(adblockStats.patternRules || 0).toLocaleString()}</strong></div>
            <div>Cosmetic rules: <strong style={{ color: TEXT }}>{(adblockStats.cosmeticRules || 0).toLocaleString()}</strong></div>
            <div>Lists loaded: <strong style={{ color: TEXT }}>{(adblockStats.listsLoaded || []).length}</strong></div>
            <div>Whitelisted: <strong style={{ color: TEXT }}>{adblockStats.whitelistedSites || 0} sites</strong></div>
          </div>
        </div>
      )}

      {/* Scan button */}
      <button onClick={onScan} disabled={loading.threats}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, color: 'white',
          fontSize: 12, fontWeight: 600, opacity: loading.threats ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
        <Icon name={loading.threats ? 'loader' : 'play'} size={13} color="white" />
        {loading.threats ? 'Scanning...' : 'Run Threat Scan'}
      </button>

      {/* Top connections preview */}
      {connections && connections.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Connections</div>
          {connections.slice(0, 5).map((c, i) => (
            <MiniConnectionRow key={i} conn={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProtectionBadge({ label, active, icon }) {
  return (
    <div style={{
      background: active ? GREEN_BG : RED_BG,
      border: `1px solid ${active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`,
      borderRadius: 8, padding: '6px 8px', textAlign: 'center',
    }}>
      <Icon name={icon} size={14} color={active ? GREEN : RED} />
      <div style={{ fontSize: 9, fontWeight: 600, color: active ? GREEN : RED, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 8, color: MUTED }}>{active ? 'ON' : 'OFF'}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, loading: isLoading }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon name={icon} size={12} color={color} />
        <span style={{ fontSize: 10, color: MUTED, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'white', lineHeight: 1 }}>
        {isLoading ? <span style={{ fontSize: 11, color: MUTED }}>...</span> : value}
      </div>
      <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function MiniConnectionRow({ conn }) {
  const remoteIp = conn.remote?.split(':')[0] || '?';
  const remotePort = conn.remote?.split(':').pop() || '?';
  const stColor = STATE_COLORS[conn.state] || MUTED;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 10 }}>
      <Dot color={stColor} />
      <span style={{ color: TEXT, flex: 1, fontFamily: 'monospace', fontSize: 10 }}>{remoteIp}</span>
      <span style={{ color: MUTED }}>:{remotePort}</span>
      <span style={{ color: stColor, fontSize: 9, fontWeight: 500 }}>{conn.state}</span>
    </div>
  );
}

function ConnectionsTab({ connections, processNames, loading, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = (connections || []).filter(c => {
    if (filter !== 'all' && c.state !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.remote?.toLowerCase().includes(q) || c.local?.toLowerCase().includes(q) || (processNames[c.pid] || '').toLowerCase().includes(q);
    }
    return true;
  });

  const stateCounts = {};
  (connections || []).forEach(c => { stateCounts[c.state] = (stateCounts[c.state] || 0) + 1; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search IP, port, process..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: '6px 10px', color: TEXT, fontSize: 10, outline: 'none' }}
        />
        <button onClick={onRefresh} disabled={loading}
          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 6, cursor: 'pointer', opacity: loading ? 0.4 : 1 }}>
          <Icon name="refresh" size={12} color={MUTED} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Pill label="All" count={connections?.length || 0} active={filter === 'all'} onClick={() => setFilter('all')} color={ACCENT} />
        {Object.entries(stateCounts).sort((a,b) => b[1] - a[1]).map(([state, count]) => (
          <Pill key={state} label={state} count={count} active={filter === state} onClick={() => setFilter(state)} color={STATE_COLORS[state] || MUTED} />
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: MUTED, fontSize: 11 }}>Loading connections...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: MUTED, fontSize: 11 }}>No connections found</div>
      ) : (
        filtered.map((c, i) => <ConnectionRow key={i} conn={c} processName={processNames[c.pid]} />)
      )}
    </div>
  );
}

function ConnectionRow({ conn, processName }) {
  const remoteIp = conn.remote?.split(':')[0] || '?';
  const remotePort = conn.remote?.split(':').pop() || '?';
  const localPort = conn.local?.split(':').pop() || '?';
  const stColor = STATE_COLORS[conn.state] || MUTED;

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Dot color={stColor} />
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT, flex: 1 }}>{remoteIp}</span>
        <span style={{ fontSize: 9, color: stColor, fontWeight: 600, background: `${stColor}15`, padding: '1px 6px', borderRadius: 6 }}>{conn.state}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 9, color: MUTED, paddingLeft: 12 }}>
        <span>Remote <strong style={{ color: TEXT }}>:{remotePort}</strong></span>
        <span>Local <strong style={{ color: TEXT }}>:{localPort}</strong></span>
        <span>{conn.proto}</span>
        {processName && <span style={{ color: 'rgba(255,255,255,0.5)' }}>{processName}</span>}
        {conn.pid && <span>PID {conn.pid}</span>}
      </div>
    </div>
  );
}

function ThreatsTab({ threats, loading, onScan, lastScan }) {
  const [severityFilter, setSeverityFilter] = useState('all');

  const filtered = (threats || []).filter(t => severityFilter === 'all' || t.severity === severityFilter);
  const highCount = (threats || []).filter(t => t.severity === 'high').length;
  const medCount = (threats || []).filter(t => t.severity === 'medium').length;
  const lowCount = (threats || []).filter(t => t.severity === 'low').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onScan} disabled={loading}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, color: 'white',
            fontSize: 11, fontWeight: 600, opacity: loading ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <Icon name={loading ? 'loader' : 'play'} size={12} color="white" />
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
        {lastScan && <span style={{ fontSize: 9, color: MUTED }}>{lastScan.toLocaleTimeString()}</span>}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <Pill label="All" count={(threats || []).length} active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')} color={ACCENT} />
        {highCount > 0 && <Pill label="High" count={highCount} active={severityFilter === 'high'} onClick={() => setSeverityFilter('high')} color={RED} />}
        {medCount > 0 && <Pill label="Medium" count={medCount} active={severityFilter === 'medium'} onClick={() => setSeverityFilter('medium')} color={AMBER} />}
        {lowCount > 0 && <Pill label="Low" count={lowCount} active={severityFilter === 'low'} onClick={() => setSeverityFilter('low')} color={MUTED} />}
      </div>

      {!threats ? (
        <div style={{ textAlign: 'center', padding: 30, color: MUTED, fontSize: 11 }}>Run a scan to check for threats</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <Icon name="shieldCheck" size={28} color={GREEN} />
          <div style={{ fontSize: 12, fontWeight: 600, color: GREEN, marginTop: 8 }}>All Clear</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>No threats in this category</div>
        </div>
      ) : (
        filtered.map((t, i) => <ThreatRow key={i} threat={t} />)
      )}
    </div>
  );
}

function ThreatRow({ threat }) {
  const sev = SEVERITY_STYLES[threat.severity] || SEVERITY_STYLES.low;
  return (
    <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon name="alert" size={12} color={sev.color} />
        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{threat.file}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: sev.color, background: `${sev.color}18`, padding: '1px 6px', borderRadius: 6, textTransform: 'uppercase' }}>{sev.label}</span>
      </div>
      <div style={{ fontSize: 9, color: MUTED, paddingLeft: 18 }}>
        <div>{threat.detail}</div>
        <div style={{ marginTop: 2 }}>Location: <strong style={{ color: 'rgba(255,255,255,0.5)' }}>{threat.folder}</strong></div>
      </div>
    </div>
  );
}

function StartupTab({ startup, loading, onRefresh }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Auto-Start Programs ({startup?.length || 0})
        </div>
        <button onClick={onRefresh} disabled={loading}
          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 5, cursor: 'pointer', opacity: loading ? 0.4 : 1 }}>
          <Icon name="refresh" size={11} color={MUTED} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: MUTED, fontSize: 11 }}>Loading startup items...</div>
      ) : !startup || startup.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: MUTED, fontSize: 11 }}>No startup items found</div>
      ) : (
        startup.map((item, i) => <StartupRow key={i} item={item} />)
      )}

      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Icon name="eye" size={11} color={ACCENT} />
          <span style={{ fontSize: 10, fontWeight: 600, color: TEXT }}>What are startup items?</span>
        </div>
        <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.5 }}>
          These programs launch automatically when Windows starts. Unwanted startup entries can slow boot time and may indicate malware persistence. Review items you don't recognize.
        </div>
      </div>
    </div>
  );
}

function StartupRow({ item }) {
  const isRegistry = item.source?.includes('Registry');
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <Icon name={isRegistry ? 'server' : 'file'} size={11} color={isRegistry ? AMBER : ACCENT} />
        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
      </div>
      <div style={{ fontSize: 9, color: MUTED, paddingLeft: 17 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 500, color: isRegistry ? AMBER : ACCENT, background: isRegistry ? AMBER_BG : ACCENT_BG, padding: '1px 5px', borderRadius: 4 }}>{item.source}</span>
        </div>
        <div style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.path}</div>
      </div>
    </div>
  );
}

function Pill({ label, count, active, onClick, color }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? `${color}15` : 'rgba(255,255,255,0.02)',
        border: active ? `1px solid ${color}40` : `1px solid ${CARD_BORDER}`,
        borderRadius: 12, padding: '3px 8px', fontSize: 9, fontWeight: 500,
        color: active ? color : MUTED, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
      {label} <span style={{ opacity: 0.6 }}>{count}</span>
    </button>
  );
}
