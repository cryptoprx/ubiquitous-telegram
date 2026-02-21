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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 24px)', margin: '-12px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🗨️</span>
          <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8 }}>Community Chat</span>
        </div>
        <button
          onClick={() => {
            if (window.Flip) Flip.tabs.create('https://gray-swan-849807.hostingersite.com/');
          }}
          style={{ padding: '3px 8px', fontSize: '9px', opacity: 0.5 }}
          title="Open in new tab"
        >
          ↗ Open
        </button>
      </div>

      {/* Bug report banner */}
      {!bannerDismissed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px',
          background: 'linear-gradient(135deg, rgba(255,98,52,0.1), rgba(255,122,77,0.05))',
          borderBottom: '1px solid rgba(255,98,52,0.15)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '13px' }}>🐛</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.4', flex: 1 }}>
            Found a bug? Report it here in Community Chat so we can fix it fast!
          </span>
          <button
            onClick={dismissBanner}
            style={{ fontSize: '14px', opacity: 0.3, cursor: 'pointer', background: 'none', border: 'none', color: 'white', padding: '2px 4px' }}
            title="Dismiss"
          >×</button>
        </div>
      )}

      {/* Loading indicator */}
      {!loaded && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 0',
          opacity: 0.3,
          fontSize: '12px',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          Loading Community Chat...
        </div>
      )}

      {/* Embedded Community Chat */}
      <iframe
        src="https://gray-swan-849807.hostingersite.com/"
        onLoad={() => setLoaded(true)}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          width: '100%',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        allow="microphone; camera; notifications; clipboard-write"
      />
    </div>
  );
}
