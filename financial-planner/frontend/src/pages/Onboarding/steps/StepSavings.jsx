import { useState } from 'react';
import { numberToIndianWords } from '../../../utils/numberToWords';
import '../../ExpenseManagement/ExpenseManagement.css';
import './steps.css';

const EXPENSE_CATEGORIES = ['Rent','Groceries','Utilities','Transport','Dining','Health','Entertainment','Shopping','Insurance','Education','Travel','Savings','EMI','Other'];

const CATEGORY_COLORS = {
  Rent:'#6366f1',Groceries:'#10b981',Utilities:'#f59e0b',Transport:'#3b82f6',
  Dining:'#ec4899',Health:'#ef4444',Entertainment:'#8b5cf6',Shopping:'#06b6d4',
  Insurance:'#14b8a6',Education:'#f97316',Travel:'#84cc16',Savings:'#22c55e',
  EMI:'#e11d48',Other:'#6b7280'
};

function CategoryPill({ cat }) {
  const color = CATEGORY_COLORS[cat] || '#6b7280';
  return (
    <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:600,
      background:`${color}22`, color, border:`1px solid ${color}44`, letterSpacing:'0.02em', whiteSpace:'nowrap' }}>
      {cat}
    </span>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  );
}

function formatMoney(num) {
  if (!num) return '0';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
}

function FixedExpenseModal({ existing, onSave, onClose }) {
  const [form, setForm] = useState({
    category:    existing?.category    || 'Rent',
    description: existing?.description || '',
    amount:      existing?.amount      || '',
    dayOfMonth:  existing?.dayOfMonth  || 1,
  });

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { alert('Enter a valid amount.'); return; }
    if (form.dayOfMonth < 1 || form.dayOfMonth > 30) { alert('Deduction day must be 1-30.'); return; }
    onSave({ 
      id: existing?.id || Date.now() + Math.random(), 
      ...form, 
      amount: parseFloat(form.amount),
      dayOfMonth: parseInt(form.dayOfMonth) || 1
    });
  };

  return (
    <div className="em-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="em-modal" onClick={e => e.stopPropagation()}>
        <div className="em-modal-header">
          <h3>{existing?.id ? 'Edit Fixed Expense' : 'Add Fixed Expense'}</h3>
          <button className="em-modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="em-modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
            This expense will automatically be added to your actual expenses every month on its deduction date.
          </p>
          <div className="em-field-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="em-field-group">
            <label>Description / Note</label>
            <input type="text" placeholder="e.g. Monthly rent, electricity..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="em-field-row">
            <div className="em-field-group">
              <label>Amount (₹) per Month</label>
              <input type="number" placeholder="0.00" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            </div>
            <div className="em-field-group">
              <label>Deduction Day of Month</label>
              <input type="number" placeholder="e.g. 5" min="1" max="30" value={form.dayOfMonth} onChange={e => {
                let val = e.target.value;
                if (val === '') { setForm({...form, dayOfMonth: ''}); return; }
                let num = parseInt(val);
                if (num > 30) num = 30;
                setForm({...form, dayOfMonth: num});
              }} />
              <span style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Deducted on this day every month</span>
            </div>
          </div>
        </div>
        <div className="em-modal-footer">
          <button className="em-btn em-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="em-btn em-btn-danger" onClick={handleSave}>
            {existing?.id ? 'Save Changes' : 'Add Fixed Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StepSavings({ data, onChange, incomeData }) {
  const [fixedExpModal, setFixedExpModal] = useState(null);

  // Calculate total income from previous step correctly
  const totalIncome = incomeData.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const totalExpense = data.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const monthlySavings = totalIncome - totalExpense;

  const handleSaveExpense = (expense) => {
    let updated;
    if (data.some(d => d.id === expense.id)) {
      updated = data.map(d => d.id === expense.id ? expense : d);
    } else {
      updated = [...data, expense];
    }
    onChange(updated);
    setFixedExpModal(null);
  };

  const handleDelete = (id) => {
    onChange(data.filter(d => d.id !== id));
  };

  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Savings Calculation</h2>
        <p>Your income is brought over from the previous step. Add your fixed monthly expenses to calculate your savings.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '32px' }}>
        <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Monthly Income
          </div>
          <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 900, color: 'var(--success)', letterSpacing: '-0.03em' }}>
            ₹{new Intl.NumberFormat('en-IN').format(totalIncome)}
          </div>
        </div>

        <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Monthly Expenses
          </div>
          <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 900, color: 'var(--danger)', letterSpacing: '-0.03em' }}>
            ₹{new Intl.NumberFormat('en-IN').format(totalExpense)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        {/* Using exact DOM and classes from ExpenseManagementPage for Fixed Expenses */}
        <div className="em-card" style={{ maxWidth: '100%', margin: 0 }}>
          <div className="em-card-header">
            <div className="em-card-title">
              <div className="em-card-icon em-icon-expense">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <div>
                <h3>Expenses</h3>
                <p>Fixed Monthly Expenses (Templates)</p>
              </div>
            </div>
            <button className="em-add-btn em-add-expense" onClick={() => setFixedExpModal('new')}>
              <PlusIcon /> Fixed Expense
            </button>
          </div>

          <div className="em-list">
            <div className="em-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textTransform: 'uppercase' }}>
              <span>Fixed Expenses</span>
            </div>
            {data.length === 0 ? (
              <div style={{ padding: '12px 24px', fontSize: '13px', color: 'var(--text-muted)' }}>
                No fixed expenses set up yet.
              </div>
            ) : (
              data.map(exp => (
                <div key={`fixed-${exp.id}`} className="em-list-item em-expense-item">
                  <div className="em-item-left">
                    <CategoryPill cat={exp.category || 'Other'} />
                    <div>
                      <div className="em-item-name-row">
                        <span className="em-item-name">{exp.description || exp.category}</span>
                      </div>
                      <div className="em-item-meta">
                        <span>Deducted on day {exp.dayOfMonth || 1} of every month</span>
                      </div>
                    </div>
                  </div>
                  <div className="em-item-right">
                    <div className="em-item-amount em-amount-expense">
                      -₹{formatMoney(exp.amount)}
                    </div>
                    <div className="em-item-actions">
                      <button className="em-action-btn em-edit-btn" onClick={() => setFixedExpModal(exp)}><EditIcon /></button>
                      <button className="em-action-btn em-delete-btn" onClick={() => handleDelete(exp.id)}><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {totalIncome > 0 && (
        <div className="savings-result-card animate-slide-up" style={{ marginTop: '32px' }}>
          <div className="savings-result-label">Your Monthly Savings</div>
          <div className={`savings-result-value ${monthlySavings < 0 ? 'negative' : ''}`}>
            ₹{new Intl.NumberFormat('en-IN').format(monthlySavings)}
          </div>
          {monthlySavings < 0 && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--danger)', marginTop: '12px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              ⚠️ Your expenses exceed your income. You need a positive savings amount to create financial goals.
            </div>
          )}
        </div>
      )}

      {fixedExpModal && (
        <FixedExpenseModal 
          existing={fixedExpModal === 'new' ? null : fixedExpModal} 
          onSave={handleSaveExpense} 
          onClose={() => setFixedExpModal(null)} 
        />
      )}
    </div>
  );
}
