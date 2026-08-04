import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyFull } from '../../utils/constants';
import { numberToIndianWords } from '../../utils/numberToWords';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './RetirementPlanner.css';

function formatIndianWords(num) {
  if (!num || isNaN(num)) return '';
  if (num >= 10000000) {
    return (num / 10000000).toFixed(2) + ' Cr';
  } else if (num >= 100000) {
    return (num / 100000).toFixed(2) + ' Lakh';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + ' K';
  }
  return '';
}

const DEFAULT_ASSUMPTIONS = {
  inflationRate: 6.0,
  expectedReturn: 8.0,
  lifestyleRatio: 75.0,
  salaryIncreaseRate: 8.0,
  withdrawalRate: 4.0,
};

const MODES = [
  {
    id: 'MODE1',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="16" y1="18" x2="16.01" y2="18"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/></svg>
    ),
    title: 'Calculate My Retirement Plan',
    subtitle: 'Dynamic Engine',
    description: "Advanced step-up SIP engine with lifestyle adjustment & inflation modeling.",
  }
];

// ─── Calculation Engines ─────────────────────────────────────────────────────
function calculateDynamicRetirement({ inputs, assumptions }) {
  const { currentAge, retirementAge, currentExpense, currentSavings, monthlyIncome } = inputs;
  const { inflationRate, expectedReturn, lifestyleRatio, salaryIncreaseRate, withdrawalRate } = assumptions;

  const Y = retirementAge - currentAge;
  if (Y <= 0) return { error: 'Retirement age must be greater than current age.' };

  const E_base = currentExpense * (lifestyleRatio / 100);
  const E_future = E_base * Math.pow(1 + (inflationRate / 100), Y);
  const A_future = E_future * 12;
  const TC = A_future / (withdrawalRate / 100);
  const FVES = currentSavings * Math.pow(1 + (expectedReturn / 100), Y);
  const NCG = Math.max(0, TC - FVES);

  const r_m = (expectedReturn / 100) / 12;
  const s = salaryIncreaseRate / 100;

  let denominator = 0;
  for (let k = 1; k <= Y; k++) {
    const stepUpFactor = Math.pow(1 + s, k - 1);
    const term = stepUpFactor * ((Math.pow(1 + r_m, 12) - 1) / r_m) * Math.pow(1 + r_m, 12 * (Y - k) + 1);
    denominator += term;
  }

  const startingSIP = NCG > 0 && denominator > 0 ? NCG / denominator : 0;
  const sipPercentageOfIncome = monthlyIncome > 0 ? (startingSIP / monthlyIncome) * 100 : 0;
  
  const trajectory = [];
  let currentSIP = startingSIP;
  let accumulated = 0;
  
  for (let k = 1; k <= Y; k++) {
    if (k > 1) currentSIP = currentSIP * (1 + s);
    const totalInvestedYear = currentSIP * 12;
    const fvContributions = currentSIP * ((Math.pow(1 + r_m, 12) - 1) / r_m) * (1 + r_m);
    accumulated = (accumulated * Math.pow(1 + r_m, 12)) + fvContributions;
    
    if ([1, 2, 3, 5, 10, 20, 30, Y].includes(k)) {
      if (!trajectory.find(t => t.year === k)) {
        trajectory.push({ year: k, age: currentAge + k, sip: currentSIP, invested: totalInvestedYear, accumulated });
      }
    }
  }

  return { Y, E_base, E_future, A_future, TC, FVES, NCG, startingSIP, sipPercentageOfIncome, trajectory };
}

function calculateOptimizer({ inputs, assumptions }) {
  const { currentAge, currentExpense, currentSavings, currentContribution, monthlyIncome } = inputs;
  const { inflationRate, expectedReturn, lifestyleRatio, salaryIncreaseRate, withdrawalRate } = assumptions;

  const maxYears = 100 - currentAge;
  const r_m = (expectedReturn / 100) / 12;
  const s = salaryIncreaseRate / 100;
  
  let optimalYear = -1;
  let targetCorpusAtOptimal = 0;
  
  const E_base = currentExpense * (lifestyleRatio / 100);

  for (let y = 1; y <= maxYears; y++) {
    // Required Corpus at Year Y
    const E_future = E_base * Math.pow(1 + (inflationRate / 100), y);
    const requiredCorpus = (E_future * 12) / (withdrawalRate / 100);
    
    // Accumulated Corpus at Year Y
    const fvSavings = currentSavings * Math.pow(1 + (expectedReturn / 100), y);
    
    // Calculate FV of SIPs with step-up
    let fvContribs = 0;
    let tempSIP = currentContribution;
    for (let k = 1; k <= y; k++) {
      if (k > 1) tempSIP = tempSIP * (1 + s);
      const fvYearlyContrib = tempSIP * ((Math.pow(1 + r_m, 12) - 1) / r_m) * (1 + r_m);
      fvContribs = (fvContribs * Math.pow(1 + r_m, 12)) + fvYearlyContrib;
    }
    
    if (fvSavings + fvContribs >= requiredCorpus) {
      optimalYear = y;
      targetCorpusAtOptimal = requiredCorpus;
      break;
    }
  }

  const earliestAge = optimalYear !== -1 ? currentAge + optimalYear : -1;
  
  // Calculate alternative scenarios (Earliest Age - 2, Earliest Age - 5)
  const scenarios = [];
  if (earliestAge > currentAge) {
    const altAges = [earliestAge - 2, earliestAge - 5].filter(a => a > currentAge);
    for (let altAge of altAges) {
      const Y_alt = altAge - currentAge;
      // Calculate required SIP for Y_alt
      const E_future = E_base * Math.pow(1 + (inflationRate / 100), Y_alt);
      const reqCorpus = (E_future * 12) / (withdrawalRate / 100);
      const fvSavings = currentSavings * Math.pow(1 + (expectedReturn / 100), Y_alt);
      const gap = Math.max(0, reqCorpus - fvSavings);
      
      let denominator = 0;
      for (let k = 1; k <= Y_alt; k++) {
        const stepUpFactor = Math.pow(1 + s, k - 1);
        const term = stepUpFactor * ((Math.pow(1 + r_m, 12) - 1) / r_m) * Math.pow(1 + r_m, 12 * (Y_alt - k) + 1);
        denominator += term;
      }
      
      const requiredSIP = gap > 0 && denominator > 0 ? gap / denominator : 0;
      scenarios.push({
        targetAge: altAge,
        requiredSIP,
        additionalSIP: Math.max(0, requiredSIP - currentContribution),
        feasible: requiredSIP <= monthlyIncome
      });
    }
  }

  return { earliestAge, optimalYear, targetCorpusAtOptimal, scenarios, currentContribution, E_base };
}


// ─── Component ───────────────────────────────────────────────────────────────
export default function RetirementPlannerPage() {
  const navigate = useNavigate();

  const [selectedMode, setSelectedMode] = useState('MODE1');
  const [phase, setPhase] = useState('INPUTS'); // INPUTS -> ASSUMPTIONS -> RESULTS
  
  const [inputs, setInputs] = useState({
    currentAge: '',
    retirementAge: 60,
    currentExpense: '',
    currentSavings: '',
    monthlyIncome: '',
    currentContribution: '',
  });

  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS });
  const [results, setResults] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeModal, setActiveModal] = useState(null);
  const [graphType, setGraphType] = useState('INVESTMENT');
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);

  // Persistence State
  const [isSaved, setIsSaved] = useState(false);
  const [planId, setPlanId] = useState(null);

  // Interactivity State
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editingField, setEditingField] = useState(null); // 'TC', 'SIP', 'AGE'
  const [customValues, setCustomValues] = useState({ TC: '', SIP: '', AGE: '' });
  const [interactiveResults, setInteractiveResults] = useState(null);
  const [maxContributionWarning, setMaxContributionWarning] = useState(false);

  useEffect(() => {
    if (!results || selectedMode !== 'MODE1') {
      setInteractiveResults(results);
      return;
    }

    let res = { ...results };
    const { currentAge, monthlyIncome } = inputs;
    const { expectedReturn, salaryIncreaseRate } = assumptions;
    
    if (editingField === 'AGE' && customValues.AGE) {
      const parsedAge = Number(customValues.AGE);
      if (parsedAge > currentAge) {
         res = calculateDynamicRetirement({ 
           inputs: { ...inputs, retirementAge: parsedAge }, 
           assumptions 
         });
      }
    } else if (editingField === 'EXPENSE' && customValues.EXPENSE) {
      const parsedExpense = Number(customValues.EXPENSE);
      const parsedTC = parsedExpense / (assumptions.withdrawalRate / 100);
      
      let currentY = res.Y;
      let startingSIP = 0;
      let sipPercentageOfIncome = 0;
      let currentFVES = 0;
      let currentNCG = 0;
      const r_m = (expectedReturn / 100) / 12;
      const s = salaryIncreaseRate / 100;

      while (true) {
        let denominator = 0;
        for (let k = 1; k <= currentY; k++) {
          const stepUpFactor = Math.pow(1 + s, k - 1);
          const term = stepUpFactor * ((Math.pow(1 + r_m, 12) - 1) / r_m) * Math.pow(1 + r_m, 12 * (currentY - k) + 1);
          denominator += term;
        }
        
        currentFVES = (inputs.currentSavings || 0) * Math.pow(1 + (expectedReturn / 100), currentY);
        currentNCG = Math.max(0, parsedTC - currentFVES);
        
        if (denominator > 0) {
          startingSIP = currentNCG > 0 ? currentNCG / denominator : 0;
        } else {
          startingSIP = currentNCG > 0 ? Infinity : 0;
        }
        
        sipPercentageOfIncome = monthlyIncome > 0 ? (startingSIP / monthlyIncome) * 100 : (startingSIP > 0 ? Infinity : 0);
        
        if (sipPercentageOfIncome <= 80 || Number(currentAge) + currentY >= 75) break;
        currentY++;
      }
      
      let autoToast = null;
      if (currentY > res.Y) {
         if (Number(currentAge) + currentY >= 75 && sipPercentageOfIncome > 80) {
            autoToast = { type: 'error', message: ` Impossible: This goal requires > 80% income even if you retire at 75.` };
         } else {
            autoToast = { type: 'warning', message: ` Goal unachievable at current timeline. Shifted Retirement Age to ${Number(currentAge) + currentY}.` };
         }
      }
      
      res = { ...res, A_future: parsedExpense, TC: parsedTC, NCG: currentNCG, FVES: currentFVES, startingSIP, sipPercentageOfIncome, isUnachievable: startingSIP <= 0 && currentNCG > 0, Y: currentY };
      if (autoToast) res.autoToast = autoToast;
    } else if (editingField === 'TC' && customValues.TC) {
      const parsedTC = Number(customValues.TC);

      let currentY = res.Y;
      let startingSIP = 0;
      let sipPercentageOfIncome = 0;
      let currentFVES = 0;
      let currentNCG = 0;
      const r_m = (expectedReturn / 100) / 12;
      const s = salaryIncreaseRate / 100;

      while (true) {
        let denominator = 0;
        for (let k = 1; k <= currentY; k++) {
          const stepUpFactor = Math.pow(1 + s, k - 1);
          const term = stepUpFactor * ((Math.pow(1 + r_m, 12) - 1) / r_m) * Math.pow(1 + r_m, 12 * (currentY - k) + 1);
          denominator += term;
        }
        
        currentFVES = (inputs.currentSavings || 0) * Math.pow(1 + (expectedReturn / 100), currentY);
        currentNCG = Math.max(0, parsedTC - currentFVES);
        
        if (denominator > 0) {
          startingSIP = currentNCG > 0 ? currentNCG / denominator : 0;
        } else {
          startingSIP = currentNCG > 0 ? Infinity : 0;
        }
        
        sipPercentageOfIncome = monthlyIncome > 0 ? (startingSIP / monthlyIncome) * 100 : (startingSIP > 0 ? Infinity : 0);
        
        if (sipPercentageOfIncome <= 80 || Number(currentAge) + currentY >= 75) break;
        currentY++;
      }
      
      let autoToast = null;
      if (currentY > res.Y) {
         if (Number(currentAge) + currentY >= 75 && sipPercentageOfIncome > 80) {
            autoToast = { type: 'error', message: ` Impossible: This corpus requires > 80% income even if you retire at 75.` };
         } else {
            autoToast = { type: 'warning', message: ` Corpus unachievable at current timeline. Shifted Retirement Age to ${Number(currentAge) + currentY}.` };
         }
      }
      
      res = { ...res, TC: parsedTC, A_future: parsedTC * (assumptions.withdrawalRate / 100), NCG: currentNCG, FVES: currentFVES, startingSIP, sipPercentageOfIncome, isUnachievable: startingSIP <= 0 && currentNCG > 0, Y: currentY };
      if (autoToast) res.autoToast = autoToast;

    } else if (editingField === 'SIP' && customValues.SIP) {
      const parsedSIP = Number(customValues.SIP);
      
      let currentY = 0; // Start at 0 to find the absolute earliest retirement age possible!
      const r_m = (expectedReturn / 100) / 12;
      const s = salaryIncreaseRate / 100;
      let projectedCorpus = 0;
      let surplusShortfall = 0;
      let currentFVES = 0;
      let currentTC = 0;

      while (true) {
        let fvContribs = 0;
        let tempSIP = parsedSIP;
        for (let k = 1; k <= currentY; k++) {
          if (k > 1) tempSIP = tempSIP * (1 + s);
          const fvYearlyContrib = tempSIP * ((Math.pow(1 + r_m, 12) - 1) / r_m) * (1 + r_m);
          fvContribs = (fvContribs * Math.pow(1 + r_m, 12)) + fvYearlyContrib;
        }
        
        currentFVES = (inputs.currentSavings || 0) * Math.pow(1 + (expectedReturn / 100), currentY);
        projectedCorpus = currentFVES + fvContribs;
        
        const E_base = (inputs.currentExpense || 0) * (assumptions.lifestyleRatio / 100);
        const E_future = E_base * Math.pow(1 + (assumptions.inflationRate / 100), currentY);
        currentTC = (E_future * 12) / (assumptions.withdrawalRate / 100);

        surplusShortfall = projectedCorpus - currentTC;
        
        if (surplusShortfall >= 0 || Number(currentAge) + currentY >= 75) break;
        currentY++;
      }
      
      let autoToast = null;
      if (currentY > res.Y) {
         if (Number(currentAge) + currentY >= 75 && surplusShortfall < 0) {
            autoToast = { type: 'error', message: ` Impossible: This SIP cannot reach the target corpus even by age 75.` };
         } else {
            autoToast = { type: 'warning', message: ` SIP too low for current timeline. Shifted Retirement Age to ${Number(currentAge) + currentY}.` };
         }
      } else if (currentY < res.Y) {
         autoToast = { type: 'success', message: ` Great news! With this higher SIP, you can retire earlier at age ${Number(currentAge) + currentY}!` };
      }

      const sipPercentageOfIncome = monthlyIncome > 0 ? (parsedSIP / monthlyIncome) * 100 : 0;
      
      const E_base = (inputs.currentExpense || 0) * (assumptions.lifestyleRatio / 100);
      const E_future = E_base * Math.pow(1 + (assumptions.inflationRate / 100), currentY);
      res = { ...res, startingSIP: parsedSIP, projectedCorpus, surplusShortfall, sipPercentageOfIncome, Y: currentY, FVES: currentFVES, TC: currentTC, A_future: E_future * 12 };
      if (autoToast) res.autoToast = autoToast;
    }

    let toast = res.autoToast || null;
    if (editingField === 'AGE' && customValues.AGE && Number(customValues.AGE) <= currentAge) {
       toast = { type: 'error', message: ` Impossible: Retirement age must be greater than your current age (${currentAge}).` };
    } else if (editingField === 'AGE' && customValues.AGE && Number(customValues.AGE) > 75) {
       toast = { type: 'error', message: ` Invalid: Retirement age cannot exceed 75.` };
    } else if (editingField === 'EXPENSE' && customValues.EXPENSE && Number(customValues.EXPENSE) < 0) {
       toast = { type: 'error', message: ` Invalid: Annual expense cannot be negative.` };
    } else if (editingField === 'TC' && customValues.TC && Number(customValues.TC) < 0) {
       toast = { type: 'error', message: ` Invalid: Target corpus cannot be negative.` };
    } else if (editingField === 'SIP' && customValues.SIP && Number(customValues.SIP) < 0) {
       toast = { type: 'error', message: ` Invalid: Monthly investment cannot be negative.` };
    } else if (!res.autoToast && res.sipPercentageOfIncome > 100) {
       toast = { type: 'error', message: ` Impossible: Required SIP (₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(res.startingSIP)}) exceeds your entire income!` };
    } else if (!res.autoToast && res.sipPercentageOfIncome > 50) {
       toast = { type: 'warning', message: ` Warning: Required SIP is more than 50% of your monthly income.` };
    } else if (!res.autoToast && res.isUnachievable) {
       toast = { type: 'error', message: ` Target Corpus is completely unachievable with the current timeline.` };
    }
    res.toast = toast;

    setInteractiveResults(res);
  }, [editingField, customValues, results, inputs, assumptions, selectedMode]);

  useEffect(() => {
    const prefillData = async () => {
      try {
        const [incomeRes, txnRes, assetsRes, planRes] = await Promise.all([
          api.get('/income').catch(() => ({ data: [] })),
          api.get('/transactions').catch(() => ({ data: [] })),
          api.get('/assets').catch(() => ({ data: [] })),
          api.get('/retirement/plan').catch(() => ({ data: null }))
        ]);

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const sumByDate = (txns, month, year, types) => txns
          .filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === month && d.getFullYear() === year && types.includes(t.type);
          })
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        const prevMonthIncome = incomeRes.data.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) + sumByDate(txnRes.data, prevMonth, prevYear, ['CREDIT']);
        const prevMonthExpenses = sumByDate(txnRes.data, prevMonth, prevYear, ['EXPENSE', 'DEBIT']);
        
        // Calculate retirement savings from 5 corpus structure
        const retirementAssets = assetsRes.data
          .filter(a => ['Retirement Corpus', 'EPF', 'PPF', 'NPS'].includes(a.type))
          .reduce((sum, a) => sum + parseFloat(a.value || 0), 0);

        setInputs(prev => ({
          ...prev,
          monthlyIncome: prev.monthlyIncome || (prevMonthIncome > 0 ? prevMonthIncome.toString() : ''),
          currentExpense: prev.currentExpense || (prevMonthExpenses > 0 ? prevMonthExpenses.toString() : ''),
          currentSavings: prev.currentSavings || (retirementAssets > 0 ? retirementAssets.toString() : '')
        }));

        if (planRes && planRes.data && planRes.data.resultJson) {
            const plan = planRes.data;
            setPlanId(plan.id);
            setSelectedMode(plan.mode || 'MODE1');
            setInputs(prev => ({
                ...prev,
                currentAge: plan.currentAge || prev.currentAge,
                retirementAge: plan.retirementAge || prev.retirementAge,
                currentExpense: plan.currentMonthlyExpense || prev.currentExpense,
                currentSavings: plan.currentRetirementSavings || prev.currentSavings,
                monthlyIncome: plan.monthlyIncome || prev.monthlyIncome,
                currentContribution: plan.currentMonthlyContribution || prev.currentContribution,
            }));
            setAssumptions(prev => ({
                ...prev,
                inflationRate: plan.inflationRate || prev.inflationRate,
                expectedReturn: plan.expectedReturn || prev.expectedReturn,
                lifestyleRatio: plan.lifestyleRatio || prev.lifestyleRatio,
                salaryIncreaseRate: plan.salaryIncreaseRate || prev.salaryIncreaseRate,
                withdrawalRate: plan.withdrawalRate || prev.withdrawalRate,
            }));
            const parsedResults = JSON.parse(plan.resultJson);
            setResults(parsedResults);
            setIsSaved(true);
            setPhase('RESULTS');
        }
      } catch (err) {}
    };
    prefillData();
  }, []);

  const handleModeSelect = (modeId) => {
    setSelectedMode(modeId);
    setPhase('INPUTS');
  };

  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }));
  };

  const handleAssumptionChange = (field, value) => {
    setAssumptions(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const validateInputs = () => {
    const errs = {};
    const age = Number(inputs.currentAge);
    if (!inputs.currentAge || age < 18 || age > 70) errs.currentAge = 'Enter a valid age (18 - 70)';
    if (!inputs.monthlyIncome || Number(inputs.monthlyIncome) < 0) errs.monthlyIncome = 'Enter valid monthly income';
    if (!inputs.currentExpense || Number(inputs.currentExpense) < 0) errs.currentExpense = 'Enter valid monthly expenses';

    if (selectedMode === 'MODE1') {
      const retAge = Number(inputs.retirementAge);
      if (!inputs.retirementAge || retAge <= age) errs.retirementAge = 'Must be after current age';
      else if (retAge > 75) errs.retirementAge = 'Max retirement age is 75';
    } else if (selectedMode === 'MODE_OPTIMIZER') {
      if (!inputs.currentContribution || Number(inputs.currentContribution) < 0) errs.currentContribution = 'Enter valid SIP amount';
    }
    
    return errs;
  };

  const goToAssumptions = () => {
    const errs = validateInputs();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setPhase('ASSUMPTIONS');
  };

  const runCalculation = () => {
    setCalculating(true);
    setTimeout(() => {
      const parsedInputs = {
        currentAge: Number(inputs.currentAge),
        retirementAge: Number(inputs.retirementAge),
        currentExpense: parseFloat(String(inputs.currentExpense).replace(/,/g, '')) || 0,
        currentSavings: parseFloat(String(inputs.currentSavings).replace(/,/g, '')) || 0,
        monthlyIncome: parseFloat(String(inputs.monthlyIncome).replace(/,/g, '')) || 0,
        currentContribution: parseFloat(String(inputs.currentContribution).replace(/,/g, '')) || 0,
      };

      let res;
      if (selectedMode === 'MODE1') {
        res = calculateDynamicRetirement({ inputs: parsedInputs, assumptions });
      } else {
        res = calculateOptimizer({ inputs: parsedInputs, assumptions });
      }

      setResults(res);
      setIsSaved(false);
      setCalculating(false);
      setPhase('RESULTS');
      
      // Save SIP to local storage for Fund Management extraction
      if (!res.error && res.startingSIP > 0) {
        localStorage.setItem('retirement_sip_target', res.startingSIP);
      }

    }, 800);
  };

  const resetPlanner = () => {
    setPhase('INPUTS');
    setResults(null);
  };

  const savePlan = async () => {
    try {
      const payload = {
        mode: selectedMode,
        currentAge: Number(inputs.currentAge) || 0,
        retirementAge: Number(inputs.retirementAge) || 60,
        currentRetirementSavings: Number(inputs.currentSavings) || 0,
        monthlyIncome: Number(inputs.monthlyIncome) || 0,
        currentMonthlyExpense: Number(inputs.currentExpense) || 0,
        currentMonthlyContribution: Number(inputs.currentContribution) || 0,
        inflationRate: assumptions.inflationRate,
        expectedReturn: assumptions.expectedReturn,
        withdrawalRate: assumptions.withdrawalRate,
        lifestyleRatio: assumptions.lifestyleRatio,
        salaryIncreaseRate: assumptions.salaryIncreaseRate,
        resultJson: JSON.stringify(interactiveResults)
      };
      const res = await api.post('/retirement/plan', payload);
      setPlanId(res.data.id);
      setIsSaved(true);
    } catch (err) {
      console.error("Failed to save plan", err);
    }
  };

  const syncToFundManagement = async () => {
    try {
      const profileRes = await api.get('/financial-profile').catch(() => ({ data: {} }));
      const allocRes = await api.get('/fund-management-allocations').catch(() => ({ data: {} }));
      
      const salary = profileRes.data.monthlySalary || Number(inputs.monthlyIncome) || 0;
      const expense = profileRes.data.monthlyExpense || Number(inputs.currentExpense) || 0;
      let allocations = {};
      try {
        if (allocRes.data && allocRes.data.allocationsJson) {
          allocations = JSON.parse(allocRes.data.allocationsJson);
        }
      } catch(e) {}
      
      const expensePct = salary > 0 ? (expense / salary) * 100 : 0;
      const otherAllocations = Object.entries(allocations)
        .filter(([k]) => k !== 'RETIREMENT')
        .reduce((sum, [, val]) => sum + Number(val), 0);
        
      const maxAllowed = Math.max(0, 100 - expensePct - otherAllocations);
      
      const targetSIP = interactiveResults?.startingSIP || 0;
      let requiredPct = salary > 0 ? (targetSIP / salary) * 100 : 0;
      
      let allocatedPct = requiredPct;
      let wasCapped = false;
      let amountShort = 0;
      
      if (requiredPct > maxAllowed) {
        allocatedPct = maxAllowed;
        wasCapped = true;
        amountShort = targetSIP - (salary * (maxAllowed / 100));
      }
      
      allocations['RETIREMENT'] = allocatedPct;
      
      await api.post('/fund-management-allocations', {
        allocationsJson: JSON.stringify(allocations)
      });
      
      if (wasCapped) {
        toast(`Limited by Overallocation! Maximum possible allocated. You still need ₹${new Intl.NumberFormat('en-IN').format(Math.round(amountShort))} more for your Retirement SIP target. Please re-direct from another fund.`, {
          icon: '⚠️',
          duration: 7000
        });
      } else {
        toast.success("Retirement SIP successfully synced to Fund Management!");
      }
      
    } catch (err) {
      console.error("Sync failed", err);
      toast.error("Failed to sync with Fund Management.");
    }
  };

  return (
    <div className="retirement-planner-page" style={{ position: 'relative', paddingTop: '32px' }}>






      {/* PHASE 1: INPUTS */}
      {phase === 'INPUTS' && (
        <div className="rp-card animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '24px' }}>{MODES.find(m => m.id === selectedMode)?.title} Inputs</h2>
          <div className="rp-grid">
            <div className="form-group">
              <label className="form-label">Current Age</label>
              <input type="number" className="form-input" value={inputs.currentAge} onChange={e => handleInputChange('currentAge', e.target.value)} placeholder="e.g. 30" />
              {errors.currentAge && <span className="form-error">{errors.currentAge}</span>}
            </div>
            {selectedMode === 'MODE1' && (
              <div className="form-group">
                <label className="form-label">Retirement Age</label>
                <input type="number" className="form-input" value={inputs.retirementAge} onChange={e => handleInputChange('retirementAge', e.target.value)} placeholder="e.g. 60" />
                {errors.retirementAge && <span className="form-error">{errors.retirementAge}</span>}
              </div>
            )}
            
            {selectedMode === 'MODE_OPTIMIZER' && (
              <div className="form-group">
                <label className="form-label">Current Monthly SIP Contribution</label>
                <div className="input-prefix">
                  <span className="input-prefix-symbol">₹</span>
                  <input type="number" step="any" className="form-input" value={inputs.currentContribution} onChange={e => handleInputChange('currentContribution', e.target.value)} onWheel={e => e.target.blur()} placeholder="e.g. 15000" />
                </div>
                {inputs.currentContribution && <div className="input-words-hint">{numberToIndianWords(inputs.currentContribution)}</div>}
                {errors.currentContribution && <span className="form-error">{errors.currentContribution}</span>}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Current Monthly Expenses</label>
              <div className="input-prefix">
                <span className="input-prefix-symbol">₹</span>
                <input type="number" step="any" className="form-input" value={inputs.currentExpense} onChange={e => handleInputChange('currentExpense', e.target.value)} onWheel={e => e.target.blur()} />
              </div>
              {inputs.currentExpense && <div className="input-words-hint">{numberToIndianWords(inputs.currentExpense)}</div>}
              {errors.currentExpense && <span className="form-error">{errors.currentExpense}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Current Retirement Savings</label>
              <div className="input-prefix">
                <span className="input-prefix-symbol">₹</span>
                <input type="number" step="any" className="form-input" value={inputs.currentSavings} onChange={e => handleInputChange('currentSavings', e.target.value)} onWheel={e => e.target.blur()} />
              </div>
              {inputs.currentSavings && <div className="input-words-hint">{numberToIndianWords(inputs.currentSavings)}</div>}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Monthly Income (To calculate % savings required)</label>
              <div className="input-prefix">
                <span className="input-prefix-symbol">₹</span>
                <input type="number" step="any" className="form-input" value={inputs.monthlyIncome} onChange={e => handleInputChange('monthlyIncome', e.target.value)} onWheel={e => e.target.blur()} />
              </div>
              {inputs.monthlyIncome && <div className="input-words-hint">{numberToIndianWords(inputs.monthlyIncome)}</div>}
              {errors.monthlyIncome && <span className="form-error">{errors.monthlyIncome}</span>}
            </div>

          </div>
          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setPhase('MODE_SELECT')}>Back</button>
            <button className="btn btn-primary" onClick={goToAssumptions}>Continue to Assumptions</button>
          </div>
        </div>
      )}

      {/* PHASE 2: ASSUMPTIONS PANEL */}
      {phase === 'ASSUMPTIONS' && (
        <div className="rp-card animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '8px' }}>Confirm Calculation Assumptions</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: 'var(--text-sm)' }}>
            These industry-standard benchmarks heavily influence the target corpus. Adjust them as per your risk profile.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div className="form-group">
                <label className="form-label">Pre-Retirement ROI (%)</label>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>Expected annual return on your investments before you retire.</div>
                <input type="number" step="0.1" className="form-input" value={assumptions.expectedReturn} onChange={e => handleAssumptionChange('expectedReturn', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Annual Salary Increase (%)</label>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>Your expected approximate salary increase percentage per year.</div>
                <input type="number" step="0.1" className="form-input" value={assumptions.salaryIncreaseRate} onChange={e => handleAssumptionChange('salaryIncreaseRate', e.target.value)} />
              </div>
            </div>

            {selectedMode === 'MODE1' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="form-group">
                    <label className="form-label">Annual Inflation Rate (%)</label>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>The expected average increase in prices each year.</div>
                    <input type="number" step="0.1" className="form-input" value={assumptions.inflationRate} onChange={e => handleAssumptionChange('inflationRate', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Safe Withdrawal Rate (SWR %)</label>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>The percentage of your corpus you plan to withdraw annually in retirement.</div>
                    <input type="number" step="0.1" className="form-input" value={assumptions.withdrawalRate} onChange={e => handleAssumptionChange('withdrawalRate', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ maxWidth: '50%' }}>
                  <label className="form-label">Lifestyle Adjustment Ratio (%)</label>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>Your estimated post-retirement living costs compared to today (e.g. 75%).</div>
                  <input type="number" className="form-input" value={assumptions.lifestyleRatio} onChange={e => handleAssumptionChange('lifestyleRatio', e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setPhase('INPUTS')}>Back to Inputs</button>
            <button className="btn btn-primary" onClick={runCalculation} disabled={calculating}>
              {calculating ? 'Calculating Engine...' : 'Confirm & Calculate'}
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: RESULTS */}
      {phase === 'RESULTS' && results && interactiveResults && !results.error && (
        <div className="results-container animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(35, 37, 51, 0.4)', padding: '16px 24px', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Retirement Plan Results</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Review and refine your retirement projections</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={resetPlanner}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Start Over
              </button>
              <button className="btn btn-secondary" onClick={() => setPhase('INPUTS')}>
                Edit Assumptions
              </button>
              
              <button 
                className={`btn ${(!isSaved || isInlineEditing) ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  if (!isSaved || isInlineEditing) {
                    savePlan();
                    setIsInlineEditing(false);
                  } else {
                    setIsInlineEditing(true);
                    setIsSaved(false);
                  }
                }}
              >
                {(!isSaved || isInlineEditing) ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Save Plan
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    Edit Plan
                  </>
                )}
              </button>

              {isSaved && !isInlineEditing && (
                <button 
                  className="btn btn-primary"
                  onClick={syncToFundManagement}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', borderColor: '#10B981', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-3.32 3.32"/></svg>
                  Sync to Fund Management
                </button>
              )}
            </div>
          </div>

          {interactiveResults.toast && (
            <div style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: interactiveResults.toast.type === 'error' ? 'var(--danger)' : 'var(--warning)',
              color: '#fff',
              padding: '16px 24px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 9999,
              fontWeight: 600,
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'slide-up 0.3s ease-out reverse' // Actually slide down effect
            }}>
              {interactiveResults.toast.message}
            </div>
          )}

          {selectedMode === 'MODE1' && (
            <>
              {/* Dashboard Layout for MODE1 */}
              <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'stretch' }}>
                {/* Left Side: Recommendation */}
                <div style={{ flex: '1.5 1 350px', background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Recommended Retirement Investment ({new Date().getFullYear()})
                    </div>
                  </div>
                  <div style={{ fontSize: '42px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '24px' }}>
                    {editingField === 'SIP' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{fontSize: '32px'}}>₹</span>
                          <input 
                            type="number" 
                            autoFocus
                            value={customValues.SIP}
                            onChange={(e) => setCustomValues({...customValues, SIP: e.target.value})}
                            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-primary)', borderRadius: '8px', color: 'white', fontSize: '32px', width: '200px', padding: '4px 12px' }}
                          />
                          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => { 
                            setResults(interactiveResults); 
                            setInputs(prev => ({...prev, retirementAge: Number(inputs.currentAge) + interactiveResults.Y}));
                            setEditingField(null); 
                            setIsSaved(false);
                          }}>Save</button>
                        </div>
                        {customValues.SIP && <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '40px', fontWeight: 500, letterSpacing: 'normal' }}>{numberToIndianWords(customValues.SIP)}</div>}
                      </div>
                    ) : (
                      <>
                        ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(interactiveResults.startingSIP)} 
                        <span style={{fontSize: '20px', fontWeight: 500, color: 'var(--text-muted)'}}>/ month</span>
                        {isInlineEditing && (
                           <button onClick={() => { setEditingField('SIP'); setCustomValues({...customValues, SIP: interactiveResults.startingSIP}); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginLeft: '12px', fontSize: '20px', padding: '4px', verticalAlign: 'middle' }} title="Edit">
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                           </button>
                        )}
                      </>
                    )}
                  </div>

                  {interactiveResults.surplusShortfall !== undefined && editingField !== 'SIP' && (
                     <div style={{ fontSize: '14px', color: interactiveResults.surplusShortfall >= 0 ? 'var(--success)' : 'var(--danger)', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <strong>Projected Retirement Corpus:</strong> ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(interactiveResults.projectedCorpus)}
                        <br/>
                        ({interactiveResults.surplusShortfall >= 0 ? 'Surplus' : 'Shortfall'} against Target: ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(interactiveResults.surplusShortfall))})
                     </div>
                  )}
                  
                  {interactiveResults.sipPercentageOfIncome > 0 && (
                    <div style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '16px', lineHeight: '1.5' }}>
                      Invest <strong style={{color: 'var(--accent-primary)'}}>{interactiveResults.sipPercentageOfIncome.toFixed(1)}%</strong> of your current monthly income to stay on track for your retirement goal.
                    </div>
                  )}
                  
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                    As your salary grows by an estimated <strong>{assumptions.salaryIncreaseRate}%</strong> annually, increase your monthly retirement investment by the same percentage. This helps maintain a consistent {interactiveResults.sipPercentageOfIncome > 0 ? interactiveResults.sipPercentageOfIncome.toFixed(1) : 'steady'}% savings rate and keeps you on track to achieve your retirement corpus.
                  </div>



                  {/* Projection Modal Buttons */}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button className="btn btn-primary" style={{ width: '100%', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', border: '1px dashed var(--accent-primary)', padding: '12px' }} onClick={() => setActiveModal('INVESTMENT')}>
                      View Year-by-Year Investment Projection
                    </button>
                    <button className="btn btn-primary" style={{ width: '100%', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px dashed var(--success)', padding: '12px' }} onClick={() => setActiveModal('CORPUS')}>
                      View Year-by-Year Corpus Growth
                    </button>
                  </div>
                </div>

                {/* Right Side: Key Metrics Stack */}
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Card 1: Annual Expense */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Annual Expense at Retirement</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {editingField === 'EXPENSE' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <input 
                               type="number" 
                               autoFocus
                               value={customValues.EXPENSE}
                               onChange={(e) => setCustomValues({...customValues, EXPENSE: e.target.value})}
                               style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-primary)', borderRadius: '4px', color: 'white', fontSize: '18px', width: '100%', padding: '4px 8px' }}
                             />
                             <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => { 
                               setResults(interactiveResults); 
                               setInputs(prev => ({...prev, retirementAge: Number(inputs.currentAge) + interactiveResults.Y}));
                               setEditingField(null); 
                               setIsSaved(false);
                             }}>Save</button>
                          </div>
                          {customValues.EXPENSE && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 'normal' }}>{numberToIndianWords(customValues.EXPENSE)}</div>}
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(interactiveResults.A_future)}
                            {isInlineEditing && (
                               <button onClick={() => { setEditingField('EXPENSE'); setCustomValues({...customValues, EXPENSE: interactiveResults.A_future}); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginLeft: '8px', fontSize: '14px', display: 'flex', alignItems: 'center' }} title="Edit">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                               </button>
                            )}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>{numberToIndianWords(interactiveResults.A_future)}</div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Card 2: Target Corpus */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Safe Retirement Corpus</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      {editingField === 'TC' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <input 
                               type="number" 
                               autoFocus
                               value={customValues.TC}
                               onChange={(e) => setCustomValues({...customValues, TC: e.target.value})}
                               style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-primary)', borderRadius: '4px', color: 'white', fontSize: '18px', width: '100%', padding: '4px 8px' }}
                             />
                             <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => { 
                               setResults(interactiveResults); 
                               setInputs(prev => ({...prev, retirementAge: Number(inputs.currentAge) + interactiveResults.Y}));
                               setEditingField(null); 
                               setIsSaved(false);
                             }}>Save</button>
                          </div>
                          {customValues.TC && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 'normal' }}>{numberToIndianWords(customValues.TC)}</div>}
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(interactiveResults.TC)}
                            {isInlineEditing && (
                               <button onClick={() => { setEditingField('TC'); setCustomValues({...customValues, TC: interactiveResults.TC}); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginLeft: '8px', fontSize: '14px', display: 'flex', alignItems: 'center' }} title="Edit">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                               </button>
                            )}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>{numberToIndianWords(interactiveResults.TC)}</div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Card 2.5: Target Retirement Age */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Target Retirement Age</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {editingField === 'AGE' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <input 
                             type="number" 
                             autoFocus
                             value={customValues.AGE}
                             onChange={(e) => setCustomValues({...customValues, AGE: e.target.value})}
                             style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-primary)', borderRadius: '4px', color: 'white', fontSize: '18px', width: '80px', padding: '4px 8px' }}
                           />
                           <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => {
                             setResults(interactiveResults);
                             setInputs(prev => ({...prev, retirementAge: customValues.AGE}));
                             setEditingField(null);
                             setIsSaved(false);
                           }}>Save</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                             {Number(inputs.currentAge) + interactiveResults.Y} Years
                             {isInlineEditing && (
                                <button onClick={() => { setEditingField('AGE'); setCustomValues({...customValues, AGE: Number(inputs.currentAge) + interactiveResults.Y}); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginLeft: '8px', fontSize: '14px', display: 'flex', alignItems: 'center' }} title="Edit">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </button>
                             )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Removed Card 3 and Card 4 per user request */}
                </div>
              </div>

              {/* Lower Section: Details & Graph (UNIFIED FOR ALL MODES) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '32px' }}>
                
                {/* Left Side: Math & Assumptions */}
                <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Calculation Assumptions */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '24px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '16px', margin: 0, color: 'var(--text-primary)' }}>Calculation Assumptions</h3>
                      <button onClick={() => setPhase('ASSUMPTIONS')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>(Edit)</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Inflation Rate</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{assumptions.inflationRate}% p.a.</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Expected Return</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{assumptions.expectedReturn}% p.a.</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Salary Growth</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{assumptions.salaryIncreaseRate}% p.a.</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Lifestyle Ratio</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{assumptions.lifestyleRatio}%</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Withdrawal Rate</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{assumptions.withdrawalRate}%</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '4px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Life Expectancy</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{Number(inputs.retirementAge) + Math.round(100 / (assumptions.withdrawalRate || 4))} Years</div>
                      </div>
                    </div>
                  </div>

                  {/* Math Explanation Section */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', fontSize: '16px' }}>
                      How does the Math work?
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                      To bridge your massive gap, our engine uses two compounding forces over your {interactiveResults.Y}-year timeline:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontSize: '13px' }}>1. The Salary Hike Vector (+{assumptions.salaryIncreaseRate}%)</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          Your monthly investment grows identically with your career. You never feel the pinch because it's proportionally locked to your income.
                        </div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontSize: '13px' }}>2. The Compound Interest Vector ({assumptions.expectedReturn}%)</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          Every deposit generates a {assumptions.expectedReturn}% annual return. Old funds compound while new larger deposits are added.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Graph */}
                <div style={{ flex: '0 0 350px', maxWidth: '350px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>Growth Trajectory</h3>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                      <button 
                        onClick={() => { setGraphType('INVESTMENT'); setSelectedDataPoint(null); }} 
                        style={{ padding: '4px 8px', background: graphType === 'INVESTMENT' ? 'rgba(99,102,241,0.2)' : 'transparent', color: graphType === 'INVESTMENT' ? 'var(--accent-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: '0.2s' }}
                      >
                        Investments
                      </button>
                      <button 
                        onClick={() => { setGraphType('CORPUS'); setSelectedDataPoint(null); }} 
                        style={{ padding: '4px 8px', background: graphType === 'CORPUS' ? 'rgba(16,185,129,0.2)' : 'transparent', color: graphType === 'CORPUS' ? 'var(--success)' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: '0.2s' }}
                      >
                        Total Corpus
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {(() => {
                    const data = [];
                    let tempAccumulated = 0;
                    let tempSIP = interactiveResults.startingSIP;
                    const r_m = (assumptions.expectedReturn / 100) / 12;
                    const s = (assumptions.salaryIncreaseRate || 0) / 100;
                    const currentSavings = inputs.currentSavings || 0;

                    for (let i = 0; i < interactiveResults.Y; i++) {
                      const k = i + 1;
                      if (k > 1) tempSIP = tempSIP * (1 + s);
                      const fvContributions = tempSIP * ((Math.pow(1 + r_m, 12) - 1) / r_m) * (1 + r_m);
                      tempAccumulated = (tempAccumulated * Math.pow(1 + r_m, 12)) + fvContributions;
                      const fvSavings = currentSavings * Math.pow(1 + (assumptions.expectedReturn / 100), k);
                      
                      data.push({
                        year: new Date().getFullYear() + i,
                        age: Number(inputs.currentAge) + i + 1,
                        sip: tempSIP,
                        corpus: tempAccumulated + fvSavings
                      });
                    }
                    
                    const step = Math.max(1, Math.floor(interactiveResults.Y / 8));
                    const displayData = data.filter((_, idx) => idx === 0 || idx === data.length - 1 || idx % step === 0);
                    // Ensure last point is included but not duplicated
                    if (displayData[displayData.length - 1].year !== data[data.length - 1].year) {
                      displayData.push(data[data.length - 1]);
                    }

                    const maxVal = Math.max(...displayData.map(d => graphType === 'INVESTMENT' ? d.sip : d.corpus));
                    const strokeColor = graphType === 'INVESTMENT' ? 'var(--accent-primary)' : 'var(--success)';
                    const yLabel = graphType === 'INVESTMENT' ? 'Monthly Investment (₹)' : 'Total Corpus Growth (₹)';
                    
                    const points = displayData.map((d, i) => {
                      const x = 50 + (i / Math.max(1, displayData.length - 1)) * 250;
                      const y = maxVal > 0 ? 250 - ((graphType === 'INVESTMENT' ? d.sip : d.corpus) / maxVal) * 200 : 250;
                      return { x, y, ...d };
                    });

                    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

                    return (
                      <div style={{ position: 'relative', width: '100%', height: '300px' }}>
                        <svg viewBox="0 0 320 300" style={{ width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
                          {/* Y-Axis Line & Label */}
                          <line x1="40" y1="20" x2="40" y2="270" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                          <text x="-180" y="25" fill="var(--text-muted)" fontSize="10" transform="rotate(-90)" letterSpacing="1">{yLabel}</text>
                          
                          {/* X-Axis Line & Label */}
                          <line x1="40" y1="270" x2="310" y2="270" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                          <text x="175" y="295" fill="var(--text-muted)" fontSize="10" textAnchor="middle" letterSpacing="1">YEARS</text>

                          {/* X-Axis Points */}
                          <text x="50" y="285" fill="var(--text-muted)" fontSize="10" textAnchor="middle">{points[0].year}</text>
                          <text x="300" y="285" fill="var(--text-muted)" fontSize="10" textAnchor="middle">{points[points.length - 1].year}</text>

                          <polyline fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={polylinePoints} />
                          <polygon fill={`url(#grad-${graphType})`} points={`50,270 ${polylinePoints} ${points[points.length-1]?.x},270`} opacity="0.2" />
                          <defs>
                            <linearGradient id={`grad-INVESTMENT`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-primary)" />
                              <stop offset="100%" stopColor="transparent" />
                            </linearGradient>
                            <linearGradient id={`grad-CORPUS`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--success)" />
                              <stop offset="100%" stopColor="transparent" />
                            </linearGradient>
                          </defs>

                          {/* Clickable Data Points */}
                          {points.map((p, i) => (
                            <g key={i} onClick={() => setSelectedDataPoint(p)} style={{ cursor: 'pointer' }}>
                              <circle cx={p.x} cy={p.y} r="4" fill="#1a1a1a" stroke={strokeColor} strokeWidth="2" />
                              {/* Invisible larger circle to make clicking easier */}
                              <circle cx={p.x} cy={p.y} r="15" fill="transparent" />
                            </g>
                          ))}
                        </svg>

                        {/* Interactive Tooltip Overlay */}
                        {selectedDataPoint && (
                          <div className="animate-fade-in" style={{
                            position: 'absolute',
                            top: '0',
                            left: '40px',
                            right: '20px',
                            background: 'rgba(0,0,0,0.85)',
                            border: `1px solid ${strokeColor}`,
                            borderRadius: '8px',
                            padding: '12px',
                            pointerEvents: 'none',
                            backdropFilter: 'blur(4px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            zIndex: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Year {selectedDataPoint.year} (Age {selectedDataPoint.age})</div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: strokeColor }}>
                                ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(graphType === 'INVESTMENT' ? selectedDataPoint.sip : selectedDataPoint.corpus)}
                              </div>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {graphType === 'INVESTMENT' ? '/ month' : 'total'}
                            </div>
                          </div>
                        )}
                        {!selectedDataPoint && (
                          <div style={{ position: 'absolute', top: '10px', left: '0', right: '0', textAlign: 'center', pointerEvents: 'none', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Click on a point to view exact numbers
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  </div>
                </div>
              </div>

            </>
          )}

          {selectedMode === 'MODE_OPTIMIZER' && (
            <div className="optimizer-results" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-xl)', padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Earliest Possible Retirement Age
                </div>
                {results.earliestAge !== -1 ? (
                  <>
                    <div style={{ fontSize: '64px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '16px' }}>
                      {results.earliestAge} <span style={{ fontSize: '24px', color: 'var(--text-muted)' }}>Years</span>
                    </div>
                    <div style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                      By continuing your current SIP of ₹{new Intl.NumberFormat('en-IN').format(results.currentContribution)}/month with step-ups.
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Required Corpus at Age {results.earliestAge}: <strong style={{color: 'var(--text-primary)'}}>₹{formatCurrencyFull(results.targetCorpusAtOptimal)}</strong>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger)', marginTop: '16px' }}>
                    Cannot achieve retirement within 100 years of age with current savings rate.
                  </div>
                )}
              </div>

              {results.scenarios && results.scenarios.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Want to retire even earlier?</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {results.scenarios.map((opt, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', position: 'relative' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retire at {opt.targetAge}</div>
                        
                        {opt.feasible ? (
                          <>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Required Starting SIP</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '4px' }}>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(opt.requiredSIP)}</div>
                            <div style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '8px', fontWeight: 600 }}>
                              (+₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(opt.additionalSIP)}/mo)
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minHeight: '80px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 500, lineHeight: 1.5 }}>
                               SIP required (₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(opt.requiredSIP)}) exceeds your current income.
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '16px', marginTop: '32px', background: 'rgba(239, 163, 68, 0.1)', border: '1px solid rgba(239, 163, 68, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--warning)' }}>
            <strong> Disclaimer:</strong> These figures are approximate estimates following industry-standard calculation models. Market returns are not guaranteed.
          </div>
        </div>
      )}

      {/* PROJECTION MODAL */}
      {activeModal && phase === 'RESULTS' && interactiveResults && !interactiveResults.error && selectedMode === 'MODE1' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ background: '#1a1a1a', padding: '32px', borderRadius: '16px', width: '500px', border: '1px solid #333', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            
            {activeModal === 'INVESTMENT' ? (
              <>
                <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Investment Projection</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
                  Your required monthly investment for each year until retirement. 
                  Because your investment increases along with your salary, the contribution percentage remains exactly the same!
                </p>
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...Array(interactiveResults.Y)].map((_, i) => {
                    const yearSIP = interactiveResults.startingSIP * Math.pow(1 + (assumptions.salaryIncreaseRate || 0) / 100, i);
                    const actualYear = new Date().getFullYear() + i;
                    const age = Number(inputs.currentAge) + i + 1;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{actualYear} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '6px' }}>(Age {age})</span></span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '15px' }}>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(yearSIP)} <span style={{fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)'}}>/ mo</span></div>
                          <div style={{ fontSize: '12px', color: 'var(--accent-primary)', marginTop: '2px', fontWeight: 600 }}>{interactiveResults.sipPercentageOfIncome.toFixed(1)}% of Income</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Corpus Growth</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
                  The cumulative growth of your retirement corpus, combining the compound interest of your existing savings with your new monthly contributions.
                </p>
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(() => {
                    let tempAccumulated = 0;
                    let tempSIP = interactiveResults.startingSIP;
                    const r_m = (assumptions.expectedReturn / 100) / 12;
                    const s = (assumptions.salaryIncreaseRate || 0) / 100;
                    const currentSavings = inputs.currentSavings || 0;
                    
                    return [...Array(interactiveResults.Y)].map((_, i) => {
                      const k = i + 1;
                      if (k > 1) tempSIP = tempSIP * (1 + s);
                      const fvContributions = tempSIP * ((Math.pow(1 + r_m, 12) - 1) / r_m) * (1 + r_m);
                      tempAccumulated = (tempAccumulated * Math.pow(1 + r_m, 12)) + fvContributions;
                      const fvSavings = currentSavings * Math.pow(1 + (assumptions.expectedReturn / 100), k);
                      const totalCorpus = tempAccumulated + fvSavings;
                      
                      const actualYear = new Date().getFullYear() + i;
                      const age = Number(inputs.currentAge) + i + 1;
                      
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{actualYear} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '6px' }}>(Age {age})</span></span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '15px' }}>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(totalCorpus)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>Total Corpus</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
            
            <div style={{ marginTop: '24px', textAlign: 'right', borderTop: '1px solid #333', paddingTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {phase === 'RESULTS' && results && results.error && (
        <div style={{ padding: '24px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)' }}>
          {results.error} <br/>
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={resetPlanner}>Go Back</button>
        </div>
      )}
    </div>
  );
}
