import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import useFinancialData from '../../hooks/useFinancialData';
import { numberToIndianWords } from '../../utils/numberToWords';
import { runWaterfallSimulation } from '../../utils/simulationEngine';

export default function GoalManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const editId = queryParams.get('editId');

  const {
    loading,
    expectedMonthlySavings,
    allocations,
    metadata,
    funds,
    preExistingSavings,
    preExistingSavingsDate,
  } = useFinancialData();

  const [fundName, setFundName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [simulationResult, setSimulationResult] = useState(null);
  const [impactAnalysis, setImpactAnalysis] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [injectAmount, setInjectAmount] = useState(0);

  const unallocatedFund = funds.find(f => f.id === 'UNALLOCATED');
  const unallocatedBalance = unallocatedFund ? (unallocatedFund.storedAssetBalance || 0) : 0;

  useEffect(() => {
    if (!loading && editId) {
      const fund = funds.find(f => f.id === editId);
      if (fund) {
        const meta = metadata[fund.id] || {};
        setFundName(fund.name);
        setTargetAmount(meta.targetAmount ? meta.targetAmount.toString() : '');
        setTargetDate(meta.targetDate || '');
      }
    }
  }, [loading, editId, funds, metadata]);

  useEffect(() => {
    if (!fundName.trim() || !targetAmount || !targetDate) {
      setSimulationResult(null);
      setImpactAnalysis([]);
      return;
    }
    
    const newTargetAmt = parseFloat(targetAmount);
    if (newTargetAmt <= 0) {
      setSimulationResult(null);
      setImpactAnalysis([]);
      return;
    }

    const activeFundId = editId || 'NEW_FUND';

    // Build existing goals list (excluding the one being edited)
    const existingGoals = funds
      .filter(f => f.id !== 'UNALLOCATED' && f.id !== activeFundId)
      .map(f => {
        const meta = metadata[f.id] || {};
        return {
          id: f.id,
          name: f.name,
          targetAmount: meta.targetAmount || 0,
          targetDate: meta.targetDate || '2099-12-31',
          balance: f.storedAssetBalance || 0
        };
      })
      .filter(g => g.targetAmount > 0);

    // ── BASELINE run: without the new goal ────────────────────────────────
    const baseline = runWaterfallSimulation(existingGoals, expectedMonthlySavings);

    // ── FULL run: with the new goal ───────────────────────────────────────
    const newGoalEntry = {
      id: activeFundId,
      name: fundName.trim(),
      targetAmount: newTargetAmt,
      targetDate: targetDate,
      balance: editId ? (funds.find(f => f.id === editId)?.storedAssetBalance || 0) : injectAmount
    };
    const allGoals = [...existingGoals, newGoalEntry];
    const full = runWaterfallSimulation(allGoals, expectedMonthlySavings);

    // ── Feasibility of the NEW goal itself ────────────────────────────────
    const fullProj = full.projectedDates[activeFundId];
    const deadlineMs = new Date(targetDate).getTime();
    const newGoalBalanceAtDeadline = full.balancesAtDeadline[activeFundId] ?? (full.balances[activeFundId] || 0);
    
    // It's only feasible if it reaches the target by or before the deadline
    const isFeasible = !!(fullProj && new Date(fullProj + '-01').getTime() <= deadlineMs);
    const shortfall = isFeasible ? 0 : Math.max(0, newTargetAmt - newGoalBalanceAtDeadline);
    let monthsNeeded = 0;
    let met = false;
    Object.keys(full.timeline).sort().forEach(mk => {
      if (!met) {
        const pct = full.timeline[mk][activeFundId] || 0;
        if (pct > 0 || !met) monthsNeeded++;
        if ((full.balances[activeFundId] || 0) >= newTargetAmt && !met) met = true;
      }
    });

    setSimulationResult({
      timeline: full.timeline,
      isFeasible,
      shortfall,
      monthsNeeded,
      activeFundId
    });

    // ── Impact Analysis on EXISTING goals ─────────────────────────────────
    if (!editId) {
      const impacts = [];
      existingGoals.forEach(g => {
        const baselineProj = baseline.projectedDates[g.id];
        const fullProj     = full.projectedDates[g.id];
        const baselineMet  = (baseline.balances[g.id] || 0) >= g.targetAmount;
        const fullMet      = (full.balances[g.id] || 0)     >= g.targetAmount;
        const deadlineMs   = new Date(g.targetDate).getTime();

        const baselineFeasible = baselineMet &&
          baselineProj && new Date(baselineProj + '-01').getTime() <= deadlineMs;
        const fullFeasible = fullMet &&
          fullProj && new Date(fullProj + '-01').getTime() <= deadlineMs;

        if (baselineFeasible && !fullFeasible) {
          // RED: was feasible, now broken
          // Shortfall = how much was MISSING at the original deadline month
          const balAtDeadline = full.balancesAtDeadline[g.id] ?? (full.balances[g.id] || 0);
          const shortfallAmt = Math.max(0, g.targetAmount - balAtDeadline);
          let newProjLabel = 'Unknown';
          if (fullProj) {
            const d = new Date(fullProj + '-01');
            newProjLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          }
          const origDate = new Date(g.targetDate);
          const origLabel = origDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          let delayMonths = 0;
          if (fullProj) {
            const fp = new Date(fullProj + '-01');
            delayMonths = (fp.getFullYear() - origDate.getFullYear()) * 12 + (fp.getMonth() - origDate.getMonth());
          }
          impacts.push({ type: 'INFEASIBLE', name: g.name, shortfallAmt, newProjLabel, origLabel, delayMonths });
        } else if (baselineFeasible && fullFeasible) {
          // Check for CONTRIBUTION PAUSE: any month where full alloc < baseline alloc by > 10%
          let pausedMonths = [];
          Object.keys(full.timeline).sort().forEach(mk => {
            const baseAlloc  = (baseline.timeline[mk]?.[g.id] || 0);
            const fullAlloc  = (full.timeline[mk]?.[g.id] || 0);
            const bothActive = baseAlloc > 1 || fullAlloc > 0;
            if (bothActive && fullAlloc < baseAlloc - 5) {
              const d = new Date(mk + '-01');
              pausedMonths.push(d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }));
            }
          });
          if (pausedMonths.length > 0) {
            const targetLabel = new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            impacts.push({ type: 'PAUSED', name: g.name, pausedMonths, targetLabel });
          }
        }
      });
      setImpactAnalysis(impacts);
    } else {
      setImpactAnalysis([]);
    }

  }, [fundName, targetAmount, targetDate, funds, metadata, editId, expectedMonthlySavings, injectAmount]);

  const handleSave = async () => {
    if (!simulationResult) {
      toast.error('Please run the simulation first.');
      return;
    }
    if (!fundName.trim() || !targetAmount || !targetDate) {
      toast.error('Please fill all fields.');
      return;
    }

    try {
      setIsSaving(true);
      
      let fundId = editId;
      if (!fundId) {
        fundId = 'FUND_' + fundName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') + '_' + Date.now();
        await api.post('/assets', {
          name: fundName.trim(),
          assetType: fundId,
          currentValue: 0.0,
          fundAllocations: '[]'
        });
      } else {
        const editingFund = funds.find(f => f.id === editId);
        if (editingFund && editingFund.assetId) {
          let newValue = editingFund.storedAssetBalance || 0;
          const target = parseFloat(targetAmount);
          let overflow = 0;
          if (newValue > target) {
              overflow = newValue - target;
              newValue = target;
          }

          await api.put(`/assets/${editingFund.assetId}`, {
            name: fundName.trim(),
            assetType: fundId,
            currentValue: newValue,
            fundAllocations: '[]'
          });

          if (overflow > 0) {
              const unalloc = funds.find(f => f.id === 'UNALLOCATED');
              if (unalloc && unalloc.assetId) {
                 await api.put(`/assets/${unalloc.assetId}`, {
                    name: unalloc.name,
                    assetType: 'UNALLOCATED',
                    currentValue: (unalloc.storedAssetBalance || 0) + overflow,
                    fundAllocations: '[]'
                 });
              } else {
                 await api.post(`/assets`, {
                    name: 'Unallocated Savings',
                    assetType: 'UNALLOCATED',
                    currentValue: overflow,
                    fundAllocations: '[]'
                 });
              }
          }
        }
      }
      
      // Update metadata (slider requiredMonthlyContrib is no longer relevant, we use timeline)
      const updatedMetadata = { 
        ...metadata, 
        [fundId]: {
            targetAmount: parseFloat(targetAmount),
            targetDate: targetDate,
            monthsRemaining: simulationResult.monthsNeeded
        } 
      };

      // We need to map the timeline keys to use the new fundId if it was a NEW_FUND
      const finalTimeline = {};
      Object.keys(simulationResult.timeline).forEach(m => {
          finalTimeline[m] = { ...simulationResult.timeline[m] };
          if (finalTimeline[m]['NEW_FUND'] !== undefined) {
              finalTimeline[m][fundId] = finalTimeline[m]['NEW_FUND'];
              delete finalTimeline[m]['NEW_FUND'];
          }
      });
      
      // Merge with existing timeline from saved settings to keep past months, but overwrite all future
      let existingSettings = {};
      try {
          const res = await api.get('/user/settings');
          if (res.data.fundAllocationsJson) {
              existingSettings = JSON.parse(res.data.fundAllocationsJson);
          }
      } catch(e) {}
      
      const newTimeline = { ...(existingSettings._timeline || {}) };
      
      // Wipe all future months from old timeline to prevent stale trailing data
      const currentDateKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      Object.keys(newTimeline).forEach(m => {
          if (m >= currentDateKey) {
              delete newTimeline[m];
          }
      });
      
      // Insert the freshly calculated comprehensive finalTimeline
      Object.keys(finalTimeline).forEach(m => {
          newTimeline[m] = finalTimeline[m];
      });

      await api.put('/user/settings', {
        manualTotalSavings: preExistingSavings,
        preExistingSavingsDate: preExistingSavingsDate,
        fundAllocationsJson: JSON.stringify({
          ...allocations, // keep old static allocations just in case of fallback
          _timeline: newTimeline,
          _metadata: updatedMetadata
        })
      });

      if (!editId && injectAmount > 0) {
         await api.post('/assets/transfer', {
            sourceFund: 'UNALLOCATED',
            destinationFund: fundId,
            amount: injectAmount
         });
      }

      toast.success(editId ? `"${fundName.trim()}" updated successfully!` : 'New goal created successfully!');
      navigate('/fund-management');
    } catch (err) {
      toast.error('Failed to save goal.');
    } finally {
      setIsSaving(false);
    }
  };

  const minTargetDate = new Date().toISOString().split('T')[0];

  if (loading) {
    return <div style={{ color: '#fff', padding: '2rem' }}>Loading Goal Planner...</div>;
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#ffffff',
      fontFamily: 'var(--font-sans, inherit)', width: '100%', maxWidth: '1200px', margin: '0 auto'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: 'rgba(17, 19, 32, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>Goal Requirements</h2>
            <button onClick={() => navigate('/fund-management')} style={{ background: 'none', border: 'none', color: '#8B8C9A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Cancel
            </button>
          </div>

          {/* Priority Explanation Card */}
          <div style={{ marginBottom: '20px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              How Priority Works
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#93C5FD', lineHeight: '1.5' }}>
              Goals are prioritized on the basis of <strong>Target Date</strong>. Goals with earlier deadlines are always funded first, while later goals will be impacted if monthly savings are limited.
            </p>
          </div>
          
          {unallocatedBalance > 0 && (
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34D399', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>
              Available Unallocated Savings: ₹{new Intl.NumberFormat('en-IN').format(unallocatedBalance)}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goal Name</label>
            <input type="text" value={fundName} onChange={e => { setFundName(e.target.value); }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '16px', padding: '14px', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} placeholder="e.g. New Car" />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Amount (₹)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', color: '#8B8C9A' }}>₹</span>
              <input type="number" min="1" value={targetAmount} onChange={e => { setTargetAmount(e.target.value); }} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '16px', padding: '14px', borderRadius: '8px', outline: 'none' }} placeholder="e.g. 1500000" />
            </div>
            {targetAmount && parseFloat(targetAmount) > 0 && (
              <div style={{ fontSize: '12px', color: '#10B981', marginTop: '6px', fontWeight: 500 }}>
                {numberToIndianWords(parseFloat(targetAmount))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: impactAnalysis.length > 0 ? '16px' : '30px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Date</label>
            <input
              type="date"
              min={minTargetDate}
              value={targetDate}
              onChange={e => {
                const val = e.target.value;
                if (val && val < minTargetDate) {
                  toast.error('Target date cannot be in the past. Please choose a future date.');
                } else {
                  setTargetDate(val);
                }
              }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${targetDate && targetDate < minTargetDate ? '#EF4444' : '#232533'}`, color: '#fff', fontSize: '16px', padding: '14px', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
            />
          </div>

          {/* ── Impact Analysis Panel ─────────────────────────────── */}
          {simulationResult && !editId && (
            <div style={{ marginBottom: '24px' }}>
              {impactAnalysis.length === 0 ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>✅</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#34D399' }}>No Impact on Existing Goals</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>All your current goals remain on schedule.</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#8B8C9A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>Impact on Existing Goals</div>
                  {impactAnalysis.map((impact, idx) => (
                    impact.type === 'INFEASIBLE' ? (
                      <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px 18px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#F87171', marginBottom: '6px' }}>{impact.name} — Target Compromised</div>
                          <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                            Allocating funds here leaves <strong style={{ color: '#D1D5DB' }}>{impact.name}</strong> short by{' '}
                            <strong style={{ color: '#FCA5A5' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.shortfallAmt))}</strong>{' '}
                            on its original deadline of {impact.origLabel}.
                          </div>
                          <div style={{ fontSize: '12px', color: '#FCA5A5', marginTop: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', display: 'inline-block' }}>
                            New projected completion: <strong style={{ color: '#FCA5A5' }}>{impact.newProjLabel}</strong>
                            {impact.delayMonths > 0 && <span style={{ color: '#9CA3AF' }}> (+{impact.delayMonths} months)</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={idx} style={{ background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '12px', padding: '16px 18px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#FCD34D', marginBottom: '6px' }}>{impact.name} — Contributions Paused</div>
                          <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                            Savings for <strong style={{ color: '#D1D5DB' }}>{impact.name}</strong> will be{' '}
                            <strong style={{ color: '#FCD34D' }}>paused</strong> for{' '}
                            <strong style={{ color: '#D1D5DB' }}>{impact.pausedMonths.length} month{impact.pausedMonths.length > 1 ? 's' : ''}</strong>{' '}
                            ({impact.pausedMonths.slice(0, 3).join(', ')}{impact.pausedMonths.length > 3 ? '…' : ''})
                            {' '}to prioritize this new goal.
                          </div>
                          <div style={{ fontSize: '12px', marginTop: '10px', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px', display: 'inline-block', color: '#34D399' }}>
                            {impact.name} will still be achieved on time by {impact.targetLabel}.
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}


          {/* Retirement Planning Button */}
          <div style={{ marginTop: '16px' }}>
             <button 
               onClick={() => navigate('/retirement-planner')}
               style={{
                 width: '100%',
                 background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                 border: '1px solid rgba(139, 92, 246, 0.3)',
                 color: '#C4B5FD',
                 padding: '16px',
                 borderRadius: '12px',
                 fontSize: '15px',
                 fontWeight: 600,
                 cursor: 'pointer',
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'center',
                 transition: 'all 0.2s',
               }}
               onMouseEnter={e => {
                 e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%)';
               }}
               onMouseLeave={e => {
                 e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)';
               }}
             >
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                 </div>
                 <span>Plan Your Retirement</span>
               </div>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
             </button>
          </div>
        </div>

        <div style={{ background: 'rgba(17, 19, 32, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0', fontWeight: 600 }}>Schedule Breakdown</h2>

          {!simulationResult && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748B', textAlign: 'center' }}>
              <p>Enter details on the left to see the automated schedule.</p>
            </div>
          )}

          {simulationResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
              <div style={{ padding: '20px', borderRadius: '12px', background: simulationResult.isFeasible ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${simulationResult.isFeasible ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ fontSize: '24px' }}>{simulationResult.isFeasible ? '✅' : '⚠️'}</div>
                  <div style={{ flex: 1 }}>
                    {simulationResult.isFeasible ? (
                      <>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#34D399' }}>Goal is Feasible</h3>
                        <p style={{ margin: 0, color: '#D1D5DB', lineHeight: '1.5' }}>
                          This goal integrates perfectly into your waterfall schedule.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#F87171' }}>Not feasible as planned</h3>
                        <p style={{ margin: 0, color: '#D1D5DB', lineHeight: '1.5' }}>
                          Even routing all available bandwidth, you will fall short by <span style={{ color: '#FCA5A5', fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(simulationResult.shortfall || 0))}</span> on the target date.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {((!simulationResult.isFeasible && simulationResult.shortfall > 0 && unallocatedBalance > 0 && injectAmount === 0) || injectAmount > 0) && !editId && (
                <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" style={{ marginTop: '2px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#60A5FA', fontWeight: 600 }}>Smart Suggestion</h3>
                      <p style={{ margin: 0, color: '#93C5FD', fontSize: '13px', lineHeight: '1.5' }}>
                        {injectAmount > 0 
                          ? (simulationResult.isFeasible 
                              ? `Injecting ₹${new Intl.NumberFormat('en-IN').format(injectAmount)} from Unallocated Savings made this goal feasible.`
                              : `Injecting ₹${new Intl.NumberFormat('en-IN').format(injectAmount)} from Unallocated Savings reduced the shortfall, but it is still not feasible.`)
                          : `You have ₹${new Intl.NumberFormat('en-IN').format(unallocatedBalance)} in Unallocated Savings. Inject ₹${new Intl.NumberFormat('en-IN').format(Math.min(unallocatedBalance, simulationResult.shortfall))} upfront to ${unallocatedBalance >= simulationResult.shortfall ? 'hit your target date.' : 'reduce your shortfall.'}`
                        }
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (injectAmount > 0) {
                        setInjectAmount(0);
                      } else {
                        setInjectAmount(Math.min(unallocatedBalance, simulationResult.shortfall));
                      }
                    }}
                    style={{
                      background: injectAmount > 0 ? 'rgba(59, 130, 246, 0.2)' : '#3B82F6',
                      color: injectAmount > 0 ? '#93C5FD' : '#fff',
                      border: injectAmount > 0 ? '1px solid rgba(59, 130, 246, 0.4)' : 'none',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      width: '100%',
                      marginTop: '4px'
                    }}
                  >
                    {injectAmount > 0 ? 'Remove Smart Injection' : `Use Unallocated Savings (Inject ₹${new Intl.NumberFormat('en-IN').format(Math.min(unallocatedBalance, simulationResult.shortfall))})`}
                  </button>
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#8B8C9A', textTransform: 'uppercase' }}>Projected Timeline for this Goal</h4>
                {(() => {
                   let totalRupees = 0;
                   const renderedItems = Object.keys(simulationResult.timeline).map(monthKey => {
                     const pct = simulationResult.timeline[monthKey][simulationResult.activeFundId] || 0;
                     if (pct === 0) return null;
                     
                     const dateObj = new Date(monthKey + '-01');
                     const monthName = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                     const rupees = Math.round(expectedMonthlySavings * (pct / 100));
                     totalRupees += rupees;
                     
                     return (
                       <div key={monthKey} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid #232533', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500 }}>{monthName}</span>
                          <div style={{ textAlign: 'right' }}>
                             <div style={{ color: '#34D399', fontWeight: 600, fontSize: '15px' }}>₹{new Intl.NumberFormat('en-IN').format(rupees)}</div>
                             <div style={{ color: '#818CF8', fontSize: '12px' }}>{pct.toFixed(1)}% of savings</div>
                          </div>
                       </div>
                     );
                   });
                   
                   return (
                     <>
                       {renderedItems}
                       {totalRupees > 0 && (
                         <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', alignItems: 'center', marginTop: '8px' }}>
                           <span style={{ fontSize: '14px', fontWeight: 600, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Accumulated</span>
                           <span style={{ fontSize: '18px', fontWeight: 700, color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(totalRupees)}</span>
                         </div>
                       )}
                     </>
                   );
                })()}
              </div>

              <button 
                onClick={handleSave} 
                disabled={isSaving || !simulationResult.isFeasible} 
                style={{ 
                  marginTop: 'auto', 
                  background: (isSaving || !simulationResult.isFeasible) ? 'rgba(255,255,255,0.05)' : '#10B981', 
                  color: (isSaving || !simulationResult.isFeasible) ? '#6B7280' : '#fff', 
                  border: 'none', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  fontSize: '16px', 
                  fontWeight: 700, 
                  cursor: (isSaving || !simulationResult.isFeasible) ? 'not-allowed' : 'pointer', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  boxShadow: (isSaving || !simulationResult.isFeasible) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {isSaving ? 'Saving...' : (editId ? 'Save Schedule' : 'Confirm & Automate Schedule')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
