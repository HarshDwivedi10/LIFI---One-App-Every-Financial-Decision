import React, { useState } from 'react';
import toast from 'react-hot-toast';

const INCOME_TYPES = ['SALARY', 'FREELANCE', 'BUSINESS', 'RENTAL', 'DIVIDEND', 'OTHER'];

const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function IncomeModal({ existing, onSave, onClose }) {
  const [form, setForm] = useState({
    type:        existing?.type        || 'SALARY',
    amount:      existing?.amount      || '',
    description: existing?.description || '',
    dayOfMonth:  existing?.dayOfMonth  || 1,
  });

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount.'); return; }
    if (form.dayOfMonth < 1 || form.dayOfMonth > 31)  { toast.error('Day must be 1-31.'); return; }
    onSave({ ...existing, ...form, amount: parseFloat(form.amount), dayOfMonth: parseInt(form.dayOfMonth) });
  };

  return (
    <div className="em-modal-overlay" onClick={onClose}>
      <div className="em-modal" onClick={e => e.stopPropagation()}>
        <div className="em-modal-header">
          <h3>{existing?.id ? 'Edit Income Source' : 'Add Income Source'}</h3>
          <button className="em-modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="em-modal-body">
          <div className="em-field-group">
            <label>Source Type</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              {INCOME_TYPES.map(t => <option key={t} value={t}>{t.charAt(0)+t.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div className="em-field-group">
            <label>Source Name / Description</label>
            <input type="text" placeholder="e.g. TechCorp Salary, Freelance Project" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="em-field-row">
            <div className="em-field-group">
              <label>Amount (₹) per Month</label>
              <input type="number" placeholder="0.00" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            </div>
            <div className="em-field-group">
              <label>Day of Month It Arrives</label>
              <input type="number" placeholder="e.g. 10" min="1" max="30" value={form.dayOfMonth} onChange={e => {
                let val = e.target.value;
                if (val === '') { setForm({...form, dayOfMonth: ''}); return; }
                let num = parseInt(val);
                if (num > 30) num = 30;
                setForm({...form, dayOfMonth: num});
              }} />
              <span style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Income arrives on this day every month</span>
            </div>
          </div>
        </div>
        <div className="em-modal-footer">
          <button className="em-btn em-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="em-btn em-btn-success" onClick={handleSave}>
            {existing?.id ? 'Save Changes' : 'Add Income'}
          </button>
        </div>
      </div>
    </div>
  );
}
