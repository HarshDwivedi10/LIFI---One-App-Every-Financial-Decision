import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function useFinancialData() {
  const [loading, setLoading] = useState(true);
  const [expectedMonthlySavings, setExpectedMonthlySavings] = useState(0);
  const [allocations, setAllocations] = useState({});
  const [metadata, setMetadata] = useState({});
  const [funds, setFunds] = useState([]);
  const [preExistingSavings, setPreExistingSavings] = useState(0);
  const [preExistingSavingsDate, setPreExistingSavingsDate] = useState('');
  const [liveTotalSavings, setLiveTotalSavings] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [savingsGrowth, setSavingsGrowth] = useState(0);
  const [lastDiscrepancySource, setLastDiscrepancySource] = useState(null);
  
  const totalAlloc = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const unallocatedPct = Math.max(0, 100 - totalAlloc);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [incomeRes, txnRes, userRes, fixedRes, fundBalancesRes] = await Promise.all([
        api.get('/income').catch(() => ({ data: [] })),
        api.get('/transactions').catch(() => ({ data: [] })),
        api.get('/user/settings').catch(() => ({ data: {} })),
        api.get('/fixed-expenses').catch(() => ({ data: [] })),
        api.get('/user/fund-balances').catch(() => ({ data: { funds: [] } }))
      ]);

      const incomeSources = incomeRes.data || [];
      const transactions = txnRes.data || [];
      const fixedExpenses = fixedRes.data || [];
      const settings = userRes.data || {};
      const fundBalances = fundBalancesRes.data || {};

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const todayDay = new Date().getDate();

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

      // Expenses calculation for current month
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

      const currentSavings = Math.max(0, currentMonthIncome - currentMonthExpenses);
      
      const sumByDate = (txns, month, year, typeFilter) => txns
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === month && d.getFullYear() === year && (typeFilter ? t.type === typeFilter : true);
        })
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      
      const prevMonthIncome = incomeSources.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) + sumByDate(transactions, prevMonth, prevYear, 'CREDIT');
      const prevMonthExpenses = sumByDate(transactions, prevMonth, prevYear, 'EXPENSE');
      const prevSavings = Math.max(0, prevMonthIncome - prevMonthExpenses);
      
      setMonthlyIncome(currentMonthIncome);
      setMonthlyExpense(currentMonthExpenses);
      setExpectedMonthlySavings(currentSavings);
      
      let growth = 0;
      if (prevSavings > 0) {
        growth = ((currentSavings - prevSavings) / prevSavings) * 100;
      } else if (currentSavings > 0) {
        growth = 100;
      }
      setSavingsGrowth(growth);
      
      setLiveTotalSavings(settings.liveTotalSavings || 0);
      setPreExistingSavings(settings.manualTotalSavings || 0);
      setPreExistingSavingsDate(settings.preExistingSavingsDate || '');
      setLastDiscrepancySource(settings.lastDiscrepancySource || null);
      
      // Parse metadata from Settings allocations mapping
      let savedSettings = {};
      try {
        if (settings.fundAllocationsJson) {
          savedSettings = JSON.parse(settings.fundAllocationsJson);
        }
      } catch (e) {}

      const savedMetadata = savedSettings._metadata || {};
      setMetadata(savedMetadata);

      // Filter and map dynamic funds from backend response
      const apiFunds = fundBalances.funds || [];
      const mappedFunds = apiFunds.map((f, idx) => ({
        ...f,
        fullName: f.id === 'UNALLOCATED' ? f.fullName : `${idx + 1}. ${f.name}`
      }));
      setFunds(mappedFunds);

      // Extract current user allocations
      const allocMap = {};
      
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const timelineAllocations = savedSettings._timeline && savedSettings._timeline[monthKey] 
        ? savedSettings._timeline[monthKey] 
        : null;

      apiFunds.forEach(f => {
        if (f.id !== 'UNALLOCATED') {
          if (timelineAllocations && timelineAllocations[f.id] !== undefined) {
             allocMap[f.id] = timelineAllocations[f.id];
          } else {
             allocMap[f.id] = f.percent;
          }
        }
      });
      setAllocations(allocMap);

    } catch (err) {
      console.error('Error loading financial data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    expectedMonthlySavings,
    allocations,
    metadata,
    funds,
    preExistingSavings,
    preExistingSavingsDate,
    liveTotalSavings,
    lastDiscrepancySource,
    unallocatedPct,
    totalAlloc,
    monthlyIncome,
    monthlyExpense,
    savingsGrowth,
    refetch: fetchData
  };
}
