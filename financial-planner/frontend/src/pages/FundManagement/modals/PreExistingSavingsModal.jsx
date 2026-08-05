import React from 'react';

export default function PreExistingSavingsModal({
  show,
  onClose,
  preExistingSavings,
  setPreExistingSavings,
  preExistingSavingsDate,
  setPreExistingSavingsDate,
  onSave
}) {
  if (!show) return null;

  return (
    <div className="fm-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="fm-modal" onClick={e => e.stopPropagation()}>
        <div className="fm-modal-header">
          <h3>Update Pre-Existing Savings</h3>
          <button className="fm-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="fm-modal-body">
          <p style={{ color: '#8B8C9A', fontSize: '13px', marginBottom: '16px' }}>Enter your total pre-existing lump sum savings.</p>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <span style={{ color: '#8B8C9A', alignSelf: 'center', fontSize: '18px' }}>₹</span>
            <input 
              type="number" 
              value={preExistingSavings} 
              onChange={e => setPreExistingSavings(parseFloat(e.target.value)||0)} 
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '18px', padding: '10px', borderRadius: '6px' }} 
              placeholder="e.g. 500000"
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '8px' }}>Date Evaluated</label>
            <input 
              type="date" 
              value={preExistingSavingsDate} 
              onChange={e => setPreExistingSavingsDate(e.target.value)} 
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', fontSize: '14px', padding: '10px', borderRadius: '6px' }} 
            />
          </div>
        </div>
        <div className="fm-modal-footer">
          <button className="fm-btn-outline" onClick={onClose}>Cancel</button>
          <button className="fm-btn-primary" style={{ background: '#EAB308', color: '#000' }} onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
