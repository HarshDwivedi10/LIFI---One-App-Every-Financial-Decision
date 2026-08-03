import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import StepTransactions from '../Onboarding/steps/StepTransactions';
import StepIncome from '../Onboarding/steps/StepIncome';
import './ExpenseManagement.css';
import toast from 'react-hot-toast';

export default function ExpenseManagementPage() {
  const [incomeData, setIncomeData] = useState({ monthlySalary: '', otherSources: [], salaryDay: '' });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date filtering state
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  
  // File upload state
  const fileRef = useRef();
  const [uploadStatus, setUploadStatus] = useState(null);

  const isInitialMount = useRef(true);
  const isFetching = useRef(true);
  const saveTimeoutRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const [isEditing, setIsEditing] = useState(false);

  const fetchData = async () => {
    try {
      isFetching.current = true;
      setLoading(true);
      const [incomeRes, txnRes, userRes] = await Promise.all([
        api.get('/income'),
        api.get('/transactions'),
        api.get('/user/settings').catch(() => ({ data: { salaryDay: 1 } }))
      ]);

      const incomeSources = incomeRes.data;
      const salary = incomeSources.find(i => i.type === 'SALARY')?.amount || '';
      const otherSources = incomeSources.filter(i => i.type !== 'SALARY').map(i => ({
        id: i.id, type: i.type, amount: i.amount, description: i.description
      }));
      setIncomeData({ monthlySalary: salary, otherSources, salaryDay: userRes.data.salaryDay || 1 });
      setTransactions(txnRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
      // Short delay to ensure state updates before allowing autosave
      setTimeout(() => { isFetching.current = false; }, 500);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const savePromise = async () => {
        if (incomeData.salaryDay) {
          await api.put('/user/settings', { salaryDay: incomeData.salaryDay });
        }

        const dbTxnsRes = await api.get('/transactions');
        const dbTxns = dbTxnsRes.data;
        const dbTxnIds = dbTxns.map(t => t.id);
        const stateTxnIds = transactions.map(t => t.id);

        const toDelete = dbTxnIds.filter(id => !stateTxnIds.includes(id));
        const toUpdate = transactions.filter(t => dbTxnIds.includes(t.id));
        const toAdd = transactions.filter(t => !dbTxnIds.includes(t.id));

        const formatDate = (date) => {
          if (Array.isArray(date)) {
            return `${date[0]}-${String(date[1]).padStart(2, '0')}-${String(date[2]).padStart(2, '0')}`;
          }
          return date;
        };

        if (toDelete.length > 0) {
          await Promise.all(toDelete.map(id => api.delete(`/transactions/${id}`).catch(() => null)));
        }

        for (const txn of toUpdate) {
          await api.put(`/transactions/${txn.id}`, {
            date: formatDate(txn.date),
            type: txn.type,
            category: txn.category || 'Other',
            amount: parseFloat(txn.amount),
            description: txn.description
          });
        }

        if (toAdd.length > 0) {
          const formattedToAdd = toAdd.map(txn => ({
            date: formatDate(txn.date),
            type: txn.type,
            category: txn.category || 'Other',
            amount: parseFloat(txn.amount),
            description: txn.description
          }));
          await api.post('/transactions/bulk', formattedToAdd);
        }
      };

      await toast.promise(savePromise(), {
        loading: 'Saving changes...',
        success: 'Saved successfully!',
        error: 'Failed to save.'
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  // --- Statement Reconciliation Upload ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setUploadStatus({ type: 'error', message: 'Only CSV files are accepted' });
      return;
    }
    
    toast.loading('Reconciling statement...', { id: 'reconcile' });
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await api.post('/transactions/reconcile-statement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const { deficit, projectedSavings, actualSavings, delayedGoalsCount } = response.data;
      
      if (deficit > 0) {
         setUploadStatus({
           type: 'warning', 
           message: `Statement reconciled. You saved ₹${actualSavings} vs projected ₹${projectedSavings}. Shortfall of ₹${deficit} was deducted from your funds. ${delayedGoalsCount > 0 ? `This delayed ${delayedGoalsCount} goal(s). Check Goal Management.` : ''}`
         });
         toast.success('Reconciled with warnings.', { id: 'reconcile' });
      } else {
         setUploadStatus({
           type: 'success',
           message: `Statement reconciled. Savings on track! Uploaded successfully.`
         });
         toast.success('Reconciled successfully!', { id: 'reconcile' });
      }
      
      await fetchData(); // refresh data
    } catch (err) {
      setUploadStatus({ type: 'error', message: 'Reconciliation failed. Check CSV format.' });
      toast.error('Reconciliation failed.', { id: 'reconcile' });
    } finally {
      e.target.value = '';
    }
  };

  // --- Derived Calculations for Active Month ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear();
    });
  }, [transactions, currentDate]);

  const monthExpenses = filteredTransactions
    .filter(t => t.type === 'EXPENSE' || t.type === 'DEBIT')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const monthCredits = filteredTransactions
    .filter(t => t.type === 'INCOME' || t.type === 'CREDIT')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // Total Income = Flat Monthly Salary + Flat Other Sources + Transaction Credits for this month
  const baseSalary = parseFloat(incomeData.monthlySalary) || 0;
  const baseOther = incomeData.otherSources.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const totalIncome = baseSalary + baseOther + monthCredits;

  const totalSavings = totalIncome - monthExpenses;

  // --- UI Helpers ---
  const goPrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const formatMonth = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return <div className="loading-state">Loading your financial dashboard...</div>;
  }

  return (
    <div className="expense-management-page">
      {/* HEADER */}
      <div className="em-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Financial Control Panel</h1>
          <p>Track and manage your complete income and expense history.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Salary Date:</span>
            <select 
              value={incomeData.salaryDay || 1} 
              onChange={(e) => setIncomeData({ ...incomeData, salaryDay: parseInt(e.target.value) })}
              disabled={!isEditing}
              style={{ padding: '6px 12px', borderRadius: '4px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', cursor: isEditing ? 'pointer' : 'not-allowed', opacity: isEditing ? 1 : 0.6 }}
            >
              {[...Array(31)].map((_, i) => (
                <option key={i+1} value={i+1} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{i+1}</option>
              ))}
            </select>
          </div>
          {!isEditing ? (
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Edit
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSaveChanges} style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#000' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Save
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload CSV Statement
          </button>
          <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".csv" onChange={handleFileUpload} />
        </div>
      </div>

      {uploadStatus && (
        <div style={{ 
          padding: '16px', 
          background: uploadStatus.type === 'error' ? 'var(--danger-bg)' : uploadStatus.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'var(--success-bg)', 
          color: uploadStatus.type === 'error' ? 'var(--danger)' : uploadStatus.type === 'warning' ? '#F59E0B' : 'var(--success)', 
          marginBottom: '24px', 
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${uploadStatus.type === 'error' ? 'var(--danger)' : uploadStatus.type === 'warning' ? '#F59E0B' : 'var(--success)'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
             <strong style={{ display: 'block', marginBottom: '4px' }}>
                {uploadStatus.type === 'error' ? 'Upload Failed' : uploadStatus.type === 'warning' ? 'Reconciliation Complete - Shortfall Detected' : 'Reconciliation Complete - On Track!'}
             </strong>
             {uploadStatus.message}
          </div>
          <button onClick={() => setUploadStatus(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* MONTH NAVIGATOR & DASHBOARD */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
          <button onClick={goPrevMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 style={{ fontSize: '24px', fontWeight: '700', width: '200px', textAlign: 'center', margin: 0 }}>{formatMonth(currentDate)}</h2>
          <button onClick={goNextMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--success)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Income</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success)' }}>₹{new Intl.NumberFormat('en-IN').format(totalIncome)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--danger)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Expenses</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--danger)' }}>₹{new Intl.NumberFormat('en-IN').format(monthExpenses)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Net Savings</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-primary)' }}>₹{new Intl.NumberFormat('en-IN').format(totalSavings)}</div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', color: 'var(--text-primary)' }}>Transaction History (Current Month)</h3>
        <StepTransactions 
          data={transactions} 
          onChange={setTransactions} 
          readOnly={!isEditing}
        />
      </div>
    </div>
  );
}
