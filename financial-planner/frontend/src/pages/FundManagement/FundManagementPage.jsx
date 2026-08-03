import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './FundManagementPage.css';
import toast from 'react-hot-toast';

const PROFILES = [
  { id: 'CONSERVATIVE', label: 'Conservative', icon: 'shield', allocations: { 'LONG_TERM': 20, 'SHORT_TERM': 10, 'EMERGENCY': 15, 'WEALTH': 5 }, description: 'Lower risk, steady returns\nMore stable allocations' },
  { id: 'MODERATE', label: 'Moderate', icon: 'scales', allocations: { 'LONG_TERM': 25, 'SHORT_TERM': 15, 'EMERGENCY': 15, 'WEALTH': 5 }, description: 'Balanced growth and stability\nOptimal mix for most investors' },
  { id: 'AGGRESSIVE', label: 'Aggressive', icon: 'rocket', allocations: { 'LONG_TERM': 20, 'SHORT_TERM': 10, 'EMERGENCY': 10, 'WEALTH': 30 }, description: 'Higher growth potential\nHigher risk, higher returns' },
  { id: 'CUSTOM', label: 'Custom', icon: 'sliders', allocations: {}, description: 'Create your own allocation\nFull control over your funds' }
];

const FUNDS = [
  { id: 'RETIREMENT', name: '1. Retirement Corpus', color: '#818CF8', icon: 'cart', description: 'For your golden years and post-work life' },
  { id: 'LONG_TERM', name: '2. Long-Term Goal Corpus', color: '#10B981', icon: 'target', description: 'For big purchases like a house or car' },
  { id: 'SHORT_TERM', name: '3. Short-Term Goal Corpus', color: '#3B82F6', icon: 'calendar', description: 'For vacations and near-term expenses' },
  { id: 'EMERGENCY', name: '4. Emergency & Protection Corpus', color: '#F97316', icon: 'shield', description: 'Safety net for unexpected situations' },
  { id: 'WEALTH', name: '5. Wealth Creation Corpus', color: '#EAB308', icon: 'chart', description: 'Aggressive growth and investments' }
];

export default function FundManagementPage() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState(0);
  const [savingsGrowth, setSavingsGrowth] = useState(0);
  const [editingSavings, setEditingSavings] = useState(false);
  const [editedSavingsValue, setEditedSavingsValue] = useState('');
  
  const [preExistingAssets, setPreExistingAssets] = useState({});
  const [retirementPercent, setRetirementPercent] = useState(0);
  
  const [selectedProfile, setSelectedProfile] = useState('AGGRESSIVE');
  const [allocations, setAllocations] = useState(PROFILES.find(p => p.id === 'AGGRESSIVE').allocations);

  const isInitialMount = useRef(true);
  const isFetching = useRef(true);
  const saveTimeoutRef = useRef(null);
  
  useEffect(() => {
    fetchData();
  }, []);

  const [isEditing, setIsEditing] = useState(false);

  const fetchData = async () => {
    try {
      isFetching.current = true;
      setLoading(true);
      const [incomeRes, txnRes, assetsRes, userRes] = await Promise.all([
        api.get('/income').catch(() => ({ data: [] })),
        api.get('/transactions').catch(() => ({ data: [] })),
        api.get('/assets').catch(() => ({ data: [] })),
        api.get('/user/settings').catch(() => ({ data: {} }))
      ]);

      const income = incomeRes.data;
      const transactions = txnRes.data;
      const settings = userRes.data;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const sumByDate = (txns, month, year, typeFilter) => txns
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === month && d.getFullYear() === year && (typeFilter ? t.type === typeFilter : true);
        })
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const currentMonthIncome = income.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) + sumByDate(transactions, currentMonth, currentYear, 'CREDIT');
      const currentMonthExpenses = sumByDate(transactions, currentMonth, currentYear, 'EXPENSE');
      
      const prevMonthIncome = income.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) + sumByDate(transactions, prevMonth, prevYear, 'CREDIT');
      const prevMonthExpenses = sumByDate(transactions, prevMonth, prevYear, 'EXPENSE');

      const currentSavings = Math.max(0, currentMonthIncome - currentMonthExpenses);
      const prevSavings = Math.max(0, prevMonthIncome - prevMonthExpenses);
      
      if (settings.manualTotalSavings !== undefined && settings.manualTotalSavings > 0) {
        setTotalSavings(settings.manualTotalSavings);
      } else {
        setTotalSavings(currentSavings);
      }
      
      let growth = 0;
      if (prevSavings > 0) {
        growth = ((currentSavings - prevSavings) / prevSavings) * 100;
      } else if (currentSavings > 0) {
        growth = 100;
      }
      setSavingsGrowth(growth);

      const assets = { RETIREMENT: 0, LONG_TERM: 0, SHORT_TERM: 0, EMERGENCY: 0, WEALTH: 0 };
      assetsRes.data.forEach(a => {
        if (a.fundAllocations && Array.isArray(a.fundAllocations)) {
          a.fundAllocations.forEach(alloc => {
             assets[alloc.fundType] = (assets[alloc.fundType] || 0) + (parseFloat(a.currentValue || 0) * (alloc.percentage / 100));
          });
        }
      });
      setPreExistingAssets(assets);

      let savedAllocations = settings.fundAllocationsJson ? JSON.parse(settings.fundAllocationsJson) : null;
      if (savedAllocations) {
        setAllocations(savedAllocations.core || PROFILES.find(p => p.id === 'AGGRESSIVE').allocations);
        setRetirementPercent(savedAllocations.retirement !== undefined ? savedAllocations.retirement : 40);
      } else {
        setAllocations(PROFILES.find(p => p.id === 'AGGRESSIVE').allocations);
        setRetirementPercent(40);
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
        manualTotalSavings: totalSavings,
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

  const handleProfileChange = (profileId) => {
    setSelectedProfile(profileId);
    if (profileId !== 'CUSTOM') {
      setAllocations(PROFILES.find(p => p.id === profileId).allocations);
    }
  };

  const handleAllocationChange = (fundId, value) => {
    setSelectedProfile('CUSTOM');
    if (fundId === 'RETIREMENT') {
      setRetirementPercent(parseFloat(value) || 0);
    } else {
      setAllocations(prev => ({ ...prev, [fundId]: parseFloat(value) || 0 }));
    }
  };

  const handleAmountChange = (fundId, amountStr) => {
    setSelectedProfile('CUSTOM');
    const amount = parseFloat(amountStr) || 0;
    const pct = (amount / totalSavings) * 100;
    if (fundId === 'RETIREMENT') {
      setRetirementPercent(pct);
    } else {
      setAllocations(prev => ({ ...prev, [fundId]: pct }));
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#8B8C9A' }}>Loading Fund Management...</div>;

  const totalOtherAlloc = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const totalAlloc = totalOtherAlloc + retirementPercent;

  const calculateRupees = (pct) => (totalSavings * (pct / 100));

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
      
      {/* Action Bar (Top Full Width, Always Visible) */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '-16px' }}>
         {!isEditing ? (
           <button className="fm-btn-primary" style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }} onClick={() => setIsEditing(true)}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
             Edit
           </button>
         ) : (
           <button className="fm-btn-primary" onClick={handleSaveChanges} style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: '#818CF8', borderRadius: '8px' }}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             Save
           </button>
         )}
      </div>

      {/* Profile Grid (Top Full Width) */}
      {isEditing && (
        <div className="fm-card" style={{ width: '100%', marginBottom: 0 }}>
          <div className="fm-profile-header">
             <div>
               <h2 className="fm-title" style={{fontSize:'18px'}}>Select Investment Profile</h2>
               <p className="fm-subtitle">Choose a profile that matches your risk appetite.</p>
             </div>
             <div className="fm-profile-badge">
               <span style={{color: '#8B8C9A', fontWeight: 400}}>Current Profile</span> &nbsp;&nbsp;&nbsp; {PROFILES.find(p=>p.id===selectedProfile)?.label || 'Custom'}
             </div>
          </div>
          
          <div className="fm-profile-grid">
            {PROFILES.map(p => (
              <div 
                key={p.id}
                onClick={() => handleProfileChange(p.id)}
                className={`fm-profile-card ${selectedProfile === p.id ? 'active' : ''}`}
              >
                {p.id === 'MODERATE' && <div className="fm-rec-badge">Recommended</div>}
                {selectedProfile === p.id && (
                  <div className="fm-check-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
                <div className="fm-profile-icon">{renderIcon(p.icon)}</div>
                <div className="fm-profile-title">{p.label}</div>
                <div className="fm-profile-desc">
                  {p.description.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEFT COLUMN: Total Savings & Summary */}
      <div style={{ flex: '1 1 300px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="fm-card" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
           <div>
             <div className="fm-total-savings" style={{ marginBottom: '8px' }}>Total Savings to Distribute</div>
             <div className="fm-savings-amount" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               {editingSavings ? (
                 <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                   <span style={{ fontSize: '24px', color: '#8B8C9A' }}>₹</span>
                   <input 
                     type="number" 
                     value={editedSavingsValue}
                     onChange={(e) => setEditedSavingsValue(e.target.value)}
                     autoFocus
                     style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #818CF8', color: '#fff', fontSize: '32px', fontWeight: 800, width: '150px', outline: 'none' }}
                   />
                   <button className="fm-btn-primary" style={{ padding: '8px 16px', fontSize: '13px', marginLeft: '8px' }} onClick={() => {
                     if(editedSavingsValue) setTotalSavings(parseFloat(editedSavingsValue));
                     setEditingSavings(false);
                   }}>Save</button>
                 </div>
               ) : (
                 <>
                   <span style={{ fontSize: '36px' }}>₹{new Intl.NumberFormat('en-IN').format(totalSavings)}</span>
                   <span style={{ fontSize: '16px', color: '#8B8C9A', marginLeft: '8px', fontWeight: 500 }}>({formatNumberToWords(totalSavings)})</span>
                   {isEditing && (
                      <button onClick={() => { setEditedSavingsValue(totalSavings.toString()); setEditingSavings(true); }} style={{ background: 'none', border: 'none', color: '#8B8C9A', cursor: 'pointer', padding: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                   )}
                 </>
               )}
             </div>
             <div style={{ fontSize: '13px', color: '#8B8C9A', marginTop: '8px' }}>This amount will be distributed across your funds.</div>
           </div>
           
           <div className="fm-legend-list">
             {FUNDS.map(fund => {
               const val = fund.id === 'RETIREMENT' ? retirementPercent : (allocations[fund.id] || 0);
               return (
                 <div key={fund.id} className="fm-legend-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #232533' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div className="fm-legend-color" style={{ background: fund.color }}></div>
                     <div className="fm-legend-label" style={{ minWidth: 'auto', color: '#8B8C9A' }}>{fund.name.substring(3)}</div>
                   </div>
                   <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                     <div className="fm-legend-value" style={{ width: '50px', textAlign: 'right' }}>{val.toFixed(1)}%</div>
                     <div style={{ color: '#8B8C9A', width: '70px', textAlign: 'right' }}>₹{new Intl.NumberFormat('en-IN').format(calculateRupees(val))}</div>
                   </div>
                 </div>
               );
             })}
           </div>

           <div style={{ background: '#1A1D2D', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#8B8C9A', fontSize: '14px' }}>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
               {totalAlloc === 100 ? "All savings managed in funds" : 
                totalAlloc < 100 ? `₹${new Intl.NumberFormat('en-IN').format(calculateRupees(100 - totalAlloc))} (${formatNumberToWords(calculateRupees(100 - totalAlloc))}) unallocated` : 
                "Overallocation"}
             </div>
             <strong style={{ color: totalAlloc === 100 ? '#10B981' : totalAlloc > 100 ? '#EF4444' : '#F59E0B', fontSize: '18px' }}>
               {totalAlloc.toFixed(1)}%
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '12px', color: '#8B8C9A' }}>
                    {totalAlloc === 100 ? "All savings managed in funds" : 
                     totalAlloc < 100 ? `₹${new Intl.NumberFormat('en-IN').format(calculateRupees(100 - totalAlloc))} (${formatNumberToWords(calculateRupees(100 - totalAlloc))}) left` : 
                     "Overallocation"}
                  </span>
                  <strong style={{ color: totalAlloc === 100 ? '#10B981' : totalAlloc > 100 ? '#EF4444' : '#F59E0B', fontSize: '18px' }}>
                    {totalAlloc.toFixed(1)}%
                  </strong>
                </div>
              </div>
           </div>
           
           <div style={{ marginTop: '32px' }}>
             <div className="fm-fund-row" style={{ alignItems: 'flex-end', borderBottom: '1px solid #232533', paddingBottom: '12px', paddingTop: 0 }}>
                <div style={{ width: '48px', paddingRight: '16px' }}></div>
                <div style={{ flex: '0 0 180px', paddingRight: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>Fund Details</div>
                </div>
                <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#8B8C9A', textAlign: 'center', lineHeight: 1.3 }}>Set Monthly<br/>Percentage</div>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', margin: '0 24px' }}>
                  <div style={{ fontSize: '10px', color: '#8B8C9A', textAlign: 'center', lineHeight: 1.3 }}>Set Monthly<br/>Amount</div>
                </div>
                <div style={{ minWidth: '100px', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '10px', color: '#8B8C9A', textAlign: 'right', lineHeight: 1.3 }}>Total Amount<br/>in Fund</div>
                </div>
             </div>

             {FUNDS.map(fund => {
               const val = fund.id === 'RETIREMENT' ? retirementPercent : (allocations[fund.id] || 0);
               const isRetirement = fund.id === 'RETIREMENT';
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
                   
                   {isRetirement && !hasPlannedRetirement ? (
                     <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                       <button className="fm-btn-outline" onClick={() => navigate('/retirement-planner')} style={{ padding: '8px 24px', borderColor: '#818CF8', color: '#818CF8' }}>
                         Plan Retirement First
                       </button>
                     </div>
                   ) : (
                     <>
                       <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                         <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{val.toFixed(1)}%</div>
                       </div>
                       
                       <div className="fm-slider-container" style={{ margin: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                         <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                           <span style={{ color: '#8B8C9A', fontSize: '14px', marginRight: '4px' }}>₹</span>
                           {isEditing ? (
                             <input 
                               type="number"
                               value={Math.round(calculateRupees(val))}
                               onChange={(e) => handleAmountChange(fund.id, e.target.value)}
                               style={{
                                 background: 'transparent',
                                 border: 'none',
                                 borderBottom: `2px solid ${fund.color}`,
                                 color: '#fff',
                                 fontSize: '15px',
                                 fontWeight: 600,
                                 width: '80px',
                                 textAlign: 'center',
                                 outline: 'none',
                                 padding: '2px 0'
                               }}
                             />
                           ) : (
                             <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                               {new Intl.NumberFormat('en-IN').format(Math.round(calculateRupees(val)))}
                             </span>
                           )}
                           <span style={{ color: '#8B8C9A', fontSize: '12px', marginLeft: '6px' }}>/ mo</span>
                         </div>
                         <input 
                           type="range" 
                           min="0" max="100" step="0.1" 
                           value={val}
                           onChange={(e) => handleAllocationChange(fund.id, e.target.value)}
                           disabled={!isEditing}
                           style={{ 
                             background: `linear-gradient(to right, ${fund.color} ${val}%, #232533 ${val}%)`,
                             '--thumb-color': fund.color,
                             opacity: isEditing ? 1 : 0.6,
                             cursor: isEditing ? 'pointer' : 'not-allowed'
                           }}
                         />
                       </div>
                       
                       <div className="fm-fund-amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '100px' }}>
                         <span style={{ color: fund.color, fontWeight: 700, fontSize: '15px' }}>
                           ₹{new Intl.NumberFormat('en-IN').format((preExistingAssets[fund.id] || 0) + calculateRupees(val))}
                         </span>
                         <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Value</span>
                       </div>
                     </>
                   )}
                 </div>
               );
             })}
           </div>
         </div>

      </div>

    </div>
  );
}
