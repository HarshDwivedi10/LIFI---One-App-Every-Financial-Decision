import { numberToIndianWords } from '../../../utils/numberToWords';
import './steps.css';

export default function StepAssets({ manualTotalSavings, onManualSavingsChange }) {
  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Pre-existing savings</h2>
        <p>Enter your already existing savings. This will be available to distribute among your goals later.</p>
      </div>

      <div className="form-group" style={{ marginTop: '24px', background: 'rgba(99, 102, 241, 0.05)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <label className="form-label" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}>
          Total Pre-Existing Savings
        </label>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          If you have a lump sum of savings (like PPF, Mutual Funds, FDs, etc.), enter the total value here.
        </p>
        <div className="input-prefix">
          <span className="input-prefix-symbol">₹</span>
          <input
            type="number"
            className="form-input"
            placeholder="e.g. 500000"
            value={manualTotalSavings}
            onChange={(e) => onManualSavingsChange(e.target.value)}
            min="0"
          />
        </div>
        {manualTotalSavings && <div className="input-words-hint">{numberToIndianWords(manualTotalSavings)}</div>}
      </div>
    </div>
  );
}
