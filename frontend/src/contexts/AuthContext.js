import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  const AUTO_LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(Date.now());
      if (isLocked && user) {
        setIsLocked(false);
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [user, isLocked]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivity;
      if (timeSinceLastActivity >= AUTO_LOCK_TIME && !isLocked) {
        setIsLocked(true);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [lastActivity, user, isLocked]);

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/auth/me`, {
        withCredentials: true
      });
      setUser(data);
    } catch (error) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await axios.post(
      `${API_URL}/api/auth/login`,
      { email, password },
      { withCredentials: true }
    );
    setUser(data);
    setLastActivity(Date.now());
    return data;
  };

  const register = async (email, password, name) => {
    const { data } = await axios.post(
      `${API_URL}/api/auth/register`,
      { email, password, name },
      { withCredentials: true }
    );
    setUser(data);
    setLastActivity(Date.now());
    return data;
  };

  const logout = async () => {
    try {
      await axios.post(
        `${API_URL}/api/auth/logout`,
        {},
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(false);
      setIsLocked(false);
    }
  };

  const unlockSession = async (password) => {
    try {
      await axios.post(
        `${API_URL}/api/auth/login`,
        { email: user.email, password },
        { withCredentials: true }
      );
      setIsLocked(false);
      setLastActivity(Date.now());
      return true;
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isLocked,
      login,
      register,
      logout,
      unlockSession,
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