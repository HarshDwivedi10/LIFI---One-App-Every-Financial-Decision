import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { numberToIndianWords } from '../../utils/numberToWords';

const DEFAULT_FUNDS = [
  { id: 'RETIREMENT', name: 'Retirement Corpus', percent: 0, isLocked: true },
  { id: 'LONG_TERM', name: 'Long-Term Goal Corpus', percent: 25, isLocked: false },
  { id: 'SHORT_TERM', name: 'Short-Term Goal Corpus', percent: 15, isLocked: false },
  { id: 'EMERGENCY', name: 'Emergency & Protection Corpus', percent: 15, isLocked: false },
  { id: 'WEALTH', name: 'Wealth Creation Corpus', percent: 5, isLocked: false }
];

export default function GoalManagementPage() {
  const [loading, setLoading] = useState(true);
  
  // Base Financials
  const [totalSavings, setTotalSavings] = useState(0); 
  const [corpuses, setCorpuses] = useState({});
  const [fundsList, setFundsList] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  // Goals State
  const [goals, setGoals] = useState([]);
  
  // UI State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', cost: '', category: '', targetDate: '' });
  
  // Off-Track Resolution State
  const [resolutionState, setResolutionState] = useState(null); 

  // Simulator State
  const [simulatorState, setSimulatorState] = useState(null);
  
  useEffect(() => {
    fetchBaseline();
  }, []);

  const fetchBaseline = async () => {
    try {
      const [fundBalRes, goalsRes] = await Promise.all([
        api.get('/user/fund-balances').catch(() => ({ data: { funds: [] } })),
        api.get('/goals').catch(() => ({ data: [] }))
      ]);

      const fundData = fundBalRes.data || {};
      const funds = fundData.funds || [];

      setTotalSavings(fundData.expectedMonthlySavings || 0);

      const corpusMap = {};
      funds.forEach(f => {
        corpusMap[f.id] = {
          name: f.name,
          balance: f.balance,
          percent: f.percent,
          monthlyAlloc: f.monthlyAlloc
        };
      });

      setFundsList(funds);
      setCorpuses(corpusMap);

      if (funds.length > 0) {
        if (!newGoal.category) setNewGoal(prev => ({ ...prev, category: funds[0].id }));
        setActiveTab(prev => prev || funds[0].id);
      }

      setGoals(goalsRes.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load financials", error);
      setLoading(false);
    }
  };

  const getMonthsFromNow = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const getMonthsBetween = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    let months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 1 : months;
  };

  const evaluateGoal = (goal) => {
    const months = getMonthsBetween(new Date(), goal.targetDate);
    const cost = parseFloat(goal.cost);
    const corpus = corpuses[goal.category];
    
    // Future Cash Flow Evaluation
    // 1. Current balance available for NEW goals (ignoring existing reserved goals for simplicity in this V1)
    const availableByTarget = corpus.balance + (corpus.monthlyAlloc * months);
    
    if (availableByTarget >= cost) {
      // ON TRACK
      const newGoalObj = { ...goal, monthlyAllocation: cost / months };
      api.post('/goals', newGoalObj).then(res => {
        setGoals([...goals, res.data]);
        setShowAddModal(false);
        setNewGoal({ name: '', cost: '', category: fundsList[0]?.id || '', targetDate: '' });
      }).catch(err => console.error("Failed to save goal", err));
    } else {
      // OFF TRACK
      const shortfall = cost - availableByTarget;
      
      // Option A: Increase Monthly Savings
      const extraMonthly = shortfall / months;
      
      // Option B: Redistribute Existing Savings
      // Total monthly allocated to all goals + new goal
      const totalSavingsForGoals = goals.reduce((sum, g) => sum + g.monthlyAllocation, 0) + corpus.monthlyAlloc; 
      
      const allActiveGoals = [...goals, { ...goal, id: 'temp_new' }];
      const totalCostNeeded = allActiveGoals.reduce((sum, g) => sum + parseFloat(g.cost), 0);
      
      const redistributedGoals = allActiveGoals.map(g => {
        const proportionalShare = parseFloat(g.cost) / totalCostNeeded;
        const newAlloc = totalSavingsForGoals * proportionalShare;
        const oldMonths = getMonthsBetween(new Date(), g.targetDate);
        const newMonths = Math.ceil(parseFloat(g.cost) / newAlloc);
        const delay = Math.max(0, newMonths - oldMonths);
        
        return {
          ...g,
          oldAlloc: g.monthlyAllocation || 0,
          newAlloc: newAlloc,
          delay: delay
        };
      });

      setResolutionState({
        status: 'OFF_TRACK',
        shortfall,
        optionA: { extraMonthly },
        optionB: { redistributedGoals }
      });
    }
  };

  const applyOptionB = async () => {
    try {
      const updatedGoals = [];
      for (const g of resolutionState.optionB.redistributedGoals) {
        const d = new Date(g.targetDate);
        d.setMonth(d.getMonth() + g.delay);
        const payload = {
          name: g.name,
          cost: g.cost,
          category: g.category,
          targetDate: d.toISOString().split('T')[0],
          monthlyAllocation: g.newAlloc
        };
        
        if (g.id === 'temp_new') {
          const res = await api.post('/goals', payload);
          updatedGoals.push(res.data);
        } else {
          const res = await api.put(`/goals/${g.id}`, payload);
          updatedGoals.push(res.data);
        }
      }
      
      setGoals(updatedGoals);
      setResolutionState(null);
      setShowAddModal(false);
      setNewGoal({ name: '', cost: '', category: fundsList[0]?.id || '', targetDate: '' });
    } catch (err) {
      console.error("Failed to apply option B", err);
    }
  };

  if (loading) return <div style={{ padding: '40px', color: 'white' }}>Loading Goal Engine...</div>;

  const getTimerText = (targetDateStr) => {
    const today = new Date();
    const target = new Date(targetDateStr);
    
    let months = (target.getFullYear() - today.getFullYear()) * 12;
    months -= today.getMonth();
    months += target.getMonth();
    
    let days = target.getDate() - today.getDate();
    if (days < 0) {
      months--;
      const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) return "Target date passed";
    if (months === 0 && days === 0) return "Due today";
    
    return `${months > 0 ? months + 'm ' : ''}${days > 0 ? days + 'd' : ''} remaining`;
  };

  return (
    <div style={{ padding: '24px 32px', width: '100%', maxWidth: '100%', margin: '0 auto', fontFamily: 'var(--font-sans)', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Goal Planning</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Future cash flow forecasting approach.</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setNewGoal({ name: '', cost: '', category: fundsList[0]?.id || '', targetDate: '' });
          setShowAddModal(true);
        }}>+ Add New Goal</button>
      </div>

      {/* NOTIFICATION BANNER */}
      {goals.filter(g => g.isDelayed && !g.acknowledged).length > 0 && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', padding: '16px 24px', borderRadius: '12px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: '#F59E0B' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#F59E0B', fontSize: '16px' }}>Goals Delayed Due to Savings Deficit</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              Your recent bank statement indicated lower savings than projected. 
              {goals.filter(g => g.isDelayed && !g.acknowledged).length} goal(s) have had their target dates automatically adjusted. 
              Please acknowledge the changes below.
            </p>
          </div>
        </div>
      )}



      {/* 5 HORIZONTAL FUND CARDS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', 
        gap: '16px', 
        marginBottom: '28px',
        width: '100%' 
      }}>
        {fundsList.filter(f => f.id !== 'UNALLOCATED').map(fund => {
          const isActive = activeTab === fund.id;
          const fundColors = {
            'RETIREMENT': { color: '#818CF8', border: 'rgba(129, 140, 248, 0.4)', bg: 'rgba(129, 140, 248, 0.1)' },
            'LONG_TERM': { color: '#10B981', border: 'rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.1)' },
            'SHORT_TERM': { color: '#3B82F6', border: 'rgba(59, 130, 246, 0.4)', bg: 'rgba(59, 130, 246, 0.1)' },
            'EMERGENCY': { color: '#F97316', border: 'rgba(249, 115, 22, 0.4)', bg: 'rgba(249, 115, 22, 0.1)' },
            'WEALTH': { color: '#EAB308', border: 'rgba(234, 179, 8, 0.4)', bg: 'rgba(234, 179, 8, 0.1)' }
          };
          const styleConfig = fundColors[fund.id] || { color: '#6366F1', border: 'rgba(99, 102, 241, 0.4)', bg: 'rgba(99, 102, 241, 0.1)' };

          return (
            <div 
              key={fund.id}
              onClick={() => setActiveTab(fund.id)}
              style={{
                background: isActive ? styleConfig.bg : 'rgba(255, 255, 255, 0.03)',
                border: `1.5px solid ${isActive ? styleConfig.color : 'rgba(255, 255, 255, 0.08)'}`,
                boxShadow: isActive ? `0 0 16px ${styleConfig.border}` : 'none',
                borderRadius: '12px',
                padding: '16px 14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: styleConfig.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {fund.name.replace(' Corpus', '')}
                </span>
                <span style={{ 
                  fontSize: '10px', 
                  background: 'rgba(255,255,255,0.08)', 
                  padding: '2px 6px', 
                  borderRadius: '8px', 
                  color: 'var(--text-muted)',
                  fontWeight: 600
                }}>
                  {fund.percent}%
                </span>
              </div>

              <div style={{ fontSize: '20px', fontWeight: 800, color: '#34D399', marginBottom: '4px' }}>
                ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(fund.balance || 0)}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                +₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(fund.monthlyAlloc || 0)}<span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/mo</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ACTIVE TAB CONTENT */}
      {activeTab && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <div>
               <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text-primary)' }}>
                 {fundsList.find(f => f.id === activeTab)?.name} Goals
               </h3>
               <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                 Money Saved Until Now: <strong style={{color: 'var(--success)', fontSize: '18px'}}>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(corpuses[activeTab]?.balance || 0)}</strong>
               </p>
             </div>
             <button 
                className="btn btn-primary" 
                style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }} 
                onClick={() => {
                  setNewGoal({ name: '', cost: '', category: activeTab, targetDate: '' });
                  setShowAddModal(true);
                }}
              >
                + Add Goal Here
              </button>
          </div>
          
          {goals.filter(g => g.category === activeTab).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
              No goals assigned to this fund yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {goals.filter(g => g.category === activeTab).map(g => (
                <div key={g.id} style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  border: `1px solid ${g.isDelayed && !g.acknowledged ? '#F59E0B' : 'var(--border-subtle)'}`,
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '12px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(16,185,129,0.2)' }}>
                    ⏱ {getTimerText(g.targetDate)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', marginTop: '4px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>{g.name}</h4>
                      {g.isDelayed && !g.acknowledged && (
                        <span style={{ fontSize: '11px', background: 'rgba(245,158,11,0.2)', color: '#F59E0B', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>Target Delayed</span>
                      )}
                    </div>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if(window.confirm('Are you sure you want to remove this goal?')) {
                          try {
                            await api.delete(`/goals/${g.id}`);
                            setGoals(goals.filter(goal => goal.id !== g.id));
                          } catch (err) {
                            console.error('Failed to delete goal', err);
                          }
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'color 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Remove Goal"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Target Cost:</span>
                    <span style={{ fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(g.cost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Monthly Alloc:</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(g.monthlyAllocation)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Target Date:</span>
                    <span style={{ fontWeight: 600, color: g.isDelayed && !g.acknowledged ? '#F59E0B' : 'inherit' }}>{new Date(g.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                  
                  {g.isDelayed && !g.acknowledged ? (
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', padding: '6px', fontSize: '12px', background: 'rgba(245,158,11,0.2)', color: '#F59E0B', borderColor: '#F59E0B' }} 
                      onClick={async () => {
                        try {
                          const res = await api.put(`/goals/${g.id}/acknowledge`);
                          setGoals(goals.map(goal => goal.id === g.id ? res.data : goal));
                        } catch (err) {
                          console.error("Failed to acknowledge", err);
                        }
                      }}
                    >
                      Acknowledge Delay
                    </button>
                  ) : (
                    <button className="btn btn-secondary" style={{ width: '100%', padding: '6px', fontSize: '12px' }} onClick={() => setSimulatorState(g)}>
                      Simulate Purchase
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD GOAL MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '32px', borderRadius: '16px', width: '500px', border: '1px solid #333' }}>
            <h2 style={{ marginTop: 0 }}>Create Goal</h2>
            <div className="form-group">
              <label className="form-label">Goal Name</label>
              <input className="form-input" value={newGoal.name} onChange={e => setNewGoal({...newGoal, name: e.target.value})} placeholder="e.g. Headphones" />
            </div>
            <div className="form-group">
              <label className="form-label">Estimated Cost</label>
              <input type="number" className="form-input" value={newGoal.cost} onChange={e => setNewGoal({...newGoal, cost: e.target.value})} placeholder="0" />
              {newGoal.cost && <div className="input-words-hint">{numberToIndianWords(newGoal.cost)}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Assign to Fund</label>
              <select className="form-select" value={newGoal.category} onChange={e => setNewGoal({...newGoal, category: e.target.value})}>
                {fundsList.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target Purchase Date</label>
              <input type="date" className="form-input" value={newGoal.targetDate} onChange={e => setNewGoal({...newGoal, targetDate: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => evaluateGoal(newGoal)}>Evaluate Feasibility</button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL */}
      {resolutionState && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#1e1e1e', padding: '32px', borderRadius: '16px', width: '800px', border: '1px solid var(--danger)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239,68,68,0.2)', padding: '12px', borderRadius: '50%', color: 'var(--danger)' }}></div>
              <h2 style={{ margin: 0, color: 'var(--danger)' }}>Goal Off-Track</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Based on your current savings and planned financial commitments, sufficient funds will not be available by {newGoal.targetDate}. You are short by <strong>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(resolutionState.shortfall)}</strong>. 
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Option A */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Option A: Increase Savings</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                  Keep all existing goals on schedule by injecting additional cash flow into this corpus.
                </p>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', marginBottom: '24px' }}>
                  + ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(resolutionState.optionA.extraMonthly)} <span style={{fontSize: '14px', fontWeight: 400}}>/ month</span>
                </div>
                <button className="btn btn-secondary" style={{ width: '100%', borderColor: 'var(--success)', color: 'var(--success)' }}>
                  Commit to Increase
                </button>
              </div>

              {/* Option B */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Option B: Redistribute Savings</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Maintain your current total savings of ₹{new Intl.NumberFormat('en-IN').format(goals.reduce((s,g)=>s+g.monthlyAllocation,0) + corpuses[newGoal.category]?.monthlyAlloc)} and restructure allocations.
                </p>
                
                <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #444', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 0' }}>Goal</th>
                      <th>Old Alloc</th>
                      <th>New Alloc</th>
                      <th>Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolutionState.optionB.redistributedGoals.map(g => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '8px 0', fontWeight: g.id === 'temp_new' ? 700 : 400 }}>{g.name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>₹{Math.round(g.oldAlloc)}</td>
                        <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>₹{Math.round(g.newAlloc)}</td>
                        <td style={{ color: g.delay > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          {g.delay > 0 ? `Delayed by ${g.delay}M` : 'On Track'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button className="btn btn-primary" style={{ width: '100%' }} onClick={applyOptionB}>
                  Confirm Redistribution
                </button>
              </div>
            </div>
            
            <button className="btn btn-ghost" style={{ marginTop: '24px', width: '100%' }} onClick={() => setResolutionState(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* SIMULATOR MODAL */}
      {simulatorState && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002 }}>
          <div style={{ background: '#1a1a1a', padding: '32px', borderRadius: '16px', width: '600px', border: '1px solid #444' }}>
            <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Immediate Purchase Simulator</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Simulating the purchase of <strong>{simulatorState.name}</strong> for <strong>₹{new Intl.NumberFormat('en-IN').format(simulatorState.cost)}</strong> right now.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid var(--accent-primary)', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent-primary)' }}>Configurable Funding Priority</h4>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>Funds will be drained in this sequence until the cost is met.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>1. {corpuses[simulatorState.category]?.name || simulatorState.category} (Primary)</span>
                  <span style={{ color: 'var(--success)' }}>₹{new Intl.NumberFormat('en-IN').format(corpuses[simulatorState.category]?.balance || 0)} available</span>
                </div>
                {corpuses['WEALTH'] && simulatorState.category !== 'WEALTH' && (
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>2. {corpuses['WEALTH'].name}</span>
                    <span style={{ color: 'var(--success)' }}>₹{new Intl.NumberFormat('en-IN').format(corpuses['WEALTH'].balance)} available</span>
                  </div>
                )}
                {corpuses['EMERGENCY'] && simulatorState.category !== 'EMERGENCY' && (
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--warning)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--warning)' }}>3. {corpuses['EMERGENCY'].name} (Warning)</span>
                    <span style={{ color: 'var(--success)' }}>₹{new Intl.NumberFormat('en-IN').format(corpuses['EMERGENCY'].balance)} available</span>
                  </div>
                )}
                {corpuses['RETIREMENT'] && simulatorState.category !== 'RETIREMENT' && (
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--danger)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--danger)' }}>4. {corpuses['RETIREMENT'].name} (Critical)</span>
                    <span style={{ color: 'var(--success)' }}>₹{new Intl.NumberFormat('en-IN').format(corpuses['RETIREMENT'].balance)} available</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSimulatorState(null)}>Close</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { alert('Simulation Execute Logic Here (Future Update)'); setSimulatorState(null); }}>
                Run Simulation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
