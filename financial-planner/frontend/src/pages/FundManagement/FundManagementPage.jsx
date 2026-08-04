import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import './FundManagementPage.css';
import toast from 'react-hot-toast';

const DEFAULT_ALLOCATIONS = { 'RETIREMENT': 20, 'LONG_TERM': 20, 'SHORT_TERM': 20, 'EMERGENCY': 20, 'WEALTH': 20 };

const FUNDS = [
  { id: 'RETIREMENT', name: '1. Retirement Corpus', color: '#818CF8', icon: 'cart', description: 'For your golden years and post-work life' },
  { id: 'LONG_TERM', name: '2. Long-Term Goal Corpus', color: '#10B981', icon: 'target', description: 'For big purchases like a house or car' },
  { id: 'SHORT_TERM', name: '3. Short-Term Goal Corpus', color: '#3B82F6', icon: 'calendar', description: 'For vacations and near-term expenses' },
  { id: 'EMERGENCY', name: '4. Emergency & Protection Corpus', color: '#F97316', icon: 'shield', description: 'Safety net for unexpected situations' },
  { id: 'WEALTH', name: '5. Wealth Creation Corpus', color: '#EAB308', icon: 'chart', description: 'Aggressive growth and investments' },
  { id: 'UNALLOCATED', name: '6. Unallocated Savings', color: '#9CA3AF', icon: 'scales', description: 'System-managed remaining savings' }
];

export default function FundManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [expectedMonthlySavings, setExpectedMonthlySavings] = useState(0);
  const [savingsGrowth, setSavingsGrowth] = useState(0);

  const [liveTotalSavings, setLiveTotalSavings] = useState(0);
  const [preExistingSavings, setPreExistingSavings] = useState(0);
  const [preExistingSavingsDate, setPreExistingSavingsDate] = useState('');

  const [preExistingAssets, setPreExistingAssets] = useState({});
  const [retirementPercent, setRetirementPercent] = useState(20);
  
  const [allocations, setAllocations] = useState(DEFAULT_ALLOCATIONS);

  const isInitialMount = useRef(true);
  const isFetching = useRef(true);
  const saveTimeoutRef = useRef(null);
  
  useEffect(() => {
    fetchData();
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [showPreExistingModal, setShowPreExistingModal] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);

  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileAmount, setReconcileAmount] = useState(0);
  const [selectedReconcileFund, setSelectedReconcileFund] = useState('RETIREMENT');
  const [isReconciling, setIsReconciling] = useState(false);

  const fetchSavingsBreakdown = async () => {
    try {
      const res = await api.get('/user/savings-breakdown');
      setBreakdownData(res.data);
      setShowBreakdownModal(true);
    } catch (err) {
      toast.error('Failed to load savings breakdown.');
    }
  };

  const fetchData = async () => {
    try {
      isFetching.current = true;
      setLoading(true);
      const [incomeRes, txnRes, assetsRes, userRes, fixedRes] = await Promise.all([
        api.get('/income').catch(() => ({ data: [] })),
        api.get('/transactions').catch(() => ({ data: [] })),
        api.get('/assets').catch(() => ({ data: [] })),
        api.get('/user/settings').catch(() => ({ data: {} })),
        api.get('/fixed-expenses').catch(() => ({ data: [] }))
      ]);

      const incomeSources = incomeRes.data || [];
      const transactions = txnRes.data || [];
      const fixedExpenses = fixedRes.data || [];
      const settings = userRes.data || {};

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const todayDay = new Date().getDate();
      const salaryDay = settings.salaryDay || 1;

      // Income calculation for current month
      const currentMonthTxns = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      const incomeTxns = currentMonthTxns.filter(t => t.type === 'INCOME' || t.type === 'CREDIT');
      const arrivedIncomeTemplates = incomeSources.filter(src => {
        const day = src.dayOfMonth || 1;
        if (day > todayDay) return false;
        const srcDesc = (src.description || src.type).toLowerCase();
        return !incomeTxns.some(t => 
          (t.description && t.description.toLowerCase().includes(srcDesc)) ||
          (t.category && t.category.toLowerCase() === src.type.toLowerCase())
        );
      });

      const currentMonthIncome = incomeTxns.reduce((s, t) => s + parseFloat(t.amount || 0), 0)
        + arrivedIncomeTemplates.reduce((s, src) => s + parseFloat(src.amount || 0), 0);

      // Expenses calculation for current month (with per-expense dayOfMonth check)
      const fixedTxns = currentMonthTxns.filter(t => (t.type === 'EXPENSE' || t.type === 'DEBIT') && t.fixedExpenseId != null);
      const uniqueFixedTxns = [];
      const seenFixed = new Set();
      for (const t of fixedTxns) {
        if (!seenFixed.has(t.fixedExpenseId)) {
          seenFixed.add(t.fixedExpenseId);
          const parentExp = fixedExpenses.find(f => f.id === t.fixedExpenseId);
          const day = parentExp ? (parentExp.dayOfMonth || 1) : 1;
          if (day <= todayDay) {
            uniqueFixedTxns.push(t);
          }
        }
      }

      let arrivedFixedTemplatesSum = 0;
      fixedExpenses.forEach(exp => {
        const day = exp.dayOfMonth || 1;
        if (!seenFixed.has(exp.id) && day <= todayDay) {
          arrivedFixedTemplatesSum += parseFloat(exp.amount || 0);
        }
      });

      let currentMonthExpenses = uniqueFixedTxns.reduce((s, t) => s + parseFloat(t.amount || 0), 0) + arrivedFixedTemplatesSum;

      const additionalTxns = currentMonthTxns.filter(t => (t.type === 'EXPENSE' || t.type === 'DEBIT') && t.fixedExpenseId == null);
      currentMonthExpenses += additionalTxns.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

      const sumByDate = (txns, month, year, typeFilter) => txns
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === month && d.getFullYear() === year && (typeFilter ? t.type === typeFilter : true);
        })
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      
      const prevMonthIncome = incomeSources.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) + sumByDate(transactions, prevMonth, prevYear, 'CREDIT');
      const prevMonthExpenses = sumByDate(transactions, prevMonth, prevYear, 'EXPENSE');

      const currentSavings = Math.max(0, currentMonthIncome - currentMonthExpenses);
      const prevSavings = Math.max(0, prevMonthIncome - prevMonthExpenses);
      
      // Always rely dynamically on the fetched current month income
      setMonthlyIncome(currentMonthIncome);
      setMonthlyExpense(currentMonthExpenses);
      setExpectedMonthlySavings(currentSavings);
      
      setLiveTotalSavings(settings.liveTotalSavings || 0);
      setPreExistingSavings(settings.manualTotalSavings || 0);
      setPreExistingSavingsDate(settings.preExistingSavingsDate || '');
      
      let growth = 0;
      if (prevSavings > 0) {
        growth = ((currentSavings - prevSavings) / prevSavings) * 100;
      } else if (currentSavings > 0) {
        growth = 100;
      }
      setSavingsGrowth(growth);

      const assets = { RETIREMENT: 0, LONG_TERM: 0, SHORT_TERM: 0, EMERGENCY: 0, WEALTH: 0, UNALLOCATED: 0 };
      assetsRes.data.forEach(a => {
        if (a.assetType && assets[a.assetType] !== undefined) {
            if (!a.fundAllocations || a.fundAllocations === '[]') {
                assets[a.assetType] += parseFloat(a.currentValue || 0);
            }
        }
        let parsedAllocations = [];
        try {
            if (a.fundAllocations) parsedAllocations = JSON.parse(a.fundAllocations);
        } catch(e){}
        if (Array.isArray(parsedAllocations)) {
          parsedAllocations.forEach(alloc => {
             if (assets[alloc.fundType] !== undefined) {
                assets[alloc.fundType] += (parseFloat(a.currentValue || 0) * (alloc.percentage / 100));
             }
          });
        }
      });
      setPreExistingAssets(assets);

      let savedAllocations = settings.fundAllocationsJson ? JSON.parse(settings.fundAllocationsJson) : null;
      if (savedAllocations) {
        setAllocations(savedAllocations.core || DEFAULT_ALLOCATIONS);
        setRetirementPercent(savedAllocations.retirement !== undefined ? savedAllocations.retirement : 20);
      } else {
        setAllocations(DEFAULT_ALLOCATIONS);
        setRetirementPercent(20);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => { isFetching.current = false; }, 500);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const payload = {
        manualTotalSavings: preExistingSavings,
        preExistingSavingsDate: preExistingSavingsDate,
        fundAllocationsJson: JSON.stringify({ core: allocations, retirement: retirementPercent })
      };
      await toast.promise(api.put('/user/settings', payload), {
        loading: 'Saving allocations...',
        success: 'Settings saved!',
        error: 'Failed to save settings.'
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };



  const handleAllocationChange = (fundId, value) => {
    let newVal = parseFloat(value) || 0;
    
    // Calculate total currently allocated to *other* funds
    let currentOtherAlloc = 0;
    if (fundId === 'RETIREMENT') {
      currentOtherAlloc = Object.values(allocations).reduce((sum, val) => sum + val, 0);
    } else {
      currentOtherAlloc = Object.entries(allocations)
        .filter(([k]) => k !== fundId)
        .reduce((sum, [, val]) => sum + val, 0) + retirementPercent;
    }
    
    // STRICTLY ENFORCE 100% TOTAL ALLOCATION ACROSS FUNDS
    const maxAllowed = Math.max(0, 100 - currentOtherAlloc);
    if (newVal > maxAllowed) {
      newVal = maxAllowed;
    }

    if (fundId === 'RETIREMENT') {
      setRetirementPercent(newVal);
    } else {
      setAllocations(prev => ({ ...prev, [fundId]: newVal }));
    }
  };

  const handleAmountChange = (fundId, amountStr) => {
    const amount = parseFloat(amountStr) || 0;
    const pct = monthlyIncome > 0 ? (amount / monthlyIncome) * 100 : 0;
    if (fundId === 'RETIREMENT') {
      setRetirementPercent(pct);
    } else {
      setAllocations(prev => ({ ...prev, [fundId]: pct }));
    }
  };

  const handleReconcile = async () => {
    try {
      setIsReconciling(true);
      const discrepancy = Math.round((liveTotalSavings - expectedMonthlySavings) - Object.values(preExistingAssets).reduce((a,b) => a+b, 0));
      await api.post('/assets/reconcile-discrepancy', {
        fundType: selectedReconcileFund,
        adjustmentAmount: discrepancy
      });
      toast.success('Fund balance adjusted successfully!');
      setShowReconcileModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to adjust fund balance.');
    } finally {
      setIsReconciling(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#8B8C9A' }}>Loading Fund Management...</div>;

  const totalOtherAlloc = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const totalAlloc = totalOtherAlloc + retirementPercent;
  const unallocatedPct = Math.max(0, 100 - totalAlloc);

  // Live Monthly Contribution is calculated strictly from Current Monthly Savings
  const calculateRupees = (pct) => (expectedMonthlySavings * (pct / 100));

  const totalSavingsDisplay = liveTotalSavings > 0 ? liveTotalSavings : (preExistingSavings + expectedMonthlySavings);

  // Cumulative Fund Balance = Stored Asset Balance + Live Current Month Contribution
  const getFundTotalBalance = (fundId, pct) => {
    return (preExistingAssets[fundId] || 0) + calculateRupees(pct);
  };

  const totalAmountInFunds = FUNDS.reduce((sum, fund) => {
    let pct = 0;
    if (fund.id === 'RETIREMENT') pct = retirementPercent;
    else if (fund.id === 'UNALLOCATED') pct = unallocatedPct;
    else pct = allocations[fund.id] || 0;
    return sum + getFundTotalBalance(fund.id, pct);
  }, 0);
  
  const totalStoredAssets = Object.values(preExistingAssets).reduce((a,b) => a+b, 0);
  const totalHistoricalSavings = liveTotalSavings - expectedMonthlySavings;
  const discrepancy = Math.round(totalHistoricalSavings - totalStoredAssets);

  const formatNumberToWords = (num) => {
    if (num >= 10000000) return (num / 10000000).toFixed(2).replace(/\.00$/, '') + ' Crores';
    if (num >= 100000) return (num / 100000).toFixed(2).replace(/\.00$/, '') + ' Lakhs';
    if (num >= 1000) return (num / 1000).toFixed(2).replace(/\.00$/, '') + 'k';
    return num.toString();
  };

  const renderIcon = (name) => {
    switch (name) {
      case 'shield': return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>;
      case 'scales': return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18"/><path d="M3 7h18"/><path d="M5 7l-2 9h6l-2-9"/><path d="M19 7l2 9h-6l2-9"/></svg>;
      case 'rocket': return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2l.5-.5c1.1-1.1 2.7-1.1 3.8 0 1.2 1.2 1.3 3.1.2 4.3l-1.3 1.4s4.2.1 6.5-2.2c2.2-2.3 2.2-6.2 0-8.5l-4-4c-2.3-2.2-6.2-2.2-8.5 0-2.3 2.3-2.2 6.5 0 8.5z"/><path d="M12 12l-2-2"/></svg>;
      case 'sliders': return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
      case 'cart': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
      case 'target': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
      case 'calendar': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
      case 'chart': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
      default: return null;
    }
  };

  const renderDonutSegments = () => {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;
    
    return FUNDS.filter(fund => {
      const val = fund.id === 'RETIREMENT' ? retirementPercent : (allocations[fund.id] || 0);
      return val > 0 || fund.id !== 'RETIREMENT'; // hide retirement if 0%
    }).map((fund) => {
      const percent = fund.id === 'RETIREMENT' ? retirementPercent : (allocations[fund.id] || 0);
      const normalizedPercent = totalAlloc > 0 ? (percent / totalAlloc) * 100 : 0;
      const strokeLength = (normalizedPercent / 100) * circumference;
      
      const result = (
        <circle 
          key={fund.id}
          cx="80" cy="80" r="60"
          fill="none"
          stroke={fund.color}
          strokeWidth="24"
          strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
          strokeDashoffset={-currentOffset}
          transform="rotate(-90 80 80)"
          style={{ transition: 'all 0.5s ease' }}
        />
      );
      currentOffset += strokeLength;
      return result;
    });
  };

  return (
    <div className="fund-management-container" style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      
      {Math.abs(discrepancy) > 0 && !loading && (
        <div style={{ width: '100%', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '12px', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             <span style={{ color: '#F97316', fontSize: '15px', fontWeight: 500 }}>
               Discrepancy Detected: Your Total Savings {discrepancy > 0 ? 'increased' : 'decreased'} by ₹{new Intl.NumberFormat('en-IN').format(Math.abs(discrepancy))} due to past updates.
             </span>
          </div>
          <button onClick={() => { setReconcileAmount(discrepancy); setShowReconcileModal(true); }} style={{ background: '#F97316', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
             Resolve Discrepancy
          </button>
        </div>
      )}

      {/* LEFT COLUMN: Total Savings & Summary */}
      <div style={{ flex: '1 1 300px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <div className="fm-card" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
           <div>
             
             <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                 <div style={{ fontSize: '12px', color: '#8B8C9A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pre-Existing Savings</div>
                 <button 
                   onClick={() => setShowPreExistingModal(true)}
                   style={{ background: 'transparent', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#818CF8', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                 >
                   Edit
                 </button>
               </div>
               
               <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                 <div style={{ fontSize: '24px', fontWeight: 700, color: '#EAB308' }}>₹{new Intl.NumberFormat('en-IN').format(preExistingSavings)}</div>
                 {preExistingSavingsDate && (
                   <div style={{ fontSize: '11px', color: '#8B8C9A' }}>(Since {preExistingSavingsDate})</div>
                 )}
               </div>
             </div>

              <div className="fm-total-savings" style={{ marginBottom: '8px' }}>Total Savings</div>
              <div className="fm-savings-amount" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '36px' }}>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(totalSavingsDisplay)}</span>
                <span style={{ fontSize: '16px', color: '#8B8C9A', marginLeft: '8px', fontWeight: 500 }}>({formatNumberToWords(totalSavingsDisplay)})</span>
              </div>
            </div>
           


           <div style={{ background: totalAlloc === 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)', borderRadius: '12px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: totalAlloc === 100 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: totalAlloc === 100 ? '#10B981' : '#EAB308', fontSize: '14px', fontWeight: 600 }}>
               {totalAlloc === 100 ? (
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
               ) : (
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               )}
               <span>Allocation Total: {totalAlloc.toFixed(1)}%</span>
             </div>
             <strong style={{ color: totalAlloc === 100 ? '#10B981' : '#EAB308', fontSize: '14px' }}>
               {totalAlloc === 100 ? '100% Allocated' : `${unallocatedPct.toFixed(1)}% unallocated`}
             </strong>
           </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Allocations */}
      <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <div className="fm-card" style={{ marginBottom: 0 }}>
           <div className="fm-profile-header" style={{ alignItems: 'center' }}>
              <div>
                <h2 className="fm-title" style={{fontSize:'20px'}}>Manage Savings Allocation</h2>
                <p className="fm-subtitle">Adjust how your savings are distributed across funds.</p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                 {!isEditing ? (
                   <button className="fm-btn-primary" style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }} onClick={() => setIsEditing(true)}>
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                     Edit Allocation
                   </button>
                 ) : (
                   <button className="fm-btn-primary" onClick={handleSaveChanges} style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: '#818CF8', borderRadius: '8px' }}>
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                     Save Allocation
                   </button>
                 )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '12px', color: totalAlloc === 100 ? '#10B981' : '#EAB308' }}>
                    Allocation Total
                  </span>
                  <strong style={{ color: totalAlloc === 100 ? '#10B981' : '#EAB308', fontSize: '18px' }}>
                    {totalAlloc.toFixed(1)}% / 100%
                  </strong>
                </div>
              </div>
           </div>
           
           <div style={{ marginTop: '32px' }}>
             <div className="fm-fund-row" style={{ alignItems: 'flex-end', borderBottom: '1px solid #232533', paddingBottom: '12px', paddingTop: 0 }}>
                <div style={{ width: '48px', paddingRight: '16px' }}></div>
                <div style={{ flex: '0 0 180px', paddingRight: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>Fund</div>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', margin: '0 16px' }}>
                  <div style={{ fontSize: '11px', color: '#8B8C9A', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>% of Monthly Savings</div>
                </div>
                <div style={{ flex: '0 0 140px', display: 'flex', justifyContent: 'center', margin: '0 16px' }}>
                  <div style={{ fontSize: '11px', color: '#8B8C9A', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>Monthly Contribution</div>
                </div>
                <div style={{ minWidth: '110px', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '11px', color: '#8B8C9A', textAlign: 'right', lineHeight: 1.3, fontWeight: 600 }}>Total Amount in Fund</div>
                </div>
             </div>

              {FUNDS.map(fund => {
                const val = fund.id === 'RETIREMENT' ? retirementPercent : fund.id === 'UNALLOCATED' ? unallocatedPct : (allocations[fund.id] || 0);
                const monthlyContribution = calculateRupees(val);
                const totalFundBalance = getFundTotalBalance(fund.id, val);
                const hasPlannedRetirement = !!localStorage.getItem('retirement_sip_target');

               return (
                 <div key={fund.id} className="fm-fund-row" style={{ alignItems: 'center' }}>
                   <div className="fm-fund-icon-box" style={{ background: `rgba(${parseInt(fund.color.slice(1,3),16)}, ${parseInt(fund.color.slice(3,5),16)}, ${parseInt(fund.color.slice(5,7),16)}, 0.15)`, color: fund.color }}>
                     {renderIcon(fund.icon)}
                   </div>
                   <div style={{ flex: '0 0 180px', paddingRight: '16px' }}>
                     <div className="fm-fund-name" style={{ fontSize: '14px' }}>{fund.name}</div>
                     <div style={{ fontSize: '11px', color: '#8B8C9A', marginTop: '4px', lineHeight: 1.4 }}>{fund.description}</div>
                   </div>
                   
                   {fund.id === 'RETIREMENT' && !hasPlannedRetirement ? (
                     <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                       <button className="fm-btn-outline" onClick={() => navigate('/retirement-planner')} style={{ padding: '8px 24px', borderColor: '#818CF8', color: '#818CF8' }}>
                         Plan Retirement First
                       </button>
                     </div>
                   ) : (
                     <>
                        <div className="fm-slider-container" style={{ flex: 1, margin: '0 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                           {fund.id === 'UNALLOCATED' ? (
                             <div style={{ color: '#9CA3AF', fontSize: '16px', fontWeight: 700 }}>{val.toFixed(1)}%</div>
                           ) : isEditing ? (
                             <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                               <input 
                                 type="number"
                                 value={val}
                                 step="0.1"
                                 onChange={(e) => handleAllocationChange(fund.id, e.target.value)}
                                 style={{
                                   background: 'transparent',
                                   border: 'none',
                                   borderBottom: `2px solid ${fund.color}`,
                                   color: '#fff',
                                   fontSize: '16px',
                                   fontWeight: 700,
                                   width: '56px',
                                   textAlign: 'center',
                                   outline: 'none',
                                   padding: '2px 0'
                                 }}
                               />
                               <span style={{ color: '#8B8C9A', fontSize: '14px', marginLeft: '4px' }}>%</span>
                             </div>
                           ) : (
                             <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>{val.toFixed(1)}%</div>
                           )}
                           
                           {fund.id !== 'UNALLOCATED' && (
                           <input 
                             type="range" 
                             min="0" max="100" step="0.1" 
                             value={val}
                             onChange={(e) => handleAllocationChange(fund.id, e.target.value)}
                             disabled={!isEditing}
                             style={{ 
                               width: '100%',
                               background: `linear-gradient(to right, ${fund.color} ${val}%, #232533 ${val}%)`,
                               '--thumb-color': fund.color,
                               opacity: isEditing ? 1 : 0.6,
                               cursor: isEditing ? 'pointer' : 'not-allowed'
                             }}
                           />
                           )}
                         </div>
                       
                       <div style={{ flex: '0 0 140px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 16px' }}>
                         <div style={{ display: 'flex', alignItems: 'center' }}>
                           <span style={{ color: '#8B8C9A', fontSize: '14px', marginRight: '4px' }}>₹</span>
                           <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                             {new Intl.NumberFormat('en-IN').format(Math.round(monthlyContribution))}
                           </span>
                           <span style={{ color: '#8B8C9A', fontSize: '12px', marginLeft: '6px' }}>/ mo</span>
                         </div>
                       </div>
                       
                       <div className="fm-fund-amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '110px' }}>
                         <span style={{ color: fund.color, fontWeight: 700, fontSize: '15px' }}>
                           ₹{new Intl.NumberFormat('en-IN').format(Math.round(totalFundBalance))}
                         </span>
                         <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fund Balance</span>
                       </div>
                     </>
                   )}
                 </div>
               );
             })}

              {/* Total Row */}
              <div className="fm-fund-row" style={{ alignItems: 'center', borderTop: '2px solid #232533', marginTop: '16px', paddingTop: '16px' }}>
                <div style={{ flex: '0 0 48px', paddingRight: '16px' }}></div>
                <div style={{ flex: '0 0 180px', paddingRight: '16px' }}>
                  <div className="fm-fund-name" style={{ fontSize: '16px', color: '#fff', fontWeight: 700 }}>Total</div>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 16px' }}>
                  <div style={{ color: totalAlloc === 100 ? '#10B981' : '#EAB308', fontSize: '16px', fontWeight: 700 }}>
                    {totalAlloc.toFixed(1)}%
                  </div>
                </div>
                <div style={{ flex: '0 0 140px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#8B8C9A', fontSize: '14px', marginRight: '4px' }}>₹</span>
                    <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                      {new Intl.NumberFormat('en-IN').format(Math.round(calculateRupees(totalAlloc)))}
                    </span>
                    <span style={{ color: '#8B8C9A', fontSize: '12px', marginLeft: '6px' }}>/ mo</span>
                  </div>
                </div>
                <div className="fm-fund-amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '110px' }}>
                  <span style={{ color: '#10B981', fontWeight: 700, fontSize: '16px' }}>
                    ₹{new Intl.NumberFormat('en-IN').format(Math.round(totalSavingsDisplay))}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Savings</span>
                </div>
              </div>

            </div>
          </div>

      </div>

      {/* Pre-Existing Savings Modal */}
      {showPreExistingModal && (
        <div className="fm-modal-overlay" onClick={() => setShowPreExistingModal(false)} style={{ zIndex: 9999 }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()}>
            <div className="fm-modal-header">
              <h3>Update Pre-Existing Savings</h3>
              <button className="fm-modal-close" onClick={() => setShowPreExistingModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="fm-modal-body">
              <p style={{ color: '#8B8C9A', fontSize: '13px', marginBottom: '16px' }}>Enter your total pre-existing lump sum savings.</p>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <span style={{ color: '#8B8C9A', alignSelf: 'center', fontSize: '18px' }}>₹</span>
                <input 
                  type="number" 
                  value={preExistingSavings} 
                  onChange={e => setPreExistingSavings(parseFloat(e.target.value)||0)} 
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '18px', padding: '10px', borderRadius: '6px' }} 
                  placeholder="e.g. 500000"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px' }}>Date Evaluated</label>
                <input 
                  type="date" 
                  value={preExistingSavingsDate} 
                  onChange={e => setPreExistingSavingsDate(e.target.value)} 
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '14px', padding: '10px', borderRadius: '6px' }} 
                />
              </div>
            </div>
            <div className="fm-modal-footer">
              <button className="fm-btn-outline" onClick={() => setShowPreExistingModal(false)}>Cancel</button>
              <button className="fm-btn-primary" style={{ background: '#EAB308', color: '#000' }} onClick={async () => {
                try {
                  await toast.promise(api.put('/user/settings', {
                    manualTotalSavings: preExistingSavings,
                    preExistingSavingsDate: preExistingSavingsDate
                  }), { loading: 'Saving...', success: 'Saved successfully!', error: 'Failed to save.' });
                  setShowPreExistingModal(false);
                } catch (err) {}
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Savings Calculation Breakdown Modal */}
      {showBreakdownModal && (
        <div className="fm-modal-overlay" onClick={() => setShowBreakdownModal(false)} style={{ zIndex: 9999 }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div className="fm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📊</span>
                <h3>Total Savings Calculation Breakdown</h3>
              </div>
              <button className="fm-modal-close" onClick={() => setShowBreakdownModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="fm-modal-body" style={{ padding: '20px' }}>
              <p style={{ color: '#8B8C9A', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Your total savings is calculated by combining your initial pre-existing lump sum savings with your monthly net savings (Income minus Expenses) for each month.
              </p>

              <div style={{ background: '#12141D', borderRadius: '8px', border: '1px solid #232533', overflow: 'hidden', marginBottom: '16px' }}>
                {/* Pre-Existing Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(234, 179, 8, 0.08)', borderBottom: '1px solid #232533' }}>
                  <div>
                    <strong style={{ color: '#EAB308', fontSize: '14px' }}>Pre-Existing Savings</strong>
                    <div style={{ fontSize: '11px', color: '#8B8C9A' }}>Initial starting lump sum {breakdownData?.preExistingSavingsDate ? `(Since ${breakdownData.preExistingSavingsDate})` : ''}</div>
                  </div>
                  <strong style={{ color: '#EAB308', fontSize: '15px', alignSelf: 'center' }}>
                    +₹{new Intl.NumberFormat('en-IN').format(breakdownData?.manualTotalSavings || 0)}
                  </strong>
                </div>

                {/* Older Months Cumulative Row (if any) */}
                {breakdownData?.olderSavingsCumulative !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #232533' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '13px' }}>Older Months Savings (Cumulative)</strong>
                      <div style={{ fontSize: '11px', color: '#8B8C9A' }}>Sum of net savings prior to last 3 months</div>
                    </div>
                    <strong style={{ color: breakdownData?.olderSavingsCumulative >= 0 ? '#10B981' : '#EF4444', fontSize: '14px', alignSelf: 'center' }}>
                      {breakdownData?.olderSavingsCumulative >= 0 ? '+' : ''}₹{new Intl.NumberFormat('en-IN').format(breakdownData?.olderSavingsCumulative || 0)}
                    </strong>
                  </div>
                )}

                {/* Recent 3 Months Table */}
                <div style={{ padding: '12px 16px 4px 16px', fontSize: '11px', textTransform: 'uppercase', color: '#8B8C9A', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Recent 3 Months Net Savings Breakdown
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '8px' }}>
                  <thead>
                    <tr style={{ color: '#8B8C9A', textAlign: 'left', borderBottom: '1px solid #232533', fontSize: '11px' }}>
                      <th style={{ padding: '8px 16px' }}>Month</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right' }}>Income</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right' }}>Expenses</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right' }}>Net Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(breakdownData?.recentMonths || []).map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: m.isCurrent ? 'rgba(129, 140, 248, 0.05)' : 'transparent' }}>
                        <td style={{ padding: '10px 16px', color: m.isCurrent ? '#818CF8' : '#fff', fontWeight: m.isCurrent ? 600 : 400 }}>
                          {m.label}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#10B981' }}>
                          +₹{new Intl.NumberFormat('en-IN').format(m.income)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: '#EF4444' }}>
                          -₹{new Intl.NumberFormat('en-IN').format(m.expense)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: m.netSavings >= 0 ? '#10B981' : '#EF4444' }}>
                          {m.netSavings >= 0 ? '+' : ''}₹{new Intl.NumberFormat('en-IN').format(m.netSavings)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Formula & Result Summary Card */}
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#8B8C9A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculated Total Savings</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                    Pre-Existing + Older Cumulative + Recent Months Net
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#10B981' }}>
                  ₹{new Intl.NumberFormat('en-IN').format(Math.round(breakdownData?.totalSavings || 0))}
                </div>
              </div>
            </div>

            <div className="fm-modal-footer">
              <button className="fm-btn-primary" style={{ background: '#818CF8', width: '100%' }} onClick={() => setShowBreakdownModal(false)}>Close Breakdown</button>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Reconciliation Modal */}
      {showReconcileModal && (
        <div className="fm-modal-overlay" onClick={() => setShowReconcileModal(false)} style={{ zIndex: 9999 }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="fm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>⚖️</span>
                <h3>Resolve Discrepancy</h3>
              </div>
              <button className="fm-modal-close" onClick={() => setShowReconcileModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="fm-modal-body" style={{ padding: '20px' }}>
              <div style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <p style={{ color: '#fff', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                  Because you edited past income or expenses, your dynamic Total Savings has {reconcileAmount > 0 ? 'increased' : 'decreased'} by <strong style={{ color: '#F97316' }}>₹{new Intl.NumberFormat('en-IN').format(Math.abs(reconcileAmount))}</strong>. 
                  <br/><br/>
                  Please select which stored fund balance should absorb this {reconcileAmount > 0 ? 'gain' : 'loss'}.
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Apply Adjustment To:
                </label>
                <select 
                  value={selectedReconcileFund} 
                  onChange={(e) => setSelectedReconcileFund(e.target.value)}
                  style={{ width: '100%', background: '#12141D', border: '1px solid #232533', color: '#fff', fontSize: '15px', padding: '12px', borderRadius: '6px', outline: 'none' }}
                >
                  {FUNDS.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="fm-modal-footer">
              <button className="fm-btn-outline" onClick={() => setShowReconcileModal(false)} disabled={isReconciling}>Cancel</button>
              <button className="fm-btn-primary" style={{ background: '#F97316' }} onClick={handleReconcile} disabled={isReconciling}>
                {isReconciling ? 'Applying...' : `Apply ₹${new Intl.NumberFormat('en-IN').format(Math.abs(reconcileAmount))} ${reconcileAmount > 0 ? 'Increase' : 'Decrease'}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
