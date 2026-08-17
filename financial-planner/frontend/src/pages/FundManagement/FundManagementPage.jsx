import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './FundManagementPage.css';
import toast from 'react-hot-toast';
import useFinancialData from '../../hooks/useFinancialData';
import CountdownTimer from '../../components/CountdownTimer';
import CustomDropdown from '../../components/UI/CustomDropdown';

export default function FundManagementPage() {
  const navigate = useNavigate();
  
  const {
    loading,
    expectedMonthlySavings,
    allocations,
    metadata,
    funds,
    preExistingSavings,
    preExistingSavingsDate,
    liveTotalSavings,
    unallocatedPct,
    totalAlloc,
    monthlyIncome,
    monthlyExpense,
    savingsGrowth,
    lastDiscrepancySource,
    refetch: fetchData
  } = useFinancialData();

  const [isEditing, setIsEditing] = useState(false);
  const [showPreExistingModal, setShowPreExistingModal] = useState(false);
  const [editPreExistingSavings, setEditPreExistingSavings] = useState(0);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);

  // Reconciliation
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileAmount, setReconcileAmount] = useState(0);
  const [selectedReconcileFund, setSelectedReconcileFund] = useState('UNALLOCATED');
  const [isReconciling, setIsReconciling] = useState(false);

  const [deletingFundId, setDeletingFundId] = useState(null);

  const handleOpenEditModal = (fund) => {
    navigate(`/goal-management?editId=${fund.id}`);
  };

  const fetchSavingsBreakdown = async () => {
    try {
      const res = await api.get('/user/savings-breakdown');
      setBreakdownData(res.data);
      setShowBreakdownModal(true);
    } catch (err) {
      toast.error('Failed to load savings breakdown.');
    }
  };

  const handleSaveChanges = async () => {
    try {
      const payload = {
        manualTotalSavings: preExistingSavings,
        preExistingSavingsDate: preExistingSavingsDate,
        fundAllocationsJson: JSON.stringify({
          ...allocations,
          _metadata: metadata
        })
      };
      await toast.promise(api.put('/user/settings', payload), {
        loading: 'Saving allocations...',
        success: 'Settings saved!',
        error: 'Failed to save settings.'
      });
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };



  // Safe custom fund deletion
  const handleDeleteFund = async (fund) => {
    try {
      // 1. If there's an accumulated balance, transfer it to UNALLOCATED
      if (fund.storedAssetBalance > 0) {
        await api.post('/assets/transfer', {
          sourceFund: fund.id,
          destinationFund: 'UNALLOCATED',
          amount: fund.storedAssetBalance
        });
      }

      // 2. Delete Asset record
      if (fund.assetId) {
        await api.delete(`/assets/${fund.assetId}`);
      }

      // 3. Remove fund allocation and metadata from settings
      const updatedAllocations = { ...allocations };
      delete updatedAllocations[fund.id];

      const updatedMetadata = { ...metadata };
      delete updatedMetadata[fund.id];

      await api.put('/user/settings', {
        manualTotalSavings: preExistingSavings,
        preExistingSavingsDate: preExistingSavingsDate,
        fundAllocationsJson: JSON.stringify({
          ...updatedAllocations,
          _metadata: updatedMetadata
        })
      });

      toast.success(`"${fund.name}" deleted. Accumulated funds moved to Unallocated.`);
      setDeletingFundId(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete fund.');
      setDeletingFundId(null);
    }
  };

  const handleLiquidateGoal = async (fund) => {
    try {
      toast.loading(`Recording purchase for ${fund.name}...`, { id: 'liquidate' });
      
      // 1. Create EXPENSE transaction
      if (fund.storedAssetBalance > 0) {
        await api.post('/transactions', {
          date: new Date().toISOString().split('T')[0],
          type: 'EXPENSE',
          category: `Goal: ${fund.name}`,
          amount: fund.storedAssetBalance,
          description: `Purchased ${fund.name}`
        });
      }

      // 2. Delete Asset record directly
      if (fund.assetId) {
        await api.delete(`/assets/${fund.assetId}`);
      }

      // 3. Clean up settings
      const updatedAllocations = { ...allocations };
      delete updatedAllocations[fund.id];

      const updatedMetadata = { ...metadata };
      delete updatedMetadata[fund.id];
      
      let newTimelineJson = null;
      try {
        const settingsRes = await api.get('/user/settings');
        if (settingsRes.data && settingsRes.data.fundAllocationsJson) {
           const parsed = JSON.parse(settingsRes.data.fundAllocationsJson);
           if (parsed._timeline) {
               Object.keys(parsed._timeline).forEach(m => {
                   if (parsed._timeline[m][fund.id] !== undefined) {
                       delete parsed._timeline[m][fund.id];
                   }
               });
           }
           parsed._metadata = updatedMetadata;
           Object.keys(updatedAllocations).forEach(k => { parsed[k] = updatedAllocations[k]; });
           delete parsed[fund.id];
           
           newTimelineJson = JSON.stringify(parsed);
        }
      } catch(e) {}

      await api.put('/user/settings', {
        manualTotalSavings: preExistingSavings,
        preExistingSavingsDate: preExistingSavingsDate,
        fundAllocationsJson: newTimelineJson || JSON.stringify({
          ...updatedAllocations,
          _metadata: updatedMetadata
        })
      });

      toast.success(`"${fund.name}" purchased successfully!`, { id: 'liquidate' });
      fetchData();
    } catch (err) {
      toast.error('Failed to record purchase.', { id: 'liquidate' });
    }
  };

  const handleReconcile = async () => {
    try {
      setIsReconciling(true);
      await api.post('/assets/reconcile-discrepancy', {
        fundType: 'UNALLOCATED',
        adjustmentAmount: reconcileAmount
      });
      toast.success('Discrepancy routed to Unallocated Savings!');
      setShowReconcileModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to adjust fund balance.');
    } finally {
      setIsReconciling(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#8B8C9A' }}>Loading Fund Management...</div>;



  const calculateRupees = (pct) => (expectedMonthlySavings * (pct / 100));
  const totalSavingsDisplay = liveTotalSavings > 0 ? liveTotalSavings : preExistingSavings;

  const totalStoredAssets = funds.reduce((sum, f) => sum + (f.storedAssetBalance || 0), 0);
  const totalHistoricalSavings = liveTotalSavings - expectedMonthlySavings;
  const discrepancy = Math.round(totalHistoricalSavings - totalStoredAssets);

  // Helper: compute months left for a fund goal
  const getMonthsLeft = (meta) => {
    if (!meta || !meta.targetDate) return null;
    const target = new Date(meta.targetDate);
    const now = new Date();
    const diff = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    return Math.max(0, diff);
  };

  // Min date for target date picker = 1 month from today
  const minTargetDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  })();


  return (
    <div className="fund-management-container animate-fade-in">
      
      {Math.abs(discrepancy) > 0 && !loading && (
        <div style={{ width: '100%', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '12px', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             <span style={{ color: '#F97316', fontSize: '15px', fontWeight: 500 }}>
                Discrepancy Detected: Your Total Savings {discrepancy > 0 ? 'increased' : 'decreased'} by ₹{new Intl.NumberFormat('en-IN').format(Math.abs(discrepancy))}. {lastDiscrepancySource ? `(Reason: ${lastDiscrepancySource})` : 'due to past updates.'}
             </span>
          </div>
          <button onClick={() => { setReconcileAmount(discrepancy); setShowReconcileModal(true); }} style={{ background: '#F97316', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
             Resolve Discrepancy
          </button>
        </div>
      )}

      {/* PRE-EXISTING SAVINGS CARD MOVED TO FOOTER */}

      {/* MAIN CONSOLIDATED CARD */}
      <div style={{ width: '100%' }}>
        <div className="fm-card fm-card-purple" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div className="fm-header-bar">
             <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                   <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }}>Portfolio Overview</h2>
                   <div style={{ fontSize: '13px', color: '#8B8C9A' }}>Monthly allocation and accumulated balances</div>
                </div>
             </div>
             <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                      className="fm-btn-primary" 
                      onClick={() => navigate('/goal-management')}
                      style={{ background: 'linear-gradient(to right, #4F46E5, #818CF8)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      Create Fund
                    </button>
                <button onClick={fetchSavingsBreakdown} style={{ background: 'transparent', color: '#8B8C9A', border: '1px solid #37394d', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                   Breakdown
                </button>
                <button 
                  onClick={() => { navigate('/dashboard/fund-transfer'); }} 
                  style={{ background: 'transparent', color: '#F97316', border: '1px solid #F97316', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                  disabled={funds.length <= 1}
                >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
                   Move Funds
                </button>
             </div>
          </div>
          
          <div className="fm-table-row fm-table-header">
             <div style={{ flex: '1.5' }}>Fund Goal</div>
             <div style={{ flex: '1.5', textAlign: 'center' }}>Time Remaining</div>
             <div style={{ flex: '1.5', textAlign: 'right' }}>Monthly Allocation</div>
             <div style={{ flex: '1.5', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
               <span>Accumulated Balance</span>
             </div>
             <div style={{ flex: '1.5', textAlign: 'right' }}></div>
          </div>

          <div style={{ flex: 1, minHeight: '300px', overflowY: 'auto' }}>
            {funds.length === 0 ? (
              <div style={{ padding: '40px 0', textContent: 'center', color: '#8B8C9A', textAlign: 'center' }}>
                No custom funds. Create one above to distribute your savings!
              </div>
            ) : (
              funds.map(fund => {
                const meta = metadata[fund.id] || {};
                let isFrozen = false;
                if (fund.id !== 'UNALLOCATED' && meta.targetDate) {
                  const targetTime = new Date(meta.targetDate + 'T00:00:00').getTime();
                  if (new Date().getTime() >= targetTime) {
                    isFrozen = true;
                  }
                }

                const val = fund.id === 'UNALLOCATED' ? unallocatedPct : (allocations[fund.id] || 0);
                const monthlyRs = isFrozen ? 0 : calculateRupees(val);
                const bal = fund.storedAssetBalance; // Current month contribution will only be added at month end
                const isAchieved = meta.targetAmount > 0 && bal >= meta.targetAmount;
                const monthsLeft = getMonthsLeft(meta);
                const targetDateFormatted = meta.targetDate 
                  ? new Date(meta.targetDate + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                  : '';
                
                return (
                   <div className="fm-table-row" key={fund.id} style={{ 
                       padding: '16px 0', 
                       display: 'flex', 
                       alignItems: 'center', 
                       opacity: isFrozen && !isAchieved ? 0.7 : 1,
                       ...(isAchieved ? {
                           background: 'rgba(16, 185, 129, 0.05)',
                           borderLeft: '3px solid #10B981',
                           paddingLeft: '12px'
                       } : {})
                   }}>
                      <div style={{ flex: '1.5', display: 'flex', flexDirection: 'column' }}>
                         <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{fund.name}</span>
                         {fund.id === 'UNALLOCATED' && (
                           <div style={{ fontSize: '11.5px', color: '#8B8C9A', marginTop: '4px' }}>Money that has not been allocated to any goal</div>
                         )}
                         {fund.id !== 'UNALLOCATED' && (
                           <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                             {meta.targetAmount ? (
                               <span style={{ fontSize: '12px', color: '#8B8C9A' }}>Target: ₹{new Intl.NumberFormat('en-IN').format(meta.targetAmount)}</span>
                             ) : (
                               <span style={{ fontSize: '12px', color: '#8B8C9A' }}>No Target Set</span>
                             )}
                           </div>
                         )}
                      </div>

                      <div style={{ flex: '1.5', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         {fund.id !== 'UNALLOCATED' ? (
                           isAchieved ? (
                             <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10B981', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)' }}>
                               Goal Achieved
                             </div>
                           ) : meta.targetDate ? (
                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                               <CountdownTimer targetDateStr={meta.targetDate} />
                               <span style={{ fontSize: '11px', color: '#8B8C9A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>({new Date(meta.targetDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })})</span>
                             </div>
                           ) : (
                             <span style={{ color: '#8B8C9A', fontSize: '13px' }}>-</span>
                           )
                         ) : (
                           <span style={{ color: '#8B8C9A', fontSize: '13px' }}>-</span>
                         )}
                      </div>
                      
                      <div style={{ flex: '1.5', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         {isAchieved ? (
                             <>
                               <span style={{ fontSize: '15px', fontWeight: 500, color: '#10B981' }}>₹0 / mo</span>
                               <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 600 }}>100% Funded</span>
                             </>
                         ) : isFrozen ? (
                           <span style={{ fontSize: '13px', fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>❄️ Frozen</span>
                         ) : (
                           <>
                             <span style={{ fontSize: '15px', fontWeight: 500, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(monthlyRs))} / mo</span>
                             <span style={{ color: '#818CF8', fontSize: '12px', fontWeight: 600 }}>{val.toFixed(1)}% of savings</span>
                           </>
                         )}
                      </div>

                      <div style={{ flex: '1.5', textAlign: 'right', fontSize: '16px', fontWeight: 600, color: '#34D399' }}>
                         ₹{new Intl.NumberFormat('en-IN').format(Math.round(bal))}
                      </div>

                      <div style={{ flex: '1.5', display: 'flex', justifyContent: 'flex-end', gap: '12px', opacity: fund.id === 'UNALLOCATED' ? 0 : 1 }}>
                        {fund.id !== 'UNALLOCATED' && (
                          isAchieved ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => {
                                if (window.confirm(`Did you purchase this goal? This will deduct ₹${fund.storedAssetBalance} from your Total Savings and delete this goal.`)) {
                                  handleLiquidateGoal(fund);
                                }
                              }} style={{ background: '#10B981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Record Purchase
                              </button>
                              <button onClick={() => {
                                if (window.confirm(`Release ₹${fund.storedAssetBalance} back into Unallocated Savings? This goal will be deleted.`)) {
                                  handleDeleteFund(fund);
                                }
                              }} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Release Funds
                              </button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => handleOpenEditModal(fund)} title="Edit" style={{ background: 'none', border: 'none', color: '#818CF8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              {deletingFundId === fund.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                  <button onClick={() => handleDeleteFund(fund)} title="Confirm Delete" style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  </button>
                                  <button onClick={() => setDeletingFundId(null)} title="Cancel" style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setDeletingFundId(fund.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                              )}
                            </>
                          )
                        )}
                      </div>
                   </div>
                );
              })
            )}
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', margin: '16px 0', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div style={{ fontSize: '13px', color: '#BFDBFE', lineHeight: '1.5' }}>
              <strong>Notice:</strong> The <strong>Monthly Allocation</strong> amounts shown above are actively being saved this month and will automatically be added to your <strong>Accumulated Balances</strong> at the end of the month.
            </div>
          </div>
          
          <div className="fm-footer-purple" style={{ padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
             <div className="fm-table-row" style={{ padding: '0', background: 'transparent', alignItems: 'center' }}>
                <div style={{ flex: '1.5', display: 'flex', paddingLeft: '16px' }}>
                  <div 
                    onClick={() => {
                      setEditPreExistingSavings(preExistingSavings);
                      setShowPreExistingModal(true);
                    }}
                    style={{ 
                      display: 'inline-flex',
                      background: 'rgba(17, 19, 32, 0.85)', 
                      border: '1px solid rgba(52, 211, 153, 0.3)', 
                      padding: '10px 16px', 
                      borderRadius: '10px', 
                      alignItems: 'center', 
                      gap: '16px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div>
                      <div style={{ color: '#8B8C9A', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Pre-Existing Savings</div>
                      <div style={{ color: '#34D399', fontSize: '16px', fontWeight: 700 }}>₹{new Intl.NumberFormat('en-IN').format(preExistingSavings)}</div>
                    </div>
                    <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </div>
                  </div>
                </div>
                <div style={{ flex: '1.5' }}></div>
                
                <div style={{ flex: '1.5', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                   <span style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(expectedMonthlySavings)} / mo</span>
                   <span style={{ fontSize: '13px', fontWeight: 600, color: totalAlloc === 100 ? '#10B981' : '#F97316' }}>
                     {totalAlloc.toFixed(1)}% Allocated
                   </span>
                </div>
                
                <div style={{ flex: '1.5', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                   <span style={{ fontSize: '16px', fontWeight: 600, color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(totalStoredAssets)}</span>
                   <span style={{ fontSize: '12px', color: '#8B8C9A' }}>Your Total Savings</span>
                </div>
                
                <div style={{ flex: '1.5' }}></div>
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
                  value={editPreExistingSavings} 
                  onChange={e => setEditPreExistingSavings(parseFloat(e.target.value)||0)} 
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
                    manualTotalSavings: editPreExistingSavings
                  }), { loading: 'Saving...', success: 'Saved successfully!', error: 'Failed to save.' });
                  setShowPreExistingModal(false);
                  fetchData();
                } catch (err) {}
              }}>Save</button>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18"/><path d="M3 7h18"/><path d="M5 7l-2 9h6l-2-9"/><path d="M19 7l2 9h-6l2-9"/></svg>
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
                  This amount will be automatically applied to your Unallocated Savings.
                </p>
                <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#8B8C9A', fontSize: '13px' }}>
                    <span>Current Unallocated Savings:</span>
                    <span>₹{new Intl.NumberFormat('en-IN').format(funds.find(f => f.id === 'UNALLOCATED')?.storedAssetBalance || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F97316', fontSize: '14px', fontWeight: 600 }}>
                    <span>After Impact:</span>
                    <span>₹{new Intl.NumberFormat('en-IN').format((funds.find(f => f.id === 'UNALLOCATED')?.storedAssetBalance || 0) + reconcileAmount)}</span>
                  </div>
                </div>
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

      {/* Breakdown Modal */}
      {showBreakdownModal && breakdownData && (
        <div className="fm-modal-overlay" onClick={() => setShowBreakdownModal(false)} style={{ zIndex: 999 }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="fm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <h3>Total Savings Calculation</h3>
              </div>
              <button className="fm-modal-close" onClick={() => setShowBreakdownModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="fm-modal-body" style={{ padding: '0', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ background: '#232533', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#8B8C9A', fontWeight: 600 }}>Period</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: '#8B8C9A', fontWeight: 600 }}>Income</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: '#8B8C9A', fontWeight: 600 }}>Expenses</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: '#8B8C9A', fontWeight: 600 }}>Net Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Pre-Existing Savings */}
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 16px', color: '#A5B4FC', fontWeight: 500 }}>Pre-Existing Balance (Manual)</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>-</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>-</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#34D399', fontWeight: 600 }}>+₹{new Intl.NumberFormat('en-IN').format(Math.round(breakdownData.manualTotalSavings || 0))}</td>
                    </tr>
                    
                    {/* Older Cumulative (if any) */}
                    {breakdownData.olderSavingsCumulative > 0 && (
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', color: '#fff' }}>Older Months (Cumulative)</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#34D399', fontWeight: 600 }}>+₹{new Intl.NumberFormat('en-IN').format(Math.round(breakdownData.olderSavingsCumulative))}</td>
                      </tr>
                    )}

                    {/* Recent Months */}
                    {breakdownData.recentMonths && breakdownData.recentMonths.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: m.isCurrent ? 'rgba(52, 211, 153, 0.05)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', color: '#fff' }}>{m.label}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(m.income))}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#EF4444' }}>-₹{new Intl.NumberFormat('en-IN').format(Math.round(m.expense))}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: m.netSavings >= 0 ? '#34D399' : '#EF4444', fontWeight: 600 }}>
                          {m.netSavings >= 0 ? '+' : ''}₹{new Intl.NumberFormat('en-IN').format(Math.round(m.netSavings))}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Total Row */}
                    <tr style={{ background: '#1A1C23', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                      <td style={{ padding: '16px', color: '#fff', fontWeight: 700, fontSize: '15px' }} colSpan={3}>Present Total Savings</td>
                      <td style={{ padding: '16px', textAlign: 'right', color: '#34D399', fontWeight: 800, fontSize: '16px' }}>
                        ₹{new Intl.NumberFormat('en-IN').format(Math.round(breakdownData.totalSavings || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      )}





    </div>
  );
}
