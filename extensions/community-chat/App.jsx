function App() {
  const [loaded, setLoaded] = React.useState(false);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

  React.useEffect(() => {
    if (window.Flip) {
      Flip.storage.get('bug-banner-dismissed').then(v => {
        if (v) setBannerDismissed(true);
      });
    }
  }, []);

  function dismissBanner() {
    setBannerDismissed(true);
    if (window.Flip) Flip.storage.set('bug-banner-dismissed', true);
  }

  const s = {
    wrap:   { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 24px)', margin: '-12px' },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      background: 'rgba(0,0,0,0.15)',
    },
    headerLeft:  { display: 'flex', alignItems: 'center', gap: '8px' },
    headerDot:   {
      width: 24, height: 24, borderRadius: 8,
      background: 'rgba(45,212,168,0.12)', border: '1px solid rgba(45,212,168,0.20)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    headerIcon:  { fontSize: 13, lineHeight: 1 },
    headerLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' },
    openBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', fontSize: 10, borderRadius: 6,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
    },
    banner: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 12px',
      background: 'rgba(245,158,11,0.07)',
      borderBottom: '1px solid rgba(245,158,11,0.18)',
      flexShrink: 0,
    },
    bannerDot:   {
      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
      background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: '#fbbf24',
    },
    bannerText:  { fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, flex: 1 },
    bannerClose: {
      fontSize: 15, cursor: 'pointer', background: 'transparent',
      border: 'none', color: 'rgba(255,255,255,0.25)', padding: '2px 4px', flexShrink: 0,
    },
    loader: {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      display: 'flex', alignItems: 'center', gap: 8,
      color: 'rgba(255,255,255,0.3)', fontSize: 12,
    },
    iframe: {
      flex: 1, border: 'none', background: 'transparent', width: '100%',
      opacity: loaded ? 1 : 0, transition: 'opacity 0.35s ease',
    },
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerDot}>
            <span style={s.headerIcon}>💬</span>
          </div>
          <span style={s.headerLabel}>Community Chat</span>
        </div>
        <button
          onClick={() => { if (window.Flip) Flip.tabs.create('https://gray-swan-849807.hostingersite.com/'); }}
          style={s.openBtn}
          title="Open in new tab"
        >
          ↗ Open
        </button>
      </div>

      {/* Bug report banner */}
      {!bannerDismissed && (
        <div style={s.banner}>
          <div style={s.bannerDot}>!</div>
          <span style={s.bannerText}>
            Found a bug? Drop it in Community Chat and we'll fix it fast.
          </span>
          <button onClick={dismissBanner} style={s.bannerClose} title="Dismiss">×</button>
        </div>
      )}

      {/* Loading state */}
      {!loaded && (
        <div style={s.loader}>
          <div className="flip-spinner flip-spinner-sm" />
          Loading Community Chat...
        </div>
      )}

      {/* Embedded Community Chat */}
      <iframe
        src="https://gray-swan-849807.hostingersite.com/"
        onLoad={() => setLoaded(true)}
        style={s.iframe}
        allow="microphone; camera; notifications; clipboard-write"
      />
    </div>
  );
}
