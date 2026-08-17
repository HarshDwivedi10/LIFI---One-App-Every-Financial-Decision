import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import './ExpenseManagement.css';
import toast from 'react-hot-toast';
import useFinancialData from '../../hooks/useFinancialData';

// ─── Icons ────────────────────────────────────────────────────────────────────
const PlusIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const EditIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
const TrashIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const ChevronDown = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const ChevronUp   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;

const INCOME_TYPES = ['SALARY', 'FREELANCE', 'BUSINESS', 'RENTAL', 'DIVIDEND', 'OTHER'];
const EXPENSE_CATEGORIES = ['Rent','Groceries','Utilities','Transport','Dining','Health','Entertainment','Shopping','Insurance','Education','Travel','Savings','EMI','Other'];
const today = () => new Date().toISOString().split('T')[0];

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

// ─── Income Modal ─────────────────────────────────────────────────────────────
function IncomeModal({ existing, onSave, onClose }) {
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

// ─── Fixed Expense Modal ────────────────────────────────────────────────────────
function FixedExpenseModal({ existing, onSave, onClose }) {
  const [form, setForm] = useState({
    category:    existing?.category    || 'Rent',
    description: existing?.description || '',
    amount:      existing?.amount      || '',
    dayOfMonth:  existing?.dayOfMonth  || 1,
  });

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount.'); return; }
    if (form.dayOfMonth < 1 || form.dayOfMonth > 30) { toast.error('Deduction day must be 1-30.'); return; }
    onSave({ ...existing, ...form, amount: parseFloat(form.amount), dayOfMonth: parseInt(form.dayOfMonth) });
  };

  return (
    <div className="em-modal-overlay" onClick={onClose}>
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

// ─── Expense Modal (Actuals) ───────────────────────────────────────────────────
function ExpenseModal({ existing, onSave, onClose }) {
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

// ─── Confirm Delete (Removed popup, using inline) ────────────────────────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onClose }) {
  return null;
}

// ─── Reconciliation Modal (2-Step Savings Verification) ──────────────────────────────────
function ReconciliationModal({ initialData, manualIncome, manualExpense, monthLabel, year, month, funds = [], onSave, onClose }) {
  const [step, setStep] = useState(1);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(initialData || { csvIncome: 0, csvExpense: 0, transactions: [] });
  const [form, setForm] = useState({
    verifiedIncome: initialData?.verifiedIncome ?? initialData?.csvIncome ?? 0,
    verifiedExpense: initialData?.verifiedExpense ?? initialData?.csvExpense ?? 0,
    selectedDeficitFundId: ''
  });

  const fileInputRef = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.pdf')) {
      toast.error('Only PDF and CSV bank statements are accepted.');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    try {
      setParsing(true);
      const res = await api.post(`/transactions/parse-csv-preview?year=${year}&month=${month}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParsedData(res.data);
      setForm(prev => ({
        ...prev,
        verifiedIncome: res.data.csvIncome || 0,
        verifiedExpense: res.data.csvExpense || 0
      }));
      toast.success(`Parsed ${res.data.totalCount || res.data.transactions?.length || 0} transactions!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse bank statement file.');
    } finally {
      setParsing(false);
    }
  };

  const projectedSavings = Math.max(0, manualIncome - manualExpense);
  const actualSavings = Math.max(0, parseFloat(form.verifiedIncome || 0) - parseFloat(form.verifiedExpense || 0));
  const totalDeficit = projectedSavings - actualSavings;

  const handleSave = () => {
    if (totalDeficit > 0 && !form.selectedDeficitFundId) {
      toast.error('Please select a fund to cover the shortfall.');
      return;
    }
    onSave({
      verifiedIncome: parseFloat(form.verifiedIncome) || 0,
      verifiedExpense: parseFloat(form.verifiedExpense) || 0,
      csvIncome: parsedData.csvIncome || 0,
      csvExpense: parsedData.csvExpense || 0,
      selectedDeficitFundId: form.selectedDeficitFundId
    });
  };

  return (
    <div className="em-modal-overlay" onClick={onClose}>
      <div className="em-modal verify-modal-container" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="em-modal-header">
          <h3>Verify Your Savings — {monthLabel}</h3>
          <button className="em-modal-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {/* 2-Step Indicator */}
        <div className="verify-step-indicator">
          <div className={`verify-step-item ${step === 1 ? 'active' : 'completed'}`} onClick={() => setStep(1)}>
            <div className="verify-step-num">1</div>
            <span>Upload &amp; Extract Statement</span>
          </div>
          <div className="verify-step-divider" />
          <div className={`verify-step-item ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>
            <div className="verify-step-num">2</div>
            <span>Reconcile &amp; Discrepancy</span>
          </div>
        </div>

        {step === 1 ? (
          <>
            <div className="em-modal-body" style={{ gap: '20px' }}>
              
              {/* Statement Upload Dropzone */}
              <label className="statement-dropzone">
                <input 
                  type="file" 
                  accept=".csv,.pdf" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload} 
                  disabled={parsing}
                />
                <div className="statement-dropzone-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="statement-dropzone-title">
                  {parsing ? 'Extracting transactions...' : 'Upload Bank Statement (CSV or PDF)'}
                </div>
                <div className="statement-dropzone-subtitle">
                  Auto-detects credits (income) and debits (expenses). Click or drag file here.
                </div>
              </label>

              {/* Extraction Summary Cards */}
              <div className="extraction-grid">
                <div className="extraction-card extraction-card-income">
                  <div className="extraction-card-header">
                    <span className="extraction-card-title">Verified Income (Credits)</span>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Deposits</span>
                  </div>
                  <div className="extraction-card-input">
                    <span>₹</span>
                    <input
                      type="number"
                      min="0"
                      value={form.verifiedIncome}
                      onChange={e => setForm({ ...form, verifiedIncome: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Total money credited this month
                  </span>
                </div>

                <div className="extraction-card extraction-card-expense">
                  <div className="extraction-card-header">
                    <span className="extraction-card-title">Verified Expense (Debits)</span>
                    <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Withdrawals</span>
                  </div>
                  <div className="extraction-card-input">
                    <span>₹</span>
                    <input
                      type="number"
                      min="0"
                      value={form.verifiedExpense}
                      onChange={e => setForm({ ...form, verifiedExpense: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Total money debited this month
                  </span>
                </div>
              </div>

              {/* Extracted Transactions Preview Table */}
              {parsedData.transactions && parsedData.transactions.length > 0 && (
                <div className="parsed-txns-section">
                  <div className="parsed-txns-header">
                    <span>Detected Statement Transactions</span>
                    <span style={{ opacity: 0.7 }}>{parsedData.transactions.length} entries</span>
                  </div>
                  <div className="parsed-txns-list">
                    {parsedData.transactions.map((tx, idx) => (
                      <div key={idx} className="parsed-txn-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <span className={`parsed-txn-tag ${tx.type === 'INCOME' || tx.type === 'CREDIT' ? 'parsed-tag-credit' : 'parsed-tag-debit'}`}>
                            {tx.type === 'INCOME' || tx.type === 'CREDIT' ? 'CR' : 'DR'}
                          </span>
                          <span className="parsed-txn-desc" title={tx.description}>{tx.description}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '16px' }}>{tx.date}</span>
                        <span className={`parsed-txn-amt ${tx.type === 'INCOME' || tx.type === 'CREDIT' ? 'parsed-amt-credit' : 'parsed-amt-debit'}`}>
                          {tx.type === 'INCOME' || tx.type === 'CREDIT' ? '+' : '-'}₹{new Intl.NumberFormat('en-IN').format(tx.amount || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <div className="em-modal-footer">
              <button className="em-btn em-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="em-btn em-btn-primary" onClick={() => setStep(2)}>
                <span>Evaluate Discrepancy &amp; Continue →</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="em-modal-body" style={{ gap: '20px' }}>
              
              {/* Comparison Grid: Manual vs Verified */}
              <div className="comparison-grid">
                <div className="comparison-box">
                  <div className="comparison-box-title">Manual App Plan</div>
                  <div className="comparison-metric">
                    <span style={{ color: 'var(--text-muted)' }}>Planned Income</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(manualIncome)}</span>
                  </div>
                  <div className="comparison-metric">
                    <span style={{ color: 'var(--text-muted)' }}>Planned Expenses</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(manualExpense)}</span>
                  </div>
                  <div className="comparison-metric">
                    <span>Projected Savings</span>
                    <span style={{ color: '#818cf8', fontWeight: 700 }}>₹{new Intl.NumberFormat('en-IN').format(projectedSavings)}</span>
                  </div>
                </div>

                <div className="comparison-box" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.25)' }}>
                  <div className="comparison-box-title" style={{ color: '#818cf8' }}>Bank Statement Actuals</div>
                  <div className="comparison-metric">
                    <span style={{ color: 'var(--text-muted)' }}>Verified Income</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(form.verifiedIncome || 0)}</span>
                  </div>
                  <div className="comparison-metric">
                    <span style={{ color: 'var(--text-muted)' }}>Verified Expenses</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(form.verifiedExpense || 0)}</span>
                  </div>
                  <div className="comparison-metric">
                    <span>Actual Net Savings</span>
                    <span style={{ color: '#818cf8', fontWeight: 700 }}>₹{new Intl.NumberFormat('en-IN').format(actualSavings)}</span>
                  </div>
                </div>
              </div>

              {/* Discrepancy Evaluation Outcome */}
              {totalDeficit < 0 ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ color: '#10B981', fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                    Surplus Detected
                  </div>
                  <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                    You saved <strong>₹{new Intl.NumberFormat('en-IN').format(Math.abs(totalDeficit))}</strong> more than projected!
                    This extra money will be automatically swept into your <strong>Unallocated Savings</strong>.
                  </p>
                </div>
              ) : totalDeficit > 0 ? (
                <div style={{ background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ color: '#F97316', fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
                    Shortfall Detected
                  </div>
                  <p style={{ color: '#ffffff', fontSize: '13px', lineHeight: '1.5', marginBottom: '14px' }}>
                    You saved <strong>₹{new Intl.NumberFormat('en-IN').format(totalDeficit)}</strong> less than projected. To balance your books, select which fund or goal absorbs this shortfall:
                  </p>
                  <div className="em-field-group">
                    <label style={{ color: '#F97316' }}>Select Fund to Deduct From</label>
                    <select
                      value={form.selectedDeficitFundId}
                      onChange={e => setForm({ ...form, selectedDeficitFundId: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', background: 'rgba(17, 19, 32, 0.9)', color: '#ffffff', border: '1px solid rgba(249, 115, 22, 0.4)', borderRadius: '8px' }}
                    >
                      <option value="">-- Select a Fund --</option>
                      {funds && funds.filter(f => f.storedAssetBalance > 0 || f.id === 'UNALLOCATED').map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} (Balance: ₹{new Intl.NumberFormat('en-IN').format(f.storedAssetBalance || 0)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ color: '#818CF8', fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
                    Perfect Match
                  </div>
                  <p style={{ color: '#ffffff', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                    Your bank statement savings perfectly match your projected savings plan. No fund adjustments needed!
                  </p>
                </div>
              )}

            </div>

            <div className="em-modal-footer">
              <button className="em-btn em-btn-ghost" onClick={() => setStep(1)}>← Back to Statement</button>
              <button className="em-btn em-btn-primary" onClick={handleSave}>Confirm &amp; Verify Savings</button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function ExpenseManagementPage() {
  const [incomeSources, setIncomeSources]   = useState([]);
  const [transactions,  setTransactions]    = useState([]);
  const [fixedExpenses, setFixedExpenses]   = useState([]);
  const [loading,       setLoading]         = useState(true);
  const [salaryDay,     setSalaryDay]       = useState(1);

  const { funds } = useFinancialData();

  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [verificationStatus, setVerificationStatus] = useState(null);
  const [reconciliationPreview, setReconciliationPreview] = useState(null);

  const [incomeModal,   setIncomeModal]   = useState(null);
  const [expenseModal,  setExpenseModal]  = useState(null);
  const [fixedExpModal, setFixedExpModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fileRef = useRef();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchVerification(); }, [currentDate]);

  const fetchVerification = async () => {
    try {
      const res = await api.get('/transactions/verification-status', {
        params: { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 }
      });
      setVerificationStatus(res.data);
    } catch { setVerificationStatus(null); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incRes, txnRes, fixedRes, userRes] = await Promise.all([
        api.get('/income').catch(() => ({ data: [] })),
        api.get('/transactions').catch(() => ({ data: [] })),
        api.get('/fixed-expenses').catch(() => ({ data: [] })),
        api.get('/user/settings').catch(() => ({ data: {} })),
      ]);
      setIncomeSources(incRes.data  || []);
      setTransactions(txnRes.data   || []);
      setFixedExpenses(fixedRes.data || []);
      setSalaryDay(userRes.data.salaryDay  || 1);
    } catch { toast.error('Failed to load data.'); }
    finally  { setLoading(false); }
  };

  // ─── Date helpers ─────────────────────────────────────────
  const parseDate = (d) => {
    if (!d) return null;
    if (Array.isArray(d)) return new Date(d[0], d[1]-1, d[2]);
    return new Date(d);
  };

  const formatMoney = n => `₹${new Intl.NumberFormat('en-IN').format(Math.abs(Math.round(n)))}`;
  const formatDate  = d => {
    const date = parseDate(d);
    if (!date) return '—';
    return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  };
  const formatMonth = d => d.toLocaleDateString('en-US', { month:'long', year:'numeric' });

  // ─── Month type ───────────────────────────────────────────
  const now = new Date();
  const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const viewMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  const isPast    = viewMonthStart < nowMonthStart;
  const isCurrent = viewMonthStart.getTime() === nowMonthStart.getTime();
  const isFuture  = viewMonthStart > nowMonthStart;

  // ─── Filter expenses for viewed month ─────────────────────
  const expensesForMonth = useMemo(() => {
    if (isFuture) return [];
    return transactions.filter(t => {
      const d = parseDate(t.date);
      if (!d) return false;
      return (t.type === 'EXPENSE' || t.type === 'DEBIT')
        && d.getMonth()    === currentDate.getMonth()
        && d.getFullYear() === currentDate.getFullYear();
    });
  }, [transactions, currentDate, isFuture]);

  const incomeTransactions = useMemo(() => {
    return transactions.filter(t => 
      (t.type === 'INCOME' || t.type === 'CREDIT') 
      && new Date(t.date).getMonth() === currentDate.getMonth() 
      && new Date(t.date).getFullYear() === currentDate.getFullYear()
    );
  }, [transactions, currentDate]);

  const activeIncomeItems = useMemo(() => {
    if (isFuture) return [];
    if (isPast) return incomeTransactions;

    const todayDay = now.getDate();
    const arrivedTemplates = incomeSources.filter(src => {
      const day = src.dayOfMonth || 1;
      if (day > todayDay) return false;
      const srcDesc = (src.description || src.type).toLowerCase();
      const hasTxn = incomeTransactions.some(t => 
        (t.description && t.description.toLowerCase().includes(srcDesc)) ||
        (t.category && t.category.toLowerCase() === src.type.toLowerCase())
      );
      return !hasTxn;
    }).map(src => ({
      id: `tmpl-${src.id}`,
      originalId: src.id,
      isTemplate: true,
      category: src.type,
      description: src.description || src.type,
      amount: parseFloat(src.amount) || 0,
      dayOfMonth: src.dayOfMonth || 1,
      source: src
    }));

    return [...incomeTransactions, ...arrivedTemplates];
  }, [incomeSources, incomeTransactions, isCurrent, isFuture, isPast]);

  const pendingIncomeSources = useMemo(() => {
    if (isFuture) return incomeSources;
    if (isPast) return [];
    const todayDay = now.getDate();
    return incomeSources.filter(src => (src.dayOfMonth || 1) > todayDay);
  }, [incomeSources, isCurrent, isFuture, isPast]);

  const incomeForMonth = useMemo(() => {
    if (isFuture) return 0;
    return activeIncomeItems.reduce((s, item) => s + (parseFloat(item.amount)||0), 0);
  }, [activeIncomeItems, isFuture]);

  const activeFixedItems = useMemo(() => {
    if (isFuture) return [];
    
    const todayDay = now.getDate();
    const allFixedTxns = expensesForMonth.filter(t => t.fixedExpenseId != null);
    const uniqueFixedTxns = [];
    const seenFixedIds = new Set();
    for (const t of allFixedTxns) {
      if (!seenFixedIds.has(t.fixedExpenseId)) {
        seenFixedIds.add(t.fixedExpenseId);
        const parentExp = fixedExpenses.find(f => f.id === t.fixedExpenseId);
        const day = parentExp ? (parentExp.dayOfMonth || 1) : 1;
        if (day <= todayDay || isPast) {
          uniqueFixedTxns.push(t);
        }
      }
    }

    if (isPast) return uniqueFixedTxns;

    const arrivedFixed = fixedExpenses
      .filter(exp => {
        if (seenFixedIds.has(exp.id)) return false;
        const day = exp.dayOfMonth || 1;
        return day <= todayDay;
      })
      .map(exp => ({
        id: `fixed-tmpl-${exp.id}`,
        originalId: exp.id,
        isTemplate: true,
        category: exp.category || 'Other',
        description: exp.description || exp.category,
        amount: parseFloat(exp.amount) || 0,
        dayOfMonth: exp.dayOfMonth || 1,
        source: exp
      }));

    return [...uniqueFixedTxns, ...arrivedFixed];
  }, [fixedExpenses, expensesForMonth, isCurrent, isFuture, isPast]);

  const pendingFixedItems = useMemo(() => {
    if (isFuture) return fixedExpenses;
    if (isPast) return [];
    const todayDay = now.getDate();
    return fixedExpenses.filter(exp => (exp.dayOfMonth || 1) > todayDay);
  }, [fixedExpenses, isCurrent, isFuture, isPast]);

  const additionalExpensesForMonth = useMemo(() => {
    return expensesForMonth.filter(t => t.fixedExpenseId == null);
  }, [expensesForMonth]);

  const totalExpenses = useMemo(() => {
    if (isFuture) return 0;
    const fixedSum = activeFixedItems.reduce((s, item) => s + (parseFloat(item.amount)||0), 0);
    const addSum   = additionalExpensesForMonth.reduce((s, item) => s + (parseFloat(item.amount)||0), 0);
    return fixedSum + addSum;
  }, [activeFixedItems, additionalExpensesForMonth, isFuture]);

  const netSavings = incomeForMonth - totalExpenses;

  // ─── Nav ──────────────────────────────────────────────────
  const goPrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1));
  const goNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1));

  // ─── CRUD Handlers ──────────────────────────────────────────
  const handleSaveIncome = async (formData) => {
    const payload = { type: formData.type, amount: formData.amount, description: formData.description, dayOfMonth: formData.dayOfMonth };
    if (formData.id) {
      await toast.promise(api.put(`/income/${formData.id}`, payload), { loading:'Updating...', success:'Income source updated!', error:'Failed to update.' });
    } else {
      await toast.promise(api.post('/income', payload), { loading:'Adding...', success:'Income source added!', error:'Failed to add.' });
    }
    setIncomeModal(null); await fetchData();
  };

  const handleSaveFixedExpense = async (formData) => {
    const payload = { category: formData.category, amount: formData.amount, description: formData.description, dayOfMonth: formData.dayOfMonth };
    if (formData.id) {
      await toast.promise(api.put(`/fixed-expenses/${formData.id}`, payload), { loading:'Updating...', success:'Fixed expense updated!', error:'Failed.' });
    } else {
      await toast.promise(api.post('/fixed-expenses', payload), { loading:'Adding...', success:'Fixed expense added!', error:'Failed.' });
    }
    setFixedExpModal(null); await fetchData();
  };

  const handleSaveExpense = async (formData) => {
    const day = formData.dayOfMonth || 1;
    const targetDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const payload = { date: targetDate, type:'EXPENSE', category: formData.category, amount: formData.amount, description: formData.description };
    if (formData.id) {
      await toast.promise(api.put(`/transactions/${formData.id}`, payload), { loading:'Updating...', success:'Expense updated!', error:'Failed.' });
    } else {
      await toast.promise(api.post('/transactions/bulk', [payload]), { loading:'Adding...', success:'Expense added!', error:'Failed.' });
    }
    setExpenseModal(null); await fetchData();
  };

  const confirmDelete = async () => {
    const { type, id } = deleteConfirm;
    if (type === 'income') {
      await toast.promise(api.delete(`/income/${id}`), { loading:'Deleting...', success:'Income source deleted.', error:'Failed.' });
    } else if (type === 'fixedExpense') {
      await toast.promise(api.delete(`/fixed-expenses/${id}`), { loading:'Deleting...', success:'Fixed expense deleted.', error:'Failed.' });
    } else {
      await toast.promise(api.delete(`/transactions/${id}`), { loading:'Deleting...', success:'Expense deleted.', error:'Failed.' });
    }
    setDeleteConfirm(null); await fetchData();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.pdf')) { 
      toast.error('Only PDF and CSV bank statements are accepted.'); 
      return; 
    }
    const fd = new FormData(); fd.append('file', file);
    try {
      const toastId = toast.loading('Parsing bank statement...');
      const res = await api.post('/transactions/parse-csv-preview', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      toast.dismiss(toastId);
      setReconciliationPreview(res.data);
    } catch (err) {
      toast.error('Failed to parse bank statement.');
    }
    e.target.value = '';
  };

  const handleSaveVerification = async (verifiedData) => {
    try {
      const payload = {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        ...verifiedData
      };
      await toast.promise(api.post('/transactions/save-verification', payload), {
        loading: 'Verifying & Reconciling...',
        success: 'Month verified successfully!',
        error: 'Failed to verify.'
      });
      setReconciliationPreview(null);
      await fetchVerification(); // Refresh tick mark status
      await fetchData(); // Refresh assets/goals if affected
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSalarySettings = async () => {
    await toast.promise(api.put('/user/settings', { salaryDay, salaryTime: "00:00" }), {
      loading:'Saving...', success:'Salary settings saved!', error:'Failed.'
    });
  };

  if (loading) return <div className="em-loading">Loading your financial data...</div>;

  return (
    <div className="em-page">
      {/* DISCREPANCY INFO BANNER */}
      <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discrepancy Auto-Routing</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#93C5FD', lineHeight: '1.5' }}>
            Note: If your verified monthly savings differ from your expected savings (due to extra income or unexpected expenses), the system will detect a discrepancy and automatically apply the difference to your <strong>Unallocated Savings</strong>.
          </p>
        </div>
      </div>

      {/* ── MONTH NAVIGATOR ── */}
      <div className="em-month-strip" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button className="em-month-nav-btn" onClick={goPrevMonth}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ textAlign:'center', margin: '0 2rem' }}>
          <h2 className="em-month-label">{formatMonth(currentDate)}</h2>
          {isFuture && <span className="em-month-tag em-tag-future">Future</span>}
          {isCurrent && <span className="em-month-tag em-tag-current">Current Month</span>}
          {isPast    && <span className="em-month-tag em-tag-past">Past</span>}
        </div>
        <button className="em-month-nav-btn" onClick={goNextMonth}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <div style={{ position: 'absolute', right: '1.5rem' }}>
          {verificationStatus?.isVerified ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Verified
              </div>
              <button 
                className="em-btn em-btn-ghost em-btn-sm" 
                onClick={() => setReconciliationPreview({
                  csvIncome: verificationStatus.csvIncome,
                  csvExpense: verificationStatus.csvExpense,
                  verifiedIncome: verificationStatus.verifiedIncome,
                  verifiedExpense: verificationStatus.verifiedExpense
                })}
              >
                View Verification
              </button>
            </div>
          ) : (
            <button 
              className="em-btn em-btn-ghost em-btn-sm" 
              onClick={() => setReconciliationPreview({
                csvIncome: 0,
                csvExpense: 0,
                verifiedIncome: 0,
                verifiedExpense: 0,
                transactions: []
              })}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Verify Your Savings
            </button>
          )}
        </div>
      </div>

      {/* ── SUMMARY PILLS ── */}
      <div className="em-summary-row">
        <div className="em-summary-pill em-pill-income">
          <div className="em-pill-label">Total Income</div>
          <div className="em-pill-value">{formatMoney(incomeForMonth)}</div>
          <div className="em-pill-note" style={{ color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>All money arriving this month</div>
          {isCurrent && pendingIncomeSources.length > 0 && (
            <div className="em-pill-note">+{formatMoney(pendingIncomeSources.reduce((s,i)=>s+(parseFloat(i.amount)||0),0))} arriving soon</div>
          )}
          {isFuture && <div className="em-pill-note">Cycle day not reached yet</div>}
        </div>
        <div className="em-summary-pill em-pill-expense">
          <div className="em-pill-label">Total Expenses</div>
          <div className="em-pill-value">{formatMoney(totalExpenses)}</div>
          <div className="em-pill-note" style={{ color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Fixed bills and manual spends</div>
        </div>
        <div className={`em-summary-pill ${netSavings >= 0 ? 'em-pill-savings' : 'em-pill-deficit'}`}>
          <div className="em-pill-label">Net Savings</div>
          <div className="em-pill-value">{netSavings < 0 ? '-' : ''}{formatMoney(netSavings)}</div>
          {isCurrent && <div className="em-pill-note">Auto-deposited to funds on fixed expense deduction date</div>}
        </div>
      </div>

      {/* ── TWO COLUMN CARDS ── */}
      <div className="em-cards-grid">

        {/* ══ INCOME CARD ══ */}
        <div className="em-card">
          <div className="em-card-header">
            <div className="em-card-title">
              <div className="em-card-icon em-icon-income">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div>
                <h3>Income Sources</h3>
                <p>Track your recurring salary, rent, and side income.</p>
              </div>
            </div>
            <button className="em-add-btn em-add-income" onClick={() => setIncomeModal('new')}>
              <PlusIcon /> Add Income
            </button>
          </div>

          <div className="em-list">
            {incomeSources.length === 0 && incomeTransactions.length === 0 ? (
              <div className="em-empty-state">
                <p>No income sources yet.</p>
                <button className="em-btn em-btn-success" onClick={() => setIncomeModal('new')}>Add Your First Income Source</button>
              </div>
            ) : (
              <>
                {/* Arrived Income (Past & Current) */}
                {activeIncomeItems.length > 0 && (
                  <div className="em-section-label em-section-arrived">
                    {isCurrent ? '✅ Arrived This Month' : 'Income Recorded'}
                  </div>
                )}
                {activeIncomeItems.map(item => {
                  const isTxn = !item.isTemplate;
                  return (
                    <div key={item.id} className="em-list-item em-income-item">
                      <div className="em-item-left">
                        <div>
                          <div className="em-item-name-row">
                            <span className="em-badge em-badge-income">{item.category || 'Income'}</span>
                            <span className="em-item-name">{item.description || item.category}</span>
                          </div>
                          <div className="em-item-meta">
                            {isCurrent && <span className="em-arrived-tag">• Credited (Day {item.dayOfMonth || 1})</span>}
                            {!isCurrent && isPast && item.date && <span>Recorded on {formatDate(item.date)}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="em-item-right">
                        <div className="em-item-amount em-amount-income">
                          +{formatMoney(item.amount)}
                        </div>
                        <div className="em-item-actions">
                          <button className="em-action-btn em-edit-btn" onClick={() => isTxn ? setExpenseModal(item) : setIncomeModal(item.source)}><EditIcon /></button>
                          {(deleteConfirm?.type === (isTxn ? 'expense' : 'income') && deleteConfirm?.id === (isTxn ? item.id : item.originalId)) ? (
                            <div style={{ display: 'flex', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', padding: '2px' }}>
                              <button className="em-action-btn" style={{ color: '#10B981', background: 'none' }} onClick={confirmDelete}>✔️</button>
                              <button className="em-action-btn" style={{ color: '#EF4444', background: 'none' }} onClick={() => setDeleteConfirm(null)}>✖️</button>
                            </div>
                          ) : (
                            <button className="em-action-btn em-delete-btn" onClick={() => isTxn ? setDeleteConfirm({ type:'expense', id:item.id, label:item.description }) : setDeleteConfirm({ type:'income', id:item.originalId, label:item.description||item.category })}><TrashIcon /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pending Income Sources (Later this month or Future) */}
                {(isCurrent || isFuture) && pendingIncomeSources.length > 0 && (
                  <>
                    {isCurrent && activeIncomeItems.length > 0 && (
                      <div className="em-section-label" style={{ marginTop: '16px' }}>Pending This Month</div>
                    )}
                    {pendingIncomeSources.map(src => (
                      <div key={`pending-${src.id}`} className="em-list-item em-income-item em-item-pending">
                        <div className="em-item-left">
                          <div>
                            <div className="em-item-name-row">
                              <span className="em-badge em-badge-income">{src.type}</span>
                              <span className="em-item-name">{src.description || src.type}</span>
                            </div>
                            <div className="em-item-meta">
                              <span>Day {src.dayOfMonth || 1} of every month</span>
                              {isCurrent && <span className="em-pending-tag">• Arriving on day {src.dayOfMonth}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="em-item-right">
                          <div className="em-item-amount em-amount-pending">
                            +{formatMoney(src.amount)}
                          </div>
                          <div className="em-item-actions">
                            <button className="em-action-btn em-edit-btn" onClick={() => setIncomeModal(src)}><EditIcon /></button>
                            {deleteConfirm?.type === 'income' && deleteConfirm?.id === src.id ? (
                              <div style={{ display: 'flex', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', padding: '2px' }}>
                                <button className="em-action-btn" style={{ color: '#10B981', background: 'none' }} onClick={confirmDelete}>✔️</button>
                                <button className="em-action-btn" style={{ color: '#EF4444', background: 'none' }} onClick={() => setDeleteConfirm(null)}>✖️</button>
                              </div>
                            ) : (
                              <button className="em-action-btn em-delete-btn" onClick={() => setDeleteConfirm({ type:'income', id:src.id, label:src.description||src.type })}><TrashIcon /></button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="em-list-total em-total-income">
                  <span>Total Income Received</span>
                  <span>{formatMoney(incomeForMonth)}</span>
                </div>
                {pendingIncomeSources.length > 0 && (
                  <div className="em-list-total em-total-pending">
                    <span>Pending (arriving later this month)</span>
                    <span>{formatMoney(pendingIncomeSources.reduce((s,i)=>s+(parseFloat(i.amount)||0),0))}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ══ EXPENSE CARD ══ */}
        <div className="em-card">
          <div className="em-card-header">
            <div className="em-card-title">
              <div className="em-card-icon em-icon-expense">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <div>
                <h3>Expenses</h3>
                <p>Track your monthly bills, subscriptions, and random spends.</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {!isPast && (
                <button className="em-add-btn em-add-expense" style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)' }} onClick={() => setFixedExpModal('new')}>
                  <PlusIcon /> Fixed Expense
                </button>
              )}
              <button className="em-add-btn em-add-expense" onClick={() => setExpenseModal('new')}>
                <PlusIcon /> Additional Expense
              </button>
            </div>
          </div>

          <div className="em-list">
            
            {/* SECTION 1: FIXED EXPENSES */}
            <div className="em-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textTransform: 'uppercase' }}>
              <span>Fixed Expenses</span>
            </div>
            {(() => {
                if (activeFixedItems.length === 0 && pendingFixedItems.length === 0) {
                  return <div style={{ padding: '12px 24px', fontSize: '13px', color: 'var(--text-muted)' }}>No fixed expenses recorded.</div>;
                }
                
                return (
                  <>
                    {/* Arrived/Deducted Fixed Expenses */}
                    {activeFixedItems.map(item => {
                      const targetFixedExp = item.source || fixedExpenses.find(f => f.id === item.fixedExpenseId) || item;
                      const targetFixedExpId = item.fixedExpenseId || item.originalId || item.id;
                      const dayVal = item.dayOfMonth || targetFixedExp?.dayOfMonth || (item.date ? parseDate(item.date).getDate() : 1);
                      return (
                        <div key={`fixed-item-${item.id}`} className="em-list-item em-expense-item">
                          <div className="em-item-left">
                            <CategoryPill cat={item.category||'Other'} />
                            <div>
                              <div className="em-item-name-row">
                                <span className="em-item-name">{item.description || item.category}</span>
                                <span style={{ color: 'var(--success-color)', fontSize: '12px', marginLeft: '8px' }}>✔ Added</span>
                              </div>
                              <div className="em-item-meta">
                                {isCurrent ? `Deducted on day ${dayVal}` : (item.date ? `Recorded on ${formatDate(item.date)}` : 'Auto-deducted')}
                              </div>
                            </div>
                          </div>
                          <div className="em-item-right">
                            <div className="em-item-amount" style={{ color: 'var(--text-muted)' }}>-{formatMoney(item.amount)}</div>
                            <div className="em-item-actions">
                              <button className="em-action-btn em-edit-btn" onClick={() => setFixedExpModal(targetFixedExp)}><EditIcon /></button>
                              {deleteConfirm?.type === 'fixedExpense' && deleteConfirm?.id === targetFixedExpId ? (
                                <div style={{ display: 'flex', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', padding: '2px' }}>
                                  <button className="em-action-btn" style={{ color: '#10B981', background: 'none' }} onClick={confirmDelete}>✔️</button>
                                  <button className="em-action-btn" style={{ color: '#EF4444', background: 'none' }} onClick={() => setDeleteConfirm(null)}>✖️</button>
                                </div>
                              ) : (
                                <button className="em-action-btn em-delete-btn" onClick={() => setDeleteConfirm({ type:'fixedExpense', id:targetFixedExpId, label:item.description||item.category })}><TrashIcon /></button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Pending Fixed Expenses */}
                    {pendingFixedItems.map(exp => (
                      <div key={`fixed-pending-${exp.id}`} className="em-list-item em-expense-item em-item-pending">
                        <div className="em-item-left">
                          <CategoryPill cat={exp.category||'Other'} />
                          <div>
                            <div className="em-item-name-row">
                              <span className="em-item-name">{exp.description || exp.category}</span>
                            </div>
                            <div className="em-item-meta">
                              {isFuture ? `Will auto-add on day ${exp.dayOfMonth || 1}` : `⏳ Arriving on day ${exp.dayOfMonth || 1}`}
                            </div>
                          </div>
                        </div>
                        <div className="em-item-right">
                          <div className="em-item-amount em-amount-pending">-{formatMoney(exp.amount)}</div>
                          <div className="em-item-actions">
                            <button className="em-action-btn em-edit-btn" onClick={() => setFixedExpModal(exp)}><EditIcon /></button>
                            {deleteConfirm?.type === 'fixedExpense' && deleteConfirm?.id === exp.id ? (
                              <div style={{ display: 'flex', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', padding: '2px' }}>
                                <button className="em-action-btn" style={{ color: '#10B981', background: 'none' }} onClick={confirmDelete}>✔️</button>
                                <button className="em-action-btn" style={{ color: '#EF4444', background: 'none' }} onClick={() => setDeleteConfirm(null)}>✖️</button>
                              </div>
                            ) : (
                              <button className="em-action-btn em-delete-btn" onClick={() => setDeleteConfirm({ type:'fixedExpense', id:exp.id, label:exp.description||exp.category })}><TrashIcon /></button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}

            {/* SECTION 2: ADDITIONAL EXPENSES FOR THE MONTH */}
            <div className="em-section-label" style={{ marginTop: '16px', textTransform: 'uppercase' }}>Additional Expenses</div>
            {expensesForMonth.filter(txn => txn.fixedExpenseId == null).length === 0 ? (
              <div className="em-empty-state">
                <div className="em-empty-icon">🧾</div>
                <p>{isFuture ? 'No additional expenses yet — future month.' : `No additional expenses recorded in ${formatMonth(currentDate)}.`}</p>
              </div>
            ) : (
              <>
                {expensesForMonth
                  .filter(txn => txn.fixedExpenseId == null)
                  .slice()
                  .sort((a,b) => parseDate(b.date) - parseDate(a.date))
                  .map(txn => (
                    <div key={txn.id} className="em-list-item em-expense-item">
                      <div className="em-item-left">
                        <CategoryPill cat={txn.category||'Other'} />
                        <div>
                          <div className="em-item-name">{txn.description || txn.category}</div>
                          {/* Note: Date is hidden as per requirement */}
                        </div>
                      </div>
                      <div className="em-item-right">
                        <div className="em-item-amount em-amount-expense">-{formatMoney(txn.amount)}</div>
                        <div className="em-item-actions">
                          <button className="em-action-btn em-edit-btn" onClick={() => setExpenseModal(txn)}><EditIcon /></button>
                          {deleteConfirm?.type === 'expense' && deleteConfirm?.id === txn.id ? (
                            <div style={{ display: 'flex', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', padding: '2px' }}>
                              <button className="em-action-btn" style={{ color: '#10B981', background: 'none' }} onClick={confirmDelete}>✔️</button>
                              <button className="em-action-btn" style={{ color: '#EF4444', background: 'none' }} onClick={() => setDeleteConfirm(null)}>✖️</button>
                            </div>
                          ) : (
                            <button className="em-action-btn em-delete-btn" onClick={() => setDeleteConfirm({ type:'expense', id:txn.id, label:txn.description||txn.category })}><TrashIcon /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                <div className="em-list-total em-total-expense">
                  <span>Total Expenses</span>
                  <span>{formatMoney(totalExpenses)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {reconciliationPreview && (
        <ReconciliationModal 
          initialData={reconciliationPreview}
          year={currentDate.getFullYear()}
          month={currentDate.getMonth() + 1}
          manualIncome={incomeForMonth} 
          manualExpense={totalExpenses}
          monthLabel={formatMonth(currentDate)}
          funds={funds}
          onSave={handleSaveVerification} 
          onClose={() => setReconciliationPreview(null)} 
        />
      )}
      {incomeModal  && <IncomeModal  existing={incomeModal==='new'?null:incomeModal}   onSave={handleSaveIncome}   onClose={() => setIncomeModal(null)}  />}
      {fixedExpModal && <FixedExpenseModal existing={fixedExpModal==='new'?null:fixedExpModal} onSave={handleSaveFixedExpense} onClose={() => setFixedExpModal(null)} />}
      {expenseModal && <ExpenseModal existing={expenseModal==='new'?null:expenseModal} onSave={handleSaveExpense} onClose={() => setExpenseModal(null)} />}
    </div>
  );
}
