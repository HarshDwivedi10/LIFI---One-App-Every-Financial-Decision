import { useState, useRef } from 'react';
import './steps.css';

export default function StepImport({ onImport, onSkip }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setUploadStatus('error');
      return;
    }
    parseCSV(file);
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = text.trim().split('\n');
        
        const incomeData = [];
        const expenseData = [];

        rows.slice(1).forEach((row, i) => {
          const cols = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (!cols[3] || parseFloat(cols[3]) <= 0) return; // Skip invalid amounts
          
          const type = (cols[1] || 'EXPENSE').toUpperCase();
          const record = {
            id: Date.now() + i,
            date: cols[0] || new Date().toISOString().split('T')[0],
            type: type,
            category: cols[2] || 'Other',
            amount: cols[3] || '0',
            description: cols[4] || '',
          };

          if (type === 'INCOME' || type === 'CREDIT') {
            incomeData.push(record);
          } else {
            expenseData.push(record);
          }
        });
        
        onImport(incomeData, expenseData);
      } catch (err) {
        setUploadStatus('error');
      }
    };
    reader.readAsText(file);
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
        <p>Save time by importing your bank statement. We'll automatically categorize your income and expenses for you to review.</p>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        style={{ marginTop: '24px' }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFileChange(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={(e) => handleFileChange(e.target.files[0])}
        />
        <span className="upload-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </span>
        <div className="upload-title">Drop your bank statement CSV here</div>
        <div className="upload-subtitle">or click to browse</div>
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
