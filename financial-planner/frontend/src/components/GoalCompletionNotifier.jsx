import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function GoalCompletionNotifier() {
  const [completedGoal, setCompletedGoal] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userData, setUserData] = useState(null);

  const checkGoals = async () => {
    try {
      const [settingsRes, fundBalancesRes] = await Promise.all([
        api.get('/user/settings').catch(() => ({ data: {} })),
        api.get('/user/fund-balances').catch(() => ({ data: { funds: [] } }))
      ]);

      const settings = settingsRes.data || {};
      const funds = fundBalancesRes.data?.funds || [];
      
      let parsedSettings = {};
      try {
        if (settings.fundAllocationsJson) {
          parsedSettings = JSON.parse(settings.fundAllocationsJson);
        }
      } catch (e) {}

      const metadata = parsedSettings._metadata || {};
      
      const now = new Date();
      // Ensure we only compare dates, not time
      now.setHours(0, 0, 0, 0);

      // Find first goal that is due today or past due
      for (const fund of funds) {
        if (fund.id === 'UNALLOCATED') continue;
        const meta = metadata[fund.id];
        if (meta && meta.targetDate && meta.targetAmount) {
          const targetDate = new Date(meta.targetDate + 'T00:00:00');
          targetDate.setHours(0,0,0,0);
          
          if (now.getTime() >= targetDate.getTime()) {
            setCompletedGoal({ fund, meta });
            setUserData({ settings, parsedSettings, funds });
            return; // Only process one at a time
          }
        }
      }
    } catch (err) {
      console.error('Error checking goals:', err);
    }
  };

  useEffect(() => {
    checkGoals();
  }, []);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const { fund, meta } = completedGoal;
      const { settings, parsedSettings } = userData;

      // 1. Delete the Asset record
      if (fund.assetId) {
        await api.delete(`/assets/${fund.assetId}`);
      }

      // 2. Update settings: deduct targetAmount from manualTotalSavings, remove fund from allocations
      const manualSavings = parseFloat(settings.manualTotalSavings) || 0;
      const targetAmount = parseFloat(meta.targetAmount) || 0;
      const updatedManualSavings = Math.max(0, manualSavings - targetAmount);

      const updatedAllocations = { ...parsedSettings };
      delete updatedAllocations[fund.id];
      
      if (updatedAllocations._metadata) {
        delete updatedAllocations._metadata[fund.id];
      }

      await api.put('/user/settings', {
        manualTotalSavings: updatedManualSavings,
        preExistingSavingsDate: settings.preExistingSavingsDate,
        fundAllocationsJson: JSON.stringify(updatedAllocations)
      });

      toast.success(`🎉 Purchase verified! ₹${new Intl.NumberFormat('en-IN').format(targetAmount)} deducted for ${fund.name}.`);
      setCompletedGoal(null);
      // Wait a moment and check if there are other completed goals
      setTimeout(checkGoals, 2000);
      
      // Dispatch an event to tell the app to refresh if needed
      window.dispatchEvent(new Event('financial-data-updated'));
    } catch (err) {
      toast.error('Failed to complete goal transaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    // If they say no, just extend the date by 1 month so it doesn't keep prompting immediately
    setIsProcessing(true);
    try {
      const { fund, meta } = completedGoal;
      const { settings, parsedSettings } = userData;
      
      const targetDate = new Date(meta.targetDate + 'T00:00:00');
      targetDate.setMonth(targetDate.getMonth() + 1);
      const newDateStr = targetDate.toISOString().split('T')[0];

      const updatedAllocations = { ...parsedSettings };
      if (updatedAllocations._metadata && updatedAllocations._metadata[fund.id]) {
        updatedAllocations._metadata[fund.id].targetDate = newDateStr;
      }

      await api.put('/user/settings', {
        manualTotalSavings: settings.manualTotalSavings,
        preExistingSavingsDate: settings.preExistingSavingsDate,
        fundAllocationsJson: JSON.stringify(updatedAllocations)
      });

      toast.success(`Goal extended by 1 month. Take your time!`);
      setCompletedGoal(null);
      setTimeout(checkGoals, 2000);
      window.dispatchEvent(new Event('financial-data-updated'));
    } catch (err) {
      toast.error('Failed to update goal.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!completedGoal) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #1A1C23 0%, #12141D 100%)',
        border: '1px solid #4F46E5',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '480px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(79, 70, 229, 0.25)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#fff', fontWeight: 700 }}>Goal Reached!</h2>
        <p style={{ margin: '0 0 24px 0', color: '#94A3B8', fontSize: '16px', lineHeight: 1.5 }}>
          Your target date for <strong style={{ color: '#fff' }}>"{completedGoal.fund.name}"</strong> has arrived! Have you made the purchase of <strong style={{ color: '#34D399' }}>₹{new Intl.NumberFormat('en-IN').format(completedGoal.meta.targetAmount)}</strong>?
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            style={{
              flex: 1,
              background: 'linear-gradient(to right, #10B981, #34D399)',
              color: '#000',
              border: 'none',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            {isProcessing ? 'Processing...' : 'Yes, I bought it!'}
          </button>
          
          <button
            onClick={handleDismiss}
            disabled={isProcessing}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Not Yet
          </button>
        </div>
      </div>
    </div>
  );
}
