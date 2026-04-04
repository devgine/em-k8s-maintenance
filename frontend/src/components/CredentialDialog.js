import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';
import { calculatePasswordStrength } from '../utils/passwordStrength';

export const CredentialDialog = ({ open, onOpenChange, spaceId, credential, onSaved }) => {
  const [type, setType] = useState('password');
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    certificate: '',
    private_key: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (credential) {
      setType(credential.type);
      setFormData({
        title: credential.title,
        username: credential.decrypted_data?.username || '',
        password: credential.decrypted_data?.password || '',
        url: credential.decrypted_data?.url || '',
        notes: credential.decrypted_data?.notes || '',
        certificate: credential.decrypted_data?.certificate || '',
        private_key: credential.decrypted_data?.private_key || ''
      });
    } else {
      setType('password');
      setFormData({
        title: '',
        username: '',
        password: '',
        url: '',
        notes: '',
        certificate: '',
        private_key: ''
      });
    }
  }, [credential, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        type,
        space_id: spaceId
      };
      
      if (credential) {
        await api.put(`/credential/${credential.id}`, payload);
        toast.success('Credential updated successfully');
      } else {
        await api.post('/credentials', payload);
        toast.success('Credential created successfully');
      }
      
      onSaved();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC] max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="credential-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]" style={{ fontFamily: "'Chivo', sans-serif" }}>
            {credential ? 'Edit Credential' : 'Add Credential'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Type</Label>
            <Select value={type} onValueChange={setType} data-testid="credential-type-select">
              <SelectTrigger className="bg-[#050505] border-[#27272A] text-[#F8FAFC]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC]">
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="ssh_key">SSH Key</SelectItem>
                <SelectItem value="tls_cert">TLS Certificate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Title *</Label>
            <Input
              placeholder="My Account, Production Server, etc."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-[#050505] border-[#27272A] text-[#F8FAFC]"
              data-testid="credential-title-input"
              required
            />
          </div>

          {(type === 'password' || type === 'other') && (
            <>
              <div className="space-y-2">
                <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Username</Label>
                <Input
                  placeholder="username@example.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="bg-[#050505] border-[#27272A] text-[#F8FAFC] font-mono"
                  data-testid="credential-username-input"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-[#050505] border-[#27272A] text-[#F8FAFC] font-mono"
                  data-testid="credential-password-input"
                />
                {formData.password && (
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
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="bg-[#050505] border-[#27272A] text-[#F8FAFC]"
                  data-testid="credential-url-input"
                />
              </div>
            </>
          )}

          {type === 'ssh_key' && (
            <div className="space-y-2">
              <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Private Key</Label>
              <Textarea
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                value={formData.private_key}
                onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                className="bg-[#050505] border-[#27272A] text-[#F8FAFC] font-mono h-32"
                data-testid="credential-private-key-input"
              />
            </div>
          )}

          {type === 'tls_cert' && (
            <div className="space-y-2">
              <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Certificate</Label>
              <Textarea
                placeholder="-----BEGIN CERTIFICATE-----"
                value={formData.certificate}
                onChange={(e) => setFormData({ ...formData, certificate: e.target.value })}
                className="bg-[#050505] border-[#27272A] text-[#F8FAFC] font-mono h-32"
                data-testid="credential-certificate-input"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Notes</Label>
            <Textarea
              placeholder="Additional notes or information"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-[#050505] border-[#27272A] text-[#F8FAFC] h-24"
              data-testid="credential-notes-input"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-[#27272A] text-[#F8FAFC] hover:bg-[#1A1A1D]"
              data-testid="credential-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#3B82F6] hover:bg-[#60A5FA] text-white"
              disabled={saving}
              data-testid="credential-save-button"
            >
              {saving ? 'Saving...' : (credential ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};