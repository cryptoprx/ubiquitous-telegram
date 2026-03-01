import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Copy, Check, Loader2, Bot, Maximize2, RotateCw } from 'lucide-react';
import clsx from 'clsx';

// Floating AI response overlay — shown for inline AI actions (context menu, page summarize)
// Renders a draggable card with streaming AI response

export default function AiOverlay() {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(''); // 'explain' | 'translate' | 'rewrite' | 'summarize' | 'define' | 'code'
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const responseRef = useRef('');
  const cardRef = useRef(null);
  const dragRef = useRef({ dragging: false, ox: 0, oy: 0 });
  const unsubTokenRef = useRef(null);
  const unsubDoneRef = useRef(null);

  // Cleanup stream listeners helper
  function cleanupStreamListeners() {
    if (unsubTokenRef.current) { unsubTokenRef.current(); unsubTokenRef.current = null; }
    if (unsubDoneRef.current) { unsubDoneRef.current(); unsubDoneRef.current = null; }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupStreamListeners();
  }, []);

  const runQuery = useCallback(async (prompt, modeLabel, pos) => {
    setVisible(true);
    setQuery(prompt);
    setMode(modeLabel);
    setResponse('');
    setLoading(true);
    responseRef.current = '';
    setCopied(false);

    // Remove any previous stream listeners before registering new ones
    cleanupStreamListeners();

    // Position near the trigger point, but clamped within viewport
    const x = Math.min(Math.max(pos?.x || 200, 20), window.innerWidth - 420);
    const y = Math.min(Math.max(pos?.y || 200, 60), window.innerHeight - 300);
    setPosition({ x, y });

    try {
      const tokenHandler = (token) => {
        responseRef.current += token;
        setResponse(responseRef.current);
      };
      const doneHandler = () => {
        setLoading(false);
        cleanupStreamListeners();
      };
      unsubTokenRef.current = window.flipAPI?.onAiStreamToken(tokenHandler);
      unsubDoneRef.current = window.flipAPI?.onAiStreamDone(doneHandler);

      const result = await window.flipAPI?.aiChat({
        messages: [
          { role: 'system', content: 'You are Flip AI, a helpful browser assistant. Respond ONLY with helpful, human-readable text. Be concise, clear, and well-formatted. Use markdown where helpful. Do NOT output JSON. Do NOT output action commands. Do NOT try to navigate or browse. Just answer the user\'s question directly.' },
          { role: 'user', content: prompt },
        ],
        stream: true,
        rawSystem: true,
      });

      if (result && typeof result === 'string') {
        setResponse(result);
        setLoading(false);
        cleanupStreamListeners();
      } else if (result?.content) {
        setResponse(result.content);
        setLoading(false);
        cleanupStreamListeners();
      }
    } catch {
      setResponse('AI is not configured. Go to Settings → AI to set up your model.');
      setLoading(false);
      cleanupStreamListeners();
    }
  }, []);

  // Listen for AI overlay events from context menu
  useEffect(() => {
    function handleEvent(e) {
      const { prompt, mode: m, x, y } = e.detail || {};
      if (prompt) runQuery(prompt, m || '', { x, y });
    }
    window.addEventListener('flip-ai-overlay', handleEvent);
    return () => window.removeEventListener('flip-ai-overlay', handleEvent);
  }, [runQuery]);

  // Dragging logic
  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.dragging) return;
      setPosition({
        x: e.clientX - dragRef.current.ox,
        y: e.clientY - dragRef.current.oy,
      });
    }
    function onUp() { dragRef.current.dragging = false; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startDrag(e) {
    dragRef.current = { dragging: true, ox: e.clientX - position.x, oy: e.clientY - position.y };
  }

  if (!visible) return null;

  const modeLabels = {
    explain: 'Explain',
    define: 'Define',
    translate: 'Translate',
    rewrite: 'Rewrite',
    summarize: 'Summarize Page',
    code: 'Explain Code',
  };

  return (
    <div
      ref={cardRef}
      className="fixed z-[200] animate-fade-in"
      style={{ left: position.x, top: position.y, width: 400, maxWidth: 'calc(100vw - 40px)' }}
    >
      <div className="rounded-2xl bg-[#1a1816]/98 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/70 overflow-hidden flex flex-col max-h-[50vh]">
        {/* Draggable header */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-move select-none shrink-0"
          onMouseDown={startDrag}
        >
          <div className="w-5 h-5 rounded-md bg-flip-500/15 flex items-center justify-center">
            <Bot size={11} className="text-flip-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] text-flip-400/60 font-medium uppercase tracking-wider">
              {modeLabels[mode] || 'Flip AI'}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {response && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(response);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="p-1 rounded-md text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
                title="Copy"
              >
                {copied ? <Check size={11} className="text-accent-400" /> : <Copy size={11} />}
              </button>
            )}
            <button
              onClick={() => {
                setVisible(false);
                window.dispatchEvent(new CustomEvent('flip-open-extension', { detail: { extensionId: 'ai-chat' } }));
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('flip-ai-prompt', { detail: { prompt: query } }));
                }, 300);
              }}
              className="p-1 rounded-md text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
              title="Open in AI Chat"
            >
              <Maximize2 size={11} />
            </button>
            <button
              onClick={() => setVisible(false)}
              className="p-1 rounded-md text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
            >
              <X size={11} />
            </button>
          </div>
        </div>

        {/* Response body */}
        <div className="overflow-y-auto px-3 py-2.5 text-[11px] text-white/75 leading-relaxed whitespace-pre-wrap">
          {loading && !response ? (
            <div className="flex items-center gap-2 py-3 text-white/25">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-[10px]">Thinking...</span>
            </div>
          ) : (
            <>
              {response}
              {loading && <span className="inline-block w-1.5 h-3 bg-flip-400/60 animate-pulse ml-0.5 rounded-sm" />}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-white/5 shrink-0">
          <span className="text-[7px] text-white/15">Drag to move · Click outside to dismiss</span>
        </div>
      </div>
    </div>
  );
}
