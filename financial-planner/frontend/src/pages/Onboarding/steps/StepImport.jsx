import { useState, useRef } from 'react';
import './steps.css';

export default function StepImport({ onImport, onSkip }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (files) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    let validFiles = fileArray.filter(f => f.name.endsWith('.csv'));
    
    if (validFiles.length === 0) {
      setUploadStatus('error');
      return;
    }
    
    parseCSVs(validFiles);
  };

  const parseCSVs = async (files) => {
    let totalIncome = 0;
    let totalExpense = 0;

    try {
      for (const file of files) {
        const text = await file.text();
        const rows = text.trim().split('\n');
        
        rows.slice(1).forEach((row) => {
          const cols = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          // Standard CSV: date(0), type(1), category(2), amount(3), description(4)
          if (!cols[3] || parseFloat(cols[3]) <= 0) return; 
          
          const type = (cols[1] || 'EXPENSE').toUpperCase();
          const amount = parseFloat(cols[3]) || 0;
          
          if (type === 'INCOME' || type === 'CREDIT') {
            totalIncome += amount;
          } else {
            totalExpense += amount;
          }
        });
      }
      
      const avgIncome = Math.round(totalIncome / 3);
      const avgExpense = Math.round(totalExpense / 3);
      
      onImport(avgIncome, avgExpense);
    } catch (err) {
      setUploadStatus('error');
    }
  };

  return (
    <div className="step-card animate-fade-in">
      <div className="step-header">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--accent-primary)' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Quick Setup
        </h2>
        <p>Save time by uploading your past 3 months of bank statements. We'll automatically calculate your average monthly income and expenses.</p>
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          multiple
          onChange={(e) => handleFileChange(e.target.files)}
          style={{ display: 'none' }}
        />
        
        <button 
            className="btn btn-primary" 
            style={{ width: '100%', maxWidth: '350px', padding: '16px', fontSize: '15px', display: 'flex', justifyContent: 'center', margin: '0 auto', background: 'var(--accent-primary)', border: 'none' }}
            onClick={() => fileRef.current.click()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Help us calculate your average savings
        </button>
        <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>You can select up to 3 CSV files at once.</p>
      </div>

      {uploadStatus === 'error' && (
        <div style={{ marginTop: 10, padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--danger)' }}>
          Could not parse file. Please use CSV format with columns: date, type, category, amount, description
        </div>
      )}

      <div className="section-divider" style={{ margin: '32px 0' }}><span>OR</span></div>

      <div style={{ textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={onSkip} style={{ width: '100%', maxWidth: '300px', margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          Enter Manually
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <p className="text-muted" style={{ fontSize: 'var(--text-xs)', marginTop: '12px' }}>
          You can always add your income and expenses step-by-step.
        </p>
      </div>
    </div>
  );
}
