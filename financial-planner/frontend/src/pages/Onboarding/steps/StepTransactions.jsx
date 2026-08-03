import { useState } from 'react';
import { TRANSACTION_TYPES, TRANSACTION_CATEGORIES } from '../../../utils/constants';
import { numberToIndianWords } from '../../../utils/numberToWords';
import './steps.css';

const EMPTY_TXN = () => ({
  id: Date.now() + Math.random(),
  date: new Date().toISOString().split('T')[0],
  type: 'EXPENSE',
  amount: '',
  description: '',
});

const TYPE_BADGE_MAP = {
  INCOME: 'badge-income',
  EXPENSE: 'badge-expense',
  DEBIT: 'badge-debit',
  CREDIT: 'badge-credit',
};

export default function StepTransactions({ data, onChange, readOnly = false }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_TXN());
  const [editId, setEditId] = useState(null);

  const [incomeAmount, setIncomeAmount] = useState('');

  const handleFormChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const saveTransaction = () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) return;
    if (editId !== null) {
      onChange(data.map((t) => (t.id === editId ? { ...formData, id: editId } : t)));
      setEditId(null);
    } else {
      onChange([...data, { ...formData, id: Date.now() }]);
    }
    setFormData(EMPTY_TXN());
  };

  const saveIncome = () => {
    if (!incomeAmount || parseFloat(incomeAmount) <= 0) return;
    onChange([...data, { 
      id: Date.now(), 
      date: new Date().toISOString().split('T')[0], 
      type: 'INCOME', 
      amount: incomeAmount, 
      description: 'Monthly Income' 
    }]);
    setIncomeAmount('');
  };

  const startEdit = (txn) => {
    setFormData({ ...txn });
    setEditId(txn.id);
  };

  const deleteTransaction = (id) => {
    onChange(data.filter((t) => t.id !== id));
  };

  const cancelForm = () => {
    setFormData(EMPTY_TXN());
    setEditId(null);
  };

  const totalIncome = data.filter((t) => t.type === 'INCOME' || t.type === 'CREDIT')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalExpense = data.filter((t) => t.type === 'EXPENSE' || t.type === 'DEBIT')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const filteredData = data.filter((txn) => {
    let match = true;
    if (searchTerm && (!txn.description || !txn.description.toLowerCase().includes(searchTerm.toLowerCase()))) {
      match = false;
    }
    if (filterStartDate && new Date(txn.date) < new Date(filterStartDate)) {
      match = false;
    }
    if (filterEndDate && new Date(txn.date) > new Date(filterEndDate)) {
      match = false;
    }
    return match;
  });

  return (
    <div className="step-card animate-fade-in">
      <div className="step-header">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent-primary)' }}>
            <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          Cash Flow Tracker
        </h2>
        <p>Review imported transactions or manually log your monthly income and expenses.</p>
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', marginTop: '20px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          
          {/* INCOME COLUMN */}
          <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label" style={{ color: 'var(--success)' }}>Add Monthly Income</label>
              <div className="input-prefix">
                <span className="input-prefix-symbol">₹</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Total income"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  min="0"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveIncome(); }}
                />
              </div>
              {incomeAmount && <div className="input-words-hint">{numberToIndianWords(incomeAmount)}</div>}
            </div>
            <button className="btn btn-primary" onClick={saveIncome} style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              Add Income
            </button>
          </div>

          <div style={{ width: '1px', background: 'var(--border-subtle)', height: '40px', alignSelf: 'center' }}></div>

          {/* EXPENSE COLUMN */}
          <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label" style={{ color: 'var(--danger)' }}>Add Monthly Expense</label>
              <div className="input-prefix">
                <span className="input-prefix-symbol">₹</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Total expense"
                  value={formData.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  min="0"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTransaction(); }}
                />
              </div>
              {formData.amount && <div className="input-words-hint">{numberToIndianWords(formData.amount)}</div>}
            </div>
            <button className="btn btn-primary" onClick={saveTransaction} style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              {editId ? 'Update Expense' : 'Add Expense'}
            </button>
            {editId && (
              <button className="btn btn-secondary" onClick={cancelForm}>Cancel</button>
            )}
          </div>

        </div>
      )}

      {/* Transaction Table */}
      {data.length > 0 && (
        <>
          <div className="flex gap-md" style={{ marginTop: 20, marginBottom: 8 }}>
            <div style={{ flex: 1, padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Expenses</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--danger)' }}>
                ₹{new Intl.NumberFormat('en-IN').format(totalExpense)}
              </div>
            </div>
            <div style={{ flex: 1, padding: '12px 16px', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Credits</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--success)' }}>
                ₹{new Intl.NumberFormat('en-IN').format(totalIncome)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>From</span>
              <input
                type="date"
                className="form-input"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>To</span>
              <input
                type="date"
                className="form-input"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="transaction-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((txn) => (
                  <tr key={txn.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                      {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge ${TYPE_BADGE_MAP[txn.type] || 'badge-expense'}`}>
                        {txn.type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txn.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: (txn.type === 'INCOME' || txn.type === 'CREDIT') ? 'var(--success)' : 'var(--danger)' }}>
                      {(txn.type === 'INCOME' || txn.type === 'CREDIT') ? '+' : '-'}
                      ₹{new Intl.NumberFormat('en-IN').format(txn.amount)}
                    </td>
                    <td>
                      {!readOnly && (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-icon btn-ghost btn-sm" onClick={() => startEdit(txn)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="btn btn-icon btn-danger btn-sm" onClick={() => deleteTransaction(txn.id)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          No expenses yet. Click "Add Your Monthly Expense" to get started.
        </div>
      )}
    </div>
  );
}
