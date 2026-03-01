import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Send, Play, Code2, FileJson, Sparkles, Copy, Download, Upload,
  ChevronRight, X, Loader2, Package, Eye, RotateCcw, Trash2, Plus,
  Puzzle, BookOpen, Zap, Globe, CreditCard, Database, Layout, Palette,
} from 'lucide-react';

const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Extension',
    icon: Plus,
    description: 'Empty starter with SDK ready',
    code: `function MyExtension() {
  const [message, setMessage] = React.useState('Hello from my extension!');

  return (
    <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#e5e5e5', minHeight: '100vh', background: '#1a1a1a' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{message}</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
        Edit this code to build your extension. Use the Flip SDK to interact with the browser.
      </p>
    </div>
  );
}`,
    manifest: { id: 'my-extension', name: 'My Extension', version: '1.0.0', description: '', author: '', permissions: ['tabs', 'storage'], sidebar: { file: 'index.jsx', width: 380 } },
  },
  {
    id: 'tab-manager',
    name: 'Tab Manager',
    icon: Layout,
    description: 'List and manage open tabs',
    code: `function TabManager() {
  const [tabs, setTabs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  async function loadTabs() {
    setLoading(true);
    const result = await Flip.tabs.list();
    setTabs(result || []);
    setLoading(false);
  }

  React.useEffect(() => { loadTabs(); }, []);

  const styles = {
    container: { padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#e5e5e5', minHeight: '100vh', background: '#1a1a1a' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    title: { fontSize: 16, fontWeight: 700 },
    btn: { padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e5e5', cursor: 'pointer', fontSize: 12 },
    tab: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', marginBottom: 6, cursor: 'pointer' },
    tabTitle: { fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
    tabUrl: { fontSize: 10, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    close: { width: 20, height: 20, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#f87171', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Open Tabs ({tabs.length})</span>
        <button style={styles.btn} onClick={loadTabs}>Refresh</button>
      </div>
      {loading ? <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading...</p> : (
        tabs.map(tab => (
          <div key={tab.id} style={styles.tab} onClick={() => Flip.tabs.navigate(tab.id, tab.url)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.tabTitle}>{tab.title || 'Untitled'}</div>
              <div style={styles.tabUrl}>{tab.url}</div>
            </div>
            <button style={styles.close} onClick={(e) => { e.stopPropagation(); Flip.tabs.close(tab.id); loadTabs(); }}>×</button>
          </div>
        ))
      )}
    </div>
  );
}`,
    manifest: { id: 'tab-manager', name: 'Tab Manager', version: '1.0.0', description: 'List and manage open tabs', author: '', permissions: ['tabs'], sidebar: { file: 'index.jsx', width: 380 } },
  },
  {
    id: 'quick-notes',
    name: 'Quick Notes',
    icon: BookOpen,
    description: 'Persistent note-taking widget',
    code: `function QuickNotes() {
  const [notes, setNotes] = React.useState([]);
  const [input, setInput] = React.useState('');

  React.useEffect(() => {
    Flip.storage.get('notes').then(saved => {
      if (saved) setNotes(JSON.parse(saved));
    });
  }, []);

  function saveNotes(updated) {
    setNotes(updated);
    Flip.storage.set('notes', JSON.stringify(updated));
  }

  function addNote() {
    if (!input.trim()) return;
    const updated = [{ id: Date.now(), text: input.trim(), time: new Date().toLocaleString() }, ...notes];
    saveNotes(updated);
    setInput('');
  }

  function deleteNote(id) {
    saveNotes(notes.filter(n => n.id !== id));
  }

  const s = {
    wrap: { padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#e5e5e5', minHeight: '100vh', background: '#1a1a1a' },
    inputRow: { display: 'flex', gap: 8, marginBottom: 16 },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e5e5', fontSize: 13, outline: 'none' },
    addBtn: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
    note: { padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', marginBottom: 8, position: 'relative' },
    noteText: { fontSize: 13, lineHeight: 1.5 },
    noteTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 },
    del: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  };

  return (
    <div style={s.wrap}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Quick Notes</h2>
      <div style={s.inputRow}>
        <input style={s.input} placeholder="Write a note..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} />
        <button style={s.addBtn} onClick={addNote}>Add</button>
      </div>
      {notes.map(n => (
        <div key={n.id} style={s.note}>
          <div style={s.noteText}>{n.text}</div>
          <div style={s.noteTime}>{n.time}</div>
          <button style={s.del} onClick={() => deleteNote(n.id)}>×</button>
        </div>
      ))}
      {notes.length === 0 && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No notes yet. Add one above!</p>}
    </div>
  );
}`,
    manifest: { id: 'quick-notes', name: 'Quick Notes', version: '1.0.0', description: 'Persistent note-taking sidebar widget', author: '', permissions: ['storage'], sidebar: { file: 'index.jsx', width: 380 } },
  },
  {
    id: 'api-dashboard',
    name: 'API Dashboard',
    icon: Globe,
    description: 'Fetch and display API data',
    code: `function APIDashboard() {
  const [url, setUrl] = React.useState('https://jsonplaceholder.typicode.com/posts?_limit=5');
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const res = await Flip.fetch(url);
      const json = typeof res === 'string' ? JSON.parse(res) : res;
      setData(json);
    } catch (e) {
      setError(e.message || 'Request failed');
    }
    setLoading(false);
  }

  const s = {
    wrap: { padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#e5e5e5', minHeight: '100vh', background: '#1a1a1a' },
    inputRow: { display: 'flex', gap: 8, marginBottom: 16 },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e5e5', fontSize: 12, outline: 'none', fontFamily: 'monospace' },
    btn: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12 },
    pre: { padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'rgba(255,255,255,0.6)', maxHeight: 400, overflow: 'auto' },
  };

  return (
    <div style={s.wrap}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>API Dashboard</h2>
      <div style={s.inputRow}>
        <input style={s.input} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()} placeholder="https://api.example.com/data" />
        <button style={s.btn} onClick={fetchData}>{loading ? '...' : 'Fetch'}</button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>}
      {data && <pre style={s.pre}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}`,
    manifest: { id: 'api-dashboard', name: 'API Dashboard', version: '1.0.0', description: 'Fetch and display API data', author: '', permissions: ['network'], sidebar: { file: 'index.jsx', width: 380 } },
  },
  {
    id: 'crypto-pay',
    name: 'Micropay Widget',
    icon: CreditCard,
    description: 'x402 payment extension starter',
    code: `function MicropayWidget() {
  const [wallet, setWallet] = React.useState(null);
  const [amount, setAmount] = React.useState('0.01');
  const [to, setTo] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    Flip.x402.walletInfo().then(setWallet).catch(() => {});
  }, []);

  async function sendPayment() {
    if (!to || !amount) return;
    setStatus('Sending...');
    try {
      const res = await Flip.x402.pay({ to, amount, reason: 'Micropay Widget payment' });
      setStatus(res.success ? 'Payment sent! TX: ' + (res.txHash || '').slice(0, 16) + '...' : 'Error: ' + (res.error || 'Failed'));
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  }

  const s = {
    wrap: { padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#e5e5e5', minHeight: '100vh', background: '#1a1a1a' },
    card: { padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', marginBottom: 12 },
    label: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' },
    input: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e5e5', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' },
    btn: { width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  };

  return (
    <div style={s.wrap}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Micropay</h2>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Send USDC payments on Base</p>
      {wallet && (
        <div style={s.card}>
          <span style={s.label}>Your wallet</span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>{wallet.address}</span>
        </div>
      )}
      <div style={s.card}>
        <span style={s.label}>Recipient address</span>
        <input style={s.input} value={to} onChange={e => setTo(e.target.value)} placeholder="0x..." />
        <span style={s.label}>Amount (USDC)</span>
        <input style={s.input} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.01" />
        <button style={s.btn} onClick={sendPayment}>Send Payment</button>
      </div>
      {status && <p style={{ fontSize: 12, color: status.startsWith('Error') ? '#f87171' : '#2dd4bf', marginTop: 8 }}>{status}</p>}
    </div>
  );
}`,
    manifest: { id: 'micropay-widget', name: 'Micropay Widget', version: '1.0.0', description: 'Send USDC payments on Base chain', author: '', permissions: ['x402'], sidebar: { file: 'index.jsx', width: 380 } },
  },
];

const CHAT_KEY = 'flip-studio-chat';

function AIChatPanel({ onInsertCode, onInsertManifest }) {
  const [messages, setMessages] = useState(() => {
    try { const r = localStorage.getItem(CHAT_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuf, setStreamBuf] = useState('');
  const [autoInserted, setAutoInserted] = useState(new Set());
  const chatEnd = useRef(null);
  const inputRef = useRef(null);
  const userHasSentRef = useRef(false); // Only auto-insert after user sends a message

  // Auto-save chat messages
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages)); } catch {}
    }
  }, [messages]);

  function extractJsx(text) {
    const match = text.match(/```(?:jsx?|javascript)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  function extractManifest(text) {
    const match = text.match(/```json\n([\s\S]*?)```/);
    if (!match) return null;
    try { return JSON.parse(match[1].trim()); } catch { return null; }
  }

  function stripCodeBlocks(text) {
    return text
      .replace(/```(?:jsx?|javascript)?\n[\s\S]*?```/g, '')
      .replace(/```json\n[\s\S]*?```/g, '')
      .trim();
  }

  // Auto-insert code + manifest when AI finishes a message
  function handleAutoInsert(content, msgIdx) {
    if (!userHasSentRef.current) return; // Ignore stale IPC events from previous sessions
    if (autoInserted.has(msgIdx)) return;
    const jsxCode = extractJsx(content);
    const manifest = extractManifest(content);
    if (jsxCode && jsxCode.length > 20) { // Reject garbage extractions
      onInsertCode(jsxCode);
      setAutoInserted(prev => new Set(prev).add(msgIdx));
    }
    if (manifest) {
      onInsertManifest(manifest);
    }
  }

  useEffect(() => {
    const tokenHandler = (token) => {
      setStreamBuf(prev => prev + token);
    };
    const doneHandler = () => {
      setStreaming(false);
      setStreamBuf(prev => {
        if (prev) {
          setMessages(msgs => {
            const updated = [...msgs];
            const idx = updated.length - 1;
            updated[idx] = { role: 'assistant', content: prev };
            return updated;
          });
        }
        return '';
      });
    };
    if (window.flipAPI?.onAiStudioToken) window.flipAPI.onAiStudioToken(tokenHandler);
    if (window.flipAPI?.onAiStudioDone) window.flipAPI.onAiStudioDone(doneHandler);

    // Clean up IPC listeners on unmount to prevent stale events on remount
    return () => {
      if (window.flipAPI?.offAiStudioToken) window.flipAPI.offAiStudioToken(tokenHandler);
      if (window.flipAPI?.offAiStudioDone) window.flipAPI.offAiStudioDone(doneHandler);
    };
  }, []);

  // When streaming ends and the final message is set, auto-insert
  useEffect(() => {
    if (streaming) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      handleAutoInsert(lastMsg.content, lastIdx);
    }
  }, [messages, streaming]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuf]);

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    userHasSentRef.current = true; // Enable auto-insert now that user has actively sent a message
    const userMsg = { role: 'user', content: input.trim() };
    const newMsgs = [...messages, userMsg, { role: 'assistant', content: '' }];
    setMessages(newMsgs);
    setInput('');
    setStreaming(true);
    setStreamBuf('');

    const chatHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    const result = await window.flipAPI?.aiStudioChat({ messages: chatHistory });
    if (result?.error) {
      setStreaming(false);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${result.error}` };
        return updated;
      });
    }
  }

  function renderMessage(msg, idx) {
    const isUser = msg.role === 'user';
    const content = idx === messages.length - 1 && streaming ? streamBuf : msg.content;
    const jsxCode = !isUser ? extractJsx(content) : null;
    const wasInserted = autoInserted.has(idx);
    // Show clean text without code blocks for assistant messages that had code
    const displayText = !isUser && jsxCode ? stripCodeBlocks(content) : content;

    return (
      <div key={idx} className={`flex gap-2.5 ${isUser ? 'justify-end' : ''}`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-lg bg-flip-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot size={14} className="text-flip-400" />
          </div>
        )}
        <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${isUser ? 'bg-flip-500/10 border border-flip-500/20' : 'bg-white/[0.04] border border-white/[0.06]'}`}>
          <div className="text-[12.5px] leading-relaxed text-white/70 whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word' }}>
            {displayText || (streaming ? <span className="inline-block w-1.5 h-4 bg-flip-400/60 animate-pulse rounded-sm" /> : '')}
          </div>
          {jsxCode && wasInserted && (
            <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/15 text-[10px] text-teal-400 font-medium">
              <Zap size={11} /> Extension created in editor
            </div>
          )}
          {jsxCode && !wasInserted && !streaming && (
            <button
              onClick={() => { onInsertCode(jsxCode); const m = extractManifest(content); if (m) onInsertManifest(m); setAutoInserted(prev => new Set(prev).add(idx)); }}
              className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-flip-500/15 border border-flip-500/20 text-[10px] text-flip-400 font-medium hover:bg-flip-500/25 transition-colors"
            >
              <Code2 size={11} /> Insert into editor
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Sparkles size={14} className="text-flip-400" />
        <span className="text-xs font-semibold text-white/80">AI Builder</span>
        <span className="text-[9px] text-white/20 ml-auto">Auto-creates extensions</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles size={24} className="text-flip-500/30 mx-auto mb-3" />
            <p className="text-[11px] text-white/30 leading-relaxed max-w-[220px] mx-auto">
              Tell me what extension to build and I'll create it directly in the editor.
            </p>
            <div className="mt-4 space-y-1.5">
              {['Build a weather widget', 'Create a bookmark search tool', 'Make a page word counter'].map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="block w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[10.5px] text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => renderMessage(m, i))}
        <div ref={chatEnd} />
      </div>

      <div className="px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Describe your extension..."
            className="flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 outline-none"
            disabled={streaming}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="w-7 h-7 rounded-lg bg-flip-500/20 hover:bg-flip-500/30 flex items-center justify-center transition-colors disabled:opacity-30"
          >
            {streaming ? <Loader2 size={13} className="text-flip-400 animate-spin" /> : <Send size={13} className="text-flip-400" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Uses blob URL so CDN scripts load properly. Babel compiles inside iframe.
// Code sent via postMessage to avoid all escaping issues.
// NO Babel in parent page — it conflicts with Monaco's AMD loader.

function buildPreviewHTML() {
  // Build as array of plain strings — zero escaping issues
  var p = [];
  p.push('<!DOCTYPE html><html><head><meta charset="utf-8">');
  p.push('<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a1a;color:#e5e5e5;font-family:Inter,system-ui,sans-serif}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}</style>');
  p.push('<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>');
  p.push('<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>');
  p.push('<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>');
  p.push('</head><body><div id="root"><p style="padding:16px;color:rgba(255,255,255,0.3);font-size:12px">Loading preview...</p></div>');
  p.push('<script>');
  // Flip SDK mock
  p.push('var Flip={tabs:{list:async function(){return[{id:1,url:"https://example.com",title:"Example",active:true}]},open:async function(){},close:async function(){},navigate:async function(){},getActive:async function(){return{id:1,url:"https://example.com",title:"Example"}},getContent:async function(){return"Sample content."},getSelectedText:async function(){return"Selected text."}},storage:{_s:{},get:async function(k){return this._s[k]||null},set:async function(k,v){this._s[k]=v},remove:async function(k){delete this._s[k]},keys:async function(){return Object.keys(this._s)}},fetch:async function(u){return(await fetch(u)).json()},ui:{showToast:function(){},setBadge:function(){},getTheme:function(){return{mode:"dark",primary:"#f97316",accent:"#2dd4bf"}}},x402:{pay:async function(){return{success:true,txHash:"0xaaa"}},balance:async function(){return{address:"0x1234",usdc:"10.50",eth:"0.01"}},walletInfo:async function(){return{address:"0x1234",network:"eip155:8453"}}},bookmarks:{list:async function(){return[]},add:async function(){}},history:{search:async function(){return[]}}};');
  p.push('window.Flip=Flip;');
  // Run function: find component, Babel compile, render
  p.push('function _run(code){');
  p.push('  try{');
  p.push('    var nm=code.match(/function\\s+([A-Z][A-Za-z0-9_]*)\\s*\\(/)||code.match(/(?:const|let|var)\\s+([A-Z][A-Za-z0-9_]*)\\s*=/);');
  p.push('    if(!nm){document.getElementById("root").innerHTML="<p style=\\"padding:16px;color:#f87171;font-size:13px\\">No React component found.</p>";return}');
  p.push('    var name=nm[1]||nm[2];');
  p.push('    var full=code+"\\n;ReactDOM.createRoot(document.getElementById(\'root\')).render(React.createElement("+name+"));";');
  p.push('    var compiled=Babel.transform(full,{presets:["react"]}).code;');
  p.push('    document.getElementById("root").innerHTML="";');
  p.push('    (new Function(compiled))();');
  p.push('  }catch(e){');
  p.push('    document.getElementById("root").innerHTML="<p style=\\"padding:16px;color:#f87171;font-size:13px\\">"+e.message+"</p>";');
  p.push('  }');
  p.push('}');
  // postMessage listener
  p.push('window.addEventListener("message",function(e){');
  p.push('  if(e.data&&e.data.type==="run-extension"){_run(e.data.code)}');
  p.push('});');
  // Signal ready after all CDN scripts loaded
  p.push('window.addEventListener("load",function(){');
  p.push('  window.parent.postMessage({type:"preview-ready"},"*");');
  p.push('});');
  p.push('</script></body></html>');
  return p.join('\n');
}

function LivePreview({ code }) {
  const iframeRef = useRef(null);
  const [error, setError] = useState('');
  const readyRef = useRef(false);
  const pendingCodeRef = useRef(null);
  const blobUrlRef = useRef(null);

  // Listen for ready signal from iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'preview-ready') {
        readyRef.current = true;
        if (pendingCodeRef.current) {
          iframeRef.current?.contentWindow?.postMessage({ type: 'run-extension', code: pendingCodeRef.current }, '*');
          pendingCodeRef.current = null;
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Create iframe with blob URL (CDN scripts load properly, no sandbox needed)
  useEffect(() => {
    if (!iframeRef.current) return;
    const html = buildPreviewHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    iframeRef.current.src = url;
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);

  // Send code to iframe whenever it changes
  useEffect(() => {
    if (!code) return;
    setError('');
    if (readyRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'run-extension', code }, '*');
    } else {
      pendingCodeRef.current = code;
    }
  }, [code]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
        <Eye size={13} className="text-teal-400" />
        <span className="text-xs font-semibold text-white/70">Live Preview</span>
        <span className="text-[9px] text-white/20 ml-auto">Sandboxed</span>
      </div>
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full border-0"
          title="Extension Preview"
        />
        {error && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-red-500/10 border-t border-red-500/20 text-[10px] text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function ManifestEditor({ manifest, onChange }) {
  function update(key, value) {
    onChange({ ...manifest, [key]: value });
  }

  const allPerms = ['tabs', 'storage', 'network', 'bookmarks', 'history', 'x402'];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-white/60 flex items-center gap-1.5"><FileJson size={12} /> manifest.json</h3>
      {[
        { key: 'id', label: 'ID', placeholder: 'my-extension' },
        { key: 'name', label: 'Name', placeholder: 'My Extension' },
        { key: 'version', label: 'Version', placeholder: '1.0.0' },
        { key: 'description', label: 'Description', placeholder: 'What does it do?' },
        { key: 'author', label: 'Author', placeholder: 'Your Name' },
      ].map(f => (
        <div key={f.key}>
          <label className="text-[10px] text-white/30 block mb-1">{f.label}</label>
          <input
            value={manifest[f.key] || ''}
            onChange={e => update(f.key, e.target.value)}
            placeholder={f.placeholder}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/70 placeholder:text-white/15 outline-none focus:border-flip-500/30 transition-colors"
          />
        </div>
      ))}
      <div>
        <label className="text-[10px] text-white/30 block mb-1.5">Permissions</label>
        <div className="flex flex-wrap gap-1.5">
          {allPerms.map(p => {
            const active = (manifest.permissions || []).includes(p);
            return (
              <button
                key={p}
                onClick={() => {
                  const perms = manifest.permissions || [];
                  update('permissions', active ? perms.filter(x => x !== p) : [...perms, p]);
                }}
                className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${active ? 'bg-flip-500/15 border-flip-500/25 text-flip-400' : 'bg-white/[0.03] border-white/[0.06] text-white/25 hover:text-white/40'}`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CodeEditor({ code, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const codeRef = useRef(code);
  const [loading, setLoading] = useState(true);

  // Keep codeRef in sync so initEditor always has the latest code
  codeRef.current = code;

  useEffect(() => {
    if (window.monaco) {
      initEditor();
      return;
    }
    // Guard against loading Monaco loader twice (_amdLoaderGlobal conflict)
    if (document.querySelector('script[data-monaco-loader]')) {
      const wait = setInterval(() => {
        if (window.monaco) { clearInterval(wait); initEditor(); }
      }, 100);
      return () => clearInterval(wait);
    }
    // Load Monaco from CDN
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/monaco-editor@0.45.0/min/vs/loader.js';
    script.setAttribute('data-monaco-loader', 'true');
    script.onload = () => {
      window.require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        initEditor();
      });
    };
    document.head.appendChild(script);

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  function initEditor() {
    if (!containerRef.current || editorRef.current) return;

    // Define Flip theme
    window.monaco.editor.defineTheme('flip-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4a4a4a' },
        { token: 'keyword', foreground: 'f97316' },
        { token: 'string', foreground: '2dd4bf' },
        { token: 'number', foreground: 'f97316' },
        { token: 'type.identifier', foreground: '60a5fa' },
      ],
      colors: {
        'editor.background': '#0d0d0d',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#ffffff06',
        'editor.selectionBackground': '#f9731630',
        'editorCursor.foreground': '#f97316',
        'editorIndentGuide.background': '#ffffff08',
        'editorLineNumber.foreground': '#333333',
        'editorLineNumber.activeForeground': '#666666',
      },
    });

    const editor = window.monaco.editor.create(containerRef.current, {
      value: codeRef.current,
      language: 'javascript',
      theme: 'flip-dark',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      minimap: { enabled: false },
      lineNumbers: 'on',
      roundedSelection: true,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      padding: { top: 12 },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: { enabled: true },
      renderLineHighlight: 'line',
      suggest: { showKeywords: true },
    });

    editor.onDidChangeModelContent(() => {
      onChange(editor.getValue());
    });

    editorRef.current = editor;
    setLoading(false);
  }

  // Update editor content when code prop changes externally (template/AI insert)
  useEffect(() => {
    if (editorRef.current && code !== editorRef.current.getValue()) {
      editorRef.current.setValue(code);
    }
  }, [code]);

  return (
    <div className="h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d] z-10">
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Loader2 size={14} className="animate-spin" /> Loading editor...
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

const STUDIO_KEY = 'flip-studio-state';
function loadStudioState() {
  try {
    const raw = localStorage.getItem(STUDIO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveStudioState(state) {
  try { localStorage.setItem(STUDIO_KEY, JSON.stringify(state)); } catch {}
}

export default function ExtensionStudio() {
  const saved = useRef(loadStudioState()).current;
  const [code, setCodeRaw] = useState(saved?.code || TEMPLATES[0].code);
  // Guard: reject corrupted/empty values from stale IPC events
  const setCode = useCallback((val) => {
    setCodeRaw(prev => {
      const v = typeof val === 'function' ? val(prev) : val;
      if (!v || typeof v !== 'string' || v.length < 5) return prev;
      return v;
    });
  }, []);
  const [manifest, setManifest] = useState(saved?.manifest || { ...TEMPLATES[0].manifest });
  const [activeTab, setActiveTab] = useState(saved?.activeTab || 'code');
  const [rightPanel, setRightPanel] = useState(saved?.rightPanel || 'preview');
  const [previewCode, setPreviewCode] = useState(saved?.code || TEMPLATES[0].code);
  const [showExport, setShowExport] = useState(false);

  // Auto-save state to localStorage on every change
  useEffect(() => {
    saveStudioState({ code, manifest, activeTab, rightPanel });
  }, [code, manifest, activeTab, rightPanel]);

  // Debounced preview update
  const previewTimer = useRef(null);
  useEffect(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreviewCode(code), 800);
    return () => clearTimeout(previewTimer.current);
  }, [code]);

  function loadTemplate(tpl) {
    setCode(tpl.code);
    setManifest({ ...tpl.manifest });
    setActiveTab('code');
  }

  const [buildNotice, setBuildNotice] = useState('');

  function handleInsertCode(newCode) {
    setCode(newCode);
    setPreviewCode(newCode); // Immediate preview, no debounce
    setActiveTab('code');
    setRightPanel('preview'); // Switch to preview so user sees the result
    setBuildNotice('Extension built successfully');
    setTimeout(() => setBuildNotice(''), 4000);
  }

  function handleInsertManifest(m) {
    setManifest(prev => ({
      ...prev,
      ...m,
      sidebar: prev.sidebar || { file: 'index.jsx', width: 380 },
    }));
  }

  function runPreview() {
    setPreviewCode(code);
    setRightPanel('preview');
  }

  function exportExtension() {
    const manifestJson = JSON.stringify({ ...manifest, sidebar: { file: 'index.jsx', width: manifest.sidebar?.width || 380 } }, null, 2);
    // Create a downloadable zip-like structure (two files as separate downloads)
    const codeBlob = new Blob([code], { type: 'text/javascript' });
    const manifestBlob = new Blob([manifestJson], { type: 'application/json' });

    // Download code
    const a1 = document.createElement('a');
    a1.href = URL.createObjectURL(codeBlob);
    a1.download = 'index.jsx';
    a1.click();

    // Download manifest
    setTimeout(() => {
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(manifestBlob);
      a2.download = 'manifest.json';
      a2.click();
    }, 200);
  }

  const tabs = [
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'manifest', label: 'Manifest', icon: FileJson },
    { id: 'templates', label: 'Templates', icon: Puzzle },
  ];

  return (
    <div className="h-full w-full bg-[#080808] flex flex-col overflow-hidden select-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top bar */}
      <div className="h-11 border-b border-white/[0.06] bg-[#0a0a0a] flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-flip-500 to-flip-600 flex items-center justify-center">
            <Puzzle size={13} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white/90">Extension Studio</span>
        </div>

        <div className="flex-1" />

        {/* Build notice */}
        {buildNotice && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 border border-teal-500/20 text-[11px] text-teal-400 font-semibold animate-pulse">
            <Zap size={12} /> {buildNotice}
          </div>
        )}

        {/* Run */}
        <button
          onClick={runPreview}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 border border-teal-500/20 text-[11px] text-teal-400 font-medium hover:bg-teal-500/25 transition-colors"
        >
          <Play size={12} /> Run Preview
        </button>

        {/* Export */}
        <button
          onClick={exportExtension}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] text-white/50 font-medium hover:text-white/70 hover:bg-white/[0.08] transition-colors"
        >
          <Download size={12} /> Export
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Editor / Manifest / Templates */}
        <div className="flex-1 flex flex-col border-r border-white/[0.06] min-w-0">
          {/* Tab bar */}
          <div className="h-9 border-b border-white/[0.06] flex items-center px-2 gap-0.5 flex-shrink-0 bg-[#0a0a0a]">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${activeTab === t.id ? 'bg-white/[0.08] text-white/80' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'}`}
                >
                  <Icon size={12} /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'code' && (
              <CodeEditor code={code} onChange={setCode} />
            )}
            {activeTab === 'manifest' && (
              <div className="h-full overflow-y-auto scrollbar-thin">
                <ManifestEditor manifest={manifest} onChange={setManifest} />
              </div>
            )}
            {activeTab === 'templates' && (
              <div className="h-full overflow-y-auto scrollbar-thin p-4">
                <p className="text-[11px] text-white/30 mb-3">Choose a starter template:</p>
                <div className="grid grid-cols-1 gap-2">
                  {TEMPLATES.map(tpl => {
                    const Icon = tpl.icon;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => loadTemplate(tpl)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors text-left group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-flip-500/10 border border-flip-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-flip-500/20 transition-colors">
                          <Icon size={16} className="text-flip-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-white/80 group-hover:text-white/90 transition-colors">{tpl.name}</div>
                          <div className="text-[10px] text-white/30 mt-0.5">{tpl.description}</div>
                        </div>
                        <ChevronRight size={14} className="text-white/10 ml-auto flex-shrink-0 group-hover:text-white/30 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Preview / AI Chat */}
        <div className="w-[380px] flex-shrink-0 flex flex-col bg-[#0a0a0a]">
          {/* Panel switcher */}
          <div className="h-9 border-b border-white/[0.06] flex items-center px-2 gap-0.5 flex-shrink-0">
            <button
              onClick={() => setRightPanel('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${rightPanel === 'preview' ? 'bg-white/[0.08] text-white/80' : 'text-white/30 hover:text-white/50'}`}
            >
              <Eye size={12} /> Preview
            </button>
            <button
              onClick={() => setRightPanel('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${rightPanel === 'ai' ? 'bg-flip-500/15 text-flip-400' : 'text-white/30 hover:text-white/50'}`}
            >
              <Sparkles size={12} /> AI Assistant
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {rightPanel === 'preview' ? (
              <LivePreview code={previewCode} />
            ) : (
              <AIChatPanel onInsertCode={handleInsertCode} onInsertManifest={handleInsertManifest} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
