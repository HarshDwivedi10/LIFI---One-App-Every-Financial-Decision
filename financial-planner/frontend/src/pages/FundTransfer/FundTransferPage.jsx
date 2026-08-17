import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import useFinancialData from '../../hooks/useFinancialData';
import { numberToIndianWords } from '../../utils/numberToWords';
import CustomDropdown from '../../components/UI/CustomDropdown';
import './FundTransferPage.css';

export default function FundTransferPage() {
  const navigate = useNavigate();
  const {
    loading,
    expectedMonthlySavings,
    metadata,
    funds,
    refreshData
  } = useFinancialData();

  const [sourceFund, setSourceFund] = useState('');
  const [targetFund, setTargetFund] = useState('');
  const [amount, setAmount] = useState('');
  const [impactAnalysis, setImpactAnalysis] = useState([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);
  const [amountError, setAmountError] = useState(false);
  const [maintainContribution, setMaintainContribution] = useState(false);

  // Exclude fixed system assets if necessary, but UNALLOCATED is allowed as source/target
  const availableFunds = useMemo(() => {
    return funds.filter(f => f.assetType !== 'CASH' && f.assetType !== 'BANK_ACCOUNT');
  }, [funds]);

  // Find currently selected funds to show balances
  const sourceAsset = availableFunds.find(f => f.id === sourceFund);
  const targetAsset = availableFunds.find(f => f.id === targetFund);

  // Core waterfall simulation engine
  const runWaterfallSimulation = (goals, monthlySavings, isSimulated = false) => {
    const sorted = [...goals].filter(g => g.targetAmount > 0 && g.balance < g.targetAmount);
    sorted.sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));

    let maxDate = new Date();
    sorted.forEach(g => {
      const d = new Date(g.targetDate);
      if (d > maxDate) maxDate = d;
    });

    const extendedMax = new Date(maxDate);
    extendedMax.setFullYear(extendedMax.getFullYear() + 5);

    let cy = new Date().getFullYear();
    let cm = new Date().getMonth();
    const maxY = extendedMax.getFullYear();
    const maxM = extendedMax.getMonth();

    const timeline = {};
    const balances = {};
    const startingBalances = {};
    const initialAllocations = {};
    const projectedDates = {};
    const balancesAtDeadline = {};

    goals.forEach(g => {
      balances[g.id] = g.balance;
      startingBalances[g.id] = g.balance;
      if (g.balance >= g.targetAmount) {
         projectedDates[g.id] = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      }
    });

    while (cy < maxY || (cy === maxY && cm <= maxM)) {
      const monthKey = `${cy}-${String(cm + 1).padStart(2, '0')}`;
      timeline[monthKey] = {};
      let available = monthlySavings;

      sorted.forEach(g => {
        if (balances[g.id] >= g.targetAmount || available <= 0) {
          timeline[monthKey][g.id] = 0;
          return;
        }
        
        const tDate = new Date(g.targetDate);
        const isPastDeadline = cy > tDate.getFullYear() ||
          (cy === tDate.getFullYear() && cm > tDate.getMonth());

        const missing = g.targetAmount - balances[g.id];
        let missingForCalc = missing;
        if (isSimulated && maintainContribution && g.transferBonus > 0) {
           missingForCalc = g.targetAmount - (balances[g.id] - g.transferBonus);
        }
        
        const mLeft = Math.max(1, (tDate.getFullYear() - cy) * 12 + (tDate.getMonth() - cm));
        const required = missingForCalc / mLeft;
        const alloc = Math.min(available, Math.max(0, required), missing);
        const pct = (alloc / monthlySavings) * 100;

        timeline[monthKey][g.id] = isPastDeadline ? 0 : pct;
        if (initialAllocations[g.id] === undefined && alloc > 0) {
          initialAllocations[g.id] = alloc;
        }
        balances[g.id] += alloc;
        available -= alloc;

        if (cy === tDate.getFullYear() && cm === tDate.getMonth()) {
          balancesAtDeadline[g.id] = balances[g.id];
        }

        if (!projectedDates[g.id] && balances[g.id] >= g.targetAmount) {
          projectedDates[g.id] = monthKey;
        }
      });

      cm++;
      if (cm > 11) { cm = 0; cy++; }
      if (cy > new Date().getFullYear() + 15) break;
    }

    return { timeline, balances, startingBalances, balancesAtDeadline, projectedDates, initialAllocations };
  };

  useEffect(() => {
    if (!sourceFund || !targetFund || !amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setImpactAnalysis([]);
      return;
    }
    
    if (sourceFund === targetFund) {
      setImpactAnalysis([]);
      return;
    }

    const transferAmt = parseFloat(amount);
    if (sourceAsset && transferAmt > sourceAsset.storedAssetBalance) {
      setImpactAnalysis([]);
      return;
    }

    // Prepare goals list
    const existingGoals = funds
      .filter(f => f.id !== 'UNALLOCATED')
      .map(f => {
        const meta = metadata[f.id] || {};
        return {
          id: f.id,
          name: f.name,
          assetType: f.assetType,
          targetAmount: meta.targetAmount || 0,
          targetDate: meta.targetDate || '2099-12-31',
          balance: f.storedAssetBalance || 0
        };
      })
      .filter(g => g.targetAmount > 0);

    // 1. BASELINE Simulation
    const baseline = runWaterfallSimulation(existingGoals, expectedMonthlySavings);

    // 2. SIMULATED Simulation (with modified balances)
    const simulatedGoals = existingGoals.map(g => {
      let newBalance = g.balance;
      if (g.id === sourceFund) newBalance -= transferAmt;
      if (g.id === targetFund) newBalance += transferAmt;
      newBalance = Math.max(0, newBalance);
      const transferBonus = newBalance - g.balance;
      return { ...g, balance: newBalance, transferBonus };
    });
    
    const simulated = runWaterfallSimulation(simulatedGoals, expectedMonthlySavings, true);

    // 3. Compute Impacts
    const impacts = [];
    
    const extractTimeline = (simulationObj, goalId) => {
      const result = [];
      let total = 0;
      Object.keys(simulationObj.timeline).sort().forEach(mKey => {
         const pct = simulationObj.timeline[mKey][goalId] || 0;
         if (pct > 0) {
            const amt = (pct / 100) * expectedMonthlySavings;
            total += amt;
            const [y, m] = mKey.split('-');
            const date = new Date(y, m - 1);
            const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            result.push({ label, amt, pct });
         }
      });
      return { 
        breakdown: result, 
        total, 
        accumulated: simulationObj.startingBalances[goalId] || 0,
        target: existingGoals.find(x => x.id === goalId)?.targetAmount || 0 
      };
    };

    existingGoals.forEach(g => {
      const baseProj = baseline.projectedDates[g.id];
      const simProj = simulated.projectedDates[g.id];
      
      const baseFeasible = !!baseProj;
      const simFeasible = !!simProj;
      
      const origDate = new Date(g.targetDate);
      const origLabel = origDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      // Impact A: Turned Infeasible (Money pulled out, causing delay past deadline)
      if (baseFeasible && !simFeasible) {
        const balAtDeadline = simulated.balancesAtDeadline[g.id] ?? (simulated.balances[g.id] || 0);
        const shortfallAmt = Math.max(0, g.targetAmount - balAtDeadline);
        let newProjLabel = 'Unknown';
        let delayMonths = 0;
        if (simProj) {
          const fp = new Date(simProj + '-01');
          newProjLabel = fp.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          delayMonths = (fp.getFullYear() - origDate.getFullYear()) * 12 + (fp.getMonth() - origDate.getMonth());
        }
        impacts.push({ type: 'INFEASIBLE', name: g.name, shortfallAmt, newProjLabel, origLabel, delayMonths });
      } 
      // Impact B: Was Infeasible, Now Feasible (Money injected, pulled before deadline)
      else if (!baseFeasible && simFeasible) {
        const fp = new Date(simProj + '-01');
        const newProjLabel = fp.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        impacts.push({ type: 'FEASIBLE_NOW', name: g.name, newProjLabel, origLabel });
      }
      else if (baseFeasible && simFeasible) {
        const bD = new Date(baseProj + '-01');
        const sD = new Date(simProj + '-01');
        const diffMonths = (sD.getFullYear() - bD.getFullYear()) * 12 + (sD.getMonth() - bD.getMonth());
        
        const baseProjLabel = bD.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

        if (diffMonths < 0) {
          // Accelerated
          if (maintainContribution) {
            impacts.push({ 
              type: 'ACCELERATED', 
              name: g.name, 
              monthsFaster: Math.abs(diffMonths), 
              baseProjLabel, 
              newProjLabel: sD.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
              rawNewDate: simProj + '-01',
              timelineInfo: extractTimeline(simulated, g.id)
            });
          }
        } else if (diffMonths > 0) {
          // Delayed (but still within deadline)
          impacts.push({ 
            type: 'DELAYED', 
            name: g.name, 
            monthsSlower: diffMonths, 
            baseProjLabel, 
            newProjLabel: sD.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            rawNewDate: simProj + '-01',
            timelineInfo: extractTimeline(simulated, g.id)
          });
        }
      }
      // Impact D: Instantly Achieved
      if (simulated.startingBalances[g.id] >= g.targetAmount && baseline.startingBalances[g.id] < g.targetAmount) {
        // If it was already pushed as FEASIBLE_NOW or ACCELERATED, remove it and just say INSTANT
        const existingIdx = impacts.findIndex(i => i.name === g.name);
        if (existingIdx !== -1) impacts.splice(existingIdx, 1);
        impacts.push({ type: 'INSTANT_ACHIEVED', name: g.name });
      }

      // Impact E: Burden Reduced
      if (!maintainContribution && g.id === targetFund) {
        const baseAlloc = baseline.initialAllocations[g.id] || 0;
        const simAlloc = simulated.initialAllocations[g.id] || 0;
        if (baseAlloc > simAlloc) {
          impacts.push({ 
            type: 'BURDEN_REDUCED', 
            name: g.name, 
            reduction: baseAlloc - simAlloc, 
            baseAlloc, 
            simAlloc,
            percentBase: (baseAlloc / expectedMonthlySavings) * 100,
            percentSim: (simAlloc / expectedMonthlySavings) * 100,
            timelineInfo: extractTimeline(simulated, g.id)
          });
        }
      }

      // Impact F: Burden Increased
      if (g.id === sourceFund) {
        const baseAlloc = baseline.initialAllocations[g.id] || 0;
        const simAlloc = simulated.initialAllocations[g.id] || 0;
        const alreadyPushed = impacts.some(i => i.name === g.name && (i.type === 'DELAYED' || i.type === 'INFEASIBLE'));
        if (simAlloc > baseAlloc && !alreadyPushed) {
          impacts.push({ 
            type: 'BURDEN_INCREASED', 
            name: g.name, 
            increase: simAlloc - baseAlloc, 
            baseAlloc, 
            simAlloc,
            percentBase: (baseAlloc / expectedMonthlySavings) * 100,
            percentSim: (simAlloc / expectedMonthlySavings) * 100,
            timelineInfo: extractTimeline(simulated, g.id)
          });
        }
      }
    });

    setImpactAnalysis(impacts);

  }, [sourceFund, targetFund, amount, funds, expectedMonthlySavings, metadata, sourceAsset, maintainContribution]);

  const handleAmountChange = (e) => {
    const val = e.target.value;
    const num = parseFloat(val);
    if (sourceAsset && !isNaN(num) && num > sourceAsset.storedAssetBalance) {
      setAmount(sourceAsset.storedAssetBalance.toString());
      setAmountError(true);
    } else {
      setAmount(val);
      setAmountError(false);
    }
  };

  const handleTransfer = async () => {
    if (!sourceFund || !targetFund || !amount) {
      toast.error('Please fill all fields.');
      return;
    }
    if (sourceFund === targetFund) {
      toast.error('Source and Target funds cannot be the same.');
      return;
    }
    const transferAmt = parseFloat(amount);
    if (isNaN(transferAmt) || transferAmt <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (sourceAsset && transferAmt > sourceAsset.storedAssetBalance) {
      toast.error(`Insufficient balance in ${sourceAsset.name}.`);
      return;
    }

    try {
      setIsTransferring(true);
      await api.post('/assets/transfer', {
        sourceFund: sourceFund,
        destinationFund: targetFund,
        amount: transferAmt
      });
      
      // Auto-update global target dates and recalibrate the central timeline
      try {
        const settingsRes = await api.get('/user/settings');
        if (settingsRes.data && settingsRes.data.fundAllocationsJson) {
          const allocationsData = JSON.parse(settingsRes.data.fundAllocationsJson);
          const md = allocationsData._metadata || {};

          impactAnalysis.forEach(impact => {
            if ((impact.type === 'ACCELERATED' || impact.type === 'DELAYED') && impact.rawNewDate) {
              const impactedFund = funds.find(f => f.name === impact.name);
              if (impactedFund) {
                if (!md[impactedFund.id]) md[impactedFund.id] = {};
                md[impactedFund.id].targetDate = impact.rawNewDate;
              }
            }
          });
          
          allocationsData._metadata = md;

          // Recalibrate timeline with new balances and new target dates
          const simulatedGoals = funds
            .filter(f => f.id !== 'UNALLOCATED')
            .map(f => {
              let bal = f.storedAssetBalance || 0;
              if (f.id === sourceFund) bal -= transferAmt;
              if (f.id === targetFund) bal += transferAmt;
              
              const mData = md[f.id] || metadata[f.id] || {};
              return {
                id: f.id,
                targetAmount: mData.targetAmount || 0,
                targetDate: mData.targetDate || '',
                balance: bal
              };
            });

          const simEngine = await import('../../utils/simulationEngine');
          const finalResult = simEngine.runWaterfallSimulation(simulatedGoals, expectedMonthlySavings);

          const newTimeline = { ...(allocationsData._timeline || {}) };
          const currentDateKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          
          Object.keys(newTimeline).forEach(m => {
              if (m >= currentDateKey) {
                  delete newTimeline[m];
              }
          });
          
          Object.keys(finalResult.timeline).forEach(m => {
              newTimeline[m] = finalResult.timeline[m];
          });
          
          allocationsData._timeline = newTimeline;

          await api.put('/user/settings', {
            ...settingsRes.data,
            fundAllocationsJson: JSON.stringify(allocationsData)
          });
        }
      } catch (e) {
        console.error("Failed to sync new target dates and timeline:", e);
      }

      setShowTransferSuccess(true);
      setTimeout(() => {
        setShowTransferSuccess(false);
        navigate('/fund-management');
      }, 2500);
      setSourceFund('');
      setTargetFund('');
      setAmount('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to transfer funds.');
      setIsTransferring(false);
      return;
    }

    try {
      await refreshData(); // Refresh all balances globally
    } catch (err) {
      console.error('Failed to refresh data after transfer', err);
    } finally {
      setIsTransferring(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#8B8C9A' }}>Loading...</div>;

  return (
    <div className="fund-transfer-page" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Subtle Heading */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#fff', margin: '0 0 8px 0' }}>Transfer Your Funds</h2>
        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>Seamlessly move money between your active goals and unallocated reserves.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* LEFT COLUMN: TRANSFER FORM */}
        <div className="ft-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', margin: 0 }}>
        
        {/* FROM and TO */}
        <div className="ft-flex-row" style={{ marginBottom: 0 }}>
          {/* FROM */}
          <div className="ft-flex-col">
            <div className="ft-form-group">
              <label>FROM</label>
              <CustomDropdown 
                value={sourceFund}
                onChange={(val) => {
                  setSourceFund(val);
                  if (val !== 'UNALLOCATED' && targetFund !== 'UNALLOCATED' && targetFund !== '') {
                    setTargetFund('UNALLOCATED');
                  }
                  const sf = availableFunds.find(f => f.id === val);
                  if (sf) {
                    setAmount(sf.storedAssetBalance.toString());
                    setAmountError(false);
                  }
                }}
                placeholder="Select Source Fund"
                options={availableFunds.map(f => ({
                  value: f.id, label: f.name,
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                }))}
              />
            </div>
          </div>

          <div className="ft-swap-icon" onClick={() => {
            const temp = sourceFund; setSourceFund(targetFund); setTargetFund(temp);
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 8 16 13"/><line x1="21" y1="8" x2="9" y2="8"/><polyline points="8 21 3 16 8 11"/><line x1="3" y1="16" x2="15" y2="16"/></svg>
          </div>

          {/* TO */}
          <div className="ft-flex-col">
            <div className="ft-form-group">
              <label>TO</label>
              <CustomDropdown 
                value={targetFund}
                onChange={(val) => {
                  setTargetFund(val);
                  if (val !== 'UNALLOCATED' && sourceFund !== 'UNALLOCATED' && sourceFund !== '') {
                    setSourceFund('UNALLOCATED');
                  }
                }}
                placeholder="Select Target Fund"
                options={availableFunds.map(f => ({
                  value: f.id, label: f.name,
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                })).filter(o => o.value !== sourceFund && (!sourceFund || sourceFund === 'UNALLOCATED' || o.value === 'UNALLOCATED'))}
              />
            </div>
          </div>
        </div>
        
        <div style={{ fontSize: '12px', color: '#8B8C9A', textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
          To move funds between goals, first transfer them to Unallocated Savings.
        </div>

        {/* BALANCE PREVIEW */}
        {(sourceAsset || targetAsset) && (
          <div className="ft-balance-preview">
            <span>{sourceAsset && <>Available: <span className="highlight">₹{new Intl.NumberFormat('en-IN').format(sourceAsset.storedAssetBalance)}</span></>}</span>
            <span>{targetAsset && <>Current: <span className="highlight">₹{new Intl.NumberFormat('en-IN').format(targetAsset.storedAssetBalance)}</span></>}</span>
          </div>
        )}

        {/* AMOUNT INPUT (only show if source or target is selected) */}
        {(sourceFund || targetFund) && (
          <div className="ft-form-group">
            <input 
              type="number" 
              className={`ft-amount-input ${amountError ? 'error' : ''}`}
              placeholder="Enter Transfer Amount (e.g. 10000)" 
              value={amount}
              onChange={handleAmountChange}
              style={{ borderColor: amountError ? '#EF4444' : undefined }}
            />
            {amountError && (
              <div style={{ color: '#EF4444', fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>Maximum available amount reached.</div>
            )}
            {amount && !amountError && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
              <div style={{ fontSize: '12px', color: '#10B981', marginTop: '10px' }}>{numberToIndianWords(parseFloat(amount))}</div>
            )}
          </div>
        )}

        {/* SIMULATION STRATEGY (only show if transfer is valid and target is NOT unallocated) */}
        {(amount && parseFloat(amount) > 0 && sourceFund && targetFund && targetFund !== 'UNALLOCATED') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <label style={{ fontSize: '12px', color: '#8B8C9A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Simulation Strategy</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div 
                onClick={() => setMaintainContribution(false)}
                style={{ 
                  padding: '16px', borderRadius: '12px', 
                  border: !maintainContribution ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.05)',
                  background: !maintainContribution ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 600, color: !maintainContribution ? '#818CF8' : '#D1D5DB', marginBottom: '4px' }}>
                  Reduce Monthly Contribution
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.4' }}>
                  Reduce monthly contribution to savings for this fund.
                </div>
              </div>
              <div 
                onClick={() => setMaintainContribution(true)}
                style={{ 
                  padding: '16px', borderRadius: '12px', 
                  border: maintainContribution ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.05)',
                  background: maintainContribution ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 600, color: maintainContribution ? '#34D399' : '#D1D5DB', marginBottom: '4px' }}>
                  Finish Goal Earlier
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.4' }}>
                  Keep monthly contribution same. Added funds will finish goals earlier.
                </div>
              </div>
            </div>
          </div>
        )}

        <button 
          className="ft-transfer-btn" 
          onClick={handleTransfer}
          disabled={isTransferring || !sourceFund || !targetFund || !amount || (sourceAsset && parseFloat(amount) > sourceAsset.storedAssetBalance)}
          style={{ marginTop: '12px' }}
        >
          {isTransferring ? 'Processing Transfer...' : 'Confirm Transfer'}
        </button>
      </div>

      {/* RIGHT COLUMN: IMPACT ANALYSIS */}
      <div className="ft-card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: '0 0 24px 0' }}>Impact Analysis</h2>
        
        {!(amount && parseFloat(amount) > 0 && sourceFund && targetFund) ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8B8C9A', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p style={{ margin: 0, fontSize: '14px' }}>Select source, target, and enter an amount to see how this transfer will impact your goals and timeline.</p>
          </div>
        ) : impactAnalysis.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {impactAnalysis.map((impact, idx) => {
              if (impact.type === 'INFEASIBLE') {
                return (
                  <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#F87171', marginBottom: '6px' }}>{impact.name} — Target Compromised</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                      Pulling funds leaves <strong style={{ color: '#D1D5DB' }}>{impact.name}</strong> short by <strong style={{ color: '#FCA5A5' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.shortfallAmt))}</strong> on its original deadline.
                    </div>
                  </div>
                );
              }
              if (impact.type === 'DELAYED') {
                return (
                  <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#F87171', marginBottom: '6px' }}>{impact.name} — Delayed</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                      Goal was originally projected to finish by <strong style={{ color: '#D1D5DB' }}>{impact.baseProjLabel}</strong>. Now the goal will be delayed by <strong style={{ color: '#F87171' }}>{impact.monthsSlower} month(s)</strong>, with the new date of completion: <strong style={{ color: '#F87171' }}>{impact.newProjLabel}</strong>.
                    </div>

                    {impact.timelineInfo && impact.timelineInfo.breakdown.length > 0 && (
                      <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Monthly Breakdown</div>
                        <div className="ft-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                          {impact.timelineInfo.breakdown.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#D1D5DB' }}>{item.label}</div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F87171' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(item.amt))}</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>{item.pct.toFixed(1)}% of savings</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Fund Amount Needed</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.total))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Transferred Amount</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#F87171' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.accumulated))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                           <div style={{ fontSize: '13px', color: '#D1D5DB', fontWeight: 600 }}>Total Goal Amount</div>
                           <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.target))}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              if (impact.type === 'ACCELERATED') {
                return (
                  <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#34D399', marginBottom: '6px' }}>{impact.name} — Accelerated</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                      Goal was originally projected to finish by <strong style={{ color: '#D1D5DB' }}>{impact.baseProjLabel}</strong>. Now the purchase can be made <strong style={{ color: '#34D399' }}>{impact.monthsFaster} month(s) earlier</strong>, with the new date of purchase: <strong style={{ color: '#34D399' }}>{impact.newProjLabel}</strong>.
                    </div>

                    {impact.timelineInfo && impact.timelineInfo.breakdown.length > 0 && (
                      <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Monthly Breakdown</div>
                        <div className="ft-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                          {impact.timelineInfo.breakdown.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#D1D5DB' }}>{item.label}</div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(item.amt))}</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>{item.pct.toFixed(1)}% of savings</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Fund Amount Needed</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.total))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Transferred Amount</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.accumulated))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                           <div style={{ fontSize: '13px', color: '#D1D5DB', fontWeight: 600 }}>Total Goal Amount</div>
                           <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.target))}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              if (impact.type === 'FEASIBLE_NOW') {
                return (
                  <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#34D399', marginBottom: '6px' }}>{impact.name} — Back on Track!</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                      This injection of funds brings <strong style={{ color: '#D1D5DB' }}>{impact.name}</strong> back on schedule to hit its target by {impact.newProjLabel}.
                    </div>
                  </div>
                );
              }
              if (impact.type === 'INSTANT_ACHIEVED') {
                return (
                  <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10B981', marginBottom: '6px' }}>🎉 {impact.name} — Goal Achieved!</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                      This transfer will instantly complete the funding for <strong style={{ color: '#D1D5DB' }}>{impact.name}</strong>!
                    </div>
                  </div>
                );
              }
              if (impact.type === 'BURDEN_REDUCED') {
                return (
                  <div key={idx} style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#818CF8', marginBottom: '6px' }}>{impact.name} — Burden Reduced</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5', marginBottom: '16px' }}>
                      Your monthly contribution for this goal will be reduced by <strong style={{ color: '#D1D5DB' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.reduction))}</strong> per month.
                    </div>
                    
                    {/* Visual Comparison */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
                          <span>Previous Contri.</span>
                          <span>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.baseAlloc))}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#6B7280', width: `${impact.percentBase}%` }}></div>
                        </div>
                      </div>
                      
                      <div style={{ color: '#6B7280' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#818CF8', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600 }}>New Contri.</span>
                          <span style={{ fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.simAlloc))}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#818CF8', width: `${impact.percentSim}%`, transition: 'width 1s ease-out' }}></div>
                        </div>
                      </div>
                    </div>

                    {impact.timelineInfo && impact.timelineInfo.breakdown.length > 0 && (
                      <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Monthly Breakdown</div>
                        <div className="ft-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                          {impact.timelineInfo.breakdown.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#D1D5DB' }}>{item.label}</div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#818CF8' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(item.amt))}</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>{item.pct.toFixed(1)}% of savings</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Fund Amount Needed</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.total))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Transferred Amount</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.accumulated))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                           <div style={{ fontSize: '13px', color: '#D1D5DB', fontWeight: 600 }}>Total Goal Amount</div>
                           <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.target))}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              if (impact.type === 'BURDEN_INCREASED') {
                return (
                  <div key={idx} style={{ background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '12px', padding: '16px 18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#FCD34D', marginBottom: '6px' }}>{impact.name} — Still on Target</div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5', marginBottom: '16px' }}>
                      To stay on target after withdrawing funds, your monthly contribution will need to <strong style={{ color: '#FCD34D' }}>increase by ₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.increase))}</strong> per month.
                    </div>
                    
                    {/* Visual Comparison */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
                          <span>Previous Contri.</span>
                          <span>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.baseAlloc))}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#6B7280', width: `${impact.percentBase}%` }}></div>
                        </div>
                      </div>
                      
                      <div style={{ color: '#6B7280' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#FCD34D', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600 }}>New Contri.</span>
                          <span style={{ fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.simAlloc))}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#FCD34D', width: `${impact.percentSim}%`, transition: 'width 1s ease-out' }}></div>
                        </div>
                      </div>
                    </div>

                    {impact.timelineInfo && impact.timelineInfo.breakdown.length > 0 && (
                      <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Monthly Breakdown</div>
                        <div className="ft-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                          {impact.timelineInfo.breakdown.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#D1D5DB' }}>{item.label}</div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#FCD34D' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(item.amt))}</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>{item.pct.toFixed(1)}% of savings</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Fund Amount Needed</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.total))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                           <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Transferred Amount</div>
                           <div style={{ fontSize: '14px', fontWeight: 700, color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.accumulated))}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                           <div style={{ fontSize: '13px', color: '#D1D5DB', fontWeight: 600 }}>Total Goal Amount</div>
                           <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>₹{new Intl.NumberFormat('en-IN').format(Math.round(impact.timelineInfo.target))}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ) : (
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: maintainContribution ? '#9CA3AF' : '#34D399', display: 'flex' }}>
              {maintainContribution ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#D1D5DB', marginBottom: '4px' }}>
                {maintainContribution ? 'No Impact' : 'No Significant Delay'}
              </div>
              <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                {maintainContribution 
                  ? "Transferring this amount won't help you achieve your goals a full month earlier."
                  : "This transfer is safe. It will not cause any of your goals to be delayed by a full month."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Success Animation Overlay */}
      {showTransferSuccess && (
        <div className="ft-success-overlay">
          <div className="ft-success-card">
             <div className="ft-success-icon-wrap">
               <svg className="ft-success-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <h2 style={{ color: '#fff', fontSize: '24px', margin: '16px 0 8px 0' }}>Transfer Complete!</h2>
             <p style={{ color: '#8B8C9A', margin: 0 }}>Your funds have been securely moved.</p>
          </div>
        </div>
      )}
    </div>
  );
}
