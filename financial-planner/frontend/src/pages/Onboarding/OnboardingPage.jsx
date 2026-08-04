import './OnboardingPage.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StepImport from './steps/StepImport';
import StepIncome from './steps/StepIncome';
import StepSavings from './steps/StepSavings';
import StepAssets from './steps/StepAssets';

import api from '../../services/api';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 1, label: 'Setup', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  ), description: 'Import data' },
  { id: 2, label: 'Income', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ), description: 'Your earnings' },
  {
    id: 3,
    label: 'Expenses',
    description: 'Calculate your savings',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
    { id: 4, label: 'Pre-existing savings', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
    ), description: 'Already existing savings' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [animDir, setAnimDir] = useState('right');


  // Shared state across steps
  const [incomeData, setIncomeData] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [manualTotalSavings, setManualTotalSavings] = useState('');
  const [salaryDay, setSalaryDay] = useState(1);

  const goNext = async () => {
    if (currentStep < STEPS.length) {
      setAnimDir('right');
      setCurrentStep((s) => s + 1);
    } else {
      const savePromise = async () => {
        // Save User Settings
        let settingsPayload = { salaryDay, salaryTime: "00:00" };
        if (manualTotalSavings) {
          settingsPayload.manualTotalSavings = parseFloat(manualTotalSavings) || 0;
        }
        await api.put('/user/settings', settingsPayload);

        // Save Income Sources
        for (const source of incomeData) {
          if (source.amount) {
            await api.post('/income', { 
              type: source.type, 
              amount: parseFloat(source.amount), 
              description: source.description, 
              dayOfMonth: parseInt(source.dayOfMonth) || 1 
            });
          }
        }

        // Save Fixed Expenses (from Step 3)
        for (const expense of transactions) {
          if (expense.amount) {
            await api.post('/fixed-expenses', {
              category: expense.category || 'Other',
              description: expense.description || '',
              amount: parseFloat(expense.amount)
            });
          }
        }

        // Save Assets
        for (const asset of assets) {
          if (asset.name && asset.value) {
            await api.post('/assets', {
              assetType: 'OTHER',
              name: asset.name,
              currentValue: parseFloat(asset.value),
              assignedCorpus: asset.assignedCorpus
            });
          }
        }
      };

      await toast.promise(savePromise(), {
        loading: 'Creating your financial profile...',
        success: 'Profile created successfully!',
        error: 'Failed to create profile.'
      });

      localStorage.setItem('hasCompletedOnboarding', 'true');
      navigate('/fund-management?firstTime=true');
    }
  };

  const goPrev = () => {
    if (currentStep > 1) {
      setAnimDir('left');
      setCurrentStep((s) => s - 1);
    }
  };

  const handleImport = (avgIncome, avgExpense) => {
    if (avgIncome > 0) {
      setIncomeData([{
        id: Date.now(),
        type: 'SALARY',
        amount: avgIncome,
        description: 'Bank Statement Average',
        dayOfMonth: 1
      }]);
    }

    if (avgExpense > 0) {
      setTransactions([{
        id: Date.now(),
        category: 'Other',
        amount: avgExpense,
        description: 'Bank Statement Average'
      }]);
    }

    goNext();
  };

  const handleSkipImport = () => {
    goNext();
  };

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;



  return (
    <div className="onboarding-page">
      {/* ── Header ── */}
      <header className="onboarding-header">
        <div className="onboarding-logo">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span className="logo-text">FinancePlanner</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="header-step-info">
            Step {currentStep} of {STEPS.length}
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => {
              toast((t) => (
                <div>
                  <div style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                    Are you sure you want to skip?
                  </div>
                  <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    You will have to configure everything manually on the dashboard.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => toast.dismiss(t.id)}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--danger-color, #ef4444)', border: 'none' }}
                      onClick={() => {
                        toast.dismiss(t.id);
                        localStorage.setItem('hasCompletedOnboarding', 'true');
                        navigate('/');
                      }}
                    >
                      Yes, Skip
                    </button>
                  </div>
                </div>
              ), { duration: Infinity, id: 'skip-onboarding-toast' });
            }}
          >
            Skip Onboarding
          </button>
        </div>
      </header>

      <div className="onboarding-container">
        {/* ── Stepper ── */}
        <div className="stepper-wrapper">
          <div className="stepper-track">
            <div className="stepper-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="stepper-steps">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`stepper-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
                onClick={() => setCurrentStep(step.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="stepper-dot">
                  {currentStep > step.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span className="step-icon">{step.icon}</span>
                  )}
                </div>
                <div className="stepper-label">
                  <span className="step-name">{step.label}</span>
                  <span className="step-desc">{step.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Step Content ── */}
        <div
          key={currentStep}
          className={`step-content animate-${animDir === 'right' ? 'slide-right' : 'slide-left'}`}
        >
          {currentStep === 1 && (
            <StepImport onImport={handleImport} onSkip={handleSkipImport} />
          )}
          {currentStep === 2 && (
            <StepIncome data={incomeData} onChange={setIncomeData} />
          )}
          {currentStep === 3 && (
            <StepSavings data={transactions} onChange={setTransactions} incomeData={incomeData} salaryDay={salaryDay} setSalaryDay={setSalaryDay} />
          )}
          {currentStep === 4 && (
            <StepAssets 
              data={assets} onChange={setAssets} 
              manualTotalSavings={manualTotalSavings} onManualSavingsChange={setManualTotalSavings} 
            />
          )}
        </div>

        {/* ── Navigation ── */}
        {currentStep !== 1 && (
          <div className="step-nav">
            <button
              className="btn btn-secondary"
              onClick={goPrev}
              disabled={currentStep === 1}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>

            <div className="step-dots">
              {STEPS.map((s) => (
                <div key={s.id} className={`step-dot ${currentStep === s.id ? 'active' : ''} ${currentStep > s.id ? 'done' : ''}`} />
              ))}
            </div>

            {currentStep === 4 ? (
              <button className="btn btn-primary" onClick={goNext}>
                Complete Setup
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={goNext}>
                Continue
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
