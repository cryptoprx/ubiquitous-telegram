import React, { useState, useCallback } from 'react';
import {
  Code2, BookOpen, Rocket, ChevronRight, ChevronDown,
  FileJson, FileCode, Shield, Zap, Eye, Package,
  CheckCircle2, AlertCircle, Play, Save, RefreshCw,
  Layers, Database, Bell, Info, Copy, Terminal,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

const TEMPLATES = {
  blank: {
    label: 'Blank Extension',
    desc: 'Empty starter with basic structure',
    manifest: {
      name: 'My Extension',
      version: '1.0.0',
      description: 'A custom Flip Browser extension',
      author: '',
      type: 'sidebar',
      main: 'App.jsx',
      permissions: [],
      api_version: '1.0',
    },
    code: `function App() {
  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>My Extension</h2>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
        Start building your extension here!
      </p>
    </div>
  );
}`,
  },
  tabs: {
    label: 'Tab Manager',
    desc: 'List and manage open tabs',
    manifest: {
      name: 'Tab Manager',
      version: '1.0.0',
      description: 'View and manage browser tabs',
      author: '',
      type: 'sidebar',
      main: 'App.jsx',
      permissions: ['tabs'],
      api_version: '1.0',
    },
    code: `function App() {
  const [tabs, setTabs] = React.useState([]);

  React.useEffect(() => {
    loadTabs();
  }, []);

  async function loadTabs() {
    if (window.Flip) {
      const allTabs = await Flip.tabs.getAll();
      setTabs(allTabs || []);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>Open Tabs</h2>
        <button onClick={loadTabs}>Refresh</button>
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab.favicon && <img src={tab.favicon} style={{ width: 16, height: 16, borderRadius: 3 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab.title || 'Untitled'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              {tab.url}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}`,
  },
  notes: {
    label: 'Notes App',
    desc: 'Persistent notes with storage API',
    manifest: {
      name: 'Quick Notes',
      version: '1.0.0',
      description: 'Take notes that persist across sessions',
      author: '',
      type: 'sidebar',
      main: 'App.jsx',
      permissions: ['storage'],
      api_version: '1.0',
    },
    code: `function App() {
  const [notes, setNotes] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      if (window.Flip) {
        const data = await Flip.storage.get('notes');
        if (data) setNotes(data);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (window.Flip) {
      await Flip.storage.set('notes', notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>Quick Notes</h2>
        <button onClick={handleSave}>
          {saved ? '\\u2713 Saved' : 'Save'}
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type your notes here..."
        style={{ width: '100%', minHeight: 200, resize: 'vertical' }}
      />
    </div>
  );
}`,
  },
};

const AVAILABLE_PERMISSIONS = [
  { id: 'tabs', label: 'Tabs', desc: 'Read and manage browser tabs', icon: Layers },
  { id: 'storage', label: 'Storage', desc: 'Save and read persistent data', icon: Database },
  { id: 'cross_storage', label: 'Cross Storage', desc: 'Read/write other extensions\' data', icon: Shield },
];

export default function DevDashboard() {
  const [activeTab, setActiveTab] = useState('docs');

  const navItems = [
    { id: 'docs', label: 'Documentation', icon: BookOpen, desc: 'Learn the extension API' },
    { id: 'create', label: 'Create Extension', icon: Rocket, desc: 'Scaffold a new extension' },
  ];

  return (
    <div className="flex-1 flex h-full w-full min-h-0 bg-surface-0">
      {/* Left sidebar nav */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-white/5 bg-surface-1/50 overflow-y-auto">
        {/* Header */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center">
              <Code2 size={18} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white/90">Developer</h1>
              <p className="text-[10px] text-white/30">Extension Studio</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex flex-col gap-0.5 px-3 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
                activeTab === item.id
                  ? 'bg-flip-500/10 text-white/90'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
              )}
            >
              <item.icon size={16} className={activeTab === item.id ? 'text-flip-400' : ''} />
              <div>
                <div className="text-[12px] font-medium">{item.label}</div>
                <div className="text-[9px] text-white/20">{item.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-[9px] text-white/15">
            <Shield size={10} />
            <span>Extensions are sandboxed</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-white/15 mt-1">
            <Zap size={10} />
            <span>React 18 + Babel JSX</span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'docs' && <DocsTab />}
        {activeTab === 'create' && <CreateTab />}
      </div>
    </div>
  );
}

function DocsTab() {
  const [openSection, setOpenSection] = useState('getting-started');

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Rocket,
      content: (
        <div className="space-y-4">
          <p>Flip extensions are <strong>React components</strong> that run in a sandboxed iframe inside the browser sidebar.</p>
          <StepList steps={[
            'Create a folder with a unique name (e.g. my-extension)',
            'Add a manifest.json file with metadata and permissions',
            'Write your App.jsx — a React component that exports App',
            'Install via Extension Manager or use the Create Extension page',
          ]} />
          <InfoBox>No build step needed — Flip transpiles JSX in the browser using Babel.</InfoBox>
          <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h4 className="text-[12px] font-semibold text-white/70 mb-2">Folder Structure</h4>
            <CodeBlock lang="text">{`extensions/
├── my-extension/
│   ├── manifest.json    ← Required: metadata + config
│   └── App.jsx          ← Required: React component entry`}</CodeBlock>
          </div>
        </div>
      ),
    },
    {
      id: 'manifest',
      title: 'manifest.json',
      icon: FileJson,
      content: (
        <div className="space-y-3">
          <p>Every extension needs a <code>manifest.json</code>:</p>
          <CodeBlock lang="json">{`{
  "name": "My Extension",
  "version": "1.0.0",
  "description": "What it does",
  "author": "Your Name",
  "type": "sidebar",
  "main": "App.jsx",
  "permissions": ["tabs", "storage"],
  "api_version": "1.0"
}`}</CodeBlock>
          <div className="space-y-1.5">
            <PropRow name="type" values="sidebar | popup | toolbar" />
            <PropRow name="main" values="Entry JSX file (default: App.jsx)" />
            <PropRow name="permissions" values="tabs, storage, cross_storage" />
            <PropRow name="content_type" values="webview (optional, for loading URLs)" />
          </div>
        </div>
      ),
    },
    {
      id: 'app-jsx',
      title: 'App.jsx Structure',
      icon: FileCode,
      content: (
        <div className="space-y-3">
          <p>Your entry file must export a function called <code>App</code>:</p>
          <CodeBlock lang="jsx">{`function App() {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    // Initialize your extension
  }, []);

  return (
    <div>
      <h2>My Extension</h2>
      {/* Your UI here */}
    </div>
  );
}`}</CodeBlock>
          <InfoBox>Use <code>React.useState</code> and <code>React.useEffect</code> — React is available globally in the sandbox.</InfoBox>
        </div>
      ),
    },
    {
      id: 'tabs-api',
      title: 'Tabs API',
      icon: Layers,
      content: (
        <div className="space-y-3">
          <p>Requires <code>"tabs"</code> permission in manifest.</p>
          <CodeBlock lang="js">{`// Get all open tabs
const tabs = await Flip.tabs.getAll();
// → [{id, url, title, favicon}]

// Get active tab
const active = await Flip.tabs.getActive();
// → {id, url, title}

// Open a new tab
await Flip.tabs.create('https://example.com');

// Navigate an existing tab
await Flip.tabs.navigate(tabId, 'https://example.com');

// Close a tab
await Flip.tabs.close(tabId);`}</CodeBlock>
        </div>
      ),
    },
    {
      id: 'storage-api',
      title: 'Storage API',
      icon: Database,
      content: (
        <div className="space-y-3">
          <p>Requires <code>"storage"</code> permission. Data persists across sessions.</p>
          <CodeBlock lang="js">{`// Save a value
await Flip.storage.set('myKey', { any: 'data' });

// Read a value
const data = await Flip.storage.get('myKey');

// Cross-extension storage (needs "cross_storage")
await Flip.storage.crossGet('other-ext-id', 'key');
await Flip.storage.crossSet('other-ext-id', 'key', val);`}</CodeBlock>
          <InfoBox>Storage is namespaced per extension. Max 1MB per key.</InfoBox>
        </div>
      ),
    },
    {
      id: 'ui-api',
      title: 'UI API',
      icon: Bell,
      content: (
        <div className="space-y-3">
          <p>Always available — no permission needed.</p>
          <CodeBlock lang="js">{`// Show a notification
Flip.ui.showNotification('Hello!', 'info');

// Set badge on extension icon
Flip.ui.setBadge('3');

// Get browser info
const info = Flip.browser.getInfo();
// → {name: 'Flip Browser', version: '1.0.0'}`}</CodeBlock>
        </div>
      ),
    },
    {
      id: 'security',
      title: 'Security & Sandboxing',
      icon: Shield,
      content: (
        <div className="space-y-3">
          <p>Extensions run in a <strong>sandboxed iframe</strong> with strict security:</p>
          <StepList steps={[
            'Extensions cannot access the browser\'s DOM or state directly',
            'All communication goes through the Flip SDK (postMessage)',
            'Permissions are enforced — undeclared APIs are blocked',
            'Rate limited to 30 API calls/sec per type',
            'Dangerous URL protocols (file://, javascript://) are blocked',
            'Source code is sanitized to prevent injection attacks',
            'Storage values capped at 1MB per key',
            'CSP restricts script sources to unpkg.com CDN only',
            'Network access blocked by default — requires "network" permission in manifest',
            'Popups blocked by default — requires "popups" permission in manifest',
            'Cross-extension storage write requires "cross_storage_write" permission',
            'API keys are masked — extensions never see raw keys',
            'Marketplace approval gate — only reviewed extensions can be installed',
          ]} />
          <InfoBox type="warning">Never request more permissions than you need. Users can see what your extension accesses. Extensions without "network" permission cannot make any HTTP requests.</InfoBox>
        </div>
      ),
    },
    {
      id: 'css',
      title: 'Built-in CSS',
      icon: Eye,
      content: (
        <div className="space-y-3">
          <p>Extensions get a dark theme stylesheet automatically:</p>
          <CodeBlock lang="html">{`<!-- Pre-styled elements -->
<button>Styled Button</button>
<input placeholder="Styled Input" />
<textarea>Styled Textarea</textarea>

<!-- Utility classes -->
<div class="card">Card container</div>
<span class="badge">Badge pill</span>
<a href="#">Themed link</a>`}</CodeBlock>
          <p className="text-[10px] text-white/30">All elements auto-match Flip's dark theme with orange accents.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 pt-8 pb-4">
        <h2 className="text-lg font-bold text-white/90">Extension Developer Guide</h2>
        <p className="text-xs text-white/40 mt-1">Build React components that run inside Flip Browser</p>
      </div>
      <div className="max-w-3xl mx-auto px-8 pb-8 space-y-2">
        {sections.map((section) => (
          <div key={section.id} className="rounded-2xl border border-white/[0.05] overflow-hidden bg-white/[0.01]">
            <button
              onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
            >
              <section.icon size={16} className={openSection === section.id ? 'text-flip-400' : 'text-white/30'} />
              <span className={clsx('text-[13px] font-medium flex-1', openSection === section.id ? 'text-white/85' : 'text-white/50')}>
                {section.title}
              </span>
              {openSection === section.id
                ? <ChevronDown size={14} className="text-white/20" />
                : <ChevronRight size={14} className="text-white/20" />}
            </button>
            {openSection === section.id && (
              <div className="px-5 pb-5 text-[12px] text-white/60 leading-relaxed">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateTab() {
  const { addExtension, setExtensions } = useBrowserStore();
  const [step, setStep] = useState('template'); // 'template' | 'config' | 'code'
  const [template, setTemplate] = useState('blank');
  const [extId, setExtId] = useState('');
  const [manifest, setManifest] = useState({ ...TEMPLATES.blank.manifest });
  const [code, setCode] = useState(TEMPLATES.blank.code);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  function selectTemplate(key) {
    setTemplate(key);
    const t = TEMPLATES[key];
    setManifest({ ...t.manifest });
    setCode(t.code);
    if (!extId) {
      setExtId(t.manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    }
  }

  function updateManifest(updates) {
    setManifest((prev) => ({ ...prev, ...updates }));
  }

  function togglePermission(perm) {
    setManifest((prev) => {
      const perms = prev.permissions || [];
      return {
        ...prev,
        permissions: perms.includes(perm)
          ? perms.filter((p) => p !== perm)
          : [...perms, perm],
      };
    });
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);

    if (!extId.trim()) {
      setError('Extension ID is required');
      setSaving(false);
      return;
    }
    if (!manifest.name.trim()) {
      setError('Extension name is required');
      setSaving(false);
      return;
    }

    try {
      if (window.flipAPI?.createExtension) {
        const result = await window.flipAPI.createExtension({
          id: extId.trim(),
          manifest,
          sourceCode: code,
        });

        if (result.error) {
          setError(result.error);
        } else {
          // Reload extensions to pick up the new one
          const exts = await window.flipAPI.loadExtensions();
          if (exts) setExtensions(exts);
          setSuccess(`"${manifest.name}" created successfully!`);
          setTimeout(() => setSuccess(null), 4000);
        }
      } else {
        setError('Extension API not available (requires Electron)');
      }
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Step indicators */}
      <div className="max-w-3xl mx-auto flex items-center gap-2 px-8 pt-8 pb-4">
        {['template', 'config', 'code'].map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => setStep(s)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all',
                step === s
                  ? 'bg-flip-500/15 text-flip-400'
                  : 'text-white/30 hover:text-white/50'
              )}
            >
              <span className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                step === s ? 'bg-flip-500 text-white' : 'bg-white/10 text-white/40'
              )}>
                {i + 1}
              </span>
              {s === 'template' ? 'Template' : s === 'config' ? 'Configure' : 'Code'}
            </button>
            {i < 2 && <ChevronRight size={12} className="text-white/10" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="max-w-3xl mx-auto px-8 pb-8">
        {step === 'template' && (
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => { selectTemplate(key); setStep('config'); }}
                className={clsx(
                  'text-left p-5 rounded-2xl border transition-all',
                  template === key
                    ? 'border-flip-500/30 bg-flip-500/5'
                    : 'border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]'
                )}
              >
                <div className="text-[13px] font-medium text-white/80">{t.label}</div>
                <div className="text-[11px] text-white/30 mt-1">{t.desc}</div>
              </button>
            ))}
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-5">
            {/* Two-column form grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-white/40 block mb-1.5">Extension ID</label>
                <input
                  type="text"
                  value={extId}
                  onChange={(e) => setExtId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="my-extension"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15 font-mono"
                />
                <p className="text-[9px] text-white/20 mt-1">Lowercase letters, numbers, hyphens only</p>
              </div>
              <div>
                <label className="text-[11px] text-white/40 block mb-1.5">Extension Name</label>
                <input
                  type="text"
                  value={manifest.name}
                  onChange={(e) => updateManifest({ name: e.target.value })}
                  placeholder="My Extension"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-white/40 block mb-1.5">Description</label>
                <input
                  type="text"
                  value={manifest.description}
                  onChange={(e) => updateManifest({ description: e.target.value })}
                  placeholder="What does your extension do?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/40 block mb-1.5">Author</label>
                <input
                  type="text"
                  value={manifest.author}
                  onChange={(e) => updateManifest({ author: e.target.value })}
                  placeholder="Your name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/40 block mb-1.5">Version</label>
                <input
                  type="text"
                  value={manifest.version}
                  onChange={(e) => updateManifest({ version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15 font-mono"
                />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="text-[11px] text-white/40 block mb-2">Permissions</label>
              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <button
                    key={perm.id}
                    onClick={() => togglePermission(perm.id)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                      manifest.permissions?.includes(perm.id)
                        ? 'border-flip-500/25 bg-flip-500/5'
                        : 'border-white/[0.06] hover:border-white/[0.1]'
                    )}
                  >
                    <perm.icon size={16} className={manifest.permissions?.includes(perm.id) ? 'text-flip-400' : 'text-white/20'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-white/70">{perm.label}</div>
                      <div className="text-[10px] text-white/25">{perm.desc}</div>
                    </div>
                    <div className={clsx(
                      'w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0',
                      manifest.permissions?.includes(perm.id)
                        ? 'border-flip-500 bg-flip-500'
                        : 'border-white/15'
                    )}>
                      {manifest.permissions?.includes(perm.id) && (
                        <CheckCircle2 size={12} className="text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep('code')}
              className="w-full mt-2 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-flip-500/10 to-accent-400/10 border border-flip-500/15 text-flip-400 hover:from-flip-500/20 hover:to-accent-400/20 transition-all text-sm font-medium"
            >
              Next: Write Code
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            {/* Two-panel: manifest + code side by side */}
            <div className="grid grid-cols-5 gap-4">
              {/* Manifest preview (smaller) */}
              <div className="col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <FileJson size={14} className="text-amber-400/60" />
                  <span className="text-xs text-white/50 font-medium">manifest.json</span>
                  <span className="text-[10px] text-white/20">(auto-generated)</span>
                </div>
                <pre className="bg-black/30 border border-white/[0.06] rounded-xl p-4 text-[11px] text-white/50 font-mono overflow-x-auto leading-relaxed overflow-y-auto" style={{ height: 400 }}>
                  {JSON.stringify(manifest, null, 2)}
                </pre>
              </div>

              {/* Code editor (larger) */}
              <div className="col-span-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode size={14} className="text-sky-400/60" />
                  <span className="text-xs text-white/50 font-medium">App.jsx</span>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  className="w-full bg-black/30 border border-white/[0.06] rounded-xl p-4 text-[11px] text-green-300/70 font-mono outline-none focus:border-flip-500/30 resize-none leading-relaxed"
                  style={{ height: 400, tabSize: 2 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const start = e.target.selectionStart;
                      const end = e.target.selectionEnd;
                      const val = e.target.value;
                      setCode(val.substring(0, start) + '  ' + val.substring(end));
                      requestAnimationFrame(() => {
                        e.target.selectionStart = e.target.selectionEnd = start + 2;
                      });
                    }
                  }}
                />
              </div>
            </div>

            {/* Status messages */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-red-300">{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 animate-fade-in">
                <CheckCircle2 size={14} className="text-green-400" />
                <span className="text-xs text-green-300">{success}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('config')}
                className="px-6 py-3 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/5 transition-all text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-flip-500/20 to-accent-400/20 border border-flip-500/25 text-flip-400 hover:from-flip-500/30 hover:to-accent-400/30 transition-all text-sm font-medium disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-flip-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Creating...' : 'Create Extension'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ children, lang }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative group">
      <pre className="bg-black/30 border border-white/[0.06] rounded-lg p-2.5 text-[10px] font-mono overflow-x-auto leading-relaxed text-green-300/60">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1 rounded bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/60"
        title="Copy"
      >
        {copied ? <CheckCircle2 size={10} /> : <Copy size={10} />}
      </button>
    </div>
  );
}

function StepList({ steps }) {
  return (
    <div className="space-y-1.5">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="w-4 h-4 rounded-full bg-flip-500/10 text-flip-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-[11px] text-white/50 leading-relaxed">{step}</span>
        </div>
      ))}
    </div>
  );
}

function InfoBox({ children, type = 'info' }) {
  return (
    <div className={clsx(
      'flex items-start gap-2 p-2.5 rounded-lg border',
      type === 'warning'
        ? 'bg-amber-500/5 border-amber-500/15'
        : 'bg-flip-500/5 border-flip-500/15'
    )}>
      <Info size={11} className={type === 'warning' ? 'text-amber-400 mt-0.5' : 'text-flip-400 mt-0.5'} />
      <div className="text-[10px] text-white/40 leading-relaxed">{children}</div>
    </div>
  );
}

function PropRow({ name, values }) {
  return (
    <div className="flex items-start gap-2 text-[10px]">
      <code className="text-flip-400/70 bg-flip-500/5 px-1.5 py-0.5 rounded font-mono text-[9px] flex-shrink-0">{name}</code>
      <span className="text-white/35">{values}</span>
    </div>
  );
}
