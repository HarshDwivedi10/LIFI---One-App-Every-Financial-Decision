-- ============================================================
--  SEED SCRIPT: Demo User "John Sharma"
--  Simulated using app since May 2026
--  Salary: ₹1,20,000/mo | Expenses: ~₹42,000/mo | Savings: ~₹78,000/mo
--  Salary Day: 10th | Profile: Moderate
--  Password: John@1234  (BCrypt hash below)
-- ============================================================

USE finance_planner;

-- ─── 1. INSERT USER ───────────────────────────────────────────────────────────
-- BCrypt hash for password "John@1234" (same hash as existing test user — valid BCrypt)
-- Login with: john.sharma@lifi.com / John@1234
INSERT INTO users (email, password, name, role, status, salary_day, salary_time, manual_total_savings, fund_allocations_json, created_at)
VALUES (
  'john.sharma@lifi.com',
  '$2a$10$VbNwIlMd7mAlIP14UbS3/OcY0twWuY946jhDLpZelblvxrxmaSAb2',
  'John Sharma',
  'ROLE_USER',
  'ACTIVE',
  10,
  '09:00',
  0,
  '{"core":{"LONG_TERM":25,"SHORT_TERM":15,"EMERGENCY":20,"WEALTH":10},"retirement":30}',
  '2026-05-01 10:00:00'
);

-- Store the new user's ID for use in subsequent inserts
SET @john_id = LAST_INSERT_ID();

-- ─── 2. INCOME SOURCES ────────────────────────────────────────────────────────
INSERT INTO income_sources (user_id, type, amount, description, created_at) VALUES
(@john_id, 'SALARY',    120000, 'Monthly Salary - TechCorp India',   '2026-05-01 10:00:00'),
(@john_id, 'FREELANCE',  18000, 'Freelance Web Consulting',           '2026-05-01 10:00:00');

-- ─── 3. TRANSACTIONS ─────────────────────────────────────────────────────────
-- MAY 2026 (salary credited on 10th)
INSERT INTO transactions (user_id, date, type, category, amount, description, created_at, updated_at) VALUES
-- Income
(@john_id, '2026-05-10', 'CREDIT',  'Salary',        120000, 'Salary credit - May 2026',           NOW(), NOW()),
(@john_id, '2026-05-15', 'CREDIT',  'Freelance',      18000, 'Freelance payment - May',             NOW(), NOW()),
-- Expenses
(@john_id, '2026-05-05', 'EXPENSE', 'Rent',           28000, 'Monthly Rent - May',                  NOW(), NOW()),
(@john_id, '2026-05-12', 'EXPENSE', 'Groceries',       7500, 'Big Basket & local market',           NOW(), NOW()),
(@john_id, '2026-05-14', 'EXPENSE', 'Utilities',       3200, 'Electricity + Internet',              NOW(), NOW()),
(@john_id, '2026-05-16', 'EXPENSE', 'Transport',       3800, 'Fuel + Metro recharge',               NOW(), NOW()),
(@john_id, '2026-05-20', 'EXPENSE', 'Dining',          4500, 'Restaurants & Zomato',                NOW(), NOW()),
(@john_id, '2026-05-22', 'EXPENSE', 'Health',          2200, 'Pharmacy + gym',                      NOW(), NOW()),
(@john_id, '2026-05-28', 'EXPENSE', 'Shopping',        4800, 'Amazon & Flipkart',                   NOW(), NOW()),
-- Automated Savings Deposit (10th May)
(@john_id, '2026-05-10', 'EXPENSE', 'Savings',        78000, 'Automated Savings Deposit',           NOW(), NOW()),

-- JUNE 2026
(@john_id, '2026-06-10', 'CREDIT',  'Salary',        120000, 'Salary credit - June 2026',          NOW(), NOW()),
(@john_id, '2026-06-14', 'CREDIT',  'Freelance',      18000, 'Freelance payment - June',            NOW(), NOW()),
(@john_id, '2026-06-05', 'EXPENSE', 'Rent',           28000, 'Monthly Rent - June',                 NOW(), NOW()),
(@john_id, '2026-06-11', 'EXPENSE', 'Groceries',       7800, 'Monthly groceries - June',            NOW(), NOW()),
(@john_id, '2026-06-13', 'EXPENSE', 'Utilities',       3100, 'Electricity + Internet - June',       NOW(), NOW()),
(@john_id, '2026-06-17', 'EXPENSE', 'Transport',       3600, 'Fuel + cab rides - June',             NOW(), NOW()),
(@john_id, '2026-06-21', 'EXPENSE', 'Dining',          5200, 'Restaurants & Swiggy - June',         NOW(), NOW()),
(@john_id, '2026-06-24', 'EXPENSE', 'Health',          1800, 'Doctor consultation',                 NOW(), NOW()),
(@john_id, '2026-06-27', 'EXPENSE', 'Entertainment',   2800, 'OTT subscriptions + movie tickets',   NOW(), NOW()),
(@john_id, '2026-06-10', 'EXPENSE', 'Savings',        80000, 'Automated Savings Deposit',           NOW(), NOW()),

-- JULY 2026
(@john_id, '2026-07-10', 'CREDIT',  'Salary',        120000, 'Salary credit - July 2026',          NOW(), NOW()),
(@john_id, '2026-07-13', 'CREDIT',  'Freelance',      22000, 'Freelance payment - July (bonus)',    NOW(), NOW()),
(@john_id, '2026-07-05', 'EXPENSE', 'Rent',           28000, 'Monthly Rent - July',                 NOW(), NOW()),
(@john_id, '2026-07-12', 'EXPENSE', 'Groceries',       8200, 'Monthly groceries - July',            NOW(), NOW()),
(@john_id, '2026-07-14', 'EXPENSE', 'Utilities',       3500, 'Electricity (higher AC usage) + Net', NOW(), NOW()),
(@john_id, '2026-07-16', 'EXPENSE', 'Transport',       4200, 'Fuel + cab rides - July',             NOW(), NOW()),
(@john_id, '2026-07-19', 'EXPENSE', 'Dining',          4900, 'Restaurants & Swiggy - July',         NOW(), NOW()),
(@john_id, '2026-07-23', 'EXPENSE', 'Health',          3500, 'Annual health checkup',               NOW(), NOW()),
(@john_id, '2026-07-28', 'EXPENSE', 'Shopping',        5500, 'New watch + clothes',                 NOW(), NOW()),
(@john_id, '2026-07-10', 'EXPENSE', 'Savings',        82000, 'Automated Savings Deposit',           NOW(), NOW());

-- ─── 3.1 FIXED EXPENSES (Templates for new automation) ─────────
INSERT INTO fixed_expenses (user_id, category, amount, description, created_at) VALUES
(@john_id, 'Rent',      28000, 'Monthly Rent',      NOW()),
(@john_id, 'Utilities',  3500, 'Electricity + Net', NOW()),
(@john_id, 'Health',     2000, 'Gym Membership',    NOW());


-- ─── 4. ASSETS (Fund Corpus Buckets — 3 months accumulated) ─────────────────
-- Moderate profile: RETIREMENT 30%, LONG_TERM 25%, SHORT_TERM 15%, EMERGENCY 20%, WEALTH 10%
-- Total deposited: ₹78k + ₹80k + ₹82k = ₹2,40,000

-- RETIREMENT: 30% → ₹72,000
INSERT INTO assets (user_id, name, asset_type, current_value, fund_allocations, created_at, updated_at) VALUES
(@john_id, 'Retirement Corpus', 'RETIREMENT', 72000, '[{"fundType":"RETIREMENT","percentage":100}]', '2026-05-10 10:00:00', NOW());

-- LONG_TERM: 25% → ₹60,000
INSERT INTO assets (user_id, name, asset_type, current_value, fund_allocations, created_at, updated_at) VALUES
(@john_id, 'Long-Term Goal Corpus', 'LONG_TERM', 60000, '[{"fundType":"LONG_TERM","percentage":100}]', '2026-05-10 10:00:00', NOW());

-- SHORT_TERM: 15% → ₹36,000
INSERT INTO assets (user_id, name, asset_type, current_value, fund_allocations, created_at, updated_at) VALUES
(@john_id, 'Short-Term Goal Corpus', 'SHORT_TERM', 36000, '[{"fundType":"SHORT_TERM","percentage":100}]', '2026-05-10 10:00:00', NOW());

-- EMERGENCY: 20% → ₹48,000
INSERT INTO assets (user_id, name, asset_type, current_value, fund_allocations, created_at, updated_at) VALUES
(@john_id, 'Emergency & Protection Corpus', 'EMERGENCY', 48000, '[{"fundType":"EMERGENCY","percentage":100}]', '2026-05-10 10:00:00', NOW());

-- WEALTH: 10% → ₹24,000
INSERT INTO assets (user_id, name, asset_type, current_value, fund_allocations, created_at, updated_at) VALUES
(@john_id, 'Wealth Creation Corpus', 'WEALTH', 24000, '[{"fundType":"WEALTH","percentage":100}]', '2026-05-10 10:00:00', NOW());

-- ─── 5. RETIREMENT PLAN ───────────────────────────────────────────────────────
INSERT INTO retirement_plans (
  user_id, mode, current_age, retirement_age,
  current_retirement_savings, monthly_income,
  inflation_rate, expected_return, withdrawal_rate, lifestyle_ratio, salary_increase_rate,
  current_monthly_expense, current_monthly_contribution,
  result_json, created_at, updated_at
)
VALUES (
  @john_id,
  'MODE1',
  31,
  60,
  72000,
  138000,
  6.0,
  12.0,
  4.0,
  0.8,
  8.0,
  42000,
  36000,
  '{"corpusRequired":38500000,"yearsToRetirement":29,"projectedCorpus":42100000,"monthlyContributionNeeded":33200,"onTrack":true,"surplusDeficit":3600000}',
  '2026-05-15 11:00:00',
  '2026-05-15 11:00:00'
);

-- ─── 6. GOALS (2 per fund = 10 goals) ────────────────────────────────────────

-- RETIREMENT GOALS
INSERT INTO goals (user_id, name, cost, category, target_date, monthly_allocation, is_delayed, acknowledged, priority) VALUES
(@john_id, 'Retirement Nest Egg',   35000000, 'RETIREMENT', '2055-06-01', 36000, false, true, 'HIGH'),
(@john_id, 'Post-Retirement Travel', 2000000, 'RETIREMENT', '2057-01-01',  4000, false, true, 'MEDIUM');

-- LONG_TERM GOALS
INSERT INTO goals (user_id, name, cost, category, target_date, monthly_allocation, is_delayed, acknowledged, priority) VALUES
(@john_id, 'Buy a House in Pune',  6500000, 'LONG_TERM', '2032-06-01', 32000, false, true, 'HIGH'),
(@john_id, 'Buy a Car (SUV)',      1800000, 'LONG_TERM', '2029-01-01', 14000, false, true, 'MEDIUM');

-- SHORT_TERM GOALS
INSERT INTO goals (user_id, name, cost, category, target_date, monthly_allocation, is_delayed, acknowledged, priority) VALUES
(@john_id, 'Europe Vacation 2027',  350000, 'SHORT_TERM', '2027-06-01', 18000, false, true, 'HIGH'),
(@john_id, 'Gaming PC & Setup',     120000, 'SHORT_TERM', '2026-12-01',  9000, false, true, 'LOW');

-- EMERGENCY GOALS
INSERT INTO goals (user_id, name, cost, category, target_date, monthly_allocation, is_delayed, acknowledged, priority) VALUES
(@john_id, '6-Month Emergency Fund',  750000, 'EMERGENCY', '2027-05-01', 20000, false, true, 'HIGH'),
(@john_id, 'Health & Insurance Buffer', 300000, 'EMERGENCY', '2027-01-01',  8000, false, true, 'HIGH');

-- WEALTH GOALS
INSERT INTO goals (user_id, name, cost, category, target_date, monthly_allocation, is_delayed, acknowledged, priority) VALUES
(@john_id, 'Build Stock Portfolio', 1000000, 'WEALTH', '2030-01-01', 8000, false, true, 'MEDIUM'),
(@john_id, 'Sovereign Gold Bond',    500000, 'WEALTH', '2029-06-01', 4000, false, true, 'LOW');

-- ─── DONE ─────────────────────────────────────────────────────────────────────
SELECT CONCAT('✅ John Sharma seeded successfully! User ID = ', @john_id) AS result;
