# Incisive Admin Portal - Technical Documentation

## Overview

This document provides a comprehensive guide to the Incisive Admin Portal frontend application. It covers all major features including user authentication, dashboard, dynamic tables system, and CRUD operations.

---

## Project Structure

**Framework:** Next.js 14 (App Router)
**State Management:** Zustand
**Styling:** Tailwind CSS
**Language:** TypeScript

**Key Directories:**
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable React components
- `src/lib/` - Utility functions and helpers
- `src/store/` - Zustand state stores
- `src/types/` - TypeScript type definitions
- `src/config/` - Configuration constants

---

## 1. User Registration (Signup)

### Flow Overview

1. User navigates to `/register`
2. Fills out registration form (first name, last name, email, password)
3. Form validates input client-side
4. Submits to Next.js API route `/api/auth/register`
5. API route forwards to backend `/api/v1/auth/register`
6. On success, tokens are set as httpOnly cookies
7. User is redirected to `/dashboard`

### Files Involved

**Frontend Page:**
`src/app/(auth)/register/page.tsx`
- Client component with registration form
- Fields: first_name, last_name, email, password, confirm_password
- Validation: required fields, email format, password length (6-50 chars), password match
- Calls `/api/auth/register` on submit
- Uses `window.location.href` for redirect to ensure cookies are sent

**API Route:**
`src/app/api/auth/register/route.ts`
- POST handler
- Forwards request to backend `{API_URL}/auth/register`
- Extracts `accessToken` and `refreshToken` from response
- Sets cookies:
  - `access_token`: httpOnly, 1 day maxAge
  - `refresh_token`: httpOnly, 7 days maxAge
- Returns `{ success: true }` on success

### Code Flow

```
RegisterPage (client)
    ↓ POST /api/auth/register
API Route (server)
    ↓ POST {BACKEND}/auth/register
Backend Response
    ↓ { accessToken, refreshToken }
API Route sets cookies
    ↓ access_token, refresh_token
Redirect to /dashboard
```

---

## 2. User Login

### Flow Overview

1. User navigates to `/login`
2. Fills out login form (email, password)
3. Form validates input
4. Submits to Next.js API route `/api/auth/login`
5. API route forwards to backend `/api/v1/auth/login`
6. On success, tokens are set as httpOnly cookies
7. User is redirected to callback URL or `/dashboard`

### Files Involved

**Frontend Page:**
`src/app/(auth)/login/page.tsx`
- Client component with login form
- Fields: email, password
- Reads `callbackUrl` from query params for post-login redirect
- Validation: required fields, email format
- Calls `/api/auth/login` on submit

**API Route:**
`src/app/api/auth/login/route.ts`
- POST handler
- Forwards request to backend `{API_URL}/auth/login`
- Sets cookies same as registration
- Returns `{ success: true }` on success

### Code Flow

```
LoginPage (client)
    ↓ POST /api/auth/login
API Route (server)
    ↓ POST {BACKEND}/auth/login
Backend Response
    ↓ { accessToken, refreshToken }
API Route sets cookies
    ↓ access_token, refresh_token
Redirect to callbackUrl or /dashboard
```

---

## 3. User Activation/Deactivation

### Flow Overview

User activation/deactivation is managed through the tables system. Users with appropriate permissions can activate or deactivate other users from the users table.

### Files Involved

**DataTable Component:**
`src/components/tables/DataTable.tsx`
- `handleActivate(id)`: PATCH request with `{ is_active: true }`
- `handleDeactivate(id)`: PATCH request with `{ is_active: false }`
- Both call `/api/tables/{tableName}/rows/{id}`

**TableActions Component:**
`src/components/tables/TableActions.tsx`
- Shows Activate button if `hasAction(permissions, 'activate')` and `!isActive`
- Shows Deactivate button if `hasAction(permissions, 'deactivate')` and `isActive`

### Activation Flow

```
TableActions
    ↓ onClick → onActivate()
DataTable.handleActivate(id)
    ↓ PATCH /api/tables/users/rows/{id}
    ↓ body: { is_active: true }
Backend updates user
    ↓ Success
DataTable.fetchRows() - refresh table
```

---

## 4. Dashboard

### Flow Overview

1. User accesses `/dashboard` (protected route)
2. Middleware validates/refreshes token
3. Protected layout fetches user data via `/api/v1/users/me`
4. Dashboard page displays user greeting and stats (for admins)

### Files Involved

**Dashboard Page:**
`src/app/(protected)/dashboard/page.tsx`
- Client component
- Displays personalized greeting based on time of day
- For admin users: fetches and displays stats from `/api/admin/dashboard`
- Shows quick action cards (View Profile, Manage Tables)
- Displays account information (name, email, role, status)

**Protected Layout:**
`src/app/(protected)/layout.tsx`
- Server component
- Calls `getSession()` to verify authentication
- Fetches user data from `{API_URL}/users/me`
- Handles session states: success, no_session, needs_refresh, server_error
- Redirects to login if unauthenticated

**ProtectedLayoutClient:**
`src/app/(protected)/ProtectedLayoutClient.tsx`
- Client component wrapper
- Syncs user data to Zustand store via `setUser(user)`
- Renders Header and Sidebar layout

### Dashboard Stats (Admin Only)

```typescript
interface DashboardStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    users: number;
    viewers: number;
  };
  recentActivity: {
    newUsersThisWeek: number;
    newUsersThisMonth: number;
  };
}
```

### Code Flow

```
Browser requests /dashboard
    ↓
Middleware (src/middleware.ts)
    ↓ Validates/refreshes token
Protected Layout (server)
    ↓ GET {BACKEND}/users/me
    ↓ Returns user data
ProtectedLayoutClient (client)
    ↓ setUser(user) to Zustand store
DashboardPage (client)
    ↓ isAdmin() ? fetch /api/admin/dashboard : skip
    ↓ Render greeting, stats, quick actions
```

---

## 5. Tables System

### Overview

The tables system provides a dynamic, configuration-driven interface for managing database tables. Each table has a configuration that defines columns, permissions, and behavior.

### Files Involved

**Tables List Page:**
`src/app/(protected)/tables/page.tsx`
- Fetches all available tables from `/api/tables`
- Displays table cards with name, description, record count
- Provides search/filter functionality

**Individual Table Page:**
`src/app/(protected)/tables/[table]/page.tsx`
- Dynamic route for any table
- Fetches table configuration from `/api/tables/{tableName}`
- Renders DataTable component with configuration

**DataTable Component:**
`src/components/tables/DataTable.tsx`
- Main table rendering component
- Features:
  - Pagination with configurable page size
  - Sorting (click column headers)
  - Filtering (via TableFilters component)
  - Search
  - CSV download
  - Inline editing (for specific tables)
  - CRUD actions via TableActions

**TableFilters Component:**
`src/components/tables/TableFilters.tsx`
- Search input
- Column-specific filters
- Filter chips display

### Table Configuration Structure

```typescript
interface TableConfig {
  name: string;           // Table identifier (e.g., "users")
  label: string;          // Display name (e.g., "Users")
  columns: TableColumn[]; // Column definitions
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
  options?: ColumnOption[];      // For select type
  optionsEndpoint?: string;      // For dynamic options
}

interface TablePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  actions: string[];  // e.g., ['activate', 'deactivate', 'export']
}
```

### Data Fetch Flow

```
DataTable component mounts
    ↓
fetchRows() called
    ↓ GET /api/tables/{tableName}/rows
    ↓ Query params: page, limit, sortBy, sortOrder, search, filters
Backend returns
    ↓ { data: [...], meta: { total, totalPages } }
DataTable renders rows
    ↓ Column values rendered via renderCellValue()
    ↓ Actions rendered via TableActions
```

---

## 6. CRUD Operations

### View Record (Read)

**File:** `src/app/(protected)/tables/[table]/[id]/page.tsx`

**Flow:**
1. Navigate to `/tables/{tableName}/{id}`
2. Page fetches config and row data in parallel
3. Displays record details in read-only format
4. Edit button shown if `canEdit(permissions)` is true

**API Calls:**
- `GET /api/tables/{tableName}` - table config
- `GET /api/tables/{tableName}/rows/{id}` - row data

### Create Record (Create)

**File:** `src/app/(protected)/tables/[table]/new/page.tsx`

**Flow:**
1. Navigate to `/tables/{tableName}/new`
2. Page fetches table config
3. Checks `canCreate(permissions)` - redirects if false
4. Renders DynamicForm component
5. On submit, POST to create endpoint
6. Redirects to detail page on success

**API Calls:**
- `GET /api/tables/{tableName}` - table config
- `POST /api/tables/{tableName}/rows` - create record

### Edit Record (Update)

**File:** `src/app/(protected)/tables/[table]/[id]/page.tsx` with `?edit=true`

**Flow:**
1. Navigate to `/tables/{tableName}/{id}?edit=true`
2. Page renders DynamicForm with initial data
3. On submit, PATCH to update endpoint
4. Redirects to view mode on success

**API Calls:**
- `PATCH /api/tables/{tableName}/rows/{id}` - update record

### Delete Record (Delete)

**File:** `src/components/tables/DataTable.tsx` and `TableActions.tsx`

**Flow:**
1. Click delete action in table row
2. Confirmation dialog appears
3. On confirm, DELETE request sent
4. Table refreshes on success

**API Calls:**
- `DELETE /api/tables/{tableName}/rows/{id}` - delete record

### Inline Editing

**File:** `src/components/tables/DataTable.tsx`

Certain tables support inline cell editing:
- `product_lab_markup`: cost, standard_price, nf_price, commitment_eligible
- `product_lab_rev_share`: dynamic fee columns

**Flow:**
1. Click on editable cell
2. Input field appears
3. Edit value
4. On blur or Enter, PATCH request sent
5. Cell updates or reverts on error

---

## 7. DynamicForm Component

**File:** `src/components/tables/DynamicForm.tsx`

### Overview

A configurable form component that renders form fields based on column definitions. Supports various field types and handles foreign key relationships.

### Features

**Field Types:**
- text, number, email, password
- date
- boolean (rendered as Yes/No select)
- select (static options or dynamic from API)
- Autocomplete (typeahead search for foreign keys)

**Foreign Key Support:**
```typescript
const FOREIGN_KEY_CONFIG = {
  lab_id: { endpoint: '/api/labs/ids', ... },
  practice_id: { endpoint: '/api/practices/ids', useTypeahead: true, ... },
  dental_group_id: { endpoint: '/api/dental-groups/ids', useTypeahead: true, ... },
  // ...
};
```

**Dependent Fields:**
Some fields depend on other fields (e.g., lab_product_id depends on lab_id):
```typescript
const DEPENDENT_FIELD_CONFIG = {
  product_lab_markup: {
    lab_product_id: {
      dependsOn: 'lab_id',
      endpoint: (labId) => `/api/tables/lab_product_mapping/rows?filters=...`,
      // ...
    },
  },
};
```

**Auto-fill Configuration:**
When a field changes, can automatically fill related fields:
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

### Form Validation

- Required field validation
- Email format validation
- Number type validation
- Password length validation (6-50 characters)
- Typeahead selection validation (must select from dropdown)

---

## 8. Authentication State Management

### Zustand Store

**File:** `src/store/authStore.ts`

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
  isAdmin: () => boolean;
  // ...
}
```

**Persistence:**
- User data persisted to sessionStorage
- Automatically restored on page reload

### Client-Side Fetch

**File:** `src/lib/fetch-client.ts`

```typescript
export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...options, credentials: 'include' });

  if (response.status === 401) {
    // Redirect to login
    window.location.href = `/login?callbackUrl=${currentPath}`;
  }

  return response;
}
```

---

## 9. Permissions System

### Permission Helpers

**File:** `src/lib/permissions.ts`

```typescript
canView(permissions)   // permissions?.read
canCreate(permissions) // permissions?.create
canEdit(permissions)   // permissions?.update
canDelete(permissions) // permissions?.delete
hasAction(permissions, action) // permissions?.actions?.includes(action)
```

### Permission Flow

1. Backend returns permissions with table config
2. DataTable receives permissions
3. UI elements conditionally rendered:
   - "Add New" button: `canCreate(permissions)`
   - Edit action: `canEdit(permissions)`
   - Delete action: `canDelete(permissions)`
   - Activate/Deactivate: `hasAction(permissions, 'activate'/'deactivate')`

---

## 10. Token Refresh System

### Overview

The application uses a three-layer token refresh system to ensure seamless authentication.

### Layers

**Layer 1 - Middleware:**
`src/middleware.ts`
- Intercepts all page requests
- Checks if access token is missing/expired/corrupted
- If refresh token exists, attempts refresh
- Sets new cookies and redirects to same URL

**Layer 2 - Protected Layout:**
`src/app/(protected)/layout.tsx`
- Server-side session verification
- Calls `/api/v1/users/me` to validate token
- On 401, delegates to session-refresh route

**Layer 3 - Session Recovery Route:**
`src/app/api/auth/session-refresh/route.ts`
- Handles edge cases where middleware can't detect invalid token
- Can set cookies (unlike Server Components)
- Either refreshes successfully or clears cookies and redirects to login

### Token Configuration

- Access Token: 1 day, httpOnly cookie
- Refresh Token: 7 days, httpOnly cookie
- Cookies: `secure: false`, `sameSite: 'lax'`, `path: '/'`

---

## 11. Routes Reference

**Public Routes:**
- `/login` - Login page
- `/register` - Registration page

**Protected Routes:**
- `/dashboard` - Main dashboard
- `/profile` - User profile
- `/tables` - Tables list
- `/tables/{tableName}` - Individual table view
- `/tables/{tableName}/new` - Create new record
- `/tables/{tableName}/{id}` - View record
- `/tables/{tableName}/{id}?edit=true` - Edit record

**API Routes:**
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/session-refresh` - Session recovery

---

## 12. Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

This variable configures the backend API base URL used by all API routes.

---

## 13. File Reference Summary

**Authentication:**
- `src/app/(auth)/login/page.tsx` - Login UI
- `src/app/(auth)/register/page.tsx` - Registration UI
- `src/app/api/auth/login/route.ts` - Login API
- `src/app/api/auth/register/route.ts` - Register API
- `src/app/api/auth/logout/route.ts` - Logout API
- `src/app/api/auth/refresh/route.ts` - Token refresh API
- `src/app/api/auth/session-refresh/route.ts` - Session recovery

**Protected Area:**
- `src/app/(protected)/layout.tsx` - Auth wrapper (server)
- `src/app/(protected)/ProtectedLayoutClient.tsx` - Layout (client)
- `src/app/(protected)/dashboard/page.tsx` - Dashboard
- `src/app/(protected)/profile/page.tsx` - User profile

**Tables System:**
- `src/app/(protected)/tables/page.tsx` - Tables list
- `src/app/(protected)/tables/[table]/page.tsx` - Table view
- `src/app/(protected)/tables/[table]/new/page.tsx` - Create record
- `src/app/(protected)/tables/[table]/[id]/page.tsx` - View/Edit record
- `src/components/tables/DataTable.tsx` - Table component
- `src/components/tables/DynamicForm.tsx` - Form component
- `src/components/tables/TableActions.tsx` - Row actions
- `src/components/tables/TableFilters.tsx` - Filter controls

**Core:**
- `src/middleware.ts` - Token refresh middleware
- `src/store/authStore.ts` - Auth state management
- `src/lib/fetch-client.ts` - Authenticated fetch wrapper
- `src/lib/permissions.ts` - Permission helpers
- `src/config/ui.constants.ts` - App constants
- `src/types/` - TypeScript definitions
