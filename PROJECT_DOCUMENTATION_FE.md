# Incisive Admin Portal - Technical Documentation

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page
│   │   └── register/page.tsx       # Registration page
│   ├── (protected)/
│   │   ├── layout.tsx              # Auth wrapper (server)
│   │   ├── ProtectedLayoutClient.tsx
│   │   ├── dashboard/page.tsx      # Dashboard
│   │   ├── profile/page.tsx        # User profile
│   │   └── tables/
│   │       ├── page.tsx            # Tables list
│   │       └── [table]/
│   │           ├── page.tsx        # Table view
│   │           ├── new/page.tsx    # Create record
│   │           └── [id]/page.tsx   # View/Edit record
│   └── api/
│       └── auth/
│           ├── login/route.ts
│           ├── register/route.ts
│           ├── logout/route.ts
│           ├── refresh/route.ts
│           └── session-refresh/route.ts
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── tables/
│   │   ├── DataTable.tsx           # Main table component
│   │   ├── DynamicForm.tsx         # Dynamic form generator
│   │   ├── TableActions.tsx        # Row actions (view/edit/delete)
│   │   └── TableFilters.tsx        # Search and filters
│   └── ui/                         # Reusable UI components
├── lib/
│   ├── fetch-client.ts             # Authenticated fetch wrapper
│   ├── permissions.ts              # Permission helpers
│   └── utils.ts                    # Utility functions
├── store/
│   └── authStore.ts                # Zustand auth state
├── config/
│   └── ui.constants.ts             # App constants and routes
├── types/                          # TypeScript definitions
└── middleware.ts                   # Token refresh middleware
```

---

## 1. Authentication

### Login Flow
**Files:** `src/app/(auth)/login/page.tsx` → `src/app/api/auth/login/route.ts`

```
User submits email/password
    ↓ POST /api/auth/login
API Route forwards to backend
    ↓ POST {BACKEND}/auth/login
Backend returns tokens
    ↓ { accessToken, refreshToken }
API Route sets httpOnly cookies
    ↓ access_token (1 day), refresh_token (7 days)
Redirect to /dashboard
```

### Registration Flow
**Files:** `src/app/(auth)/register/page.tsx` → `src/app/api/auth/register/route.ts`

- Fields: first_name, last_name, email, password, confirm_password
- Validation: required fields, email format, password 6-50 chars
- Same token/cookie flow as login

### Token Refresh (3 Layers)

**Layer 1 - Middleware** (`src/middleware.ts`)
- Intercepts all page requests
- Refreshes if access token missing/expired
- Sets new cookies, redirects to same URL

**Layer 2 - Protected Layout** (`src/app/(protected)/layout.tsx`)
- Validates token with `/api/v1/users/me`
- On 401, delegates to session-refresh route

**Layer 3 - Session Recovery** (`src/app/api/auth/session-refresh/route.ts`)
- Handles edge cases middleware can't detect
- Either refreshes or clears cookies and redirects to login

---

## 2. Dashboard

**File:** `src/app/(protected)/dashboard/page.tsx`

- Personalized greeting based on time of day
- Admin stats from `/api/admin/dashboard` (total users, active/inactive, roles)
- Quick action cards (View Profile, Manage Tables)
- Account information display

### Protected Layout Flow
```
Browser requests /dashboard
    ↓
Middleware validates/refreshes token
    ↓
Protected Layout fetches /users/me
    ↓
ProtectedLayoutClient syncs user to Zustand
    ↓
Dashboard renders
```

---

## 3. Tables System

### Tables List
**File:** `src/app/(protected)/tables/page.tsx`
- Fetches available tables from `/api/tables`
- Displays cards with name, description, record count

### Individual Table
**File:** `src/app/(protected)/tables/[table]/page.tsx`
- Fetches config from `/api/tables/{tableName}`
- Renders DataTable component

### DataTable Component
**File:** `src/components/tables/DataTable.tsx`

**Features:**
- Pagination, sorting (column headers), filtering, search
- CSV download
- Inline editing (product_lab_markup, product_lab_rev_share)
- CRUD actions via TableActions

**Data Flow:**
```
fetchRows()
    ↓ GET /api/tables/{tableName}/rows
    ↓ params: page, limit, sortBy, sortOrder, search, filters
Response: { data: [...], meta: { total, totalPages } }
```

### Table Configuration
```typescript
interface TableConfig {
  name: string;
  label: string;
  columns: TableColumn[];
  permissions: TablePermissions;
  default_sort?: SortConfig;
}

interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'boolean' | 'date' | 'select';
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
  required: boolean;
}

interface TablePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  actions: string[];  // ['activate', 'deactivate', 'export']
}
```

---

## 4. CRUD Operations

### View Record
**File:** `src/app/(protected)/tables/[table]/[id]/page.tsx`
- Route: `/tables/{tableName}/{id}`
- Fetches config + row data in parallel
- Edit button if `canEdit(permissions)`

### Create Record
**File:** `src/app/(protected)/tables/[table]/new/page.tsx`
- Route: `/tables/{tableName}/new`
- Checks `canCreate(permissions)`
- POST `/api/tables/{tableName}/rows`

### Edit Record
**File:** `src/app/(protected)/tables/[table]/[id]/page.tsx`
- Route: `/tables/{tableName}/{id}?edit=true`
- PATCH `/api/tables/{tableName}/rows/{id}`

### Delete Record
**File:** `src/components/tables/TableActions.tsx`
- Confirmation dialog
- DELETE `/api/tables/{tableName}/rows/{id}`

### Inline Editing
- Click editable cell → input appears
- On blur/Enter → PATCH request
- Supported tables: `product_lab_markup`, `product_lab_rev_share`

---

## 5. DynamicForm Component

**File:** `src/components/tables/DynamicForm.tsx`

### Field Types
- text, number, email, password, date
- boolean (Yes/No select)
- select (static or dynamic options)
- Autocomplete (typeahead for foreign keys)

### Foreign Key Config
```typescript
const FOREIGN_KEY_CONFIG = {
  lab_id: { endpoint: '/api/labs/ids', ... },
  practice_id: { endpoint: '/api/practices/ids', useTypeahead: true },
  dental_group_id: { endpoint: '/api/dental-groups/ids', useTypeahead: true },
};
```

### Dependent Fields
```typescript
const DEPENDENT_FIELD_CONFIG = {
  product_lab_markup: {
    lab_product_id: {
      dependsOn: 'lab_id',
      endpoint: (labId) => `/api/tables/lab_product_mapping/rows?filters=...`,
    },
  },
};
```

### Auto-fill
```typescript
const AUTO_FILL_CONFIG = {
  dental_practices: {
    dental_group_id: {
      targetField: 'dental_group_name',
      extractValue: (option) => option.label.split(' : ')[1],
    },
  },
};
```

---

## 6. State Management

### Auth Store
**File:** `src/store/authStore.ts`

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  isAdmin: () => boolean;
}
```
- Persisted to sessionStorage
- Restored on page reload

### Fetch Client
**File:** `src/lib/fetch-client.ts`
- Wraps fetch with `credentials: 'include'`
- On 401: redirects to `/login?callbackUrl={currentPath}`

---

## 7. Permissions

**File:** `src/lib/permissions.ts`

```typescript
canView(permissions)    // permissions?.read
canCreate(permissions)  // permissions?.create
canEdit(permissions)    // permissions?.update
canDelete(permissions)  // permissions?.delete
hasAction(permissions, action)  // permissions?.actions?.includes(action)
```

**UI Rendering:**
- "Add New" button: `canCreate(permissions)`
- Edit action: `canEdit(permissions)`
- Delete action: `canDelete(permissions)`
- Activate/Deactivate: `hasAction(permissions, 'activate'/'deactivate')`

---

## 8. Routes Reference

**Public:**
- `/login` - Login page
- `/register` - Registration page

**Protected:**
- `/dashboard` - Main dashboard
- `/profile` - User profile
- `/tables` - Tables list
- `/tables/{tableName}` - Table view
- `/tables/{tableName}/new` - Create record
- `/tables/{tableName}/{id}` - View record
- `/tables/{tableName}/{id}?edit=true` - Edit record

**API:**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/session-refresh`

---

## 9. Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

---

## 10. Token Configuration

- Access Token: 1 day, httpOnly cookie
- Refresh Token: 7 days, httpOnly cookie
- Cookie settings: `secure: false`, `sameSite: 'lax'`, `path: '/'`
