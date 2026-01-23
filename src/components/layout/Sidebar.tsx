'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/config/ui.constants';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard,
  User,
  Settings,
  X,
  Database,
  Users,
  Activity,
  Table,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { TableInfo } from '@/types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, ReactNode> = {
  users: <Users className="h-5 w-5" />,
  activity: <Activity className="h-5 w-5" />,
  database: <Database className="h-5 w-5" />,
  table: <Table className="h-5 w-5" />,
  default: <Database className="h-5 w-5" />,
};

function NavItem({ href, icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isTablesExpanded, setIsTablesExpanded] = useState(true);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await fetchWithAuth('/api/tables');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.tables) {
            setTables(data.data.tables);
          } else if (data.tables) {
            setTables(data.tables);
          }
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
      }
    };

    if (user) {
      fetchTables();
    }
  }, [user]);

  const navItems = [
    {
      href: ROUTES.DASHBOARD,
      icon: <LayoutDashboard className="h-5 w-5" />,
      label: 'Dashboard',
    },
    {
      href: ROUTES.PROFILE,
      icon: <User className="h-5 w-5" />,
      label: 'Profile',
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 lg:hidden">
          <span className="text-lg font-semibold dark:text-white">Menu</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={pathname === item.href}
                onClick={onClose}
              />
            ))}
          </div>

          {/* Tables Section */}
          {tables.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setIsTablesExpanded(!isTablesExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-400"
              >
                <span>Tables</span>
                {isTablesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {isTablesExpanded && (
                <div className="space-y-1">
                  {tables.map((table) => (
                    <NavItem
                      key={table.name}
                      href={`${ROUTES.TABLES}/${table.name}`}
                      icon={iconMap[table.icon] || iconMap.default}
                      label={table.label}
                      isActive={pathname === `${ROUTES.TABLES}/${table.name}`}
                      onClick={onClose}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
