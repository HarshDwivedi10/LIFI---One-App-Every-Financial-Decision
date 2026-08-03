import React, { useEffect, useState, useMemo, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './DashboardPage.css';
import SnapshotCard from './SnapshotCard';
import HealthScoreRing from './HealthScoreRing';
import GoalProgressCard from './GoalProgressCard';
import RetirementSummaryCard from './RetirementSummaryCard';
import FinancialCoachCard from './FinancialCoachCard';
import BankStatementSummaryCard from './BankStatementSummaryCard';
import ChartWrapper from './ChartWrapper';
import ChatBox from '../../components/Chat/ChatBox';
import { useNotifications } from '../../context/NotificationContext';

// Lazy loaded charts
const SavingsGrowthChart = lazy(() => import('./SavingsGrowthChart'));
const ExpenseChart = lazy(() => import('./ExpenseChart'));
const FundAllocationChart = lazy(() => import('./FundAllocationChart'));

/* ─── Helpers ──────────────────────────────────────────── */
const fmt = (n) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(1)}Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}k`
    : `₹${Math.round(n)}`;

const MOTIVATIONAL = [
  'Small steps today create financial freedom tomorrow.',
  'Every rupee saved is a rupee working for your future.',
  'Consistency beats perfection in wealth building.',
  'Your future self will thank you for saving today.',
  'Financial health is built one smart decision at a time.',
];

function getMotivational() {
  return MOTIVATIONAL[new Date().getDate() % MOTIVATIONAL.length];
}

function buildMonthlyTrend(transactions) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleString('default', { month: 'short' }),
      savings: 0,
      expenses: 0,
    });
  }

  transactions.forEach((t) => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find((m) => m.key === key);
    if (!m) return;
    if (t.type === 'EXPENSE' || t.type === 'DEBIT') m.expenses += parseFloat(t.amount || 0);
  });

  return months;
}

/* ─── MOCK data for when backend returns nothing ──────── */
const MOCK_SAVINGS_DATA = [
  { month: 'Feb', savings: 18000 },
  { month: 'Mar', savings: 22000 },
  { month: 'Apr', savings: 19500 },
  { month: 'May', savings: 27000 },
  { month: 'Jun', savings: 24000 },
  { month: 'Jul', savings: 30000 },
];

const MOCK_EXPENSE_DATA = [
  { month: 'Feb', expenses: 32000 },
  { month: 'Mar', expenses: 28500 },
  { month: 'Apr', expenses: 35000 },
  { month: 'May', expenses: 29000 },
  { month: 'Jun', expenses: 33000 },
  { month: 'Jul', expenses: 25000 },
];

const MOCK_FUND_DATA = [
  { name: 'Retirement', value: 35 },
  { name: 'Emergency', value: 15 },
  { name: 'Travel', value: 15 },
  { name: 'Education', value: 20 },
  { name: 'Investment', value: 15 },
];

/* ─── Notification helpers ────────────────────────────── */
function buildNotifications(goals, retirementPlan, savingsRatio) {
  const notes = [];

  if (retirementPlan) {
    notes.push({
      type: 'info',
      text: `Retirement plan active — targeting age ${retirementPlan.retirementAge}.`,
      time: 'Just now',
    });
  }

  const nearGoal = goals.find((g) => {
    const months = (new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24 * 30);
    return months > 0 && months < 3;
  });
  if (nearGoal) {
    notes.push({
      type: 'success',
      text: `Goal "${nearGoal.name}" is nearing its target date!`,
      time: '1 day ago',
    });
  }

  const delayedGoal = goals.find((g) => g.isDelayed && !g.acknowledged);
  if (delayedGoal) {
    notes.push({
      type: 'warning',
      text: `Goal "${delayedGoal.name}" has been delayed due to savings shortfall.`,
      time: 'Recently',
    });
  }

  if (savingsRatio < 0.1) {
    notes.push({
      type: 'danger',
      text: 'Monthly savings are below 10% of income. Review your expenses.',
      time: 'This month',
    });
  }

  if (notes.length === 0) {
    notes.push({
      type: 'success',
      text: 'All systems green! Your finances are on track.',
      time: 'Now',
    });
  }

  return notes;
}

/* ─── ICONS ──────────────────────────────────────────── */
export const Icons = {
  savings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  monthly: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  ),
  goals: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  retirement: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" /><path d="m17 5-5-3-5 3" /><path d="m17 19-5 3-5-3" /><path d="M2 12h20" />
    </svg>
  ),
  emergency: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  health: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setNotifications } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [retirementPlan, setRetirementPlan] = useState(null);
  const [assets, setAssets] = useState([]);
  const [fundAllocations, setFundAllocations] = useState([]);
  
  // New mock states for Coach and Bank Statement
  const [coach, setCoach] = useState(null);
  const [statementData, setStatementData] = useState(null);

  // Modal states
  const [showChatModal, setShowChatModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  /* ─── Fetch all data ──────────────────────────────── */
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [incomeRes, txnRes, goalsRes, retirementRes, assetsRes] = await Promise.all([
          api.get('/income').catch(() => ({ data: [] })),
          api.get('/transactions').catch(() => ({ data: [] })),
          api.get('/goals').catch(() => ({ data: [] })),
          api.get('/retirement/plan').catch(() => ({ data: null })),
          api.get('/assets').catch(() => ({ data: [] })),
        ]);

        if (isMounted) {
          setIncome(incomeRes?.data || []);
          setTransactions(txnRes?.data || []);
          setGoals(goalsRes?.data || []);
          setRetirementPlan(retirementRes?.data || null);
          setAssets(assetsRes?.data || []);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        if (isMounted) {
          // Build fund allocations from localStorage (same source as GoalManagement)
          const allFundsStr = localStorage.getItem('all_funds_allocations');
          if (allFundsStr) {
            try {
              const parsed = JSON.parse(allFundsStr);
              setFundAllocations(
                parsed.map((f) => ({ name: f.name.replace(' Corpus', ''), value: parseFloat(f.percent) || 0 }))
                  .filter((f) => f.value > 0)
              );
            } catch {
              setFundAllocations(MOCK_FUND_DATA);
            }
          } else {
            setFundAllocations(MOCK_FUND_DATA);
          }

          // Set coach based on user assignment
          if (user?.assignedCoachName) {
            setCoach({ name: user.assignedCoachName, specialization: 'Tax & Wealth Management', photo: '' });
          } else {
            setCoach(null);
          }
          setStatementData({ lastUploaded: Date.now() - 432000000, avgSavings: 45000, totalIncome: 120000, totalExpenses: 75000 });
          setLoading(false);
        }
      }
    };
    fetchAll();
    return () => { isMounted = false; };
  }, []);

  /* ─── Derived metrics ─────────────────────────────── */
  const totalMonthlyIncome = useMemo(
    () => income.reduce((s, i) => s + parseFloat(i.amount || 0), 0),
    [income]
  );

  const { currentMonthExpenses, currentMonthSavings } = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();
    const exp = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === cm && d.getFullYear() === cy && (t.type === 'EXPENSE' || t.type === 'DEBIT');
      })
      .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    return { currentMonthExpenses: exp, currentMonthSavings: Math.max(0, totalMonthlyIncome - exp) };
  }, [transactions, totalMonthlyIncome]);

  const totalAssetValue = useMemo(
    () => assets.reduce((s, a) => s + parseFloat(a.currentValue || 0), 0),
    [assets]
  );

  const emergencyFundBalance = useMemo(() => {
    const emergency = assets.filter(
      (a) => a.fundAllocations && a.fundAllocations.toLowerCase().includes('emergency')
    );
    return emergency.reduce((s, a) => s + parseFloat(a.currentValue || 0), 0);
  }, [assets]);

  const retirementProgress = useMemo(() => {
    if (!retirementPlan) return 0;
    try {
      const result = retirementPlan.resultJson ? JSON.parse(retirementPlan.resultJson) : {};
      const corpus = result.requiredCorpus || 1;
      const current = retirementPlan.currentRetirementSavings || 0;
      return Math.min(100, Math.round((current / corpus) * 100));
    } catch {
      return 0;
    }
  }, [retirementPlan]);

  const healthScore = useMemo(() => {
    let score = 0;
    const savingsRatio = totalMonthlyIncome > 0 ? currentMonthSavings / totalMonthlyIncome : 0;
    if (savingsRatio >= 0.3) score += 30;
    else if (savingsRatio >= 0.2) score += 22;
    else if (savingsRatio >= 0.1) score += 12;

    if (goals.length > 0) score += 15;
    if (goals.length >= 3) score += 10;

    if (retirementPlan) score += 20;
    if (retirementProgress >= 50) score += 10;

    if (emergencyFundBalance >= totalMonthlyIncome * 3) score += 15;
    else if (emergencyFundBalance > 0) score += 7;

    return Math.min(100, score);
  }, [totalMonthlyIncome, currentMonthSavings, goals, retirementPlan, retirementProgress, emergencyFundBalance]);

  const savingsRatio = totalMonthlyIncome > 0 ? currentMonthSavings / totalMonthlyIncome : 0;
  const notifications = useMemo(
    () => buildNotifications(goals, retirementPlan, savingsRatio),
    [goals, retirementPlan, savingsRatio]
  );

  useEffect(() => {
    setNotifications(notifications);
  }, [notifications, setNotifications]);

  /* ─── Chart data ──────────────────────────────────── */
  const monthlyTrend = useMemo(() => buildMonthlyTrend(transactions), [transactions]);

  const savingsChartData = monthlyTrend.some((m) => m.savings > 0 || m.expenses > 0)
    ? monthlyTrend.map((m) => ({ month: m.month, savings: m.savings }))
    : MOCK_SAVINGS_DATA;

  const expenseChartData = monthlyTrend.some((m) => m.expenses > 0)
    ? monthlyTrend.map((m) => ({ month: m.month, expenses: m.expenses }))
    : MOCK_EXPENSE_DATA;

  /* ─── Quick Actions ────────────────────────────────── */
  const quickActions = [
    { label: 'Add Goal', icon: '🎯', path: '/goal-management' },
    { label: 'Add Fund', icon: '💼', path: '/fund-management' },
    { label: 'Upload Statement', icon: '📄', path: '/expense-management' },
    { label: 'AI Simulation', icon: '🤖', path: '/goal-management' },
    { label: 'Update Income', icon: '💰', path: '/expense-management' },
    { label: 'Retirement', icon: '🏖️', path: '/retirement-planner' },
  ];

  /* ─── Render ──────────────────────────────────────── */
  return (
    <div className="dashboard-page">

      {/* ── Top: Welcome Header ──────────────────────── */}
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <div className="sub-date">{today}</div>
          <h1>
            Welcome back, <span className="name-highlight">{firstName}</span> 👋
          </h1>
          <div className="motivational-msg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {getMotivational()}
          </div>
        </div>

        {/* Health score badge in header for quick view */}
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 20px',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                Financial Health
              </div>
              <div
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 900,
                  color: healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? 'var(--accent-secondary)' : healthScore >= 40 ? 'var(--warning)' : 'var(--danger)',
                }}
              >
                {healthScore}/100
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="section-card-header" style={{ marginBottom: '0.75rem' }}>
          <div className="section-card-title">
            <div className="title-icon" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
            </div>
            Quick Actions
          </div>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="quick-action-btn"
              onClick={() => navigate(action.path)}
              id={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="quick-action-icon">{action.icon}</div>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 1: Financial Snapshot Cards ────────────── */}
      <div className="snapshot-grid">
        <SnapshotCard
          loading={loading}
          icon={Icons.savings}
          title="Total Savings"
          value={fmt(totalAssetValue)}
          trend={totalAssetValue > 0 ? 'Total asset value' : 'No assets recorded'}
          trendDirection="neutral"
          accentColor="#10b981"
          iconBg="rgba(16,185,129,0.12)"
          topBar="linear-gradient(135deg, #10b981, #34d399)"
        />
        <SnapshotCard
          loading={loading}
          icon={Icons.monthly}
          title="Monthly Savings"
          value={fmt(currentMonthSavings)}
          trend={`${Math.round(savingsRatio * 100)}% of income`}
          trendDirection={savingsRatio >= 0.2 ? 'up' : savingsRatio >= 0.1 ? 'neutral' : 'down'}
          accentColor="#6366f1"
          iconBg="rgba(99,102,241,0.12)"
          topBar="linear-gradient(135deg, #6366f1, #818cf8)"
        />
        <SnapshotCard
          loading={loading}
          icon={Icons.goals}
          title="Active Goals"
          value={goals.length.toString()}
          trend={goals.filter((g) => g.isDelayed && !g.acknowledged).length > 0 ? `${goals.filter((g) => g.isDelayed && !g.acknowledged).length} delayed` : 'All on track'}
          trendDirection={goals.filter((g) => g.isDelayed && !g.acknowledged).length > 0 ? 'down' : 'up'}
          accentColor="#3b82f6"
          iconBg="rgba(59,130,246,0.12)"
          topBar="linear-gradient(135deg, #3b82f6, #60a5fa)"
        />
        <SnapshotCard
          loading={loading}
          icon={Icons.retirement}
          title="Retirement Progress"
          value={retirementPlan ? `${retirementProgress}%` : 'Not set'}
          trend={retirementPlan ? `Retire at ${retirementPlan.retirementAge}` : 'Set up a plan'}
          trendDirection={retirementProgress >= 50 ? 'up' : 'neutral'}
          accentColor="#f59e0b"
          iconBg="rgba(245,158,11,0.12)"
          topBar="linear-gradient(135deg, #f59e0b, #fcd34d)"
        />
        <SnapshotCard
          loading={loading}
          icon={Icons.emergency}
          title="Emergency Fund"
          value={fmt(emergencyFundBalance)}
          trend={emergencyFundBalance >= totalMonthlyIncome * 3 ? '3+ months covered' : 'Build to 3 months'}
          trendDirection={emergencyFundBalance >= totalMonthlyIncome * 3 ? 'up' : 'down'}
          accentColor="#ef4444"
          iconBg="rgba(239,68,68,0.12)"
          topBar="linear-gradient(135deg, #ef4444, #f87171)"
        />
        <SnapshotCard
          loading={loading}
          icon={Icons.health}
          title="Health Score"
          value={`${healthScore}/100`}
          trend={healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs work'}
          trendDirection={healthScore >= 60 ? 'up' : 'down'}
          accentColor="#8b5cf6"
          iconBg="rgba(139,92,246,0.12)"
          topBar="linear-gradient(135deg, #8b5cf6, #a78bfa)"
        />
      </div>

      {/* ── Row 2: Savings Chart & Expense Chart ──────── */}
      <div className="dashboard-main-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ChartWrapper
          title="Savings Growth"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
          headerRight={<span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Last 6 months</span>}
          loading={loading}
        >
          <SavingsGrowthChart data={savingsChartData} loading={loading} />
        </ChartWrapper>

        <ChartWrapper
          title="Monthly Expenses"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>}
          iconBg="rgba(245,158,11,0.12)"
          iconColor="var(--warning)"
          headerRight={<span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Last 6 months</span>}
          loading={loading}
        >
          <ExpenseChart data={expenseChartData} loading={loading} />
        </ChartWrapper>
      </div>

      {/* ── Row 3: Fund Allocation & Health Score ──────── */}
      <div className="dashboard-main-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ChartWrapper
          title="Fund Allocation"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>}
          iconBg="rgba(16,185,129,0.12)"
          iconColor="var(--success)"
          loading={loading}
        >
          <FundAllocationChart data={fundAllocations} loading={loading} />
        </ChartWrapper>

        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <div className="title-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              Financial Health
            </div>
          </div>
          <HealthScoreRing score={healthScore} loading={loading} />
        </div>
      </div>

      {/* ── Row 4: Goal Progress & Retirement Summary ──────── */}
      <div className="dashboard-main-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', marginBottom: 'var(--space-lg)' }}>
        <GoalProgressCard goals={goals} loading={loading} />
        <RetirementSummaryCard retirementPlan={retirementPlan} loading={loading} />
      </div>

      {/* ── Row 6: Bank Statement Summary & Financial Coach ──────── */}
      <div className="dashboard-main-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        <BankStatementSummaryCard loading={loading} statementData={statementData} />
        <FinancialCoachCard 
          loading={loading} 
          coach={coach} 
          onChatClick={() => setShowChatModal(true)}
          onProfileClick={() => setShowProfileModal(true)}
        />
      </div>

      {/* Chat Modal */}
      {showChatModal && coach && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem'
          }}
          onClick={() => setShowChatModal(false)}
        >
          <div style={{ width: '100%', maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <ChatBox
              partner={{ id: user.assignedCoachId, name: coach.name, role: 'ROLE_COACH' }}
              onClose={() => setShowChatModal(false)}
            />
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && coach && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem'
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', background: 'var(--border-subtle)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', margin: '0 auto 1rem'
            }}>
              {coach.photo ? (
                <img src={coach.photo} alt={coach.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>{coach.name}</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{coach.specialization || 'Wealth Management'}</p>
            <div style={{ textAlign: 'left', background: 'var(--bg-body)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}><strong>Role:</strong> Personal Financial Coach</p>
              <p style={{ margin: '0', fontSize: '0.875rem' }}><strong>Email:</strong> contact@{coach.name.toLowerCase().replace(/\s+/g, '')}.coach</p>
            </div>
            <button className="primary-btn" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => setShowProfileModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
