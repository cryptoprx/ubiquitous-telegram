import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { acceptCall, rejectCall } from '../lib/companionSync';

/** Incoming call overlay — shown when companion calls the browser */
export default function IncomingCallOverlay() {
  const [call, setCall] = useState(null);
  const [status, setStatus] = useState('ringing');
  const [callSession, setCallSession] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    function handleIncomingCall(e) {
      const { code, type, from } = e.detail || {};
      if (code) {
        setCall({ code, type, from });
        setStatus('ringing');
      }
    }
    window.addEventListener('flip-incoming-call', handleIncomingCall);
    return () => window.removeEventListener('flip-incoming-call', handleIncomingCall);
  }, []);

  async function handleAccept() {
    if (!call) return;
    setStatus('connecting');
    const session = await acceptCall(call.code, call.type);
    if (session) {
      setCallSession(session);
      if (localVideoRef.current) localVideoRef.current.srcObject = session.localStream;
      session.pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        setStatus('connected');
      };
      setTimeout(() => setStatus((s) => s === 'connecting' ? 'connected' : s), 15000);
    } else {
      setStatus('ended');
      setTimeout(() => { setCall(null); setStatus('ringing'); }, 2000);
    }
  }

  function handleReject() {
    rejectCall();
    setCall(null);
    setStatus('ringing');
  }

  function handleEnd() {
    if (callSession) {
      callSession.pc?.close();
      callSession.localStream?.getTracks().forEach((t) => t.stop());
    }
    setCallSession(null);
    setCall(null);
    setStatus('ringing');
  }

  if (!call) return null;

  if (status === 'ringing') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div className="bg-surface-1 rounded-2xl p-8 max-w-xs w-full text-center border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShieldCheck size={28} className="text-green-400" />
          </div>
          <p className="text-white/90 text-sm font-semibold mb-1">Incoming {call.type === 'video' ? 'Video' : 'Voice'} Call</p>
          <p className="text-white/40 text-xs mb-6">from {call.from}</p>
          <div className="flex gap-3">
            <button onClick={handleReject} className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors">
              Decline
            </button>
            <button onClick={handleAccept} className="flex-1 py-2.5 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors">
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        {status !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
            <div className="w-12 h-12 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/60 text-sm">{status === 'connecting' ? 'Connecting...' : 'Call ended'}</p>
          </div>
        )}
        {call.type === 'video' && (
          <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-28 h-36 rounded-xl object-cover border-2 border-white/10 shadow-xl" />
        )}
      </div>
      <div className="flex items-center justify-center gap-6 py-4 bg-surface-1 border-t border-white/5">
        <button onClick={handleEnd} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="23" y1="1" x2="1" y2="23"/>
            <path d="M16.92 11.07A10 10 0 0 0 12 9.5a10 10 0 0 0-4.92 1.57"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
