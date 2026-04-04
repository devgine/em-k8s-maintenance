import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Lock } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatApiErrorDetail } from '../utils/api';

export const LockScreen = () => {
  const { user, unlockSession } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await unlockSession(password);
      toast.success('Session unlocked');
      setPassword('');
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]" data-testid="lock-screen">
      <div className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#0F0F11] border border-[#27272A] flex items-center justify-center mb-4">
            <Lock size={40} weight="duotone" className="text-[#3B82F6]" />
          </div>
          <h2 className="text-2xl font-bold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Chivo', sans-serif" }}>Session Locked</h2>
          <p className="text-[#94A3B8] text-center" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Enter your password to unlock
          </p>
          <p className="text-[#64748B] text-sm mt-2">{user?.email}</p>
        </div>
        
        <form onSubmit={handleUnlock} className="space-y-4">
          <Input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-[#050505] border-[#27272A] text-[#F8FAFC] focus:ring-[#3B82F6]"
            data-testid="unlock-password-input"
            autoFocus
          />
          <Button
            type="submit"
            className="w-full bg-[#3B82F6] hover:bg-[#60A5FA] text-white"
            disabled={loading || !password}
            data-testid="unlock-button"
          >
            {loading ? 'Unlocking...' : 'Unlock Session'}
          </Button>
        </form>
      </div>
    </div>
  );
};