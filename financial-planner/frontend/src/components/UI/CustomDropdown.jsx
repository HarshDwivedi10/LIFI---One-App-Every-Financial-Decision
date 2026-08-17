import React, { useState, useRef, useEffect } from 'react';
import './CustomDropdown.css';

export default function CustomDropdown({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select an option',
  disabled = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`custom-dropdown-container ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div 
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="custom-dropdown-selected">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="cd-icon">{selectedOption.icon}</span>}
              <span className="cd-label">{selectedOption.label}</span>
            </>
          ) : (
            <span className="cd-placeholder">{placeholder}</span>
          )}
        </div>
        <div className="custom-dropdown-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="custom-dropdown-menu">
          {options.length === 0 ? (
            <div className="custom-dropdown-empty">No options available</div>
          ) : (
            options.map((opt, idx) => (
              <div 
                key={idx}
                className={`custom-dropdown-item ${value === opt.value ? 'selected' : ''}`}
                onClick={() => {
                  if (onChange && opt.value !== value) onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.icon && <span className="cd-icon">{opt.icon}</span>}
                <span className="cd-label">{opt.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
