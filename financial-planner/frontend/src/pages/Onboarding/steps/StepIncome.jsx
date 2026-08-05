import { useState } from 'react';
import '../../ExpenseManagement/ExpenseManagement.css';
import { INCOME_TYPES } from '../../../utils/constants';

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

function IncomeModal({ existing, onSave, onClose }) {
  const [form, setForm] = useState({
    type:        existing?.type        || 'SALARY',
    amount:      existing?.amount      || '',
    description: existing?.description || '',
    dayOfMonth:  existing?.dayOfMonth  || 1,
  });

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { alert('Enter a valid amount.'); return; }
    if (form.dayOfMonth < 1 || form.dayOfMonth > 31)  { alert('Day must be 1-31.'); return; }
    onSave({ 
      id: existing?.id || Date.now() + Math.random(), 
      ...form, 
      amount: parseFloat(form.amount), 
      dayOfMonth: parseInt(form.dayOfMonth) 
    });
  };

  return (
    <div className="em-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
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

export default function StepIncome({ data, onChange }) {
  const [incomeModal, setIncomeModal] = useState(null);

  const handleSaveIncome = (source) => {
    let updated;
    if (data.some(d => d.id === source.id)) {
      updated = data.map(d => d.id === source.id ? source : d);
    } else {
      updated = [...data, source];
    }
    onChange(updated);
    setIncomeModal(null);
  };

  const handleDelete = (id) => {
    onChange(data.filter(d => d.id !== id));
  };

  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Income Details</h2>
        <p>Tell us about your monthly earnings. This helps us calculate your savings potential and financial plan.</p>
      </div>

      <div style={{ marginTop: '32px' }}>
        {/* Using exact DOM and classes from ExpenseManagementPage */}
        <div className="em-card" style={{ maxWidth: '100%', margin: 0 }}>
          <div className="em-card-header">
            <div className="em-card-title">
              <div className="em-card-icon em-icon-income">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div>
                <h3>Income Sources</h3>
                <p>Recurring monthly income streams</p>
              </div>
            </div>
            <button className="em-add-btn em-add-income" onClick={() => setIncomeModal('new')}>
              <PlusIcon /> Add Income
            </button>
          </div>

          <div className="em-list">
            {data.length === 0 ? (
              <div className="em-empty-state">
                <div className="em-empty-icon">💰</div>
                <p>No income sources yet.</p>
                <button className="em-btn em-btn-success" onClick={() => setIncomeModal('new')}>
                  Add Your First Income Source
                </button>
              </div>
            ) : (
              <>
                <div className="em-section-label em-section-arrived">
                  Income Sources
                </div>
                {data.map(src => (
                  <div key={src.id} className="em-list-item em-income-item">
                    <div className="em-item-left">
                      <div>
                        <div className="em-item-name-row">
                          <span className="em-badge em-badge-income">{src.type}</span>
                          <span className="em-item-name">{src.description || src.type}</span>
                        </div>
                        <div className="em-item-meta">
                          <span>Day {src.dayOfMonth || 1} of every month</span>
                        </div>
                      </div>
                    </div>
                    <div className="em-item-right">
                      <div className="em-item-amount em-amount-income">
                        +₹{formatMoney(src.amount)}
                      </div>
                      <div className="em-item-actions">
                        <button className="em-action-btn em-edit-btn" onClick={() => setIncomeModal(src)}><EditIcon /></button>
                        <button className="em-action-btn em-delete-btn" onClick={() => handleDelete(src.id)}><TrashIcon /></button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="em-list-total em-total-income">
                  <span>Total Income</span>
                  <span>₹{formatMoney(data.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {incomeModal && (
        <IncomeModal 
          existing={incomeModal === 'new' ? null : incomeModal} 
          onSave={handleSaveIncome} 
          onClose={() => setIncomeModal(null)} 
        />
      )}
    </div>
  );
}
