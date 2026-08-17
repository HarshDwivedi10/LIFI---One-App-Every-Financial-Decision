/*
================================================================================
  LI.FI FINANCIAL PLANNER — BACKEND DOCUMENTATION
  Detailed Notes for Interview Preparation (Part 1 of 2)
  Tech Stack: Spring Boot 3, Spring Security, JWT, Spring Data JPA,
              Hibernate, WebSockets (STOMP), JavaMail, Razorpay SDK
================================================================================


========================================================================
SECTION 1: PROJECT ARCHITECTURE
========================================================================

The backend is a standalone Spring Boot 3 REST API that communicates with the
React frontend exclusively via HTTP REST endpoints and WebSocket STOMP subscriptions.
Spring Security enforces stateless JWT authentication on every protected route.
The application uses Hibernate ORM with a relational MySQL/PostgreSQL database,
where all entities are mapped via JPA annotations and all database access is
done through Spring Data JPA repositories. The project is structured in layers:
Controller → Service → Repository → Database (Entity), ensuring clean separation
of concerns and making each layer independently testable.


========================================================================
SECTION 2: DATABASE TABLES & REPOSITORIES (14 Tables / 14 Repositories)
========================================================================

--------- 1. UserRepository (Table: users) ---------
The `users` table is the central entity of the entire application and stores all
user account details — both regular users (ROLE_USER) and financial coaches (ROLE_COACH).
It holds authentication data including the bcrypt-hashed password, unique email,
full name, phone number, and role enum. Additionally it stores financial profile
settings like `salaryDay`, `salaryTime`, `manualTotalSavings`,
`fundAllocationsJson` (a JSON column that stores the user's fund percentage
distribution map keyed by month), the `assignedCoach` (a self-referencing
ManyToOne foreign key to the coach's user row), `coachPermission` (READ_ONLY or
READ_WRITE), `lastDiscrepancySource` (a string tracking what financial operation
last changed savings), and a `mustChangePassword` flag used for first-login
forced password change flows. UserRepository has custom queries like
`findByEmail`, `findByAssignedCoach`, and `existsByEmail` to support auth, coach
assignment, and duplicate email prevention.

--------- 2. AssetRepository (Table: assets) ---------
The `assets` table stores the actual fund buckets that a user's money is
distributed into — for example "Retirement Corpus", "Car Goal Fund", or
"Unallocated Savings". Each asset row belongs to one user (ManyToOne
foreign key to `users`) and has an `assetType` string (e.g. "RETIREMENT",
"UNALLOCATED", or a dynamic goal key) that is the identifier used across the
entire app to match funds to goals and percentage allocations. The `currentValue`
column stores the actual rupee balance of that fund at any point in time, and the
`fundAllocations` column stores a JSON array of percentage-based sub-allocations
if the fund itself is split further. The repository provides `findByUserId` to
load all of a user's funds in one query, which is heavily used by the savings
calculation and fund transfer logic.

--------- 3. GoalRepository (Table: goals) ---------
The `goals` table represents financial targets a user sets — for example
"Buy a Car by December 2026 for ₹8,00,000". Each row has a `name`, `category`
(which directly maps to an assetType), `cost` (the target amount), `targetDate`
(the deadline), `monthlyAllocation` (how much the user is contributing monthly),
and boolean flags `isCompleted` and `isDelayed`. The `isDelayed` flag is
particularly important — it is set to `true` by the ReconciliationService when a
CSV bank statement discrepancy causes the system to deduce that a shortfall in
savings has pushed the goal's target date backward. The `findByUserId` method is
used in multiple places to evaluate which goals need their target dates recalculated
after financial changes.

--------- 4. IncomeSourceRepository (Table: income_sources) ---------
The `income_sources` table stores recurring income records for a user, such as
a monthly salary, freelance income, or rental income. Each row stores the
`amount`, a `description`, the `type` enum (SALARY, FREELANCE, BUSINESS, OTHER),
and a `dayOfMonth` integer specifying which day of the month this income arrives.
This `dayOfMonth` is used by the Automated Savings Scheduler to determine when
to automatically create a corresponding INCOME transaction in the user's ledger.
The repository provides `findByUserId` to load all income sources for a given user,
and this data is used by `SavingsCalculationService` to compute projected monthly
income when building the live savings breakdown.

--------- 5. FixedExpenseRepository (Table: fixed_expenses) ---------
The `fixed_expenses` table stores mandatory recurring monthly expenses for a user
that are expected to repeat every month — such as rent, internet bills, EMIs, or
subscriptions. Each row has a `category`, `description`, `amount`, and a
`dayOfMonth` field specifying when the deduction should be applied in the monthly
cycle. The `FixedExpenseController` has special "dynamic sync" logic that
automatically creates or updates the corresponding transaction row in the
`transactions` table whenever a fixed expense is added or edited, ensuring the
current month's ledger is always accurate without the user having to manually
log recurring expenses. The `findByUserId` method is used extensively by the
`SavingsCalculationService` to calculate projected monthly expenses.

--------- 6. TransactionRepository (Table: transactions) ---------
The `transactions` table is the master ledger of the application and stores every
financial event — manual user-entered transactions, automated income/expense
entries, and CSV-parsed bank statement entries. Each row has a `type` enum
(INCOME, EXPENSE, CREDIT, DEBIT), `amount`, `date`, `category`, `description`,
a nullable `fixedExpenseId` (foreign key to the fixed expense that generated it,
used to prevent double-counting in savings calculations), and a nullable
`incomeSourceId` (foreign key to the income source). The repository has custom
queries such as `findByUserId` and `countByUserIdAndTypeAndDateBetween` that
power the savings breakdown and duplicate-entry prevention in the scheduler.
The `SavingsCalculationService` explicitly skips transactions whose
`fixedExpenseId` is not null when summing expenses to prevent double-counting
because fixed expense amounts are already included via the template totals.

--------- 7. RetirementPlanRepository (Table: retirement_plans) ---------
The `retirement_plans` table stores each user's most recently saved retirement
projection as a single persistent row (one plan per user). Each row stores the
user's inputs — `currentAge`, `retirementAge`, `currentMonthlyExpense`,
`currentRetirementSavings`, `inflationRate`, `expectedReturn`,
`withdrawalRate`, and `mode` (either MODE1 for standard calculation or
MODE_OPTIMIZER for finding the earliest retirement age). It also stores the
computed `resultJson` column which is a serialized JSON object of all the
calculated values so that the UI can display the results without recalculating.
The `findByUserId` query is used by the AppLayout sidebar to determine whether
a "Your Retirement" link should be shown in the navigation.

--------- 8. MonthlyStatementVerificationRepository (Table: monthly_statement_verifications) ---------
This table tracks the user's bank-statement-verified savings for each
month/year combination, storing the verified income and expenses from their
uploaded CSV against the system's projected values. The key column `appliedDeficit`
stores the calculated difference (projected minus actual) so the system can
correctly adjust fund balances. The `findByUserId` query returns all past
verifications, and their `appliedDeficit` values are summed and subtracted from
the user's `totalSavings` in `SavingsCalculationService.getSavingsBreakdown()`,
ensuring that any over-estimated projected savings are corrected in the live
balance. This design means the user's total savings balance is always accurate
regardless of what months they chose to verify.

--------- 9. CoachProfileRepository (Table: coach_profiles) ---------
The `coach_profiles` table stores all the professional profile details for a
financial coach that go beyond what the `users` table holds. This includes
`title` (e.g. "Financial Planning Coach"), `location`, `yearsExperience`,
`rating`, `clientCount`, `aboutMe`, `expertise` (comma-separated tags like
"Retirement Planning, Tax Planning"), `consultationFee`, `profilePictureBase64`
(the coach's photo stored as a base64 string), `resumeBase64` (the coach's
uploaded CV/Resume as a base64 PDF), `professionalSummary`, `experienceDetails`,
`educationDetails`, `linkedIn`, and `phone`. The repository provides a critical
custom query `findAllByUserStatusWithUser` which fetches all profiles whose linked
user has ACTIVE account status — this is what powers the coach marketplace listing.

--------- 10. CoachSuggestionRepository (Table: coach_suggestions) ---------
The `coach_suggestions` table stores financial advice and personalized
recommendations that a hired coach sends to their client users directly within
the application. Each suggestion has a `suggestionText`, a `category`
(e.g., "Investment Strategy", "Goal Planning"), and foreign keys to both the
coach user and the target user. The `findByUserIdOrderByCreatedAtDesc` query
retrieves all suggestions for a given user ordered by most recent first, so
the client can see the newest advice at the top of their financial advice
panel. Suggestions are one-way (coach to user) and are informational only —
they are distinct from PendingEdits which require user approval.

--------- 11. PendingEditRepository (Table: pending_edits) ---------
The `pending_edits` table stores proposed changes that a coach wants to make to a
client's financial data — but which require explicit approval from the user before
being applied. Each row has a `payloadJson` field storing the exact proposed change
as a JSON string (e.g., a proposed new fund allocation or goal target date), an
`entityType` string describing what is being changed (e.g. "FUND", "GOAL"),
a `description` explaining why the change is being proposed, and a `status` field
(PENDING, ACCEPTED, REJECTED). The `findByUserIdAndStatusOrderByCreatedAtDesc`
query is used to show all pending changes awaiting the user's decision, and once
the user accepts or rejects, the status is updated but the record is never deleted
— providing a full audit trail of coach-proposed modifications.

--------- 12. MessageRepository (Table: messages) ---------
The `messages` table stores the full bidirectional chat history between a user
and their assigned financial coach, powering the real-time live chat feature.
Each row stores `senderId`, `receiverId`, `content` (the message text), a
`timestamp`, and a boolean `read` flag that is set to `false` when the message
arrives and `true` once the recipient has opened the chat. The repository has
several custom JPQL queries including `findBySenderIdAndReceiverIdOrSenderIdAndReceiverIdOrderByTimestampAsc`
to load the full conversation thread in chronological order,
`countByReceiverIdAndReadFalse` to get the total unread badge count, and
`countUnreadGroupedBySender` to know per-sender unread counts for the notification
badges. The `markMessagesAsRead` query bulk-updates all messages from a specific
sender to `read = true` when the user opens the chat with them.

--------- 13. OtpTokenRepository (Table: otp_tokens) ---------
The `otp_tokens` table is a temporary holding table for email OTP codes generated
during the two-step user registration flow. When a user enters their email to begin
registration, a 6-digit OTP code is generated, saved here with a 5-minute
`expiryTime`, and emailed to the user. Upon form submission, the system looks up
this table using both the email and the OTP code to validate the combination before
creating the account. The `deleteByEmail` method is called at the start of every
OTP generation to ensure any previous unexpired codes for that email are removed
before a new one is saved, preventing multiple valid OTPs from coexisting for the
same address. After successful registration, the used OTP record is explicitly
deleted to keep the table clean.

--------- 14. BankTransactionRepository (Table: bank_transactions) ---------
The `bank_transactions` table stores raw transaction rows parsed from user-uploaded
bank statement CSV files, each row representing one credit or debit line item from
the bank's ledger. This table is separate from the main `transactions` table because
bank statement entries are externally sourced and may not map cleanly to the user's
manually-defined categories and structures. Each row holds the transaction `date`,
`description`, `creditAmount`, `debitAmount`, and the parsed `transactionType`.
The data in this table is the input to the Discrepancy Evaluation system
(ReconciliationService) where the total credits are treated as verified income and
total debits as verified expenses, and the result is compared against the projected
values from the regular transactions ledger.


========================================================================
SECTION 3: CONTROLLERS (14 Controllers) — Detailed Working
========================================================================

--------- 1. AuthController (/api/auth) ---------
The `AuthController` is the entry point for all authentication-related operations
and is the only controller whose endpoints are permitted without a JWT token in
the security configuration (`/api/auth/**` is listed as `permitAll()`). It exposes
five endpoints: `/register` delegates to `AuthService.register()` which validates
the OTP, hashes the password with BCrypt, and creates the user account; `/login`
delegates to `AuthService.login()` which uses Spring's `AuthenticationManager` to
verify credentials and then generates a signed JWT token; `/send-registration-otp`
delegates to `AuthService.sendRegistrationOtp()` which generates a 6-digit code,
stores it in `otp_tokens` with a 5-minute expiry, and emails it to the user via
`EmailService`. The `/forgot-password` endpoint generates a random 8-digit
temporary password, bcrypt-hashes and saves it to the user row with
`mustChangePassword = true`, and sends the plaintext temporary password via a
styled HTML email. The `/change-password` endpoint is called after forced-login
with a temporary password, accepting a new password and updating the hash while
clearing the `mustChangePassword` flag. There is also a `/test-email` GET
endpoint used during development to verify email delivery works correctly.

--------- 2. UserController (/api/user) ---------
The `UserController` provides multiple utility endpoints that the frontend uses
to load the core financial dashboard data for the logged-in user. The `GET /user/settings`
endpoint returns the user's profile settings (salary day/time, manual savings,
etc.) primarily used to detect if a retirement plan exists for nav link visibility.
The `GET /user/savings-breakdown` endpoint delegates to `SavingsCalculationService.getSavingsBreakdown()`
which returns a detailed month-by-month income vs expense analysis, cumulative
savings figure, and the three most recent months' data for the dashboard charts.
The `GET /user/fund-balances` endpoint delegates to `SavingsCalculationService.getFundBalances()`
which computes each fund's current stored balance from the `assets` table plus
the projected monthly contribution based on the user's fund allocation percentages.
It also handles coach permission reads/writes (`/user/coach-permission`), retrieves
coach suggestions (`/user/coach-suggestions`), lists pending edit requests
(`/user/pending-edits`), and allows the user to accept or reject them
(`/user/pending-edits/{id}/accept` and `/user/pending-edits/{id}/reject`).

--------- 3. AssetController (/api/assets) ---------
The `AssetController` manages all fund-level operations including creating,
reading, updating, and deleting fund buckets (Asset entities). A critical design
feature of this controller is the use of `UserResolverService` — every endpoint
calls `userResolverService.getEffectiveUser(user, request)` which checks whether
the request contains an `X-Target-User-Id` HTTP header (set by coaches in
read/write mode) and if so, uses the target user's ID instead of the logged-in
coach's ID; this allows coaches to read and manage a client's assets without
needing to impersonate them. The `POST /assets/transfer` endpoint implements fund
transfer logic: it validates that the amount is positive, that source and
destination funds differ, that the source fund has sufficient balance, and then
atomically deducts from the source Asset and adds to the destination Asset in the
database. The `POST /assets/calculate-fund-goal` endpoint is a pure calculation
endpoint (no DB writes) that computes the required monthly contribution percentage
needed to reach a financial goal by a target date — it also checks feasibility and
returns a projected alternative date if the goal is not achievable by the target
date with current savings.

--------- 4. GoalController (/api/goals) ---------
The `GoalController` provides CRUD operations for goal entities. When a goal is
created, the frontend specifies the `category` which must exactly match an asset's
`assetType` so the system can correlate fund balances with goals. The goal's
`monthlyAllocation` and `targetDate` drive all impact calculations — for example
the `ReconciliationService` uses these to determine by how many months to delay a
goal when a spending shortfall is detected. The `PUT /goals/{id}/acknowledge`
endpoint is used when a user has been notified that their goal was delayed —
clicking Acknowledge sets `isDelayed = false` on the goal so the warning badge
disappears from the UI. The `GoalCompletionNotifier` React component polls the
goals list and detects when any goal's stored asset balance equals or exceeds its
`cost`, firing an in-app celebration notification.

--------- 5. IncomeController (/api/income) ---------
The `IncomeController` handles full CRUD for a user's recurring income sources
and delegates all work directly to the `IncomeSourceRepository`. Creating a new
income source stores the recurring template in the `income_sources` table, and
this template is used by both the `SavingsCalculationService` (to project monthly
income in the live savings breakdown) and the `AutomatedSavingsScheduler` (to
auto-log income transactions on the appropriate day of each month). The update
and delete endpoints verify ownership by checking that the existing record's
`userId` matches the authenticated user's ID before allowing any modification,
preventing horizontal privilege escalation. The `UserResolverService` pattern is
also used here so coaches with read/write permission can view their client's
income configuration.

--------- 6. FixedExpenseController (/api/fixed-expenses) ---------
The `FixedExpenseController` manages the user's recurring mandatory expenses and
has sophisticated "Dynamic Sync" logic that goes beyond simple CRUD. When a new
fixed expense is created, the controller checks if today's date is on or after
the expense's configured `dayOfMonth`; if it is, it immediately creates a
corresponding `EXPENSE` transaction for the current month in the `transactions`
table (with the `fixedExpenseId` reference set) so the user's ledger instantly
reflects the deduction without waiting for the scheduler. During updates, the
existing month's transaction is found and synced with the new amount and description,
or deleted if the deduction date is now in the future for this month. During deletion,
the current month's associated transaction is also cleaned up. Every create, update,
and delete operation is wrapped inside `savingsCalculationService.trackDiscrepancyOperation()`
which computes total savings before and after the change, and if a meaningful
difference is detected, saves the operation reason in `user.lastDiscrepancySource`
for audit trail purposes.

--------- 7. TransactionController (/api/transactions) ---------
The `TransactionController` is the most complex data controller in the application,
handling manual ledger entries, CSV file uploads, and bank statement reconciliation.
For regular CRUD, it verifies ownership of every transaction and delegates to
`TransactionRepository`. The `POST /transactions/upload` endpoint accepts a
multipart CSV file from the user, delegates to `BankStatementService.parseBankStatement()`
which uses the `CsvParserService` internally, and returns a summary of total
credits, total debits, and an array of parsed transaction rows for the user to
review on the frontend's Verify Your Savings page. The `POST /transactions/reconcile`
endpoint accepts the user's verified income and expense totals (which they may
have adjusted on the frontend) and delegates to `ReconciliationService.reconcile()`
which implements the complete Waterfall Discrepancy System — comparing projected
savings against actual, calculating the deficit or surplus, adjusting fund balances,
and potentially delaying goal target dates. The `GET /transactions/verification-status`
endpoint checks if the user has already verified their bank statement for a specific
month/year, returning the existing verification record if it exists.

--------- 8. RetirementController (/api/retirement) ---------
The `RetirementController` exposes three endpoints handling the retirement planner
feature. The `POST /retirement/calculate` endpoint accepts all the user's inputs
(current age, retirement age, monthly expense, inflation rate, expected return,
withdrawal rate, and mode), delegates the math to `RetirementCalculationService.calculate()`,
and returns a rich JSON object with the recommended monthly investment, required
corpus, projected future expenses, and year-by-year investment projection arrays
for the charts. The `POST /retirement/plan` endpoint saves the final version of the
plan to the `retirement_plans` table for persistence, so the user can return to
the planner and see their saved results without re-entering inputs. The
`GET /retirement/plan` endpoint retrieves the most recently saved plan for the
authenticated user and is specifically used by the `AppLayout` sidebar to check if
a retirement plan exists and conditionally show the "Your Retirement" navigation link.

--------- 9. PublicCoachController (/api/coaches) ---------
The `PublicCoachController` manages the publicly accessible (but still
authenticated for user context) coach marketplace. The `GET /coaches` endpoint
fetches all coaches whose account status is `ACTIVE`, builds full `CoachDetailDTO`
objects from their `CoachProfile` records, and importantly marks which coach (if
any) is already hired by the currently authenticated user by setting
`hiredByCurrentUser = true` on that coach's DTO — the frontend uses this flag to
decide whether to show the "Hire" button or the "Your Coach" hired view. The
`POST /coaches/{coachId}/hire` endpoint is the server-side record-keeping step
called after a Razorpay payment is successfully verified — it sets the
`user.assignedCoach` foreign key to link the user to their coach, but in practice
this is called from within `RazorpayController.verifyPayment()` rather than
directly by the frontend, since payment verification must happen first.

--------- 10. CoachController (/api/coach) ---------
The `CoachController` is restricted exclusively to users with the `ROLE_COACH`
authority (enforced in `SecurityConfig`) and provides coaches their own management
interface. The `GET /coach/users` endpoint returns a full list of all users who
have hired the authenticated coach, including their financial data DTOs that allow
the coach to review their clients' portfolios. The `GET /coach/profile` and
`PUT /coach/profile` endpoints allow a coach to read and update their professional
profile metadata — name, title, expertise, profile picture, CV, fees, and
LinkedIn. The `POST /coach/suggestions` endpoint allows a coach to post a
personalized advice message (a `CoachSuggestion`) to a specific client, which
immediately appears in the client's coach suggestions panel. The
`POST /coach/propose-edit` endpoint allows a coach to submit a structured JSON
payload representing a proposed change to a client's data, which gets saved as
a `PendingEdit` in PENDING status and notified to the client for approval.

--------- 11. AdminController (/api/admin) ---------
The `AdminController` is restricted exclusively to `ROLE_ADMIN` users and
provides the administrator interface for managing the platform. The admin can
view a list of all pending coach registrations (users with ROLE_COACH and
PENDING status) who are waiting for approval to become active on the platform.
When an admin approves a coach via `POST /admin/coaches/{id}/approve`, the coach's
account status is changed to ACTIVE and they become visible in the marketplace.
When a coach is rejected via `POST /admin/coaches/{id}/reject`, their status is
set to REJECTED and they are permanently hidden from the marketplace. The admin
can also view all regular users, suspend accounts, reinstate suspended users,
and view a full dashboard of platform metrics like total user count, active coach
count, and total transaction volume via `AdminDashboardService`.

--------- 12. RazorpayController (/api/razorpay) ---------
The `RazorpayController` is the payment gateway integration controller that handles
the two-step Razorpay payment flow for hiring a financial coach. The
`POST /razorpay/create-order` endpoint receives the target coach ID and the fee
amount from the frontend, converts the rupee amount to paise (Razorpay requires
amounts in paise, so ₹1999 becomes 199900 paise), and uses the Razorpay Java SDK
to create a server-side Order object with a unique receipt ID — the returned
`orderId` is what the frontend Razorpay modal uses to initialize the payment UI.
The `POST /razorpay/verify-payment` endpoint is called after the user completes
payment on the Razorpay UI; it receives the `razorpay_order_id`,
`razorpay_payment_id`, and `razorpay_signature` from the frontend and uses
`Utils.verifyPaymentSignature()` from the Razorpay SDK which internally computes
an HMAC-SHA256 digest of (order_id + "|" + payment_id) using the Razorpay secret
key and compares it against the signature received — if they match, the payment is
authentic. On successful verification, the controller calls `CoachService.hireCoach()`
to link the user to the coach in the database, and then calls
`EmailService.sendCoachHiringSuccessEmail()` to dispatch a styled HTML success
email to the user's registered email address confirming the purchase.

--------- 13. ChatController (/api/chat) ---------
The `ChatController` manages the REST-based portions of the live chat system —
specifically fetching message history and tracking read/unread status. The
`GET /chat/history?partnerId={id}` endpoint retrieves the full bidirectional
conversation thread between the authenticated user and their coach (or vice versa),
ordered chronologically by timestamp using a complex JPQL OR-condition query that
matches rows where the current user is either the sender or the receiver.
The `GET /chat/my-coach` endpoint is the most critical endpoint for the sidebar
— it re-fetches the authenticated user freshly from the database within a
`@Transactional(readOnly=true)` scope (to avoid Hibernate LazyInitializationException
on the LAZY-loaded `assignedCoach` relationship) and returns the coach's ID, name,
and role if one is assigned. The `GET /chat/unread-count` endpoint returns both a
total unread count and a per-sender map so the floating chat button can show an
accurate badge number. The `PUT /chat/mark-read?partnerId={id}` endpoint bulk-updates
all messages from a specific sender to read=true when the user opens the chat window.

--------- 14. WebSocketChatController (/app/chat.send) ---------
The `WebSocketChatController` handles incoming real-time chat messages over the
WebSocket (STOMP) connection rather than REST HTTP. When a client sends a message,
it is received by the `@MessageMapping("/chat.send")` method which extracts the
senderId, receiverId, and content from the `ChatMessageRequest` payload, saves the
Message entity to the `messages` table via `MessageRepository`, and then uses
`SimpMessagingTemplate.convertAndSend()` to push the saved message DTO to the
receiver's personal topic `/topic/messages/{receiverId}` — any client subscribed
to that topic instantly receives the message without polling. The
`WebSocketConfig` sets up the STOMP broker with `/topic` and `/queue` message
prefixes, configures `/app` as the application destination prefix, and registers
a custom JWT-based handshake interceptor that validates the Bearer token during
the WebSocket upgrade request so that unauthenticated users cannot open a WebSocket
connection.


========================================================================
SECTION 4: SERVICES — Detailed Working
========================================================================

--------- AuthService ---------
The `AuthService` is the core authentication business logic layer that handles all
account lifecycle operations. In `sendRegistrationOtp()`, it first checks if the
email is already registered (throwing an error if so for duplicate email prevention),
then deletes any previous OTP for that email, generates a cryptographically random
6-digit code formatted as a zero-padded string, saves it to the `otp_tokens` table
with a `LocalDateTime.now().plusMinutes(5)` expiry time, and finally invokes
`EmailService.sendOtpEmail()` to deliver it. The `register()` method validates the
OTP by looking up the email+code combination in the repository, checks it hasn't
expired, deletes the used token, then builds a `User` entity with the password
encoded by `BCryptPasswordEncoder`; if the role is COACH it also creates a
`CoachProfile` record and sets the account status to PENDING (requiring admin
approval) instead of immediately ACTIVE. The `login()` method uses Spring
Security's `AuthenticationManager.authenticate()` which internally invokes the
`DaoAuthenticationProvider` to load the user by email and compare the bcrypt hash
— on success it checks account status enums to block PENDING/SUSPENDED/REJECTED
accounts before generating and returning a signed JWT token.

--------- EmailService ---------
The `EmailService` uses Spring's `JavaMailSender` with a MIME message builder
to send rich HTML-formatted emails for three scenarios. For OTP verification, it
sends a styled card email with the 6-digit code displayed in a large green box
with a 5-minute expiry warning. For forgot-password, it sends a styled card with
the 8-digit temporary password displayed in a red box with instructions to change
it immediately. For coach hiring success, it sends a premium styled email with a
purple gradient, a congratulations heading addressed to the user by name, the
coach's name prominently displayed, and a thank you message — this email is
triggered inside `RazorpayController.verifyPayment()` immediately after a successful
payment verification. The `fromEmail` is read from `application.properties` via
`@Value("${spring.mail.username}")` so the sender address is configurable per
deployment environment. All errors during email sending are caught and logged,
and a `RuntimeException` is thrown so the calling code knows if delivery failed.

--------- SavingsCalculationService ---------
The `SavingsCalculationService` is the most complex and important service in the
application, responsible for computing the user's true live financial picture at
any given moment. The `getSavingsBreakdown()` method builds a timeline starting
from the earliest date found across the user's transactions and user registration
date, iterates through each month, and for each month computes total income
(summing income source templates if the deduction date has passed for the current
month, or the full amount for past months, plus manual INCOME transactions) and
total expenses (similarly for fixed expense templates plus manual EXPENSE transactions,
but critically excluding any transactions whose `fixedExpenseId` is not null to
prevent double-counting). It then sums all past months (older than the most recent
three) into a single `olderCumulative` figure, exposes the three recent months as
a detailed array for UI charts, adds the user's `manualTotalSavings` (pre-app
savings), subtracts the total `appliedDeficit` from all `MonthlyStatementVerification`
records, and returns the final `totalSavings`. The `getFundBalances()` method calls
`getSavingsBreakdown()` to get the live total and then reads the user's
`fundAllocationsJson` from the database to distribute the expected monthly savings
across funds as percentages, combining this projected monthly contribution with the
stored `currentValue` from each `Asset` database row to compute each fund's total
displayed balance. The `trackDiscrepancyOperation()` wrapper method calculates
savings before and after any financial modification (adding expenses, deleting
income, etc.) and records the operation description as `lastDiscrepancySource` on
the user if the total changes significantly.

--------- RetirementCalculationService ---------
The `RetirementCalculationService` implements the complete actuarial mathematics
for retirement planning. In MODE1 (Calculate My Retirement Plan), it computes:
Future Monthly Expense = Current Monthly Expense × (1 + Inflation Rate)^(Years Until Retirement),
which projects today's living costs into future rupee value. Then Required Corpus =
(Future Monthly Expense × 12) / Safe Withdrawal Rate, which is the total nest egg
needed so that withdrawing at the safe rate covers annual expenses indefinitely.
The Required Monthly Contribution uses the PMT formula:
PMT = (Gap × Monthly Return) / ((1 + Monthly Return)^Months - 1),
where Gap = Required Corpus - Future Value of Current Savings, computing the
exact monthly SIP amount needed to accumulate that corpus. In MODE_OPTIMIZER
(Earliest Retirement Age Finder), it iterates from year 1 to 100-currentAge,
computing for each potential retirement year whether the Future Value of current
savings plus compounded SIP contributions would meet the required corpus —
returning the earliest year it becomes achievable. All results are saved as
JSON to the `retirement_plans` table so they persist across sessions.

--------- ReconciliationService ---------
The `ReconciliationService` implements the Discrepancy Waterfall System. When
called with the user's bank-verified income and expense, it first calculates
Projected Savings = (sum of income transactions for the month) - (sum of expense
transactions for the month, using the same double-counting prevention logic as
`SavingsCalculationService`). Then Actual Savings = Verified Income - Verified
Expense. The Total Deficit = Projected Savings - Actual Savings (positive means
user saved less than expected, negative means they saved more). To avoid overwriting
a previous verification for the same month, it tracks `previousAppliedDeficit` and
only applies the `deltaDeficit` (the new total minus the previously applied amount).
For a surplus (delta < 0), the surplus amount is added directly to the UNALLOCATED
asset. For a deficit (delta > 0), the shortfall is deducted from a user-selected
fund asset, and then the service checks all goals linked to that fund — if the
projected balance by the goal's target date (currentBalance + monthlyAllocation ×
monthsRemaining) falls below the goal cost, it calculates `extraMonthsNeeded =
ceil(shortfall / monthlyAllocation)` and pushes the goal's targetDate forward by
that many months, setting `isDelayed = true`.

--------- CoachService ---------
The `CoachService` handles all the business logic for the coach-user relationship
ecosystem. The `getActiveCoachesForUser()` method fetches all coach profiles with
ACTIVE status and, for the currently authenticated user, marks which coach (if any)
they have already hired by comparing the user's `assignedCoach` ID against each
coach profile's user ID. The `hireCoach()` method performs a simple but critical
write: it sets the `user.assignedCoach` foreign key to the coach user entity and
saves — this is the database action that officially makes a coach "hired" for a
user, and it is called only after payment is verified by Razorpay. The
`postCoachSuggestion()` method creates a `CoachSuggestion` entity linking the coach
and target user with the suggestion text and category. The `proposeEdit()` method
creates a `PendingEdit` entity with status "PENDING" and the proposed change's JSON
payload. The `acceptPendingEdit()` and `rejectPendingEdit()` methods both validate
that the pending edit belongs to the requesting user (authorization check) before
updating the status to "ACCEPTED" or "REJECTED" respectively.

--------- CsvParserService ---------
The `CsvParserService` uses the OpenCSV library to parse bank statement CSV files
in a format-agnostic manner. It reads the first row as a header row (discarded),
then iterates every subsequent row expecting at minimum 4 columns: date, type,
category, amount (and optionally description). For the date column, it attempts to
parse the string through four different `DateTimeFormatter` patterns in sequence
(yyyy-MM-dd, dd/MM/yyyy, dd-MM-yyyy, MM/dd/yyyy) and defaults to today's date
if none match — this makes the parser resilient to different bank export formats.
For the transaction type, it first tries a direct enum lookup (INCOME, EXPENSE,
CREDIT, DEBIT); if that fails (because the bank uses words like "CR" or "Credited"),
it falls back to a keyword check — if the string contains "CREDIT" or "INCOME" it
maps to INCOME, otherwise EXPENSE. The amount column is sanitized with a regex
`replaceAll("[^0-9.]", "")` to strip currency symbols, commas, and spaces before
parsing as a double. Each row is wrapped in a try-catch so that any single
unparseable row is skipped with a warning log rather than crashing the entire upload.

*/
