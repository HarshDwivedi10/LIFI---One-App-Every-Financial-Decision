import React from 'react';

export default function TransferModal({
  show,
  onClose,
  transferFrom,
  setTransferFrom,
  transferTo,
  setTransferTo,
  transferAmount,
  setTransferAmount,
  isTransferring,
  onTransfer,
  funds
}) {
  if (!show) return null;

  return (
    <div className="fm-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="fm-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔄</span>
            <h3>Transfer Funds</h3>
          </div>
          <button className="fm-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="fm-modal-body" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '6px' }}>From Fund</label>
            <select 
              value={transferFrom} 
              onChange={e => setTransferFrom(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '14px' }}
            >
              {funds.map(f => (
                <option key={f.id} value={f.id} style={{ background: '#1a1a24' }}>{f.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '6px' }}>To Fund</label>
            <select 
              value={transferTo} 
              onChange={e => setTransferTo(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '14px' }}
            >
              {funds.map(f => (
                <option key={f.id} value={f.id} style={{ background: '#1a1a24' }}>{f.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8B8C9A', marginBottom: '6px' }}>Transfer Amount (₹)</label>
            <input 
              type="number" 
              value={transferAmount} 
              onChange={e => setTransferAmount(e.target.value)}
              placeholder="e.g. 5000"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #232533', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '14px' }}
            />
          </div>
        </div>

        <div className="fm-modal-footer">
          <button className="fm-btn-outline" onClick={onClose} disabled={isTransferring}>Cancel</button>
          <button 
            className="fm-btn-primary" 
            style={{ background: '#F97316', color: '#fff' }} 
            onClick={onTransfer}
            disabled={isTransferring}
          >
            {isTransferring ? 'Transferring...' : 'Execute Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
