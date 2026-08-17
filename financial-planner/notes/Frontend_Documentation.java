/*
================================================================================
  LI.FI FINANCIAL PLANNER — FRONTEND DOCUMENTATION
  Detailed Notes for Interview Preparation (Part 2 of 2)
  Tech Stack: React 18 (Vite), React Router v6, Axios, SockJS + STOMP,
              Razorpay Checkout.js, react-hot-toast, Vanilla CSS
================================================================================


========================================================================
SECTION 1: ARCHITECTURE & FOLDER STRUCTURE
========================================================================

The frontend is a Single Page Application (SPA) built with React 18 using Vite
as the development server and bundler. All routing is handled client-side using
`react-router-dom` v6 with a `<BrowserRouter>` at the root and a `<PrivateRoute>`
wrapper component that reads the authentication state from `AuthContext` to
redirect unauthenticated users to the login page. State is managed at the component
level using React hooks (`useState`, `useEffect`, `useCallback`), and global state
(user session and WebSocket connection) is shared through React Context API to avoid
prop drilling across deeply nested components. API communication is handled entirely
through Axios with a pre-configured instance in `api.js` that automatically attaches
the JWT Bearer token from `localStorage` to every request header and handles 401
responses by clearing the session and redirecting to login.

The folder structure separates concerns as follows:
- `src/pages/` — One directory per major feature page (Login, Home, FundManagement, etc.)
- `src/components/` — Shared, reusable UI components (AppLayout, ChatBox, Navbar, etc.)
- `src/context/` — React Context providers (AuthContext, SocketContext)
- `src/services/api.js` — Centralized Axios configuration and all API call functions
- `src/utils/` — Pure utility functions (Razorpay checkout initiator, formatters)


========================================================================
SECTION 2: KEY CONTEXT PROVIDERS
========================================================================

--------- AuthContext (src/context/AuthContext.jsx) ---------
The `AuthContext` is the global authentication state provider that wraps the entire
application. It manages the `user` object and `loading` state using `useState`, and
on initial load it reads the `finance_user` key from `localStorage` and the JWT
`token` key to restore the session across page refreshes (so users do not get logged
out every time they refresh the browser). The `login()` async function calls
`POST /api/auth/login`, receives the JWT token and user data object, stores both
in `localStorage`, and sets the `user` state — but if the backend returns
`mustChangePassword: true`, it stores the token but does not set the user (so the
user is held on a forced password-change screen before accessing the dashboard).
The `register()` function handles both user and coach flows — for a regular user
it receives a token and user data and logs them in immediately, while for a coach
it receives only a message (no token) because coach accounts go to PENDING status
awaiting admin approval. The `logout()` function clears both the `user` state and
both `localStorage` entries, causing the `PrivateRoute` to immediately redirect
to the login page.

--------- SocketContext (src/context/SocketContext.jsx) ---------
The `SocketContext` manages the WebSocket lifecycle for the live chat feature. On
login (when `user` becomes non-null in `AuthContext`), `SocketContext` creates a
new SockJS connection to the backend's `/ws` endpoint and wraps it with a STOMP
client from the `@stomp/stompjs` library. The client is configured to send the
JWT Bearer token in the `Authorization` header of the WebSocket connection request,
matching the server-side JWT validation in `WebSocketConfig`. Upon successful
connection, the STOMP client subscribes to the user's personal topic channel
`/topic/messages/{userId}` so that any messages sent to that channel by the backend
(via `SimpMessagingTemplate.convertAndSend()`) are delivered instantly to the
browser without polling. The context exposes a `sendMessage(payload)` function
that calls `stompClient.publish()` to send a message over the WebSocket, and also
exposes the `subscribeToMessages(callback)` function that `ChatBox.jsx` uses to
register a handler for incoming messages. On logout, the STOMP connection is
deactivated and all subscriptions are cleaned up to prevent memory leaks.


========================================================================
SECTION 3: PAGES — Detailed Working
========================================================================

--------- Login Page (src/pages/Login/) ---------
The Login page handles both the user login flow and the two-step registration
flow in a single tabbed UI. For login, the form collects email and password,
calls `authApi.login()` from the context, and on success redirects to the
dashboard — but checks the `mustChangePassword` flag in the response and if true,
shows an inline "Change Password" form before allowing navigation. For registration,
the first step collects name, email, password, role (User or Coach), and for
coaches a resume PDF file upload (converted to base64). Clicking "Send OTP" calls
`authApi.sendRegistrationOtp(email)` which delivers the 6-digit code to the email.
The second step shows an OTP input — on submit the full registration payload
including the validated OTP is sent to `authApi.register()`, and the form displays
validation hints directly on the UI (minimum 6-character password requirement,
email format validation). After successful registration as a user, the JWT is
received and the user is auto-logged in; after registration as a coach, a message
is shown that the account is pending admin approval.

--------- Home Page (src/pages/Home/) ---------
The Home dashboard is the first page a user sees after login and aggregates the
most important financial snapshot data from multiple API calls made in parallel
using `Promise.all()`. It fetches the savings breakdown (for the live total savings
figure and the three recent month income/expense bars), the fund balances (for the
fund distribution summary cards), and the goals list (for progress bars and
completion percentages). The page renders a hero card at the top showing "Live
Total Savings" in large rupee format, derived from
`GET /api/user/savings-breakdown` and the `totalSavings` field. Below that,
a three-panel recent months bar chart compares income vs expense for the current
and two previous months using vanilla CSS bar elements with dynamically computed
heights. A "Quick Actions" section provides fast navigation buttons to commonly
used features. The page also implements a `GoalCompletionNotifier` component that
runs on every mount to check if any goal's current fund balance meets or exceeds
the goal cost, and if so fires a confetti-style in-app celebration notification
using `react-hot-toast`.

--------- Your Monthly Savings Page (src/pages/ExpenseManagement/) ---------
The Your Monthly Savings page is the core financial tracking center where users
manage all of their income sources, fixed recurring expenses, and manual one-off
transactions. On load it makes four API calls to fetch income sources, fixed
expenses, all transactions, and the savings breakdown, and presents them in
sectioned cards. The income section shows all recurring income streams with their
amounts, descriptions, and arrival dates, and has an inline form to add new ones.
The fixed expense section similarly shows recurring mandatory bills and allows
adding, editing, and deleting them — with a visual indicator showing whether the
deduction has already been applied for the current month (the backend's Dynamic Sync
logic ensures this). The manual transactions section has a date-filtered table view
of all ledger entries, with type badges (INCOME in green, EXPENSE in red), and
supports adding manual one-off transactions for income not from a recurring source
or irregular expenses. The "Verify Your Savings" button opens the two-step CSV
upload flow (Step 1 parses the file, Step 2 compares and reconciles).

--------- Goal Management Page (src/pages/GoalManagement/) ---------
The Goal Management page (named "Create a Goal" in the navbar) allows users to
create, view, and manage their financial targets. The goal creation form uses the
`POST /api/assets/calculate-fund-goal` calculation endpoint reactively — as the
user types the target amount and target date, it immediately shows them the
required monthly contribution, required allocation percentage, whether the goal is
feasible with current savings, and the projected alternative date if it is not
feasible. This instant feedback is implemented using a `useEffect` with a 300ms
debounce that calls the calculation API every time the target amount, target date,
or allocation percentage changes. Upon creating a goal, the form also creates a
corresponding Asset record via `POST /api/assets` with the same category name so
the fund shows up in the Goal Management page. The goals list shows each goal's
progress bar (current fund balance / goal cost as a percentage), the monthly
contribution, the target date, and a red "Delayed" badge if `isDelayed = true`.

--------- Fund Management Page (src/pages/FundManagement/) ---------
The Fund Management page (named "Goal Management" in the navbar) is the central
view of all the user's fund buckets and their allocation percentages. On load, it
calls `GET /api/user/fund-balances` which returns each fund with its ID, name,
stored balance from the database, projected monthly contribution based on allocation
percentage, and combined total balance. The page renders each fund as a card showing
the balance, the allocation percentage slider, and for goal-linked funds, a progress
bar against the goal's target cost. The allocation percentage sliders are
dynamically interactive — as the user adjusts one slider, the system recalculates
the remaining percentage available for other funds and updates the "Unallocated
Savings" percentage in real-time so the total always equals 100%. When the user
clicks "Save Allocations", the new percentages are serialized as a JSON object
keyed by fund ID and sent to `PUT /api/user/settings` as the `fundAllocationsJson`
field. The Unallocated Savings card shows the helper text "Money that has not been
allocated to any goal" and is always placed last in the list.

--------- Fund Transfer Page (src/pages/FundTransfer/) ---------
The Fund Transfer page allows users to manually move money between their fund
buckets and implements a predictive Impact Analysis system to show the user exactly
what will happen before they confirm. The page fetches all funds via
`GET /api/user/fund-balances` and populates two dropdowns (source fund and
destination fund). As the user selects funds and enters the amount, the frontend
immediately computes the impact locally without an API call: for the source fund
it calculates how many months the goal completion is delayed (shortfall / monthly
allocation rounded up), and for the destination fund it calculates how many months
the goal target date is shortened (transfer amount / monthly allocation rounded up).
This predictive impact text appears instantly as the user types, giving them
data-driven feedback before confirming. On confirmation, `POST /api/assets/transfer`
is called with the source fund type, destination fund type, and amount — the backend
validates balance sufficiency and performs the atomic debit/credit. The history
section below the form shows recent transfer records fetched from
`GET /api/assets/transfers`.

--------- Expert Connect Page / Hire a Finance Expert (src/pages/ExpertConnect/) ---------
The Expert Connect page is the coach marketplace where users can browse and hire
financial coaches. On load, `GET /api/coaches` fetches all active coach profiles,
and the page checks if any coach has `hiredByCurrentUser: true` — if so, the entire
page immediately renders the `HiredCoachView` component instead of the marketplace
carousel, showing the user's coach's profile with chat access. If no coach is hired,
the page renders a horizontal carousel of coach profile cards, each showing the
coach's photo, name, title, location, years of experience, rating, client count,
expertise tags, professional summary, education timeline, and consultation fee.
Arrow buttons navigate between coaches, and clicking "Hire This Expert" invokes
`initiateRazorpayCheckout()` from the utils folder, which dynamically loads the
Razorpay `checkout.js` script if not already present, configures the modal with
the backend-generated `orderId`, and on successful payment calls
`POST /api/razorpay/verify-payment`. On verified payment success, the page fires
the `window.dispatchEvent(new Event('coachHired'))` custom event which the
`AppLayout` sidebar listens for to immediately update the nav label.

--------- HiredCoachView Component (src/pages/ExpertConnect/HiredCoachView.jsx) ---------
The `HiredCoachView` is rendered when the user already has an assigned coach and
replaces the entire marketplace UI. It displays the coach's full profile — profile
picture, name, title, location, rating, client count — at the top of the page.
Below that is the "Coach Access & Permissions" panel where the user can toggle
between "Allow Coach to READ Data" (READ_ONLY mode — the coach can view the portal
but make no changes) and "Allow Coach to READ & EDIT Data" (READ_WRITE mode — the
coach can also propose fund/goal changes via PendingEdits). The permissions are
saved via `PUT /api/user/coach-permission` when the user clicks a radio option.
The "Coach Financial Advice" panel shows all suggestions posted by the coach
(fetched from `GET /api/user/coach-suggestions`) in chronological order with
category badges. The "Proposed Changes Requiring Approval" panel shows all
`PendingEdit` records with PENDING status, each showing the coach's proposed
description and JSON payload, with Accept and Reject buttons that call the
corresponding API endpoints.

--------- Retirement Planner Page (src/pages/RetirementPlanner/) ---------
The Retirement Planner page is a multi-step financial projection tool. In the
input phase, the user fills in their current age, target retirement age, current
monthly expense, existing retirement savings, expected annual return rate,
inflation rate, safe withdrawal rate, and optionally their current monthly
SIP contribution. Submitting this form calls `POST /api/retirement/calculate` and
the returned results object is rendered in a rich results panel. The results panel
shows the "Recommended Retirement Investment" (monthly SIP amount), the
"Required Corpus" (total savings needed), projected future monthly expense,
and the expected monthly income at retirement. Two expandable "View Year-by-Year"
tables show the user exactly how their investment and corpus grow year by year
using the backend's computed projection arrays. The "Save Plan" button calls
`POST /api/retirement/plan` to persist the plan, and immediately fires
`window.dispatchEvent(new Event('retirementPlanUpdated'))` which the `AppLayout`
sidebar listens for to show the "Your Retirement" navigation link. The
Retirement Age Optimizer (MODE_OPTIMIZER) tab lets users input their current
monthly SIP and get back the earliest possible retirement age given those contributions.

--------- Coach Dashboard (src/pages/Coach/) ---------
The Coach Dashboard is a specialized portal visible only to users with ROLE_COACH
and provides coaches with a complete interface to manage their clients. The
"Assigned Clients" panel shows a list of all users who have hired this coach,
fetched from `GET /api/coach/users`, and clicking on a client switches the entire
dashboard to a read-only view of that client's financial data (income, expenses,
fund balances, goals, retirement plan) by setting `X-Target-User-Id` header in
all subsequent API calls via `localStorage.setItem('targetUserId', clientId)`.
The "Post Advice" form allows a coach to write personalized financial advice with
a category tag and submit it via `POST /api/coach/suggestions` to appear in the
client's portal. The "Propose Portfolio Change" form lets a coach describe a
recommended change and provide a JSON payload, submitting via
`POST /api/coach/propose-edit` — the client then sees this in their pending
approvals queue. The "Profile" tab lets the coach update all their marketplace
listing details including photo, CV upload, expertise, and fees.

--------- Admin Dashboard (src/pages/Admin/) ---------
The Admin Dashboard is accessible only to ROLE_ADMIN users and serves as the
platform management interface. It shows four key metrics at the top: total users,
total coaches, total transactions, and total assets under management — fetched
from `GET /api/admin/dashboard-stats`. The "Pending Coach Approvals" section is
the most important panel, listing all coaches who have registered but are awaiting
admin verification — each card shows the coach's submitted name, email, registration
date, and a link to view/download their uploaded resume PDF. Clicking "Approve"
sends `POST /api/admin/coaches/{id}/approve` which activates the account and makes
them visible in the marketplace. Clicking "Reject" sends `POST /api/admin/coaches/{id}/reject`
which permanently marks them as rejected and removes them from the pending list.
The "All Users" section shows a searchable, paginated table of all user accounts
with their status badges, allowing the admin to suspend active accounts or reinstate
suspended ones.


========================================================================
SECTION 4: SHARED COMPONENTS — Detailed Working
========================================================================

--------- AppLayout (src/components/AppLayout.jsx) ---------
The `AppLayout` is the global wrapper component that renders around every protected
page, containing the sidebar navigation, the main content area (via React Router's
`<Outlet>`), and the floating chat button. On mount, it fetches three pieces of
data: the user's retirement plan (via `GET /api/retirement/plan`) to determine
if the "Your Retirement" nav link should be visible, the user's assigned coach (via
`GET /api/chat/my-coach`) to determine if the nav label should say "Your financial
Expert" instead of "Hire a Finance Expert" and to enable the floating chat button,
and the user's fund balances to detect a negative Unallocated Savings (triggering
a red warning banner at the top). To handle real-time updates without page refreshes,
the component registers `window.addEventListener` listeners for two custom browser
events — `retirementPlanUpdated` (fired by RetirementPlannerPage after saving) and
`coachHired` (fired by ExpertConnectPage after payment) — which trigger re-fetching
of the respective data. The sidebar nav uses React Router's `<NavLink>` for active
state styling, and the nav label rendering logic conditionally replaces labels based
on state (retirement plan existence and coach assignment status).

--------- ChatBox (src/components/Chat/ChatBox.jsx) ---------
The `ChatBox` is a floating Facebook-Messenger-style chat overlay that appears
when the user clicks the floating chat button in the bottom-right corner of the
screen. It positions itself with CSS `position: fixed` and `z-index: 999` over
all other content, showing the coach's name and status in a header bar. On mount,
it calls `GET /api/chat/history?partnerId={coachId}` to load the full existing
message history and renders each message as a bubble aligned left (partner) or
right (current user). It uses the `SocketContext` to subscribe to incoming STOMP
messages — when a new message arrives for the user's topic, the message is appended
to the local `messages` array state without re-fetching the entire history.
Sending a message calls both the STOMP `sendMessage()` function (for real-time
delivery to the partner) and `POST /api/chat/send` REST endpoint (for persistence
to the database). The component calls `PUT /api/chat/mark-read` on mount and
whenever a new message arrives to clear the unread badge count on the floating
button, and auto-scrolls to the bottom of the messages list using a `useRef`
and `scrollIntoView` whenever a new message is added.

--------- GoalCompletionNotifier (src/components/GoalCompletionNotifier.jsx) ---------
The `GoalCompletionNotifier` is a "headless" component (renders no visible UI
of its own) that runs on every page render within the `AppLayout` to check whether
any of the user's goals have been completed. On mount it fetches both the goals list
(via `GET /api/goals`) and the fund balances (via `GET /api/user/fund-balances`),
then for each goal that is not already marked `isCompleted`, it checks if the
corresponding fund's current balance is greater than or equal to the goal's cost
target. If a goal is found to be complete, it fires a `react-hot-toast` success
notification with the goal name and a celebratory message, and calls
`PUT /api/goals/{id}/acknowledge` to update the `isCompleted` flag in the database
so the notification only fires once. This design allows goal completion to be
detected and celebrated from any page in the application without the user having
to navigate to the goals page.


========================================================================
SECTION 5: API SERVICE LAYER (src/services/api.js)
========================================================================

The `api.js` file configures a single shared Axios instance with the base URL
pointing to `http://localhost:8080/api` and a 10-second timeout. The request
interceptor automatically reads the JWT token from `localStorage['token']` and
appends it as an `Authorization: Bearer {token}` header to every outgoing request,
and also reads `localStorage['targetUserId']` (used by the Coach dashboard) and
appends it as the `X-Target-User-Id` custom header when present. The response
interceptor catches 401 Unauthorized responses — if the error comes from a
non-auth endpoint it means the JWT has expired, so it clears the stored token and
user from localStorage and forces a redirect to `/login`. All API functions are
organized into named exports grouped by feature: `authApi`, `incomeApi`,
`transactionApi`, `assetApi`, `liabilityApi`, `retirementApi`, `goalApi`,
`coachApi`, `userCoachApi`, and `chatApi`. The `chatApi.getMyCoach()` function
calls `GET /api/chat/my-coach` and its response is the critical signal used by
`AppLayout` to determine whether to show the coach-related UI elements.


========================================================================
SECTION 6: RAZORPAY INTEGRATION (src/utils/razorpayCheckout.js)
========================================================================

The Razorpay integration is implemented as a utility function `initiateRazorpayCheckout()`
that is called from the ExpertConnect page when the user clicks "Hire". It first
checks if the `window.Razorpay` constructor already exists in the browser (from a
previous load); if not, it dynamically creates a `<script>` tag pointing to
`https://checkout.razorpay.com/v1/checkout.js` and waits for it to load. Once the
script is available, it calls `POST /api/razorpay/create-order` with the coach ID
and fee amount, receives the backend-generated `orderId`, and constructs a Razorpay
`options` object with the order ID, amount, currency (INR), user name and email as
prefill values, and a `handler` callback function. The handler is called by Razorpay
with `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` upon
successful payment — it then calls `POST /api/razorpay/verify-payment` with these
three values plus the coach ID. If verification returns success, the `onSuccess`
callback passed into `initiateRazorpayCheckout()` is invoked (which refreshes the
coaches list and dispatches the `coachHired` custom event), and a success toast
notification is shown to the user.


========================================================================
SECTION 7: COMPLETE END-TO-END FLOWS
========================================================================

--- Flow 1: User Hires a Coach (Complete Frontend → Backend → DB) ---
1. User opens ExpertConnect page → `GET /api/coaches` fetches active coach list.
2. User clicks "Hire This Expert" → `initiateRazorpayCheckout()` runs.
3. Frontend calls `POST /api/razorpay/create-order` → backend creates Razorpay
   Order via SDK → returns orderId.
4. Razorpay modal opens in browser → user completes UPI/card payment.
5. Razorpay JS calls `handler()` with payment IDs and signature.
6. Frontend calls `POST /api/razorpay/verify-payment` with signature + coachId.
7. Backend uses HMAC-SHA256 to verify signature authenticity.
8. On valid signature → `CoachService.hireCoach()` → sets user.assignedCoach
   FK in `users` table.
9. `EmailService.sendCoachHiringSuccessEmail()` → styled HTML email sent to user.
10. Frontend receives success → fires `coachHired` event → AppLayout sidebar
    updates label to "Your financial Expert" → ExpertConnect shows HiredCoachView.

--- Flow 2: Monthly Savings Calculation ---
1. Any dashboard page loads → `GET /api/user/savings-breakdown` called.
2. `SavingsCalculationService.getSavingsBreakdown()` runs:
   a. Fetches all income sources, fixed expenses, transactions, verifications.
   b. Builds month-by-month timeline from earliest record to today.
   c. Sums income/expense per month (skipping fixedExpenseId transactions).
   d. Combines olderCumulative + recentMonths + manualSavings - appliedDeficits.
3. Returns totalSavings and per-month breakdown → frontend renders charts.

--- Flow 3: Bank Statement Upload & Discrepancy Reconciliation ---
1. User clicks "Verify Your Savings" → two-step modal opens.
2. Step 1: User uploads CSV → `POST /api/transactions/upload` →
   `BankStatementService` → `CsvParserService` parses rows, sums credits/debits.
3. Frontend shows parsed totals in an editable table.
4. User confirms (or adjusts) verified income and expense → clicks "Apply".
5. `POST /api/transactions/reconcile` → `ReconciliationService.reconcile()`:
   a. Computes projected savings from ledger transactions for that month.
   b. Computes actual savings = verifiedIncome - verifiedExpense.
   c. Calculates deficit = projected - actual.
   d. Surplus → credited to UNALLOCATED asset.
   e. Deficit → debited from selected fund → if goal-linked, target date pushed back.
6. Updated fund balances reflected on dashboard.

--- Flow 4: Live Chat Message (WebSocket) ---
1. User clicks chat bubble → `ChatBox` mounts → loads history via REST.
2. `SocketContext` STOMP subscription is already active on `/topic/messages/{userId}`.
3. User types a message → `stompClient.publish()` to `/app/chat.send`.
4. `WebSocketChatController` receives → saves to `messages` table →
   `SimpMessagingTemplate.convertAndSend()` to `/topic/messages/{coachId}`.
5. Coach's browser (subscribed to their own topic) receives message instantly.
6. Message appears in coach's ChatBox without any refresh or polling.

*/
