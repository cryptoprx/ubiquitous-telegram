import React, { useState, useEffect } from 'react';
import { Shield, CreditCard, X, ExternalLink, AlertTriangle, Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// x402 Payment Prompt — shown when a website returns HTTP 402 Payment Required
// Displays payment details and lets the user approve/deny the micropayment

export default function X402PaymentPrompt() {
  const [request, setRequest] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, signing, success, error
  const [error, setError] = useState('');

  // Extension-triggered payment state
  const [extPay, setExtPay] = useState(null);

  useEffect(() => {
    // Listen for HTTP 402 responses from main process
    if (window.flipAPI?.onX402PaymentRequest) {
      window.flipAPI.onX402PaymentRequest((data) => {
        setRequest(data);
        setExtPay(null);
        setStatus('idle');
        setError('');
      });
    }

    // Listen for extension-triggered payments (Flip.x402.pay())
    function handleExtPay(e) {
      const detail = e.detail;
      if (!detail) return;
      setExtPay(detail);
      setRequest({
        id: detail.id,
        url: `Extension: ${detail.extensionName}`,
        hostname: detail.extensionName,
        price: detail.amount,
        asset: 'USDC',
        network: 'eip155:8453',
        payTo: detail.to,
        description: detail.reason || `Payment to ${detail.extensionName}`,
        scheme: 'exact',
        isExtension: true,
      });
      setStatus('idle');
      setError('');
    }
    window.addEventListener('flip-x402-ext-pay', handleExtPay);
    return () => window.removeEventListener('flip-x402-ext-pay', handleExtPay);
  }, []);

  async function handleApprove() {
    if (!request) return;
    setStatus('signing');
    setError('');
    try {
      if (extPay) {
        // Extension-triggered payment — send USDC directly via wallet
        const sendResult = await window.flipAPI.walletSendUsdc(extPay.to, extPay.amount, false);
        if (sendResult?.success) {
          // Record as x402 extension payment
          await window.flipAPI.walletAddTx({
            id: Date.now(),
            type: 'x402',
            to: extPay.to,
            amount: extPay.amount,
            asset: 'USDC',
            site: extPay.extensionName,
            network: 'eip155:8453',
            timestamp: Date.now(),
          });
          setStatus('success');
          // Notify extension of success
          window.dispatchEvent(new CustomEvent('flip-x402-ext-result', {
            detail: { id: extPay.id, result: { success: true, txHash: sendResult.txHash } },
          }));
          setTimeout(() => { setRequest(null); setExtPay(null); setStatus('idle'); }, 2000);
        } else {
          setStatus('error');
          setError(sendResult?.error || 'Payment failed');
          window.dispatchEvent(new CustomEvent('flip-x402-ext-result', {
            detail: { id: extPay.id, result: { error: sendResult?.error || 'Payment failed' } },
          }));
        }
      } else {
        // HTTP 402 payment — sign via main process
        const result = await window.flipAPI.respondX402Payment(request.id, true);
        if (result?.success) {
          setStatus('success');
          setTimeout(() => { setRequest(null); setStatus('idle'); }, 2000);
        } else if (result?.error) {
          setStatus('error');
          setError(result.error);
        }
      }
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  }

  async function handleDeny() {
    if (!request) return;
    if (extPay) {
      // Notify extension of denial
      window.dispatchEvent(new CustomEvent('flip-x402-ext-result', {
        detail: { id: extPay.id, result: { cancelled: true } },
      }));
      setExtPay(null);
    } else {
      await window.flipAPI.respondX402Payment(request.id, false);
    }
    setRequest(null);
    setStatus('idle');
  }

  if (!request) return null;

  const priceDisplay = request.price?.startsWith?.('$')
    ? request.price
    : `$${request.price}`;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-20 pointer-events-none">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={handleDeny} />

      {/* Payment Card */}
      <div className="relative pointer-events-auto w-[380px] rounded-2xl bg-surface-1/98 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden animate-scale-in">
        {/* Gradient header bar */}
        <div className="h-1 bg-gradient-to-r from-flip-500 via-accent-400 to-flip-500" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flip-500/15 border border-flip-500/20 flex items-center justify-center">
                <CreditCard size={18} className="text-flip-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Payment Required</h3>
                <p className="text-[10px] text-white/30 mt-0.5">x402 Micropayment</p>
              </div>
            </div>
            <button onClick={handleDeny} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Site info */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={12} className="text-accent-400/70" />
              <span className="text-[10px] text-white/40 font-medium">{request.hostname}</span>
            </div>
            {request.description && (
              <p className="text-xs text-white/60 mb-2">{request.description}</p>
            )}
            <div className="text-[9px] text-white/20 font-mono truncate">{request.url}</div>
          </div>

          {/* Payment details */}
          <div className="rounded-xl bg-gradient-to-br from-flip-500/5 to-accent-400/5 border border-flip-500/15 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Amount</span>
              <span className="text-lg font-bold text-white/90 font-mono">{priceDisplay}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">Asset</span>
                <span className="text-[10px] text-white/60 font-medium">{request.asset || 'USDC'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">Network</span>
                <span className="text-[10px] text-white/60 font-medium">
                  {request.network?.includes('8453') ? 'Base' : request.network?.includes('84532') ? 'Base Sepolia' : request.network || 'Base'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">Recipient</span>
                <span className="text-[9px] text-white/40 font-mono">
                  {request.payTo ? request.payTo.slice(0, 8) + '...' + request.payTo.slice(-6) : 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Status messages */}
          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
              <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-red-300">{error}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 mb-3 animate-fade-in">
              <Check size={12} className="text-green-400" />
              <span className="text-[10px] text-green-300">Payment signed! Reloading page...</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDeny}
              disabled={status === 'signing'}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/50 font-medium hover:bg-white/[0.08] transition-colors disabled:opacity-40"
            >
              Deny
            </button>
            <button
              onClick={handleApprove}
              disabled={status === 'signing' || status === 'success'}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-flip-500/30 to-accent-400/20 border border-flip-500/25 text-xs text-flip-400 font-semibold hover:from-flip-500/40 hover:to-accent-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'signing' ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Signing...
                </>
              ) : status === 'success' ? (
                <>
                  <Check size={12} />
                  Paid!
                </>
              ) : (
                <>
                  Pay {priceDisplay}
                </>
              )}
            </button>
          </div>

          {/* Fine print */}
          <p className="text-[8px] text-white/15 text-center mt-3 leading-relaxed">
            Paid via x402 protocol · USDC on Base · Flip Wallet
          </p>
        </div>
      </div>
    </div>
  );
}
