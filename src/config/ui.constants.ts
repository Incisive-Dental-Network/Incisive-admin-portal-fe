export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export const TOAST_DURATION = 4000;

export const DEBOUNCE_DELAY = 300;

export const TABLE_ICONS: Record<string, string> = {
  users: 'Users',
  products: 'Package',
  orders: 'ShoppingCart',
  categories: 'Folder',
  settings: 'Settings',
  logs: 'FileText',
  default: 'Table',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  TABLES: '/tables',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  USERS: {
    ME: '/users/me',
    LIST: '/users',
    BY_ID: (id: string) => `/users/${id}`,
  },
  TABLES: {
    LIST: '/tables',
    CONFIG: (table: string) => `/tables/${table}`,
    ROWS: (table: string) => `/tables/${table}/rows`,
    ROW: (table: string, id: string) => `/tables/${table}/rows/${id}`,
  },
  HEALTH: {
    PING: '/health/ping',
  },
} as const;

export const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
} as const;

export const ROLE_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-800',
  USER: 'bg-blue-100 text-blue-800',
} as const;
