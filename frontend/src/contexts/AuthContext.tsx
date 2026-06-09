import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

interface UserProfile {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  tenantId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerTenant: (payload: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(localStorage.getItem('tenant_id'));
  const [loading, setLoading] = useState(true);

  // Load user data on startup if token exists
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await api.get('/users/me');
          setUser(response.data);
          if (response.data.tenant_id) {
            localStorage.setItem('tenant_id', response.data.tenant_id);
            setTenantId(response.data.tenant_id);
          }
        } catch (error) {
          console.error('Failed to restore session', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    // Fetch user details immediately to capture their tenant ID
    const userResponse = await api.get('/users/me');
    const userProfile = userResponse.data;
    setUser(userProfile);

    if (userProfile.tenant_id) {
      localStorage.setItem('tenant_id', userProfile.tenant_id);
      setTenantId(userProfile.tenant_id);
    }
  };

  const registerTenant = async (payload: any) => {
    await api.post('/auth/register-tenant', payload);
    // After registration, auto-login with credentials
    await login(payload.admin_email, payload.admin_password);
  };

  const logout = () => {
    const token = localStorage.getItem('refresh_token');
    if (token) {
      api.post(`/auth/logout?refresh_token=${token}`).catch(() => {});
    }
    localStorage.clear();
    setUser(null);
    setTenantId(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenantId, loading, login, registerTenant, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
