import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import './ExpenseManagement.css';
import toast from 'react-hot-toast';

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
              <input type="number" placeholder="e.g. 10" min="1" max="31" value={form.dayOfMonth} onChange={e => setForm({...form, dayOfMonth: parseInt(e.target.value)||1})} />
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

// ─── Expense Modal ────────────────────────────────────────────────────────────
function ExpenseModal({ existing, currentMonth, onSave, onClose }) {
  const parseDate = (d) => {
    if (!d) return today();
    if (Array.isArray(d)) return `${d[0]}-${String(d[1]).padStart(2,'0')}-${String(d[2]).padStart(2,'0')}`;
    return d.split('T')[0] || d;
  };
  const [form, setForm] = useState({
    category:    existing?.category    || 'Other',
    description: existing?.description || '',
    amount:      existing?.amount      || '',
    date:        parseDate(existing?.date),
  });

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount.'); return; }
    onSave({ ...existing, ...form, type:'EXPENSE', amount:parseFloat(form.amount) });
  };

  return (
    <div className="em-modal-overlay" onClick={onClose}>
      <div className="em-modal" onClick={e => e.stopPropagation()}>
        <div className="em-modal-header">
          <h3>{existing?.id ? 'Edit Expense' : 'Add Expense'}</h3>
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
            <input type="text" placeholder="e.g. Monthly rent, Amazon order..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="em-field-row">
            <div className="em-field-group">
              <label>Amount (₹)</label>
              <input type="number" placeholder="0.00" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            </div>
            <div className="em-field-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
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

// ─── Confirm Delete ────────────────────────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onClose }) {
  return (
    <div className="em-modal-overlay" onClick={onClose}>
      <div className="em-modal em-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="em-modal-header">
          <h3>Confirm Delete</h3>
          <button className="em-modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="em-modal-body">
          <p style={{ color:'var(--text-secondary)', margin:0 }}>
            Are you sure you want to delete <strong style={{ color:'var(--text-primary)' }}>{label}</strong>? This cannot be undone.
          </p>
        </div>
        <div className="em-modal-footer">
          <button className="em-btn em-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="em-btn em-btn-danger" onClick={onConfirm}>Delete</button>
        </div>
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
  const [loading,       setLoading]         = useState(true);
  const [salaryDay,     setSalaryDay]       = useState(1);
  const [salaryTime,    setSalaryTime]      = useState('09:00');
  const [showExpHistory, setShowExpHistory] = useState(false);

  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [incomeModal,   setIncomeModal]   = useState(null);
  const [expenseModal,  setExpenseModal]  = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fileRef = useRef();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incRes, txnRes, userRes] = await Promise.all([
        api.get('/income').catch(() => ({ data: [] })),
        api.get('/transactions').catch(() => ({ data: [] })),
        api.get('/user/settings').catch(() => ({ data: {} })),
      ]);
      setIncomeSources(incRes.data  || []);
      setTransactions(txnRes.data   || []);
      setSalaryDay(userRes.data.salaryDay  || 1);
      setSalaryTime(userRes.data.salaryTime || '09:00');
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

  // ─── Income calculation (per month) ────────────────────────
  // Rule: each income source arrives on its `dayOfMonth` every month.
  // Past months  → full income (all sources credited)
  // Current month → only sources whose dayOfMonth <= today's date
  // Future months → 0
  const incomeForMonth = useMemo(() => {
    if (isFuture) return 0;
    if (isPast)   return incomeSources.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
    // current month: only sources whose day has arrived
    const todayDay = now.getDate();
    return incomeSources
      .filter(i => (i.dayOfMonth || 1) <= todayDay)
      .reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
  }, [incomeSources, currentDate, isFuture, isPast]);

  // Which income sources are "active" (arrived) for current view
  const activeIncomeSources = useMemo(() => {
    if (isFuture) return [];
    if (isPast)   return incomeSources;
    const todayDay = now.getDate();
    return incomeSources.filter(i => (i.dayOfMonth || 1) <= todayDay);
  }, [incomeSources, isFuture, isPast]);

  const pendingIncomeSources = useMemo(() => {
    if (!isCurrent) return [];
    const todayDay = now.getDate();
    return incomeSources.filter(i => (i.dayOfMonth || 1) > todayDay);
  }, [incomeSources, isCurrent]);

  const totalExpenses = expensesForMonth.reduce((s, t) => s + (parseFloat(t.amount)||0), 0);
  const netSavings    = incomeForMonth - totalExpenses;

  // ─── Expense history grouped by month ─────────────────────
  const expenseHistory = useMemo(() => {
    const groups = {};
    transactions
      .filter(t => t.type === 'EXPENSE' || t.type === 'DEBIT')
      .forEach(t => {
        const d = parseDate(t.date);
        if (!d) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('en-US', { month:'long', year:'numeric' });
        if (!groups[key]) groups[key] = { label, total:0, items:[] };
        groups[key].total += parseFloat(t.amount)||0;
        groups[key].items.push(t);
      });
    return Object.entries(groups)
      .sort(([a],[b]) => b.localeCompare(a)) // newest first
      .map(([, v]) => v);
  }, [transactions]);

  // ─── Nav ──────────────────────────────────────────────────
  const goPrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1));
  const goNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1));

  // ─── Income CRUD ──────────────────────────────────────────
  const handleSaveIncome = async (formData) => {
    const payload = { type: formData.type, amount: formData.amount, description: formData.description, dayOfMonth: formData.dayOfMonth };
    if (formData.id) {
      await toast.promise(api.put(`/income/${formData.id}`, payload), { loading:'Updating...', success:'Income source updated!', error:'Failed to update.' });
    } else {
      await toast.promise(api.post('/income', payload), { loading:'Adding...', success:'Income source added!', error:'Failed to add.' });
    }
    setIncomeModal(null); await fetchData();
  };

  const handleSaveExpense = async (formData) => {
    const payload = { date: formData.date, type:'EXPENSE', category: formData.category, amount: formData.amount, description: formData.description };
    if (formData.id) {
      await toast.promise(api.put(`/transactions/${formData.id}`, payload), { loading:'Updating...', success:'Expense updated!', error:'Failed to update.' });
    } else {
      await toast.promise(api.post('/transactions/bulk', [payload]), { loading:'Adding...', success:'Expense added!', error:'Failed to add.' });
    }
    setExpenseModal(null); await fetchData();
  };

  const confirmDelete = async () => {
    const { type, id } = deleteConfirm;
    if (type === 'income') {
      await toast.promise(api.delete(`/income/${id}`), { loading:'Deleting...', success:'Income source deleted.', error:'Failed.' });
    } else {
      await toast.promise(api.delete(`/transactions/${id}`), { loading:'Deleting...', success:'Expense deleted.', error:'Failed.' });
    }
    setDeleteConfirm(null); await fetchData();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file?.name.endsWith('.csv')) { toast.error('Only CSV files accepted.'); return; }
    const fd = new FormData(); fd.append('file', file);
    await toast.promise(api.post('/transactions/reconcile-statement', fd, { headers:{ 'Content-Type':'multipart/form-data' } }), {
      loading:'Reconciling...', success:'Statement reconciled!', error:'Reconciliation failed.'
    });
    e.target.value = ''; await fetchData();
  };

  const handleSaveSalarySettings = async () => {
    await toast.promise(api.put('/user/settings', { salaryDay, salaryTime }), {
      loading:'Saving...', success:'Salary settings saved!', error:'Failed.'
    });
  };

  if (loading) return <div className="em-loading">Loading your financial data...</div>;

  return (
    <div className="em-page">

      {/* ── PAGE HEADER ── */}
      <div className="em-page-header">
        <div>
          <h1>Financial Control Panel</h1>
          <p>Monthly income and expense tracking with per-source day-of-credit control.</p>
        </div>
        <div className="em-header-actions">
          <div className="em-salary-setting">
            <span>Salary Day</span>
            <select value={salaryDay} onChange={e => setSalaryDay(parseInt(e.target.value))}>
              {[...Array(31)].map((_,i) => <option key={i+1} value={i+1}>{i+1}</option>)}
            </select>
            <span>at</span>
            <input type="time" value={salaryTime} onChange={e => setSalaryTime(e.target.value)} />
            <button className="em-btn em-btn-primary em-btn-sm" onClick={handleSaveSalarySettings}>Save</button>
          </div>
          <button className="em-btn em-btn-ghost em-btn-sm" onClick={() => fileRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload CSV
          </button>
          <input type="file" ref={fileRef} style={{ display:'none' }} accept=".csv" onChange={handleFileUpload} />
        </div>
      </div>

      {/* ── MONTH NAVIGATOR ── */}
      <div className="em-month-strip">
        <button className="em-month-nav-btn" onClick={goPrevMonth}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ textAlign:'center' }}>
          <h2 className="em-month-label">{formatMonth(currentDate)}</h2>
          {isFuture && <span className="em-month-tag em-tag-future">Future</span>}
          {isCurrent && <span className="em-month-tag em-tag-current">Current Month</span>}
          {isPast    && <span className="em-month-tag em-tag-past">Past</span>}
        </div>
        <button className="em-month-nav-btn" onClick={goNextMonth}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* ── SUMMARY PILLS ── */}
      <div className="em-summary-row">
        <div className="em-summary-pill em-pill-income">
          <div className="em-pill-label">Total Income</div>
          <div className="em-pill-value">{formatMoney(incomeForMonth)}</div>
          {isCurrent && pendingIncomeSources.length > 0 && (
            <div className="em-pill-note">+{formatMoney(pendingIncomeSources.reduce((s,i)=>s+(parseFloat(i.amount)||0),0))} arriving soon</div>
          )}
          {isFuture && <div className="em-pill-note">Salary day not reached yet</div>}
        </div>
        <div className="em-summary-pill em-pill-expense">
          <div className="em-pill-label">Total Expenses</div>
          <div className="em-pill-value">{formatMoney(totalExpenses)}</div>
        </div>
        <div className={`em-summary-pill ${netSavings >= 0 ? 'em-pill-savings' : 'em-pill-deficit'}`}>
          <div className="em-pill-label">Net Savings</div>
          <div className="em-pill-value">{netSavings < 0 ? '-' : ''}{formatMoney(netSavings)}</div>
          {isCurrent && <div className="em-pill-note">Auto-deposited to funds on salary day</div>}
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
                <p>Recurring monthly income streams</p>
              </div>
            </div>
            <button className="em-add-btn em-add-income" onClick={() => setIncomeModal('new')}>
              <PlusIcon /> Add Income
            </button>
          </div>

          <div className="em-list">
            {incomeSources.length === 0 ? (
              <div className="em-empty-state">
                <div className="em-empty-icon">💰</div>
                <p>No income sources yet.</p>
                <button className="em-btn em-btn-success" onClick={() => setIncomeModal('new')}>Add Your First Income Source</button>
              </div>
            ) : (
              <>
                {/* Active/Arrived sources */}
                {activeIncomeSources.length > 0 && (
                  <div className="em-section-label em-section-arrived">
                    {isCurrent ? '✅ Arrived This Month' : isPast ? 'Income Sources' : ''}
                  </div>
                )}
                {incomeSources.map(src => {
                  const arrived = isPast || (isCurrent && (src.dayOfMonth||1) <= now.getDate());
                  const pending = isCurrent && (src.dayOfMonth||1) > now.getDate();
                  return (
                    <div key={src.id} className={`em-list-item em-income-item ${pending ? 'em-item-pending' : ''}`}>
                      <div className="em-item-left">
                        <div>
                          <div className="em-item-name-row">
                            <span className={`em-badge em-badge-income`}>{src.type}</span>
                            <span className="em-item-name">{src.description || src.type}</span>
                          </div>
                          <div className="em-item-meta">
                            <span>Day {src.dayOfMonth || 1} of every month</span>
                            {pending && <span className="em-pending-tag">• Arriving on {src.dayOfMonth}</span>}
                            {arrived && !isFuture && <span className="em-arrived-tag">• Credited</span>}
                          </div>
                        </div>
                      </div>
                      <div className="em-item-right">
                        <div className={`em-item-amount ${arrived && !isFuture ? 'em-amount-income' : 'em-amount-pending'}`}>
                          +{formatMoney(src.amount)}
                        </div>
                        <div className="em-item-actions">
                          <button className="em-action-btn em-edit-btn" onClick={() => setIncomeModal(src)}><EditIcon /></button>
                          <button className="em-action-btn em-delete-btn" onClick={() => setDeleteConfirm({ type:'income', id:src.id, label:src.description||src.type })}><TrashIcon /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                <p>{formatMonth(currentDate)}</p>
              </div>
            </div>
            <button className="em-add-btn em-add-expense" onClick={() => setExpenseModal('new')}>
              <PlusIcon /> Add Expense
            </button>
          </div>

          <div className="em-list">
            {expensesForMonth.length === 0 ? (
              <div className="em-empty-state">
                <div className="em-empty-icon">🧾</div>
                <p>{isFuture ? 'No expenses yet — future month.' : `No expenses in ${formatMonth(currentDate)}.`}</p>
                {!isFuture && <button className="em-btn em-btn-danger" onClick={() => setExpenseModal('new')}>Add an Expense</button>}
              </div>
            ) : (
              <>
                {expensesForMonth
                  .slice()
                  .sort((a,b) => parseDate(b.date) - parseDate(a.date))
                  .map(txn => (
                    <div key={txn.id} className="em-list-item em-expense-item">
                      <div className="em-item-left">
                        <CategoryPill cat={txn.category||'Other'} />
                        <div>
                          <div className="em-item-name">{txn.description || txn.category}</div>
                          <div className="em-item-meta">{formatDate(txn.date)}</div>
                        </div>
                      </div>
                      <div className="em-item-right">
                        <div className="em-item-amount em-amount-expense">-{formatMoney(txn.amount)}</div>
                        <div className="em-item-actions">
                          <button className="em-action-btn em-edit-btn" onClick={() => setExpenseModal(txn)}><EditIcon /></button>
                          <button className="em-action-btn em-delete-btn" onClick={() => setDeleteConfirm({ type:'expense', id:txn.id, label:txn.description||txn.category })}><TrashIcon /></button>
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

      {/* ── EXPENSE HISTORY (collapsible) ── */}
      {expenseHistory.length > 0 && (
        <div className="em-history-section">
          <button className="em-history-toggle" onClick={() => setShowExpHistory(v => !v)}>
            <div className="em-history-toggle-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Expense Addition History</span>
              <span className="em-history-count">{transactions.filter(t=>t.type==='EXPENSE'||t.type==='DEBIT').length} entries across {expenseHistory.length} month{expenseHistory.length>1?'s':''}</span>
            </div>
            <span className="em-history-arrow">{showExpHistory ? <ChevronUp /> : <ChevronDown />}</span>
          </button>

          {showExpHistory && (
            <div className="em-history-body">
              {expenseHistory.map((group, gi) => (
                <div key={gi} className="em-history-group">
                  <div className="em-history-group-header">
                    <span className="em-history-month">{group.label}</span>
                    <span className="em-history-group-total">-{formatMoney(group.total)}</span>
                  </div>
                  {group.items
                    .slice()
                    .sort((a,b) => parseDate(b.date) - parseDate(a.date))
                    .map(txn => (
                      <div key={txn.id} className="em-history-item">
                        <CategoryPill cat={txn.category||'Other'} />
                        <span className="em-history-desc">{txn.description || txn.category}</span>
                        <span className="em-history-date">{formatDate(txn.date)}</span>
                        <span className="em-history-amount">-{formatMoney(txn.amount)}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {incomeModal  && <IncomeModal  existing={incomeModal==='new'?null:incomeModal}   onSave={handleSaveIncome}   onClose={() => setIncomeModal(null)}  />}
      {expenseModal && <ExpenseModal existing={expenseModal==='new'?null:expenseModal} currentMonth={currentDate} onSave={handleSaveExpense} onClose={() => setExpenseModal(null)} />}
      {deleteConfirm && <ConfirmDelete label={deleteConfirm.label} onConfirm={confirmDelete} onClose={() => setDeleteConfirm(null)} />}
    </div>
  );
}
