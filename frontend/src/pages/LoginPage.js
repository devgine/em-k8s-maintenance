import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Shield, Info } from 'lucide-react';
import { toast } from 'sonner';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [token, setToken] = useState('');

  const keycloakUrl = process.env.REACT_APP_KEYCLOAK_URL;
  const keycloakRealm = process.env.REACT_APP_KEYCLOAK_REALM;
  const keycloakClientId = process.env.REACT_APP_KEYCLOAK_CLIENT_ID;
  const redirectUri = window.location.origin + '/login';

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }

    // Check for Keycloak redirect
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Exchange code for token (this would be done via backend in production)
      toast.info('Processing authentication...');
      // For now, just show message
      window.history.replaceState({}, document.title, '/login');
    }
  }, [user, navigate]);

  const handleLoginWithKeycloak = () => {
    const authUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth?client_id=${keycloakClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid`;
    window.location.href = authUrl;
  };

  const handleTokenLogin = (e) => {
    e.preventDefault();
    if (token.trim()) {
      login(token);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } else {
      toast.error('Please enter a valid token');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#09090B' }}
      data-testid="login-page"
    >
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/1c84658e-2f93-4ed7-8258-1a5b6c6f3bd0/images/19434e7acbad717547a94d18052e7db713fad57fd8de10d59c749272266b0e12.png)'
        }}
      />
      
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-blue-600 mb-4">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-zinc-50 tracking-tighter" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            K8s Maintenance
          </h1>
          <p className="text-zinc-400 mt-2" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Manage your Kubernetes application middlewares
          </p>
        </div>

        <div className="bg-[#121214] border border-[#27272A] rounded-md p-8">
          <div className="space-y-6">
            {/* Keycloak SSO */}
            <div>
              <Button
                onClick={handleLoginWithKeycloak}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium"
                data-testid="keycloak-login-button"
              >
                <Shield size={18} className="mr-2" />
                Login with Keycloak
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#27272A]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#121214] px-2 text-zinc-500">Or use token</span>
              </div>
            </div>

            {/* Manual Token Login */}
            <form onSubmit={handleTokenLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-zinc-50 text-xs tracking-[0.2em] uppercase font-bold">Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Paste your JWT token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="bg-[#09090B] border-[#27272A] text-zinc-50 font-mono text-sm"
                  data-testid="token-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium"
                data-testid="token-login-button"
              >
                Login with Token
              </Button>
            </form>

            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
              <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-zinc-400">
                Get your access token from Keycloak admin console or use the SSO button above.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};