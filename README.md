# WorkTrack

WorkTrack is a PostgreSQL-backed employee time tracking app.

Core flow:

- Employer registers a company and becomes its `MANAGER`.
- Manager creates projects/worksites and employees inside that company.
- Employee creates and edits weekly work entries.
- Employee submits the week to their manager.
- Manager reviews submitted weeks from employees in the same company.
- Manager approves or rejects the week.
- Approved hours are used for confirmed salary calculations.

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, Redux Toolkit Query |
| Backend | Node.js HTTP API, Prisma ORM |
| Database | PostgreSQL / Prisma Postgres |
| Frontend deployment | Netlify |
| Backend deployment | Render-compatible Node web service |

## Roles

The system uses only two roles:

- `EMPLOYEE`
- `MANAGER`

Employees and managers belong to companies through `CompanyMembership`.
Roles are stored on `CompanyMembership`, not directly on `User`.

## Multi-Tenant Model

WorkTrack is company-scoped:

- `User` is a global identity with a unique email.
- `Company` owns projects, memberships, work entries and weekly submissions.
- `CompanyMembership` connects a user to a company and stores `role`, `status` and `hourlyRateCzk`.
- `Project` belongs to exactly one company.
- `WorkEntry` stores `companyId`, `employeeMembershipId` and `projectId`.
- `WeeklySubmission` stores `companyId`, `employeeMembershipId` and optional `reviewedByMembershipId`.

Backend authorization resolves the active company from authenticated membership data. `companyId` from the frontend is never treated as proof of access.

## Local Setup

Create `backend/.env` locally:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/worktrack"
AUTH_TOKEN_SECRET="replace-with-at-least-32-random-characters"
BACKEND_PORT=3001
CLIENT_ORIGIN="http://localhost:5173,http://127.0.0.1:5173"
```

Create `frontend/webApp/.env` locally:

```bash
VITE_API_BASE_URL="http://localhost:3001/api"
```

Do not commit `.env` files. The checked-in `backend/.env.example` and `frontend/webApp/.env.example` are the source of truth for supported environment variables.

Install dependencies:

```bash
npm install
npm --prefix backend install
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate:deploy
```

Start backend:

```bash
npm start
```

Start frontend:

```bash
npm run dev:client
```

## API

### Public

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Backend, database and deployment health |

### Auth

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register-company` | Register company and first manager |
| `POST` | `/api/auth/register` | Alias for company registration |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/me` | Current user |
| `PATCH` | `/api/me/profile` | Update profile |
| `DELETE` | `/api/me` | Soft-delete current user |

### Employee

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/work-entries?weekStart=YYYY-MM-DD` | Selected employee week |
| `POST` | `/api/work-entries` | Create work entry |
| `PATCH` | `/api/work-entries/:id` | Update own draft/rejected entry |
| `DELETE` | `/api/work-entries/:id` | Delete own draft/rejected entry |
| `POST` | `/api/weekly-submissions` | Submit week to manager |
| `GET` | `/api/work-summary` | Employee or manager dashboard summary |
| `GET` | `/api/projects` | Active projects for employee, all projects for manager |

### Manager

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/manager/employees` | Employees in current company |
| `POST` | `/api/manager/employees` | Create employee membership |
| `PATCH` | `/api/manager/employees/:id` | Update employee membership rate/status |
| `POST` | `/api/projects` | Create project |
| `PATCH` | `/api/projects/:id` | Update project |
| `GET` | `/api/company-settings` | Current company settings |
| `PATCH` | `/api/company-settings` | Update company name |
| `GET` | `/api/manager/submissions?status=SUBMITTED` | Review queue |
| `GET` | `/api/manager/submissions/:id` | Submission details |
| `POST` | `/api/manager/submissions/:id/approve` | Approve submitted week |
| `POST` | `/api/manager/submissions/:id/reject` | Reject submitted week |

### Manual company subscriptions

Company subscriptions are billed manually by bank transfer. The manager creates
an invoice for the plan matching the number of active employee memberships,
then submits it for review after sending the transfer. A platform subscription
administrator confirms the received payment before the subscription period is
extended.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/company-subscription` | Subscription, active employee count, plans and payment history |
| `POST` | `/api/company-subscription/invoices` | Create a plan invoice (`planCode`) and return QR Platba SPAYD data |
| `POST` | `/api/company-subscription/invoices/:id/request-review` | Ask platform admin to verify bank transfer |
| `GET` | `/api/platform/subscription-payments` | List payments for allowlisted platform admins; optional `?status=REVIEW_REQUESTED` |
| `POST` | `/api/platform/subscription-payments/:id/confirm` | Confirm transfer and extend subscription once |
| `POST` | `/api/platform/subscription-payments/:id/reject` | Reject a payment review request |

The initial monthly plans are 490 CZK for 1–5 active employees, 790 CZK for
6–10, 1,290 CZK for 11–20, and 2,190 CZK for 21–40. 41+ requires a custom
arrangement. New companies choose a plan at registration and receive one
calendar month of full access starting at company creation. The selected price
is shown before registration. No card or automatic charge is used. The
subscription page shows the trial end date and the manual QR payment option.
After the trial, companies have five grace days to complete a manual payment;
after that, adding employees is paused while company data remains available.
Paid invoices extend the selected plan for one month and are due in 14 days.

Set these backend environment variables before issuing QR-enabled invoices:

```bash
SUBSCRIPTION_ADMIN_EMAILS="owner@example.com"
SUBSCRIPTION_ACCOUNT_NUMBER=""
SUBSCRIPTION_BANK_CODE=""
SUBSCRIPTION_ACCOUNT_PREFIX=""
SUBSCRIPTION_ACCOUNT_HOLDER=""
```

The admin allowlist is separate from tenant manager permissions. Until account
number and bank code are configured, invoice responses return
`accountConfigured: false` and `spayd: null`; no bank details are fabricated.

## Salary

Salary is calculated from work entries and `CompanyMembership.hourlyRateCzk`.

- Confirmed salary: `APPROVED hours * hourlyRateCzk`
- Predicted salary: `DRAFT + SUBMITTED hours * hourlyRateCzk`

The values are calculated at request time and are not stored in the database.

## Production Deployment

### Render backend

The repository includes `render.yaml`. The Render service runs:

```bash
Build Command: npm run build
Start Command: npm start
Health Check: /api/health
```

Required production environment variables:

```bash
DATABASE_URL
AUTH_TOKEN_SECRET
CLIENT_ORIGIN
```

`CLIENT_ORIGIN` must contain the deployed frontend origin, for example:

```bash
CLIENT_ORIGIN="https://<your-netlify-site>.netlify.app"
```

If more than one frontend origin is intentionally supported, use the backend-supported comma-separated list.

Optional production variables include:

```bash
DIRECT_DATABASE_URL
API_KEY
ACCESS_TOKEN_TTL_MINUTES
```

Render automatically supplies deployment metadata such as `RENDER_GIT_COMMIT`, `RENDER_GIT_BRANCH` and `RENDER_EXTERNAL_URL`. `/api/health` exposes this metadata so a smoke check can verify the deployed commit.

The backend binds to `0.0.0.0` and uses `process.env.PORT` with a local fallback.

### Netlify frontend

`netlify.toml` builds the root project with `npm run build`, publishes `dist`, and redirects SPA routes to `/index.html`.

Set the following production environment variable in Netlify:

```bash
VITE_API_BASE_URL="https://<your-render-service>/api"
```

The production Vite build intentionally fails if `VITE_API_BASE_URL` is missing. If `API_KEY` is enabled on the backend, also configure the matching public client key as documented in `frontend/webApp/.env.example`.

After the first Netlify production deploy, copy its exact origin into Render `CLIENT_ORIGIN` and redeploy/restart the backend if necessary.

## Release Checks

Run the repository checks before release:

```bash
npm run build
npm --prefix backend test
npm run secrets:check
```

Then verify the deployed backend, database, frontend root, SPA deep link and exact Render commit:

```bash
BACKEND_URL="https://<your-render-service>" \
FRONTEND_URL="https://<your-netlify-site>.netlify.app" \
EXPECTED_COMMIT="$(git rev-parse HEAD)" \
npm run smoke:production
```

`EXPECTED_COMMIT` is strict: the smoke check fails if `/api/health` does not report a deployment commit or if Render is running a different commit.

Before calling a release production-ready, confirm all of the following:

- database migrations completed successfully on Render;
- `/api/health` reports `ok: true` and `database.connected: true`;
- the Render deployment commit matches the intended release commit;
- Netlify `/` loads WorkTrack;
- direct navigation to `/sign-in` returns the SPA rather than a 404;
- login works from the production frontend origin;
- employee hours can be saved and a week can be submitted;
- manager approval/rejection works;
- confirmed/predicted salary values update as expected;
- notifications appear for submit/approve/reject flows.

## Manager Bootstrap

Create a manager and company:

```bash
npm run create:manager -- --email=manager@example.com --name="Manager" --password="password123" --company-name="Acme"
```
