import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LockKey, ShieldCheck } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatApiErrorDetail } from '../utils/api';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginData.email, loginData.password);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerData.email, registerData.password, registerData.name);
      toast.success('Account created successfully');
      navigate('/dashboard');
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#050505' }}
      data-testid="login-page"
    >
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/1c84658e-2f93-4ed7-8258-1a5b6c6f3bd0/images/c109a796de88833f4f90d54ece761d2fdb05e7dddbfaf3ce7c06c1a5044bb6e8.png)'
        }}
      />
      
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-gradient-to-r from-[#3B82F6] to-[#10B981] mb-4">
            <ShieldCheck size={32} weight="duotone" className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-[#F8FAFC] tracking-tighter" style={{ fontFamily: "'Chivo', sans-serif" }}>
            VaultKeeper
          </h1>
          <p className="text-[#94A3B8] mt-2" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Your secure password and credentials manager
          </p>
        </div>

        {/* Auth Forms */}
        <div className="bg-[#0F0F11] border border-[#27272A] rounded-md p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="login-tab">Login</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="bg-[#050505] border-[#27272A] text-[#F8FAFC] focus:ring-1 focus:ring-[#3B82F6]"
                    data-testid="login-email-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="bg-[#050505] border-[#27272A] text-[#F8FAFC] focus:ring-1 focus:ring-[#3B82F6]"
                    data-testid="login-password-input"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#3B82F6] hover:bg-[#60A5FA] text-white font-medium tracking-wide"
                  disabled={loading}
                  data-testid="login-submit-button"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name" className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Name</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="John Doe"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    className="bg-[#050505] border-[#27272A] text-[#F8FAFC] focus:ring-1 focus:ring-[#3B82F6]"
                    data-testid="register-name-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="bg-[#050505] border-[#27272A] text-[#F8FAFC] focus:ring-1 focus:ring-[#3B82F6]"
                    data-testid="register-email-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="bg-[#050505] border-[#27272A] text-[#F8FAFC] focus:ring-1 focus:ring-[#3B82F6]"
                    data-testid="register-password-input"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#3B82F6] hover:bg-[#60A5FA] text-white font-medium tracking-wide"
                  disabled={loading}
                  data-testid="register-submit-button"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};