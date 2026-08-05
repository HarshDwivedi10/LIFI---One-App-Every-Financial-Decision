import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import './FundManagementPage.css';
import toast from 'react-hot-toast';

const DEFAULT_ALLOCATIONS = { 'LONG_TERM': 25, 'SHORT_TERM': 25, 'EMERGENCY': 25, 'WEALTH': 25 };

const RAW_FUNDS = [
  { id: 'RETIREMENT', rawName: 'Retirement Corpus', color: '#818CF8', icon: 'cart', description: 'For your golden years and post-work life' },
  { id: 'LONG_TERM', rawName: 'Long-Term Goal Corpus', color: '#10B981', icon: 'target', description: 'For big purchases like a house or car' },
  { id: 'SHORT_TERM', rawName: 'Short-Term Goal Corpus', color: '#3B82F6', icon: 'calendar', description: 'For vacations and near-term expenses' },
  { id: 'EMERGENCY', rawName: 'Emergency & Protection Corpus', color: '#F97316', icon: 'shield', description: 'Safety net for unexpected situations' },
  { id: 'WEALTH', rawName: 'Wealth Creation Corpus', color: '#EAB308', icon: 'chart', description: 'Aggressive growth and investments' },
  { id: 'UNALLOCATED', rawName: 'Unallocated Savings', color: '#9CA3AF', icon: 'scales', description: 'System-managed remaining savings' }
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
  const [retirementPercent, setRetirementPercent] = useState(0);

  const hasPlannedRetirement = retirementPercent > 0 || (preExistingAssets['RETIREMENT'] || 0) > 0 || !!localStorage.getItem('retirement_sip_target');

  const FUNDS = RAW_FUNDS.filter(f => f.id !== 'RETIREMENT' || hasPlannedRetirement).map((f, idx) => ({
    ...f,
    name: `${idx + 1}. ${f.rawName}`
  }));
  
  const [allocations, setAllocations] = useState(DEFAULT_ALLOCATIONS);
  const [showFirstTimeAllocationModal, setShowFirstTimeAllocationModal] = useState(false);
  const [onboardingAllocations, setOnboardingAllocations] = useState({ LONG_TERM: 25, SHORT_TERM: 25, EMERGENCY: 25, WEALTH: 25 });

  const isInitialMount = useRef(true);
  const isFetching = useRef(true);
  const saveTimeoutRef = useRef(null);
  
  const hasShownToast = useRef(false);

  useEffect(() => {
    fetchData();
    const params = new URLSearchParams(location.search);
    if (params.get('firstTime') === 'true' && !hasShownToast.current) {
      hasShownToast.current = true;
      setShowFirstTimeAllocationModal(true);
    }
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [showPreExistingModal, setShowPreExistingModal] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);

  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileAmount, setReconcileAmount] = useState(0);
  const [selectedReconcileFund, setSelectedReconcileFund] = useState('RETIREMENT');
  const [isReconciling, setIsReconciling] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);

  const [showTransferHistoryModal, setShowTransferHistoryModal] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

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
    isFetching.current = true;
    try {
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

      // Process assets map
      const assetsList = assetsRes.data || [];
      const assets = { RETIREMENT: 0, LONG_TERM: 0, SHORT_TERM: 0, EMERGENCY: 0, WEALTH: 0, UNALLOCATED: 0 };
      
      assetsList.forEach(a => {
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

      let savedAllocations = settings.fundAllocationsJson ? JSON.parse(settings.fundAllocationsJson) : null;
      const coreMap = savedAllocations?.core || DEFAULT_ALLOCATIONS;
      const retPct = savedAllocations?.retirement !== undefined ? savedAllocations.retirement : 0;

      if (savedAllocations) {
        setAllocations(coreMap);
        setRetirementPercent(retPct);
      } else {
        setAllocations(DEFAULT_ALLOCATIONS);
        setRetirementPercent(0);
      }

      const totalStoredSum = Object.values(assets).reduce((a,b) => a+b, 0);
      if (totalStoredSum === 0) {
        const historical = Math.max(0, (settings.liveTotalSavings || 0) - currentSavings);
        const base = historical > 0 ? historical : (settings.manualTotalSavings || 0);
        assets.UNALLOCATED = base;
        assets.LONG_TERM = 0;
        assets.SHORT_TERM = 0;
        assets.EMERGENCY = 0;
        assets.WEALTH = 0;
        assets.RETIREMENT = 0;
      }
      setPreExistingAssets(assets);

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

  const handleTransfer = async () => {
    if (!transferFrom || !transferTo || !transferAmount || parseFloat(transferAmount) <= 0) {
      toast.error('Please fill all fields with valid amounts.');
      return;
    }
    if (transferFrom === transferTo) {
      toast.error('Source and destination must be different.');
      return;
    }

    const currentUnallocatedPct = Math.max(0, 100 - (Object.values(allocations).reduce((sum, val) => sum + val, 0) + retirementPercent));
    const availableBalance = preExistingAssets[transferFrom] || 0;
    
    if (parseFloat(transferAmount) > availableBalance) {
      toast.error('Insufficient funds in the source account. You can only transfer accumulated stored savings.');
      return;
    }

    try {
      setIsTransferring(true);
      await api.post('/assets/transfer', {
        sourceFund: transferFrom,
        destinationFund: transferTo,
        amount: parseFloat(transferAmount)
      });
      
      setShowTransferModal(false);
      setTransferAmount('');
      
      // Trigger success animation overlay
      setShowTransferSuccess(true);
      setTimeout(() => {
        setShowTransferSuccess(false);
        fetchData();
      }, 2500);

    } catch (err) {
      console.error('Transfer Error:', err.response);
      let errorMsg = 'Failed to transfer funds.';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') errorMsg = err.response.data;
        else if (err.response.data.message) errorMsg = err.response.data.message;
        else errorMsg = JSON.stringify(err.response.data);
      }
      toast.error(errorMsg);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleViewTransferHistory = async () => {
    setShowTransferHistoryModal(true);
    setIsFetchingHistory(true);
    try {
      const res = await api.get('/assets/transfers');
      setTransferHistory(res.data || []);
    } catch (err) {
      toast.error('Failed to load transfer history.');
    } finally {
      setIsFetchingHistory(false);
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
    <div className="fund-management-container">
      
      {Math.abs(discrepancy) > 0 && !loading && (
        <div style={{ width: '100%', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '12px', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
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

      {/* TOP WIDGETS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Left: Allocation Total Widget */}
        <div className="fm-card fm-card-purple" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
          <div>
            <div className="fm-compact-title" style={{ color: totalAlloc === 100 ? '#10B981' : '#F97316' }}>Allocation Total</div>
            <div className="fm-compact-value" style={{ color: totalAlloc === 100 ? '#10B981' : '#F97316' }}>{totalAlloc.toFixed(1)}%</div>
            <div style={{ fontSize: '11px', color: '#8B8C9A', marginTop: '4px' }}>{totalAlloc === 100 ? '100% Allocated' : `${unallocatedPct.toFixed(1)}% Unallocated`}</div>
          </div>
        </div>

        {/* Right: Total Savings Widget */}
        <div className="fm-card fm-card-green" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
          <div>
            <div className="fm-compact-title">Total Savings</div>
            <div className="fm-compact-value" style={{ color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(totalSavingsDisplay)}</div>
          </div>
          <button 
             onClick={() => setShowPreExistingModal(true)}
             style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
           >
             Edit Pre-Existing Balance
           </button>
        </div>

      </div>

      {/* MAIN TWO COLUMNS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* LEFT CARD - Monthly Allocation */}
        <div className="fm-card fm-card-purple" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div className="fm-header-bar">
             <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderIcon('calendar')}
                </div>
                <div>
                   <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }}>Monthly Allocation</h2>
                   <div style={{ fontSize: '13px', color: '#8B8C9A' }}>Current month's savings distribution</div>
                </div>
             </div>
             <button onClick={() => isEditing ? handleSaveChanges() : setIsEditing(true)} style={{ background: isEditing ? '#4F46E5' : '#818CF8', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>
                {isEditing ? 'Save' : (
                   <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                     Edit Allocation
                   </span>
                )}
             </button>
          </div>
          
          <div className="fm-table-row fm-table-header">
             <div style={{ flex: '2' }}>Fund</div>
             <div style={{ flex: '1', textAlign: 'center' }}>% of Monthly Savings</div>
             <div style={{ flex: '1.2', textAlign: 'right' }}>Monthly Contribution</div>
          </div>

          <div style={{ flex: 1 }}>
            {FUNDS.map(fund => {
                const val = fund.id === 'RETIREMENT' ? retirementPercent : fund.id === 'UNALLOCATED' ? unallocatedPct : (allocations[fund.id] || 0);
                const hasPlannedRetirement = !!localStorage.getItem('retirement_sip_target');
                
                return (
                   <div className="fm-table-row" key={fund.id}>
                      <div style={{ flex: '2', display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `rgba(${parseInt(fund.color.slice(1,3),16)}, ${parseInt(fund.color.slice(3,5),16)}, ${parseInt(fund.color.slice(5,7),16)}, 0.15)`, color: fund.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {renderIcon(fund.icon)}
                         </div>
                         <div style={{ fontSize: '14px', fontWeight: 500 }}>{fund.name}</div>
                      </div>
                      
                      <div style={{ flex: '1', textAlign: 'center' }}>
                         {fund.id === 'RETIREMENT' && !hasPlannedRetirement ? (
                            <span style={{ fontSize: '13px', color: '#8B8C9A' }}>Unplanned</span>
                         ) : fund.id === 'UNALLOCATED' ? (
                            <span style={{ fontSize: '15px', fontWeight: 600 }}>{val.toFixed(1)}%</span>
                         ) : isEditing ? (
                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 8px' }}>
                               <input 
                                 type="range" 
                                 min="0" max="100" step="0.1" 
                                 value={val}
                                 onChange={(e) => handleAllocationChange(fund.id, e.target.value)}
                                 style={{ 
                                   width: '100%',
                                   background: `linear-gradient(to right, ${fund.color} ${val}%, #232533 ${val}%)`,
                                   '--thumb-color': fund.color,
                                   cursor: 'pointer'
                                 }}
                               />
                               <span style={{ fontSize: '12px', marginTop: '6px', color: '#A5B4FC', fontWeight: 600 }}>{val.toFixed(1)}%</span>
                             </div>
                         ) : (
                             <span style={{ fontSize: '15px', fontWeight: 600 }}>{val.toFixed(1)}%</span>
                         )}
                      </div>
                      
                      <div style={{ flex: '1.2', textAlign: 'right', fontSize: '14px', fontWeight: 500 }}>
                         ₹{new Intl.NumberFormat('en-IN').format(Math.round(calculateRupees(val)))} <span style={{ color: '#8B8C9A', fontSize: '12px' }}>/ mo</span>
                      </div>
                   </div>
                );
            })}
          </div>
          
          <div className="fm-footer-purple">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Monthly Savings</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#A5B4FC', display: 'flex', alignItems: 'center' }}>
                   <span style={{ fontSize: '18px', marginRight: '32px', color: totalAlloc === 100 ? '#10B981' : '#F97316' }}>{totalAlloc.toFixed(1)}%</span>
                   ₹{new Intl.NumberFormat('en-IN').format(expectedMonthlySavings)} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginLeft: '4px' }}>/ mo</span>
                </div>
             </div>
          </div>
        </div>
        
        {/* RIGHT CARD - Fund Balances */}
        <div className="fm-card fm-card-green" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div className="fm-header-bar">
             <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </div>
                <div>
                   <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }}>Fund Balances</h2>
                   <div style={{ fontSize: '13px', color: '#8B8C9A' }}>Current accumulated balance in each fund</div>
                </div>
             </div>
             <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleViewTransferHistory} style={{ background: 'transparent', color: '#8B8C9A', border: '1px solid #37394d', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
                   History
                </button>
                <button onClick={() => { setTransferFrom('UNALLOCATED'); setTransferTo('RETIREMENT'); setShowTransferModal(true); }} style={{ background: 'transparent', color: '#F97316', border: '1px solid #F97316', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
                   Transfer
                </button>
             </div>
          </div>
          
          <div className="fm-table-row fm-table-header">
             <div style={{ flex: '1' }}>Fund</div>
             <div style={{ flex: '1', textAlign: 'right' }}>Fund Balance</div>
          </div>

          <div style={{ flex: 1 }}>
            {FUNDS.map(fund => {
                const val = fund.id === 'RETIREMENT' ? retirementPercent : fund.id === 'UNALLOCATED' ? unallocatedPct : (allocations[fund.id] || 0);
                const bal = getFundTotalBalance(fund.id, val);
                return (
                   <div className="fm-table-row" key={fund.id}>
                      <div style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `rgba(${parseInt(fund.color.slice(1,3),16)}, ${parseInt(fund.color.slice(3,5),16)}, ${parseInt(fund.color.slice(5,7),16)}, 0.15)`, color: fund.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {renderIcon(fund.icon)}
                         </div>
                         <div style={{ fontSize: '14px', fontWeight: 500 }}>{fund.name}</div>
                      </div>
                      
                      <div style={{ flex: '1', textAlign: 'right', fontSize: '15px', fontWeight: 600, color: '#34D399' }}>
                         ₹{new Intl.NumberFormat('en-IN').format(Math.round(bal))}
                      </div>
                   </div>
                );
            })}
          </div>
          
          <div className="fm-footer-green">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Total Savings</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#34D399' }}>
                   ₹{new Intl.NumberFormat('en-IN').format(totalSavingsDisplay)}
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
            </div>
            <div className="fm-modal-footer">
              <button className="fm-btn-outline" onClick={() => setShowPreExistingModal(false)}>Cancel</button>
              <button className="fm-btn-primary" style={{ background: '#EAB308', color: '#000' }} onClick={async () => {
                try {
                  await toast.promise(api.put('/user/settings', {
                    manualTotalSavings: preExistingSavings
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
                    <div style={{ fontSize: '11px', color: '#8B8C9A' }}>Initial starting lump sum</div>
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
        <div className="fm-modal-overlay" onClick={() => setShowReconcileModal(false)} style={{ zIndex: 999 }}>
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

      {/* Transfer Funds Modal */}
      {showTransferModal && (
        <div className="fm-modal-overlay" onClick={() => setShowTransferModal(false)} style={{ zIndex: 999 }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="fm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>💸</span>
                <h3>Transfer Funds</h3>
              </div>
              <button className="fm-modal-close" onClick={() => setShowTransferModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="fm-modal-body" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Fund</label>
                <select 
                  value={transferFrom} 
                  onChange={(e) => setTransferFrom(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '15px', padding: '12px', borderRadius: '6px', outline: 'none' }}
                >
                  <option value="" disabled style={{ background: '#1A1C23', color: '#8B8C9A' }}>Select Source Fund</option>
                  {FUNDS.map(f => (
                    <option key={f.id} value={f.id} style={{ background: '#1A1C23', color: '#fff' }}>{f.name.replace(/^\d+\.\s*/, '')} (Avail: ₹{new Intl.NumberFormat('en-IN').format(preExistingAssets[f.id] || 0)})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#232533', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Fund</label>
                <select 
                  value={transferTo} 
                  onChange={(e) => setTransferTo(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '15px', padding: '12px', borderRadius: '6px', outline: 'none' }}
                >
                  <option value="" disabled style={{ background: '#1A1C23', color: '#8B8C9A' }}>Select Destination Fund</option>
                  {FUNDS.map(f => (
                    <option key={f.id} value={f.id} disabled={f.id === transferFrom} style={{ background: '#1A1C23', color: '#fff' }}>{f.name.replace(/^\d+\.\s*/, '')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfer Amount</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', color: '#8B8C9A' }}>₹</span>
                  <input 
                    type="number" 
                    value={transferAmount} 
                    onChange={e => setTransferAmount(e.target.value)} 
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '18px', padding: '12px', borderRadius: '6px' }} 
                    placeholder="Enter amount"
                  />
                </div>
              </div>
            </div>

            <div className="fm-modal-footer">
              <button className="fm-btn-outline" onClick={() => setShowTransferModal(false)} disabled={isTransferring}>Cancel</button>
              <button className="fm-btn-primary" style={{ background: '#10B981' }} onClick={handleTransfer} disabled={isTransferring || !transferFrom || !transferTo || !transferAmount}>
                {isTransferring ? 'Transferring...' : 'Complete Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer History Modal */}
      {showTransferHistoryModal && (
        <div className="fm-modal-overlay" onClick={() => setShowTransferHistoryModal(false)} style={{ zIndex: 999 }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="fm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📜</span>
                <h3>Transfer History</h3>
              </div>
              <button className="fm-modal-close" onClick={() => setShowTransferHistoryModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="fm-modal-body" style={{ padding: '0', maxHeight: '400px', overflowY: 'auto' }}>
              {isFetchingHistory ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#8B8C9A' }}>Loading history...</div>
              ) : transferHistory.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#8B8C9A' }}>No transfers found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ background: '#232533', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#8B8C9A', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#8B8C9A', fontWeight: 600 }}>Route</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: '#8B8C9A', fontWeight: 600 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferHistory.map((t, idx) => {
                      const src = FUNDS.find(f => f.id === t.sourceFund)?.name.replace(/^\d+\.\s*/, '') || t.sourceFund;
                      const dst = FUNDS.find(f => f.id === t.destinationFund)?.name.replace(/^\d+\.\s*/, '') || t.destinationFund;
                      const dateObj = new Date(t.date);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px 16px', color: '#fff' }}>
                            {dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            <div style={{ fontSize: '11px', color: '#8B8C9A' }}>{dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit' })}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#EF4444', fontWeight: 500 }}>{src}</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8C9A" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                              <span style={{ color: '#10B981', fontWeight: 500 }}>{dst}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#F97316', fontWeight: 600 }}>
                            ₹{new Intl.NumberFormat('en-IN').format(t.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Animation Overlay */}
      {showTransferSuccess && (
        <div className="fm-success-overlay">
          <div className="fm-success-card">
             <div className="fm-success-icon-wrap">
               <svg className="fm-success-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <h2 style={{ color: '#fff', fontSize: '24px', margin: '16px 0 8px 0' }}>Transfer Complete!</h2>
             <p style={{ color: '#8B8C9A', margin: 0 }}>Your funds have been securely moved.</p>
          </div>
        </div>
      )}

      {/* First-Time Onboarding Monthly Allocation Modal */}
      {showFirstTimeAllocationModal && (
        <div className="fm-modal-overlay" style={{ zIndex: 99999 }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%', padding: '28px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', marginBottom: '12px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>Welcome! Allocate Your Monthly Savings</h2>
              <p style={{ color: '#8B8C9A', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                Distribute your monthly savings across your 4 core funds. Your pre-existing lump sum savings are safely stored in your <strong style={{ color: '#9CA3AF' }}>Unallocated Fund</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {[
                { id: 'LONG_TERM', name: '1. Long-Term Goal Corpus', color: '#10B981', desc: 'Big purchases like house or car' },
                { id: 'SHORT_TERM', name: '2. Short-Term Goal Corpus', color: '#3B82F6', desc: 'Vacations, near-term expenses' },
                { id: 'EMERGENCY', name: '3. Emergency & Protection Corpus', color: '#F97316', desc: 'Safety net for unexpected situations' },
                { id: 'WEALTH', name: '4. Wealth Creation Corpus', color: '#EAB308', desc: 'Aggressive growth & investments' },
              ].map(f => {
                const val = onboardingAllocations[f.id] || 0;
                const monthlyRs = expectedMonthlySavings * (val / 100);
                return (
                  <div key={f.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #232533', borderRadius: '10px', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: f.color }} />
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{f.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input 
                          type="number" 
                          min="0" max="100" 
                          value={val}
                          onChange={(e) => {
                            let n = parseFloat(e.target.value) || 0;
                            if (n < 0) n = 0;
                            if (n > 100) n = 100;
                            setOnboardingAllocations(prev => ({ ...prev, [f.id]: n }));
                          }}
                          style={{ width: '60px', background: '#12141D', border: '1px solid #37394D', color: f.color, fontWeight: 700, textAlign: 'center', padding: '4px 6px', borderRadius: '6px', fontSize: '14px' }}
                        />
                        <span style={{ color: '#8B8C9A', fontSize: '13px' }}>%</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" min="0" max="100" step="1" 
                        value={val}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value) || 0;
                          setOnboardingAllocations(prev => ({ ...prev, [f.id]: n }));
                        }}
                        style={{ 
                          flex: 1, 
                          height: '6px',
                          borderRadius: '3px',
                          background: `linear-gradient(to right, ${f.color} ${val}%, #232533 ${val}%)`,
                          '--thumb-color': f.color,
                          cursor: 'pointer' 
                        }}
                      />
                      <span style={{ color: '#8B8C9A', fontSize: '12px', minWidth: '85px', textAlign: 'right' }}>
                        ₹{new Intl.NumberFormat('en-IN').format(Math.round(monthlyRs))}/mo
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Allocation Total Indicator */}
            {(() => {
              const total = Object.values(onboardingAllocations).reduce((a,b) => a+b, 0);
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: total === 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(249, 115, 22, 0.1)', border: `1px solid ${total === 100 ? '#10B981' : '#F97316'}`, borderRadius: '8px', marginBottom: '20px' }}>
                  <span style={{ color: total === 100 ? '#10B981' : '#F97316', fontWeight: 600, fontSize: '14px' }}>
                    {total === 100 ? '✓ 100% Fully Allocated' : `Total: ${total.toFixed(1)}% (${total < 100 ? `${(100-total).toFixed(1)}% remaining` : `${(total-100).toFixed(1)}% over`})`}
                  </span>
                  <span style={{ color: '#8B8C9A', fontSize: '12px' }}>
                    Monthly Savings: ₹{new Intl.NumberFormat('en-IN').format(expectedMonthlySavings)}
                  </span>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="fm-btn-outline" 
                onClick={() => {
                  setShowFirstTimeAllocationModal(false);
                  toast.success('Pre-existing savings moved to Unallocated Fund.', { icon: '💰' });
                }}
              >
                Skip for Now
              </button>
              <button 
                className="fm-btn-primary" 
                style={{ background: '#4F46E5', color: '#fff', padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
                onClick={async () => {
                  setAllocations(onboardingAllocations);
                  try {
                    await toast.promise(api.put('/user/settings', {
                      manualTotalSavings: preExistingSavings,
                      fundAllocationsJson: JSON.stringify({ core: onboardingAllocations, retirement: 0 })
                    }), {
                      loading: 'Saving monthly allocation...',
                      success: 'Monthly allocation saved successfully!',
                      error: 'Failed to save allocation.'
                    });
                  } catch(e){}
                  setShowFirstTimeAllocationModal(false);
                }}
              >
                Save Monthly Allocation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
