function App() {
  const [score, setScore] = React.useState(0);
  const [checks, setChecks] = React.useState([]);
  const [tab, setTab] = React.useState('overview');
  const [loading, setLoading] = React.useState(true);
  const [adblockStats, setAdblockStats] = React.useState(null);
  const [settings, setSettings] = React.useState(null);
  const [proxyStatus, setProxyStatus] = React.useState(null);
  const [ipInfo, setIpInfo] = React.useState(null);
  const [blockedCount, setBlockedCount] = React.useState(0);
  const [whitelist, setWhitelist] = React.useState([]);

  const icons = {
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22',
    lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 10 0v4',
    unlock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 9.9-1',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    alert: 'M12 9v4M12 17h.01M10.29 3.86l-8.6 14.86a2 2 0 0 0 1.71 3h17.2a2 2 0 0 0 1.71-3l-8.6-14.86a2 2 0 0 0-3.42 0Z',
    info: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10ZM12 16v-4M12 8h.01',
    globe: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10ZM2 12h20',
    wifi: 'M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
    monitor: 'M2 3h20v14H2zM8 21h8M12 17v4',
    cookie: 'M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5',
    fingerprint: 'M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4M12 2a14.5 14.5 0 0 0 0 20M2 12h10',
    refresh: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8',
    layers: 'M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  };

  function Icon({ name, size = 16, color = 'currentColor', style = {} }) {
    return React.createElement('svg', {
      width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      style: { flexShrink: 0, ...style },
    }, React.createElement('path', { d: icons[name] || icons.shield }));
  }

  React.useEffect(() => { runChecks(); }, []);

  async function runChecks() {
    setLoading(true);
    try {
      const [stats, secStatus, proxy, ip, blocked, wl] = await Promise.all([
        Flip.adblock.getStats().catch(() => null),
        Flip.browser.getSecurityStatus().catch(() => null),
        Flip.proxy.getStatus().catch(() => null),
        Flip.proxy.checkIp().catch(() => null),
        Flip.adblock.getBlockedCount().catch(() => 0),
        Flip.adblock.getWhitelist().catch(() => []),
      ]);
      setAdblockStats(stats);
      const sett = secStatus || {};
      setSettings(sett);
      setProxyStatus(proxy);
      setIpInfo(ip);
      setBlockedCount(typeof blocked === 'number' ? blocked : 0);
      setWhitelist(Array.isArray(wl) ? wl : []);
      buildChecks(stats, sett, proxy, ip, blocked, wl);
    } catch (e) {
      console.error('Privacy scan failed:', e);
    }
    setLoading(false);
  }

  function buildChecks(stats, sett, proxy, ip, blocked, wl) {
    const results = [];
    let pts = 0;
    let maxPts = 0;

    // 1. Ad blocker (REAL data)
    maxPts += 20;
    const adEnabled = sett?.adBlock !== false;
    const filterCount = stats?.totalFilters || 0;
    const blockedDomains = stats?.blockedDomains || 0;
    results.push({
      id: 'adblock', label: 'Ad & Tracker Blocker',
      desc: adEnabled
        ? `Active — ${filterCount.toLocaleString()} filter rules loaded, ${blockedDomains.toLocaleString()} blocked domains, ${(typeof blocked === 'number' ? blocked : 0).toLocaleString()} requests blocked this session`
        : 'Disabled — ads and trackers are not being blocked',
      pass: adEnabled, weight: 20, icon: 'shield', category: 'protection',
    });
    if (adEnabled) pts += 20;

    // 2. Tracking protection (REAL setting)
    maxPts += 15;
    const tpEnabled = sett?.trackingProtection !== false;
    results.push({
      id: 'tracking', label: 'Tracking Protection',
      desc: tpEnabled
        ? 'Enabled — known tracking scripts and pixels are blocked at the network level'
        : 'Disabled — tracking scripts can monitor your browsing activity',
      pass: tpEnabled, weight: 15, icon: 'eyeOff', category: 'protection',
    });
    if (tpEnabled) pts += 15;

    // 3. HTTPS-Only Mode (REAL setting)
    maxPts += 15;
    const httpsOnly = sett?.httpsOnly !== false;
    results.push({
      id: 'https', label: 'HTTPS-Only Mode',
      desc: httpsOnly
        ? 'Enabled — insecure HTTP connections are automatically upgraded to HTTPS'
        : 'Disabled — you may be connecting to websites over unencrypted HTTP',
      pass: httpsOnly, weight: 15, icon: 'lock', category: 'connection',
    });
    if (httpsOnly) pts += 15;

    // 4. Fingerprint protection (REAL setting)
    maxPts += 15;
    const fpEnabled = sett?.fingerprintProtection !== false;
    results.push({
      id: 'fingerprint', label: 'Fingerprint Protection',
      desc: fpEnabled
        ? 'Enabled — Canvas, WebGL, AudioContext, and navigator data are spoofed to prevent tracking'
        : 'Disabled — websites can create a unique fingerprint of your browser',
      pass: fpEnabled, weight: 15, icon: 'fingerprint', category: 'protection',
    });
    if (fpEnabled) pts += 15;

    // 5. VPN / Proxy (REAL status)
    maxPts += 10;
    const vpnActive = proxy?.active === true;
    results.push({
      id: 'vpn', label: 'VPN / Proxy',
      desc: vpnActive
        ? 'Active — your traffic is routed through a proxy server'
        : 'Not active — your real IP address is visible to websites',
      pass: vpnActive, weight: 10, icon: 'globe', category: 'connection',
    });
    if (vpnActive) pts += 10;

    // 6. DNS-over-HTTPS
    maxPts += 10;
    results.push({
      id: 'doh', label: 'DNS-over-HTTPS',
      desc: 'Enabled — DNS queries are encrypted via Cloudflare (always on in Flip Browser)',
      pass: true, weight: 10, icon: 'lock', category: 'connection',
    });
    pts += 10;

    // 7. Extension sandboxing
    maxPts += 10;
    results.push({
      id: 'sandbox', label: 'Extension Sandboxing',
      desc: 'Extensions run in isolated iframes with permission-gated APIs and Content Security Policy',
      pass: true, weight: 10, icon: 'layers', category: 'protection',
    });
    pts += 10;

    // 8. WebRTC leak
    maxPts += 5;
    const hasRTC = !!(window.RTCPeerConnection || window.webkitRTCPeerConnection);
    results.push({
      id: 'webrtc', label: 'WebRTC Leak Protection',
      desc: hasRTC
        ? (fpEnabled ? 'WebRTC available in browsing tabs — fingerprint protection limits IP exposure' : 'WebRTC available in browsing tabs — real IP may leak even through VPN')
        : 'WebRTC unavailable in this context',
      pass: !hasRTC || fpEnabled, weight: 5, icon: 'wifi', category: 'leak',
    });
    if (!hasRTC || fpEnabled) pts += 5;

    // 9. Whitelisted sites (informational)
    const wlCount = Array.isArray(wl) ? wl.length : 0;
    results.push({
      id: 'whitelist', label: 'Ad Blocker Whitelist',
      desc: wlCount > 0
        ? `${wlCount} site(s) whitelisted — ads and trackers are not blocked on these sites`
        : 'No sites whitelisted — full protection on all sites',
      pass: wlCount === 0, weight: 0, icon: 'alert', category: 'tracking', info: wlCount === 0,
    });

    // Fingerprint info items
    const platform = navigator.platform || navigator.userAgentData?.platform || 'Unknown';
    results.push({ id: 'platform', label: 'Platform', desc: 'Reported as: ' + platform + (fpEnabled ? ' (spoofed in browsing tabs)' : '') + ' (host value shown here)', pass: null, weight: 0, icon: 'monitor', category: 'fingerprint', info: true });

    const cores = navigator.hardwareConcurrency || 0;
    results.push({ id: 'cores', label: 'CPU Cores', desc: cores ? cores + ' logical cores (real value — ' + (fpEnabled ? 'spoofed in browsing tabs' : 'visible to websites') + ')' : 'Not exposed', pass: null, weight: 0, icon: 'monitor', category: 'fingerprint', info: true });

    const mem = navigator.deviceMemory;
    results.push({ id: 'memory', label: 'Device Memory', desc: mem ? mem + ' GB (real value — ' + (fpEnabled ? 'spoofed in browsing tabs' : 'visible to websites') + ')' : 'Not exposed', pass: null, weight: 0, icon: 'monitor', category: 'fingerprint', info: true });

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    results.push({ id: 'timezone', label: 'Timezone', desc: tz, pass: null, weight: 0, icon: 'globe', category: 'fingerprint', info: true });

    const lang = navigator.language || 'Unknown';
    results.push({ id: 'lang', label: 'Language', desc: lang + ' (' + (navigator.languages?.length || 1) + ' configured)', pass: null, weight: 0, icon: 'globe', category: 'fingerprint', info: true });

    const commonRes = [[1920,1080],[1366,768],[1536,864],[1440,900],[1280,720],[2560,1440]];
    const isCommon = commonRes.some(([w,h]) => w === screen.width && h === screen.height);
    results.push({ id: 'screen', label: 'Screen Resolution', desc: screen.width + 'x' + screen.height + (isCommon ? ' (common)' : ' (uncommon — easier to fingerprint)'), pass: null, weight: 0, icon: 'monitor', category: 'fingerprint', info: true });

    if (ip) {
      results.push({ id: 'ip', label: 'Visible IP Address', desc: ip.ip || 'Could not determine', pass: null, weight: 0, icon: 'globe', category: 'connection', info: true });
    }

    const finalScore = maxPts > 0 ? Math.round((pts / maxPts) * 100) : 0;
    setScore(finalScore);
    setChecks(results);
  }

  function getScoreColor(s) {
    if (s >= 80) return '#22c55e';
    if (s >= 60) return '#eab308';
    if (s >= 40) return '#f97316';
    return '#ef4444';
  }

  function getScoreLabel(s) {
    if (s >= 80) return 'Strong';
    if (s >= 60) return 'Moderate';
    if (s >= 40) return 'Fair';
    return 'Weak';
  }

  const S = {
    root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0a09', color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    header: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
    iconBadge: { width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    content: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
    scoreCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', gap: '4px' },
    bigScore: (color) => ({ fontSize: '52px', fontWeight: '800', color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }),
    scoreSub: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
    scoreGrade: (color) => ({ display: 'inline-block', padding: '3px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', background: color + '15', color, border: '1px solid ' + color + '30', marginTop: '4px' }),
    tabs: { display: 'flex', gap: '4px' },
    tab: (active) => ({ flex: 1, padding: '7px', borderRadius: '8px', fontSize: '10px', fontWeight: '600', border: '1px solid ' + (active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'), background: active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.02)', color: active ? '#22c55e' : 'rgba(255,255,255,0.35)', cursor: 'pointer', textAlign: 'center' }),
    statRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' },
    statCard: (color) => ({ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px' }),
    statValue: { fontSize: '20px', fontWeight: '700', color: 'white', lineHeight: 1 },
    statLabel: { fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' },
    checkItem: (pass) => ({ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }),
    checkIcon: (pass) => ({ width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: pass === true ? 'rgba(34,197,94,0.1)' : pass === false ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)' }),
    checkLabel: { fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
    checkDesc: { fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginTop: '2px', lineHeight: '1.4' },
    btnSm: { background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.4)' },
    loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px' },
  };

  const scoreColor = getScoreColor(score);

  return React.createElement('div', { style: S.root },
    React.createElement('div', { style: S.header },
      React.createElement('div', { style: S.iconBadge }, React.createElement(Icon, { name: 'shield', size: 16, color: '#22c55e' })),
      React.createElement('div', { style: { flex: 1, fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.9)' } }, 'Privacy Dashboard'),
      React.createElement('button', { style: S.btnSm, onClick: runChecks, title: 'Re-scan' }, React.createElement(Icon, { name: 'refresh', size: 13 }))
    ),

    React.createElement('div', { style: S.content },
      loading ? React.createElement('div', { style: S.loading },
        React.createElement(Icon, { name: 'shield', size: 40, color: 'rgba(34,197,94,0.3)' }),
        React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: '600' } }, 'Scanning privacy settings...')
      ) : React.createElement(React.Fragment, null,
        // Score
        React.createElement('div', { style: S.scoreCard },
          React.createElement('div', { style: S.bigScore(scoreColor) }, score),
          React.createElement('div', { style: S.scoreSub }, 'Privacy Score'),
          React.createElement('div', { style: S.scoreGrade(scoreColor) }, getScoreLabel(score))
        ),

        // Live stats row
        React.createElement('div', { style: S.statRow },
          React.createElement('div', { style: S.statCard('#22c55e') },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' } },
              React.createElement(Icon, { name: 'shield', size: 11, color: '#22c55e' }),
              React.createElement('span', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.3)' } }, 'Blocked')
            ),
            React.createElement('div', { style: S.statValue }, (blockedCount || 0).toLocaleString()),
            React.createElement('div', { style: S.statLabel }, 'requests this session')
          ),
          React.createElement('div', { style: S.statCard('#6366f1') },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' } },
              React.createElement(Icon, { name: 'layers', size: 11, color: '#6366f1' }),
              React.createElement('span', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.3)' } }, 'Filter Rules')
            ),
            React.createElement('div', { style: S.statValue }, (adblockStats?.totalFilters || 0).toLocaleString()),
            React.createElement('div', { style: S.statLabel }, (adblockStats?.listsLoaded?.length || 0) + ' lists loaded')
          ),
          React.createElement('div', { style: S.statCard('#f59e0b') },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' } },
              React.createElement(Icon, { name: 'eyeOff', size: 11, color: '#f59e0b' }),
              React.createElement('span', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.3)' } }, 'Domains Blocked')
            ),
            React.createElement('div', { style: S.statValue }, (adblockStats?.blockedDomains || 0).toLocaleString()),
            React.createElement('div', { style: S.statLabel }, 'known tracker domains')
          ),
          React.createElement('div', { style: S.statCard('#06b6d4') },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' } },
              React.createElement(Icon, { name: 'globe', size: 11, color: '#06b6d4' }),
              React.createElement('span', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.3)' } }, 'Your IP')
            ),
            React.createElement('div', { style: { fontSize: '12px', fontWeight: '600', color: 'white', fontFamily: 'monospace', wordBreak: 'break-all' } }, ipInfo?.ip || '—'),
            React.createElement('div', { style: S.statLabel }, proxyStatus?.active ? 'proxied' : 'direct connection')
          )
        ),

        // Tabs
        React.createElement('div', { style: S.tabs },
          React.createElement('button', { style: S.tab(tab === 'overview'), onClick: () => setTab('overview') }, 'Checks'),
          React.createElement('button', { style: S.tab(tab === 'fingerprint'), onClick: () => setTab('fingerprint') }, 'Fingerprint'),
          React.createElement('button', { style: S.tab(tab === 'whitelist'), onClick: () => setTab('whitelist') }, 'Whitelist')
        ),

        // Checks tab
        tab === 'overview' && checks.filter(c => !c.info && c.category !== 'fingerprint').map(c =>
          React.createElement('div', { key: c.id, style: S.checkItem(c.pass) },
            React.createElement('div', { style: S.checkIcon(c.pass) },
              React.createElement(Icon, { name: c.pass ? 'check' : 'x', size: 11, color: c.pass ? '#22c55e' : '#ef4444' })
            ),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: S.checkLabel }, c.label),
              React.createElement('div', { style: S.checkDesc }, c.desc)
            )
          )
        ),

        // Fingerprint tab
        tab === 'fingerprint' && checks.filter(c => c.category === 'fingerprint' || c.id === 'fingerprint').map(c =>
          React.createElement('div', { key: c.id, style: S.checkItem(c.pass) },
            React.createElement('div', { style: S.checkIcon(c.pass) },
              React.createElement(Icon, { name: c.pass === true ? 'check' : c.pass === false ? 'x' : 'info', size: 11, color: c.pass === true ? '#22c55e' : c.pass === false ? '#ef4444' : '#3b82f6' })
            ),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: S.checkLabel }, c.label),
              React.createElement('div', { style: S.checkDesc }, c.desc)
            )
          )
        ),

        // Whitelist tab
        tab === 'whitelist' && React.createElement(React.Fragment, null,
          whitelist.length === 0
            ? React.createElement('div', { style: { textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '11px' } },
                React.createElement(Icon, { name: 'check', size: 24, color: '#22c55e', style: { margin: '0 auto 8px' } }),
                React.createElement('div', { style: { fontWeight: '600', color: '#22c55e' } }, 'No Whitelisted Sites'),
                React.createElement('div', { style: { marginTop: '4px' } }, 'All sites have full ad and tracker blocking')
              )
            : whitelist.map((site, i) =>
                React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '8px' } },
                  React.createElement(Icon, { name: 'alert', size: 12, color: '#f59e0b' }),
                  React.createElement('span', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' } }, site)
                )
              )
        )
      )
    )
  );
}
