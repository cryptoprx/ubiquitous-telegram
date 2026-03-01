import React, { useState, useEffect } from 'react';
import { Globe, Shield, RefreshCw, ShieldCheck, Wifi, WifiOff, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

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

export default VpnView;
