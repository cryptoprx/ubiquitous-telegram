import React, { useState, useEffect } from 'react';
import { Plus, Lock, CreditCard, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

function AutofillView() {
  const { autofill, setAutofill } = useBrowserStore();
  const [tab, setTab] = useState('addresses'); // 'addresses' | 'payments'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    window.flipAPI?.getAutofill?.().then(data => { if (data) setAutofill(data); });
  }, []);

  function saveData(newData) {
    setAutofill(newData);
    window.flipAPI?.saveAutofill?.(newData);
  }

  function addAddress() {
    setEditing('new-addr');
    setForm({ name: '', street: '', city: '', state: '', zip: '', country: '', phone: '', email: '' });
  }

  function addPayment() {
    setEditing('new-pay');
    setForm({ label: '', number: '', expiry: '', name: '' });
  }

  function saveAddress() {
    const addresses = [...(autofill.addresses || []), { ...form, id: Date.now() }];
    saveData({ ...autofill, addresses });
    setEditing(null);
  }

  function savePayment() {
    const masked = { ...form, number: '****' + (form.number || '').slice(-4), id: Date.now() };
    const payments = [...(autofill.payments || []), masked];
    saveData({ ...autofill, payments });
    setEditing(null);
  }

  function deleteAddress(id) {
    saveData({ ...autofill, addresses: autofill.addresses.filter(a => a.id !== id) });
  }

  function deletePayment(id) {
    saveData({ ...autofill, payments: autofill.payments.filter(p => p.id !== id) });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <CreditCard size={14} className="text-flip-400" />
          Autofill
        </h2>
        <div className="flex gap-1 mt-2">
          {['addresses', 'payments'].map(t => (
            <button key={t} onClick={() => { setTab(t); setEditing(null); }}
              className={clsx('px-3 py-1 rounded-lg text-[10px] font-medium transition-all',
                tab === t ? 'bg-flip-500/15 text-flip-400' : 'text-white/30 hover:text-white/50'
              )}>{t === 'addresses' ? 'Addresses' : 'Payments'}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {tab === 'addresses' && (
          <>
            {(autofill.addresses || []).map(addr => (
              <div key={addr.id} className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/70 font-medium">{addr.name}</div>
                  <button onClick={() => deleteAddress(addr.id)} className="text-white/15 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                </div>
                <div className="text-[9px] text-white/30 mt-0.5">{addr.street}, {addr.city} {addr.state} {addr.zip}</div>
                {addr.email && <div className="text-[9px] text-white/20 mt-0.5">{addr.email}</div>}
              </div>
            ))}
            {editing === 'new-addr' ? (
              <div className="space-y-1.5 p-2.5 rounded-lg border border-flip-500/20 bg-flip-500/5">
                {['name', 'street', 'city', 'state', 'zip', 'country', 'phone', 'email'].map(f => (
                  <input key={f} type="text" placeholder={f.charAt(0).toUpperCase() + f.slice(1)} value={form[f] || ''}
                    onChange={e => setForm({ ...form, [f]: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                ))}
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => setEditing(null)} className="flex-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] text-white/40">Cancel</button>
                  <button onClick={saveAddress} className="flex-1 px-2 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/20 text-[9px] text-flip-400 font-medium">Save</button>
                </div>
              </div>
            ) : (
              <button onClick={addAddress} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-[10px] text-white/25 hover:text-white/40 hover:border-white/20 transition-all">
                <Plus size={11} /> Add Address
              </button>
            )}
          </>
        )}
        {tab === 'payments' && (
          <>
            {(autofill.payments || []).map(pay => (
              <div key={pay.id} className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/70 font-medium flex items-center gap-1.5">
                    <CreditCard size={10} className="text-white/25" />{pay.label || 'Card'}
                  </div>
                  <button onClick={() => deletePayment(pay.id)} className="text-white/15 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                </div>
                <div className="text-[9px] text-white/30 font-mono mt-0.5">{pay.number}</div>
                <div className="text-[9px] text-white/20">{pay.name} · {pay.expiry}</div>
              </div>
            ))}
            {editing === 'new-pay' ? (
              <div className="space-y-1.5 p-2.5 rounded-lg border border-flip-500/20 bg-flip-500/5">
                <input type="text" placeholder="Card Label (e.g. Personal Visa)" value={form.label || ''}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                <input type="text" placeholder="Card Number" value={form.number || ''}
                  onChange={e => setForm({ ...form, number: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 font-mono outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                <div className="flex gap-1.5">
                  <input type="text" placeholder="MM/YY" value={form.expiry || ''}
                    onChange={e => setForm({ ...form, expiry: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 font-mono outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                  <input type="text" placeholder="Name on Card" value={form.name || ''}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 outline-none focus:border-flip-500/40 placeholder:text-white/15" />
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => setEditing(null)} className="flex-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] text-white/40">Cancel</button>
                  <button onClick={savePayment} className="flex-1 px-2 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/20 text-[9px] text-flip-400 font-medium">Save</button>
                </div>
              </div>
            ) : (
              <button onClick={addPayment} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-[10px] text-white/25 hover:text-white/40 hover:border-white/20 transition-all">
                <Plus size={11} /> Add Payment Method
              </button>
            )}
          </>
        )}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-start gap-2">
            <Lock size={9} className="text-white/15 mt-0.5" />
            <span className="text-[9px] text-white/20">Autofill data is encrypted and stored locally using OS-level encryption.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutofillView;
