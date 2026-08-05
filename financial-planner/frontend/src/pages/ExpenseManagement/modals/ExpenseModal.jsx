import React, { useState } from 'react';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = ['Rent','Groceries','Utilities','Transport','Dining','Health','Entertainment','Shopping','Insurance','Education','Travel','Savings','EMI','Other'];

const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function ExpenseModal({ existing, onSave, onClose }) {
  const defaultDay = existing?.date ? new Date(existing.date).getDate() : 1;
  const [form, setForm] = useState({
    category:    existing?.category    || 'Other',
    description: existing?.description || '',
    amount:      existing?.amount      || '',
    dayOfMonth:  existing?.dayOfMonth  || defaultDay,
  });

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount.'); return; }
    if (form.dayOfMonth < 1 || form.dayOfMonth > 30) { toast.error('Day must be 1-30.'); return; }
    onSave({ ...existing, ...form, type:'EXPENSE', amount:parseFloat(form.amount), dayOfMonth: parseInt(form.dayOfMonth) });
  };

  return (
    <div className="em-modal-overlay" onClick={onClose}>
      <div className="em-modal" onClick={e => e.stopPropagation()}>
        <div className="em-modal-header">
          <h3>{existing?.id ? 'Edit Actual Expense' : 'Add Additional Expense'}</h3>
          <button className="em-modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="em-modal-body">
          <div className="em-field-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="em-field-group">
            <label>Description / Note</label>
            <input type="text" placeholder="e.g. Amazon order, dinner..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="em-field-row">
            <div className="em-field-group">
              <label>Amount (₹)</label>
              <input type="number" placeholder="0.00" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            </div>
            <div className="em-field-group">
              <label>Day of Month (1-30)</label>
              <input type="number" placeholder="e.g. 4" min="1" max="30" value={form.dayOfMonth} onChange={e => {
                let val = e.target.value;
                if (val === '') { setForm({...form, dayOfMonth: ''}); return; }
                let num = parseInt(val);
                if (num > 30) num = 30;
                setForm({...form, dayOfMonth: num});
              }} />
              <span style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Date/day when expense occurred</span>
            </div>
          </div>
        </div>
        <div className="em-modal-footer">
          <button className="em-btn em-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="em-btn em-btn-danger" onClick={handleSave}>
            {existing?.id ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
