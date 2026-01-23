'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';
import { ROUTES } from '@/config/ui.constants';
import { fetchWithAuth } from '@/lib/fetch-client';
import type { LoginRequest, RegisterRequest, User } from '@/types';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout: storeLogout } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetchWithAuth('/api/users/me');
        if (response.ok) {
          const userData: User = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      }
    };

    if (!user) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [user, setUser, setLoading]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setIsSubmitting(true);
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Login failed');
        }

        // Fetch user data after successful login
        const userResponse = await fetchWithAuth('/api/users/me');
        if (userResponse.ok) {
          const userData: User = await userResponse.json();
          setUser(userData);
          toast.success('Welcome back!');
          router.push(ROUTES.DASHBOARD);
          return true;
        }

        throw new Error('Failed to fetch user data');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        toast.error(message);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [router, setUser]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      setIsSubmitting(true);
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Registration failed');
        }

        // Fetch user data after successful registration
        const userResponse = await fetchWithAuth('/api/users/me');
        if (userResponse.ok) {
          const userData: User = await userResponse.json();
          setUser(userData);
          toast.success('Account created successfully!');
          router.push(ROUTES.DASHBOARD);
          return true;
        }

        throw new Error('Failed to fetch user data');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        toast.error(message);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [router, setUser]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      storeLogout();
      router.push(ROUTES.LOGIN);
    }
  }, [router, storeLogout]);

  const isAdmin = user?.role === 'ADMIN';

  return {
    user,
    isAuthenticated,
    isLoading,
    isSubmitting,
    isAdmin,
    login,
    register,
    logout,
  };
}
