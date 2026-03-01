import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, X, Trash2, Copy, Check, Loader2, FileText, ArrowDownUp } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../store/browserStore';

// AI Tab Assistant — "Chat with this page" sidebar panel
// Extracts page content and enables multi-turn conversation

export default function AiTabAssistant({ onClose }) {
  const { tabs, activeTabId } = useBrowserStore();
  const activeTab = tabs.find(t => t.id === activeTabId);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageContent, setPageContent] = useState('');
  const [pageExtracted, setPageExtracted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(null);
  const responseRef = useRef('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Extract page content from active webview
  const extractPageContent = useCallback(async () => {
    if (!activeTabId) return;
    setExtracting(true);
    try {
      // Use a custom event to ask WebContent to extract text
      const result = await new Promise((resolve) => {
        const handler = (e) => {
          window.removeEventListener('flip-page-content-result', handler);
          resolve(e.detail);
        };
        window.addEventListener('flip-page-content-result', handler);
        window.dispatchEvent(new CustomEvent('flip-extract-page-content', {
          detail: { tabId: activeTabId },
        }));
        // Timeout after 10s
        setTimeout(() => {
          window.removeEventListener('flip-page-content-result', handler);
          resolve({ text: '', error: 'Extraction timed out' });
        }, 10000);
      });

      if (result?.text) {
        // Truncate to ~8000 chars to fit in context window
        const truncated = result.text.length > 8000
          ? result.text.slice(0, 8000) + '\n\n[... content truncated for context limits]'
          : result.text;
        setPageContent(truncated);
        setPageExtracted(true);
        setMessages([{
          role: 'assistant',
          content: `I've loaded the content from **"${activeTab?.title || 'this page'}"** (${result.text.length.toLocaleString()} characters). Ask me anything about it!`,
        }]);
      } else {
        setMessages([{
          role: 'assistant',
          content: 'Could not extract page content. The page may be empty or using a format I can\'t read.',
        }]);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: `Error extracting page: ${e.message}` }]);
    }
    setExtracting(false);
  }, [activeTabId, activeTab?.title]);

  // Extract on mount
  useEffect(() => {
    if (!pageExtracted && activeTabId && !activeTab?.url?.startsWith('flip://')) {
      extractPageContent();
    }
  }, [activeTabId]);

  // Send message
  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    responseRef.current = '';

    // Remove any previous stream listeners before registering new ones
    cleanupStreamListeners();

    // Build the conversation for AI
    const systemContent = pageContent
      ? `You are Flip AI Tab Assistant. The user is chatting about a web page. Here is the page content:\n\n---\n${pageContent}\n---\n\nAnswer the user's questions about this page content. Be concise and helpful. Use markdown formatting.`
      : 'You are Flip AI Tab Assistant. The user wants to chat about a web page, but the content could not be extracted. Help them as best you can.';

    const apiMessages = [
      { role: 'system', content: systemContent },
      ...newMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    try {
      // Set up streaming
      const tokenHandler = (token) => {
        responseRef.current += token;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last._streaming) {
            return [...prev.slice(0, -1), { role: 'assistant', content: responseRef.current, _streaming: true }];
          }
          return [...prev, { role: 'assistant', content: responseRef.current, _streaming: true }];
        });
      };
      const doneHandler = () => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?._streaming) {
            const { _streaming, ...clean } = last;
            return [...prev.slice(0, -1), clean];
          }
          return prev;
        });
        setLoading(false);
        cleanupStreamListeners();
      };
      unsubTokenRef.current = window.flipAPI?.onAiStreamToken(tokenHandler);
      unsubDoneRef.current = window.flipAPI?.onAiStreamDone(doneHandler);

      const result = await window.flipAPI?.aiChat({
        messages: apiMessages,
        stream: true,
        rawSystem: true,
      });

      // Handle non-streaming responses
      if (result && typeof result === 'string') {
        setMessages(prev => [...prev, { role: 'assistant', content: result }]);
        setLoading(false);
        cleanupStreamListeners();
      } else if (result?.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
        setLoading(false);
        cleanupStreamListeners();
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      setLoading(false);
      cleanupStreamListeners();
    }
  }

  // Compare tabs feature
  async function compareTabs() {
    const otherTabs = tabs.filter(t => t.id !== activeTabId && !t.url?.startsWith('flip://'));
    if (otherTabs.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No other tabs open to compare with.' }]);
      return;
    }
    // For now, just tell the user which tabs are available
    const tabList = otherTabs.map(t => `- **${t.title || t.url}**`).join('\n');
    setInput(`Compare this page with the content on: `);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `Here are your other open tabs:\n\n${tabList}\n\nTell me what you'd like to compare!`,
    }]);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 shrink-0">
        <div className="w-6 h-6 rounded-lg bg-flip-500/15 flex items-center justify-center">
          <Bot size={13} className="text-flip-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-white/80 font-semibold">Chat with Page</span>
          {activeTab && (
            <p className="text-[9px] text-white/30 truncate">{activeTab.title || activeTab.url}</p>
          )}
        </div>
        <button
          onClick={compareTabs}
          className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
          title="Compare with another tab"
        >
          <ArrowDownUp size={12} />
        </button>
        <button
          onClick={() => { setMessages([]); setPageExtracted(false); setPageContent(''); }}
          className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
          title="Clear conversation"
        >
          <Trash2 size={12} />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Extraction status */}
      {extracting && (
        <div className="flex items-center gap-2 px-3 py-2 bg-flip-500/5 border-b border-white/5">
          <Loader2 size={12} className="animate-spin text-flip-400" />
          <span className="text-[10px] text-white/40">Reading page content...</span>
        </div>
      )}

      {/* Not extracted yet prompt */}
      {!pageExtracted && !extracting && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5">
          <FileText size={12} className="text-white/30" />
          <span className="text-[10px] text-white/40">
            {activeTab?.url?.startsWith('flip://') ? 'Internal pages cannot be analyzed' : 'Page content not loaded'}
          </span>
          {!activeTab?.url?.startsWith('flip://') && (
            <button
              onClick={extractPageContent}
              className="ml-auto text-[9px] text-flip-400/60 hover:text-flip-400 transition-colors"
            >
              Load content
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx(
              'max-w-[90%] rounded-xl px-3 py-2 text-[11px] leading-relaxed',
              msg.role === 'user'
                ? 'bg-flip-500/15 text-white/80 rounded-br-sm'
                : 'bg-white/[0.04] text-white/70 rounded-bl-sm border border-white/5'
            )}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'assistant' && msg.content && !msg._streaming && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.content);
                    setCopied(i);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className="mt-1 text-[8px] text-white/20 hover:text-white/50 transition-colors"
                >
                  {copied === i ? '✓ Copied' : 'Copy'}
                </button>
              )}
              {msg._streaming && (
                <span className="inline-block w-1.5 h-3 bg-flip-400/60 animate-pulse ml-0.5 rounded-sm" />
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/5">
              <Loader2 size={12} className="animate-spin text-white/30" />
              <span className="text-[10px] text-white/30">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="shrink-0 px-3 py-2 border-t border-white/5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 focus-within:border-flip-500/30 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this page..."
            className="flex-1 bg-transparent text-[11px] text-white/80 placeholder-white/25 outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-1 rounded-md text-flip-400/60 hover:text-flip-400 disabled:text-white/15 transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
        <div className="text-[7px] text-white/10 mt-1 text-center">
          Ask questions · Extract data · Summarize sections
        </div>
      </form>
    </div>
  );
}
