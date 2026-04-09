import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="text-zinc-50 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-50 mb-2">Access Denied</h2>
          <p className="text-zinc-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};