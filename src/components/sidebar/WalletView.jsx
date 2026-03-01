import React, { useState, useEffect } from 'react';
import { X, Copy, RefreshCw, Lock, Wallet } from 'lucide-react';
import clsx from 'clsx';

function WalletView() {
  const [walletState, setWalletState] = useState('loading');
  const [walletInfo, setWalletInfo] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balLoading, setBalLoading] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendAsset, setSendAsset] = useState('USDC');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showSend, setShowSend] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [txHistory, setTxHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [testnet, setTestnet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletError, setWalletError] = useState('');

  useEffect(() => { checkWallet(); }, []);

  async function checkWallet() {
    if (!window.flipAPI?.walletHas) { setWalletState('none'); return; }
    const has = await window.flipAPI.walletHas();
    if (has) {
      const info = await window.flipAPI.walletInfo();
      setWalletInfo(info);
      setWalletState('main');
      refreshBalance();
    } else {
      setWalletState('none');
    }
  }

  async function refreshBalance() {
    setBalLoading(true);
    try {
      const bal = await window.flipAPI.walletBalance(testnet);
      setBalance(bal);
    } catch {}
    setBalLoading(false);
  }

  async function handleCreate() {
    setWalletError('');
    const result = await window.flipAPI.walletCreate();
    if (result?.address) {
      setWalletInfo(result);
      setWalletState('main');
      refreshBalance();
    }
  }

  async function handleImport() {
    setWalletError('');
    try {
      const result = await window.flipAPI.walletImport(importInput);
      if (result?.address) {
        setWalletInfo(result);
        setImportInput('');
        setWalletState('main');
        refreshBalance();
      } else {
        setWalletError(result?.error || 'Invalid seed');
      }
    } catch (e) {
      setWalletError(e.message);
    }
  }

  async function handleSend() {
    if (!sendTo || !sendAmount) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = sendAsset === 'USDC'
        ? await window.flipAPI.walletSendUsdc(sendTo, sendAmount, testnet)
        : await window.flipAPI.walletSendEth(sendTo, sendAmount, testnet);
      setSendResult(result);
      if (result?.success) { refreshBalance(); setSendTo(''); setSendAmount(''); }
    } catch (e) {
      setSendResult({ error: e.message });
    }
    setSending(false);
  }

  async function handleExport() {
    const m = await window.flipAPI.walletExportMnemonic();
    setMnemonic(m || 'Private key import (no mnemonic)');
    setShowMnemonic(true);
  }

  async function handleDelete() {
    if (!confirm('Delete wallet? This cannot be undone. Make sure you have backed up your seed phrase.')) return;
    await window.flipAPI.walletDelete();
    setWalletInfo(null);
    setBalance(null);
    setWalletState('none');
  }

  async function loadHistory() {
    const h = await window.flipAPI.walletTxHistory();
    setTxHistory(h || []);
    setShowHistory(true);
  }

  function copyAddress() {
    navigator.clipboard.writeText(walletInfo?.address || balance?.address || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const addr = walletInfo?.address || balance?.address || '';
  const shortAddr = addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';

  if (walletState === 'loading') {
    return <div className="flex items-center justify-center py-20 text-white/20"><RefreshCw size={16} className="animate-spin" /></div>;
  }

  if (walletState === 'none' || walletState === 'setup' || walletState === 'import') {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-flip-500/20 to-accent-400/10 border border-flip-500/20 flex items-center justify-center mb-3">
            <Wallet size={22} className="text-flip-400" />
          </div>
          <h3 className="text-sm font-semibold text-white/90 mb-1">Flip Wallet</h3>
          <p className="text-[10px] text-white/30 leading-relaxed max-w-48">
            USDC wallet on Base network for x402 micropayments and web3 transactions
          </p>
        </div>

        {walletState === 'import' ? (
          <div className="space-y-3">
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Enter seed phrase (12 words) or private key (0x...)"
              className="w-full input-base text-xs h-20 resize-none"
            />
            {walletError && <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{walletError}</div>}
            <button onClick={handleImport} disabled={!importInput.trim()} className="w-full py-2.5 rounded-xl bg-flip-500/20 border border-flip-500/25 text-flip-400 text-xs font-medium hover:bg-flip-500/30 transition-colors disabled:opacity-40">
              Import Wallet
            </button>
            <button onClick={() => { setWalletState('none'); setWalletError(''); }} className="w-full py-2 text-[10px] text-white/30 hover:text-white/50">
              Back
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={handleCreate} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-flip-500/20 to-accent-400/10 border border-flip-500/20 text-flip-400 text-xs font-medium hover:from-flip-500/30 hover:to-accent-400/20 transition-all">
              Create New Wallet
            </button>
            <button onClick={() => setWalletState('import')} className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs font-medium hover:bg-white/[0.06] transition-colors">
              Import Existing Wallet
            </button>
          </div>
        )}
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex items-center justify-between mb-3">
          <span className="sidebar-section px-0 py-0">Transactions</span>
          <button onClick={() => setShowHistory(false)} className="text-white/30 hover:text-white/60"><X size={12} /></button>
        </div>
        {txHistory.length === 0 ? (
          <div className="text-center py-10 text-[10px] text-white/20">No transactions yet</div>
        ) : (
          <div className="space-y-1.5">
            {txHistory.map((tx) => (
              <div key={tx.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/50 font-medium">{tx.type === 'send' ? 'Sent' : tx.type === 'x402' ? 'x402 Payment' : 'Received'}</span>
                  <span className="text-[10px] text-flip-400 font-mono">{tx.amount} {tx.asset}</span>
                </div>
                <div className="text-[9px] text-white/20 font-mono truncate">{tx.to}</div>
                <div className="text-[8px] text-white/15 mt-1">{new Date(tx.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="rounded-xl bg-gradient-to-br from-flip-500/10 via-white/[0.02] to-accent-400/5 border border-flip-500/15 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-flip-500/20 flex items-center justify-center">
              <Wallet size={13} className="text-flip-400" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 font-medium">Flip Wallet</div>
              <button onClick={copyAddress} className="text-[9px] text-white/25 font-mono hover:text-flip-400 transition-colors" title="Copy address">
                {copied ? 'Copied!' : shortAddr}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setTestnet(!testnet); setTimeout(refreshBalance, 100); }}
              className={clsx('px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors', testnet ? 'bg-yellow-500/20 text-yellow-400' : 'bg-accent-400/15 text-accent-400')}
            >
              {testnet ? 'Testnet' : 'Base'}
            </button>
            <button onClick={refreshBalance} className="p-1 text-white/30 hover:text-white/60" title="Refresh">
              <RefreshCw size={10} className={balLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">USDC</span>
            <span className="text-sm font-semibold text-white/90 font-mono">
              ${balance?.usdc ? parseFloat(balance.usdc).toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">ETH</span>
            <span className="text-[11px] text-white/50 font-mono">
              {balance?.eth ? parseFloat(balance.eth).toFixed(6) : '0.000000'}
            </span>
          </div>
          {balance?.error && <div className="text-[9px] text-red-400/70">{balance.error}</div>}
        </div>

        <div className="flex gap-1.5">
          <button onClick={() => { setShowSend(!showSend); setSendResult(null); }} className="flex-1 py-1.5 rounded-lg bg-flip-500/15 border border-flip-500/20 text-[10px] text-flip-400 font-medium hover:bg-flip-500/25 transition-colors">
            {showSend ? 'Cancel' : 'Send'}
          </button>
          <button onClick={loadHistory} className="flex-1 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/50 font-medium hover:bg-white/[0.08] transition-colors">
            History
          </button>
          <button onClick={handleExport} className="py-1.5 px-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/30 hover:text-white/60 transition-colors" title="Export seed">
            <Lock size={10} />
          </button>
        </div>

        {showSend && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
            <div className="flex gap-1.5">
              {['USDC', 'ETH'].map((a) => (
                <button key={a} onClick={() => setSendAsset(a)} className={clsx('flex-1 py-1 rounded-md text-[9px] font-medium transition-colors', sendAsset === a ? 'bg-flip-500/20 text-flip-400' : 'bg-white/[0.04] text-white/30')}>
                  {a}
                </button>
              ))}
            </div>
            <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="Recipient address (0x...)" className="w-full input-base text-xs" />
            <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder={`Amount in ${sendAsset}`} className="w-full input-base text-xs" type="number" step="0.000001" />
            <button onClick={handleSend} disabled={sending || !sendTo || !sendAmount} className="w-full py-2 rounded-lg bg-flip-500/20 border border-flip-500/25 text-[10px] text-flip-400 font-medium hover:bg-flip-500/30 transition-colors disabled:opacity-40">
              {sending ? 'Sending...' : `Send ${sendAsset}`}
            </button>
            {sendResult?.success && <div className="text-[9px] text-accent-400">Sent! Tx: {sendResult.txHash?.slice(0, 16)}...</div>}
            {sendResult?.error && <div className="text-[9px] text-red-400">{sendResult.error}</div>}
          </div>
        )}

        {showMnemonic && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[9px] text-red-400/70 mb-1 font-medium">Secret Recovery Phrase — never share this</div>
            <div className="p-2 rounded-lg bg-black/30 border border-red-500/20 text-[10px] text-white/60 font-mono break-all select-all">{mnemonic}</div>
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => { navigator.clipboard.writeText(mnemonic); }} className="flex-1 py-1.5 rounded-lg bg-white/[0.04] text-[9px] text-white/40 hover:text-white/60">Copy</button>
              <button onClick={() => setShowMnemonic(false)} className="flex-1 py-1.5 rounded-lg bg-white/[0.04] text-[9px] text-white/40 hover:text-white/60">Close</button>
            </div>
          </div>
        )}
      </div>

      <button onClick={handleDelete} className="w-full mb-3 py-1.5 rounded-lg text-[9px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
        Delete Wallet
      </button>
    </div>
  );
}

export default WalletView;
