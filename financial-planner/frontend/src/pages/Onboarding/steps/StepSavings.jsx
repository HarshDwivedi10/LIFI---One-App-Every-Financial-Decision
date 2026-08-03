import { useState, useEffect } from 'react';
import { numberToIndianWords } from '../../../utils/numberToWords';
import './steps.css';

export default function StepSavings({ data, onChange, incomeData }) {
  // Calculate total income from previous step
  const salary = parseFloat(incomeData.monthlySalary) || 0;
  const otherIncome = incomeData.otherSources.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalIncome = salary + otherIncome;

  // Calculate initial total expense if data was imported
  const [expenseInput, setExpenseInput] = useState('');

  useEffect(() => {
    if (data && data.length > 0 && !expenseInput) {
      const initialExpense = data
        .filter(t => t.type === 'EXPENSE' || t.type === 'DEBIT')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      if (initialExpense > 0) {
        setExpenseInput(initialExpense.toString());
      }
    }
  }, [data]);

  const handleExpenseChange = (e) => {
    const val = e.target.value;
    setExpenseInput(val);
    const amount = parseFloat(val) || 0;
    
    // We overwrite the transactions with a single summary expense
    onChange([{
      id: Date.now() + Math.random(),
      date: new Date().toISOString().split('T')[0],
      type: 'EXPENSE',
      amount: amount,
      description: 'Total Monthly Expenses'
    }]);
  };

  const totalExpense = parseFloat(expenseInput) || 0;
  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(1) : 0;

  return (
    <div className="step-card animate-fade-in">
      <div className="step-header">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent-primary)' }}>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Savings Calculation
        </h2>
        <p>Your income is brought over from the previous step. Enter your total monthly expenses to calculate your savings.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        {/* Income Read-Only */}
        <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Monthly Income
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: 'var(--success)' }}>
            ₹{new Intl.NumberFormat('en-IN').format(totalIncome)}
          </div>
        </div>

        {/* Expense Input */}
        <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Monthly Expenses
          </div>
          <div className="input-prefix" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <span className="input-prefix-symbol" style={{ color: 'var(--danger)' }}>₹</span>
            <input
              type="number"
              className="form-input"
              style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)', border: 'none', background: 'transparent' }}
              placeholder="0"
              value={expenseInput}
              onChange={handleExpenseChange}
              min="0"
            />
          </div>
          {expenseInput && <div className="input-words-hint">{numberToIndianWords(expenseInput)}</div>}
        </div>
      </div>

      {/* Savings Result */}
      <div style={{ marginTop: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)', border: '1px solid rgba(99,102,241,0.3)', padding: '32px', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Your Monthly Savings
        </div>
        <div style={{ fontSize: '48px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
          ₹{new Intl.NumberFormat('en-IN').format(savings)}
        </div>
        
        {totalIncome > 0 && (
          <div style={{ marginTop: '16px', display: 'inline-block', padding: '6px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Savings Rate: <strong style={{ color: 'var(--accent-primary)' }}>{savingsRate}%</strong> of income
          </div>
        )}
      </div>

    </div>
  );
}
