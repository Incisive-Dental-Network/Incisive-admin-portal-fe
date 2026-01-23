'use client';

import { useState, FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge, RoleBadge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { fetchWithAuth } from '@/lib/fetch-client';
import { User as UserIcon } from 'lucide-react';
import type { User } from '@/types';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate() || !user) return;

    setIsLoading(true);
    try {
      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Update failed');
      }

      const updatedUser: User = await response.json();
      setUser(updatedUser);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
    });
    setErrors({});
    setIsEditing(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1">
          View and manage your account information
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header with Avatar */}
        <div className="bg-gray-50 px-6 py-8 border-b">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {user.first_name} {user.last_name}
              </h2>
              <p className="text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={user.role} />
                <StatusBadge isActive={user.is_active} />
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="p-6">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={formData.first_name}
                  onChange={handleChange('first_name')}
                  error={errors.first_name}
                  required
                />
                <Input
                  label="Last Name"
                  value={formData.last_name}
                  onChange={handleChange('last_name')}
                  error={errors.last_name}
                  required
                />
              </div>

              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                error={errors.email}
                required
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <dl className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">First Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.first_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.last_name}</dd>
                  </div>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Role</dt>
                    <dd className="mt-1">
                      <RoleBadge role={user.role} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1">
                      <StatusBadge isActive={user.is_active} />
                    </dd>
                  </div>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">User ID</dt>
                  <dd className="mt-1 text-sm text-gray-500 font-mono">{user.id}</dd>
                </div>
              </dl>

              <div className="pt-4 border-t">
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
