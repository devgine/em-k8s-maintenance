import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Sparkle, Copy } from '@phosphor-icons/react';
import api from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { toast } from 'sonner';
import { calculatePasswordStrength } from '../utils/passwordStrength';

export const PasswordGenerator = () => {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [options, setOptions] = useState({
    include_uppercase: true,
    include_lowercase: true,
    include_numbers: true,
    include_symbols: true
  });
  const [generating, setGenerating] = useState(false);

  const generatePassword = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/password-generator', {
        length,
        ...options
      });
      setPassword(data.password);
    } catch (error) {
      toast.error('Failed to generate password');
    } finally {
      setGenerating(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(password);

  return (
    <div className="bg-[#0F0F11] border border-[#27272A] rounded-md p-4" data-testid="password-generator">
      <div className="flex items-center gap-2 mb-4">
        <Sparkle size={20} weight="duotone" className="text-[#3B82F6]" />
        <h3 className="text-sm font-bold text-[#F8FAFC] tracking-[0.2em] uppercase" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Password Generator
        </h3>
      </div>

      {password && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Input
              value={password}
              readOnly
              className="bg-[#050505] border-[#27272A] text-[#F8FAFC] font-mono text-sm"
              data-testid="generated-password"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0 text-[#64748B] hover:text-[#F8FAFC]"
              onClick={() => copyToClipboard(password, 'Password')}
              data-testid="copy-generated-password"
            >
              <Copy size={16} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-[#1A1A1D] rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${(passwordStrength.score + 1) * 20}%`,
                  backgroundColor: passwordStrength.color 
                }}
              />
            </div>
            <span className="text-xs" style={{ color: passwordStrength.color }}>
              {passwordStrength.label}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[#F8FAFC] text-xs">Length: {length}</Label>
          </div>
          <Slider
            value={[length]}
            onValueChange={(value) => setLength(value[0])}
            min={8}
            max={32}
            step={1}
            className="cursor-pointer"
            data-testid="password-length-slider"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[#F8FAFC] text-xs">Uppercase (A-Z)</Label>
            <Switch
              checked={options.include_uppercase}
              onCheckedChange={(checked) => setOptions({ ...options, include_uppercase: checked })}
              data-testid="uppercase-switch"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[#F8FAFC] text-xs">Lowercase (a-z)</Label>
            <Switch
              checked={options.include_lowercase}
              onCheckedChange={(checked) => setOptions({ ...options, include_lowercase: checked })}
              data-testid="lowercase-switch"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[#F8FAFC] text-xs">Numbers (0-9)</Label>
            <Switch
              checked={options.include_numbers}
              onCheckedChange={(checked) => setOptions({ ...options, include_numbers: checked })}
              data-testid="numbers-switch"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[#F8FAFC] text-xs">Symbols (!@#$)</Label>
            <Switch
              checked={options.include_symbols}
              onCheckedChange={(checked) => setOptions({ ...options, include_symbols: checked })}
              data-testid="symbols-switch"
            />
          </div>
        </div>

        <Button
          onClick={generatePassword}
          className="w-full bg-[#3B82F6] hover:bg-[#60A5FA] text-white"
          disabled={generating}
          data-testid="generate-password-button"
        >
          {generating ? 'Generating...' : 'Generate Password'}
        </Button>
      </div>
    </div>
  );
};