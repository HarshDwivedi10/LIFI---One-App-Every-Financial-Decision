import { useState } from 'react';
import { INCOME_TYPES } from '../../../utils/constants';
import { numberToIndianWords } from '../../../utils/numberToWords';
import './steps.css';

const INCOME_TYPE_LABELS = {
  SALARY: 'Monthly Salary',
  FREELANCE: 'Freelance',
  BUSINESS: 'Business Income',
  RENTAL: 'Rental Income',
  DIVIDEND: 'Dividends / Interest',
  OTHER: 'Other Income',
};

export default function StepIncome({ data, onChange }) {
  const [errors, setErrors] = useState({});

  const handleSalaryChange = (val) => {
    onChange({ ...data, monthlySalary: val });
    if (errors.salary) setErrors((e) => ({ ...e, salary: '' }));
  };

  const addOtherSource = () => {
    onChange({
      ...data,
      otherSources: [
        ...data.otherSources,
        { id: Date.now(), type: 'FREELANCE', amount: '', description: '' },
      ],
    });
  };

  const updateSource = (id, field, value) => {
    onChange({
      ...data,
      otherSources: data.otherSources.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    });
  };

  const removeSource = (id) => {
    onChange({
      ...data,
      otherSources: data.otherSources.filter((s) => s.id !== id),
    });
  };

  const totalMonthlyIncome =
    (parseFloat(data.monthlySalary) || 0) +
    data.otherSources.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  return (
    <div className="step-card">
      <div className="step-header">
        <h2>� Income Details</h2>
        <p>Tell us about your monthly earnings. This helps us calculate your savings potential and financial plan.</p>
      </div>

      {/* Monthly Salary */}
      <div className="income-primary-card">
        <div className="income-card-label">
          <span className="income-icon">�</span>
          <div>
            <div className="income-title">Monthly Salary</div>
            <div className="income-subtitle">Your primary monthly take-home salary after taxes</div>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">
            Monthly Take-Home Salary <span className="required">*</span>
          </label>
          <div className="input-prefix">
            <span className="input-prefix-symbol">₹</span>
            <input
              id="income-salary"
              type="number"
              className="form-input"
              placeholder="e.g. 85000"
              value={data.monthlySalary}
              onChange={(e) => handleSalaryChange(e.target.value)}
              min="0"
            />
          </div>
          {data.monthlySalary && <div className="input-words-hint">{numberToIndianWords(data.monthlySalary)}</div>}
          {errors.salary && <span className="form-error">{errors.salary}</span>}
        </div>
        
        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">
            Salary Day <span className="required">*</span>
          </label>
          <select 
            className="form-select"
            value={data.salaryDay || 1}
            onChange={(e) => onChange({ ...data, salaryDay: parseInt(e.target.value) })}
          >
            {[...Array(31)].map((_, i) => (
              <option key={i+1} value={i+1}>{i+1}</option>
            ))}
          </select>
          <div className="input-words-hint" style={{ color: 'var(--text-muted)' }}>The day of the month your salary is credited. Used for tracking savings.</div>
        </div>
      </div>

      {/* Other Income Sources */}
      <div style={{ marginTop: 24 }}>
        <div className="flex items-center justify-between mb-md">
          <div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>Other Income Sources</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
              Freelance work, rental income, dividends, etc.
            </p>
          </div>
          {data.otherSources.length > 0 && (
            <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-secondary)', border: '1px solid rgba(99,102,241,0.2)' }}>
              {data.otherSources.length} source{data.otherSources.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {data.otherSources.map((source, index) => (
          <div key={source.id} className="row-item" style={{ gridTemplateColumns: '1fr 1fr 1.5fr auto' }}>
            <div className="form-group">
              <label className="form-label">Income Type</label>
              <select
                className="form-select"
                value={source.type}
                onChange={(e) => updateSource(source.id, 'type', e.target.value)}
              >
                {INCOME_TYPES.filter((t) => t !== 'SALARY').map((t) => (
                  <option key={t} value={t}>{INCOME_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Amount</label>
              <div className="input-prefix">
                <span className="input-prefix-symbol">₹</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={source.amount}
                  onChange={(e) => updateSource(source.id, 'amount', e.target.value)}
                  min="0"
                />
              </div>
              {source.amount && <div className="input-words-hint">{numberToIndianWords(source.amount)}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. YouTube channel"
                value={source.description}
                onChange={(e) => updateSource(source.id, 'description', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-icon btn-danger"
                onClick={() => removeSource(source.id)}
                style={{ marginTop: 20 }}
                title="Remove source"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="add-row-btn" onClick={addOtherSource}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add Income Source
        </button>
      </div>

      {/* Total Summary */}
      {totalMonthlyIncome > 0 && (
        <div className="income-total-card animate-fade-in">
          <div className="income-total-label">Total Monthly Income</div>
          <div className="income-total-value">
            ₹{new Intl.NumberFormat('en-IN').format(totalMonthlyIncome)}
          </div>
          {data.otherSources.length > 0 && (
            <div className="income-breakdown">
              <div className="breakdown-row">
                <span>Salary</span>
                <span>₹{new Intl.NumberFormat('en-IN').format(parseFloat(data.monthlySalary) || 0)}</span>
              </div>
              {data.otherSources.map((s) => (
                <div key={s.id} className="breakdown-row">
                  <span>{INCOME_TYPE_LABELS[s.type]}{s.description ? ` (${s.description})` : ''}</span>
                  <span>₹{new Intl.NumberFormat('en-IN').format(parseFloat(s.amount) || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
