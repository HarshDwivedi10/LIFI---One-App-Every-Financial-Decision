import { useState, useRef } from 'react';
import api from '../../../services/api';
import './steps.css';

export default function StepImport({ onImport, onSkip }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileRef = useRef();

  const handleFileChange = (files) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    let validFiles = fileArray.filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.csv') || n.endsWith('.pdf');
    });
    
    if (validFiles.length === 0) {
      setUploadStatus('error');
      return;
    }
    
    parseStatements(validFiles);
  };

  const parseStatements = async (files) => {
    setIsParsing(true);
    setUploadStatus(null);
    let totalIncome = 0;
    let totalExpense = 0;
    let successCount = 0;

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const res = await api.post('/transactions/parse-csv-preview', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          if (res.data) {
            totalIncome += parseFloat(res.data.csvIncome || 0);
            totalExpense += parseFloat(res.data.csvExpense || 0);
            successCount++;
          }
        } catch (err) {
          console.error("Statement parse error for file", file.name, err);
        }
      }

      if (successCount === 0) {
        setUploadStatus('error');
        setIsParsing(false);
        return;
      }

      // Calculate monthly average (divide by number of files/months)
      const months = Math.max(1, successCount);
      const avgIncome = Math.round(totalIncome / months);
      const avgExpense = Math.round(totalExpense / months);
      
      setIsParsing(false);
      onImport(avgIncome, avgExpense);
    } catch (err) {
      setIsParsing(false);
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
        <p>Save time by uploading your bank statements (PDF or CSV). We'll automatically calculate your average monthly income and expenses.</p>
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.pdf"
          multiple
          onChange={(e) => handleFileChange(e.target.files)}
          style={{ display: 'none' }}
        />
        
        <button 
            className="btn btn-primary" 
            style={{ width: '100%', maxWidth: '350px', padding: '16px', fontSize: '15px', display: 'flex', justifyContent: 'center', margin: '0 auto', background: 'var(--accent-primary)', border: 'none' }}
            onClick={() => fileRef.current.click()}
            disabled={isParsing}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          {isParsing ? 'Parsing Statements...' : 'Upload Bank Statements (PDF / CSV)'}
        </button>
        <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>You can select PDF or CSV bank statements.</p>
      </div>

      {uploadStatus === 'error' && (
        <div style={{ marginTop: 10, padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--danger)' }}>
          Could not parse statement. Please check the file format or enter details manually.
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
