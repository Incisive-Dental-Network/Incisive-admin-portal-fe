'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/ui.constants';
import { fetchWithAuth } from '@/lib/fetch-client';
import {
  Users,
  Activity,
  TrendingUp,
  Settings,
  ArrowRight,
} from 'lucide-react';

interface DashboardStats {
  total_users?: number;
  active_users?: number;
  new_users_today?: number;
  new_users_this_week?: number;
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering auth-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      if (!mounted || !isAdmin()) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetchWithAuth('/api/admin/dashboard');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin, mounted]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, {user?.first_name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Welcome to your dashboard. Here&apos;s what&apos;s happening.
        </p>
      </div>

      {/* Admin Stats */}
      {mounted && isAdmin() && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Users"
                value={stats.total_users || 0}
                icon={<Users className="h-5 w-5" />}
                color="blue"
              />
              <StatCard
                title="Active Users"
                value={stats.active_users || 0}
                icon={<Activity className="h-5 w-5" />}
                color="green"
              />
              <StatCard
                title="New Today"
                value={stats.new_users_today || 0}
                icon={<TrendingUp className="h-5 w-5" />}
                color="purple"
              />
              <StatCard
                title="New This Week"
                value={stats.new_users_this_week || 0}
                icon={<TrendingUp className="h-5 w-5" />}
                color="orange"
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="View Profile"
            description="View and update your profile information"
            href={ROUTES.PROFILE}
            icon={<Users className="h-6 w-6" />}
          />

          <QuickActionCard
            title="Manage Tables"
            description="View and manage database tables"
            href={ROUTES.TABLES}
            icon={<Activity className="h-6 w-6" />}
          />
        </div>
      </div>

      {/* Account Info */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Account Information
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user?.first_name} {user?.last_name}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="mt-1 text-sm text-gray-900">{user?.role}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user?.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {user?.is_active ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

function QuickActionCard({ title, description, href, icon }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gray-100 rounded-lg text-gray-600">{icon}</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400" />
      </div>
    </Link>
  );
}
