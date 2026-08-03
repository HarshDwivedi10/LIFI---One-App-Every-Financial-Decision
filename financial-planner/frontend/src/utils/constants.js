// ─── Asset Types & Fund Allocation Defaults ──────────────────────────────────

export const ASSET_TYPES = [
  'Savings Account',
  'Cash',
  'Fixed Deposit (FD)',
  'Mutual Funds',
  'Stocks',
  'Gold',
  'EPF',
  'PPF',
  'NPS',
  'Crypto',
  'Custom',
];

export const FUND_TYPES = [
  { id: 'EMERGENCY', label: 'Emergency Fund', badge: 'badge-emergency', color: 'var(--fund-emergency)' },
  { id: 'RETIREMENT', label: 'Retirement Fund', badge: 'badge-retirement', color: 'var(--fund-retirement)' },
  { id: 'SHORT_TERM', label: 'Short-Term Fund', badge: 'badge-short', color: 'var(--fund-short)' },
  { id: 'LONG_TERM', label: 'Long-Term Fund', badge: 'badge-long', color: 'var(--fund-long)' },
  { id: 'WEALTH', label: 'Wealth Creation Fund', badge: 'badge-wealth', color: 'var(--fund-wealth)' },
];

// Default fund allocation per asset type (100% unless split)
export const DEFAULT_FUND_ALLOCATION = {
  'Savings Account': [{ fundType: 'EMERGENCY', percentage: 100 }],
  'Cash':            [{ fundType: 'EMERGENCY', percentage: 100 }],
  'Fixed Deposit (FD)': [{ fundType: 'LONG_TERM', percentage: 100 }],
  'Mutual Funds':    [{ fundType: 'WEALTH', percentage: 100 }],
  'Stocks':          [{ fundType: 'WEALTH', percentage: 100 }],
  'Gold':            [{ fundType: 'WEALTH', percentage: 100 }],
  'EPF':             [{ fundType: 'RETIREMENT', percentage: 100 }],
  'PPF':             [{ fundType: 'RETIREMENT', percentage: 100 }],
  'NPS':             [{ fundType: 'RETIREMENT', percentage: 100 }],
  'Crypto':          [{ fundType: 'WEALTH', percentage: 100 }],
  'Custom':          [{ fundType: 'LONG_TERM', percentage: 100 }],
};

// ─── Transaction Types ────────────────────────────────────────────────────────
export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'DEBIT', 'CREDIT'];

export const TRANSACTION_CATEGORIES = {
  INCOME: ['Salary', 'Freelance', 'Dividend', 'Rental', 'Business', 'Other Income'],
  EXPENSE: ['Food', 'Rent', 'Transport', 'Utilities', 'Entertainment', 'Medical', 'Shopping', 'Education', 'Other'],
  DEBIT: ['ATM Withdrawal', 'Bank Transfer', 'Bill Payment', 'Other Debit'],
  CREDIT: ['Bank Transfer In', 'Refund', 'Cashback', 'Other Credit'],
};

// ─── Liability Types ──────────────────────────────────────────────────────────
export const LIABILITY_TYPES = [
  'Home Loan',
  'Personal Loan',
  'Vehicle Loan',
  'Education Loan',
  'Credit Card Outstanding',
  'Other Loans',
];

// ─── Income Source Types ──────────────────────────────────────────────────────
export const INCOME_TYPES = ['SALARY', 'FREELANCE', 'BUSINESS', 'RENTAL', 'DIVIDEND', 'OTHER'];

// ─── Retirement Modes ─────────────────────────────────────────────────────────
export const RETIREMENT_MODES = {
  MODE1: 'CALCULATE_PLAN',
  MODE_OPTIMIZER: 'OPTIMIZER',
};

// ─── Formatting ──────────────────────────────────────────────────────────────
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCurrencyFull = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '₹0';
  const num = Number(value);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
  return `₹${num.toFixed(0)}`;
};

export const formatNumber = (value) => {
  if (!value) return '0';
  return new Intl.NumberFormat('en-IN').format(value);
};

// ─── Asset default reason ─────────────────────────────────────────────────────
export const DEFAULT_ALLOCATION_REASON = {
  'Savings Account': 'Most liquid source for emergencies.',
  'Cash': 'Immediately available funds.',
  'Fixed Deposit (FD)': 'Generally created for planned future expenses.',
  'Mutual Funds': 'Long-term investment for wealth generation.',
  'Stocks': 'Growth-oriented investments.',
  'Gold': 'Long-term store of value.',
  'EPF': 'Retirement-specific investment.',
  'PPF': 'Retirement-focused savings.',
  'NPS': 'Dedicated retirement corpus.',
  'Crypto': 'High-risk investment asset.',
  'Custom': 'User-defined asset.',
};
