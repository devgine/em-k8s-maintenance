import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [token]);

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/user/info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(data);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = (accessToken) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const hasRole = (role) => {
    return user?.roles?.includes(role) || false;
  };

  const isAdmin = () => hasRole('admin');
  const isUser = () => hasRole('user');
  const isReadonly = () => hasRole('readonly');

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      token,
      login,
      logout,
      hasRole,
      isAdmin,
      isUser,
      isReadonly,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};