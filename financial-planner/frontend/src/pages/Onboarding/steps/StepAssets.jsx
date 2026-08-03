import { useEffect, useState } from 'react';
import { numberToIndianWords } from '../../../utils/numberToWords';
import './steps.css';

const CORPUS_TYPES = [
  { id: 'RETIREMENT', label: 'Retirement Corpus', description: 'EPF, PPF, NPS, or dedicated retirement funds', color: 'var(--fund-retirement, #6366f1)' },
  { id: 'LONG_TERM', label: 'Long-Term Goal Corpus', description: 'Savings for house, car, wedding (3+ years)', color: 'var(--fund-long, #8b5cf6)' },
  { id: 'SHORT_TERM', label: 'Short-Term Goal Corpus', description: 'Vacations, gadgets, upcoming purchases (<3 years)', color: 'var(--fund-short, #06b6d4)' },
  { id: 'EMERGENCY', label: 'Emergency & Protection Corpus', description: 'Liquid emergency fund, medical buffer', color: 'var(--fund-emergency, #f59e0b)' },
  { id: 'WEALTH', label: 'Wealth Creation Corpus', description: 'Stocks, MFs, Gold strictly for wealth generation', color: 'var(--fund-wealth, #10b981)' },
];

export default function StepAssets({ data, onChange, manualTotalSavings, onManualSavingsChange }) {
  // data will now be an array of objects: { id, name, value, assignedCorpus }
  const [assets, setAssets] = useState(data && data.length > 0 && data[0].name !== undefined ? data : []);

  useEffect(() => {
    // If data was in the old format (just 5 corpuses), clear it or migrate it
    if (data && data.length > 0 && data[0].type && data[0].name === undefined) {
      setAssets([]);
      onChange([]);
    }
  }, []);

  const addAsset = () => {
    const newAsset = { id: Date.now() + Math.random(), name: '', value: '', assignedCorpus: 'WEALTH' };
    const updated = [...assets, newAsset];
    setAssets(updated);
    onChange(updated);
  };

  const updateAsset = (id, field, value) => {
    const updated = assets.map(a => a.id === id ? { ...a, [field]: value } : a);
    setAssets(updated);
    onChange(updated);
  };

  const removeAsset = (id) => {
    const updated = assets.filter(a => a.id !== id);
    setAssets(updated);
    onChange(updated);
  };

  const totalWealth = assets.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);

  // Group by corpus to show a mini summary
  const corpusTotals = CORPUS_TYPES.reduce((acc, corpus) => {
    acc[corpus.id] = assets.filter(a => a.assignedCorpus === corpus.id).reduce((s, a) => s + (parseFloat(a.value) || 0), 0);
    return acc;
  }, {});

  return (
    <div className="step-card">
      <div className="step-header">
        <h2>Initial Corpus Funding</h2>
        <p>Add your existing savings (like PPF, Mutual Funds, FDs, etc.) and assign them to one of our 5 financial corpuses.</p>
      </div>

      <div className="form-group" style={{ marginTop: '24px', background: 'rgba(99, 102, 241, 0.05)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <label className="form-label" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}>
          Total Pre-Existing Savings (Unallocated)
        </label>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          If you have a lump sum of savings that you haven't assigned to specific assets yet, enter it here. This will be available to distribute among your goals later.
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Or Itemize Your Assets</h3>
        {assets.map((asset, index) => {
          const selectedCorpus = CORPUS_TYPES.find(c => c.id === asset.assignedCorpus);
          return (
            <div key={asset.id} className="form-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', borderLeft: `4px solid ${selectedCorpus?.color || 'var(--border-subtle)'}`, position: 'relative' }}>
              <button 
                onClick={() => removeAsset(asset.id)}
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '14px' }}>Asset Name (e.g., PPF, Mutual Fund)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., PPF"
                    value={asset.name}
                    onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '14px' }}>Current Value</label>
                  <div className="input-prefix">
                    <span className="input-prefix-symbol">₹</span>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      value={asset.value}
                      onChange={(e) => updateAsset(asset.id, 'value', e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '16px' }}>
                <label className="form-label" style={{ fontSize: '14px' }}>Assign to Corpus</label>
                <select 
                  className="form-input"
                  value={asset.assignedCorpus}
                  onChange={(e) => updateAsset(asset.id, 'assignedCorpus', e.target.value)}
                >
                  {CORPUS_TYPES.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#111827' }}>{c.label}</option>
                  ))}
                </select>
              </div>
              
              {asset.value && <div className="input-words-hint" style={{ marginTop: '8px' }}>{numberToIndianWords(asset.value)}</div>}
            </div>
          );
        })}
      </div>

      <button className="btn btn-secondary" onClick={addAsset} style={{ marginTop: '20px', width: '100%', padding: '12px', borderStyle: 'dashed' }}>
        + Add Existing Saving / Asset
      </button>

      {totalWealth > 0 && (
        <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Pre-Existing Wealth (Itemized)</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>
              ₹{new Intl.NumberFormat('en-IN').format(totalWealth)}
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
            {CORPUS_TYPES.map(c => {
              if (!corpusTotals[c.id]) return null;
              return (
                <div key={c.id} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{c.label.replace(' Corpus', '')}</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: c.color }}>₹{new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(corpusTotals[c.id])}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
