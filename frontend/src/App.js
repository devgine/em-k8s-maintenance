import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LockScreen } from './components/LockScreen';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SpaceDetailPage } from './pages/SpaceDetailPage';
import { Toaster } from './components/ui/sonner';
import './App.css';

const AppContent = () => {
  const { isLocked } = useAuth();

  return (
    <>
      {isLocked && <LockScreen />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/space/:spaceId" element={
          <ProtectedRoute>
            <SpaceDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#0F0F11',
            color: '#F8FAFC',
            border: '1px solid #27272A'
          }
        }}
      />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;