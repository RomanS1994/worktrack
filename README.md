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
| Deployment | Render-compatible Node web service |

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
AUTH_TOKEN_SECRET="replace-with-local-secret"
BACKEND_PORT=3000
CLIENT_ORIGIN="http://localhost:5173,http://127.0.0.1:5173"
```

Create `frontend/webApp/.env` locally:

```bash
VITE_API_BASE_URL="http://localhost:3000/api"
```

Do not commit `.env` files.

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
| `GET` | `/api/health` | Backend and database health |

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
| `GET` | `/api/work-entries?weekStart=YYYY-MM-DD` | Current employee week |
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
| `POST` | `/api/projects/:id/deactivate` | Deactivate project |
| `GET` | `/api/company-settings` | Current company settings |
| `PATCH` | `/api/company-settings` | Update company name |
| `GET` | `/api/manager/submissions?status=SUBMITTED` | Review queue |
| `GET` | `/api/manager/submissions/:id` | Submission details |
| `POST` | `/api/manager/submissions/:id/approve` | Approve submitted week |
| `POST` | `/api/manager/submissions/:id/reject` | Reject submitted week |

## Salary

Salary is calculated from work entries and `CompanyMembership.hourlyRateCzk`.

- Confirmed salary: `APPROVED hours * hourlyRateCzk`
- Predicted salary: `DRAFT + SUBMITTED hours * hourlyRateCzk`

The values are calculated at request time and are not stored in the database.

## Render

Render web service should use:

```bash
Build Command: npm run build
Start Command: npm start
```

Required production environment variables:

```bash
DATABASE_URL
AUTH_TOKEN_SECRET
CLIENT_ORIGIN
```

Optional:

```bash
DIRECT_DATABASE_URL
API_KEY
ACCESS_TOKEN_TTL_MINUTES
```

The backend binds to `0.0.0.0` and uses `process.env.PORT` with local fallback `3000`.

## Checks

```bash
npm run build
npm --prefix backend test
npm run secrets:check
```

## Manager Bootstrap

Create a manager and company:

```bash
npm run create:manager -- --email=manager@example.com --name="Manager" --password="password123" --company-name="Acme"
```
