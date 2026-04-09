import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, X } from 'lucide-react';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

export const ApplicationUpdateDialog = ({ open, onOpenChange, application, onSaved }) => {
  const [ipAllowlist, setIpAllowlist] = useState([]);
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (application) {
      setIpAllowlist(application.ip_allowlist || []);
    }
  }, [application]);

  const validateIp = (ip) => {
    // Basic IP/CIDR validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('/');
    const ipParts = parts[0].split('.');
    
    // Validate each octet
    for (const part of ipParts) {
      const num = parseInt(part);
      if (num < 0 || num > 255) return false;
    }
    
    // Validate CIDR if present
    if (parts.length === 2) {
      const cidr = parseInt(parts[1]);
      if (cidr < 0 || cidr > 32) return false;
    }
    
    return true;
  };

  const handleAddIp = () => {
    if (!newIp.trim()) {
      toast.error('Please enter an IP address');
      return;
    }
    
    if (!validateIp(newIp.trim())) {
      toast.error('Invalid IP address or range format');
      return;
    }
    
    if (ipAllowlist.includes(newIp.trim())) {
      toast.error('IP already in list');
      return;
    }
    
    setIpAllowlist([...ipAllowlist, newIp.trim()]);
    setNewIp('');
  };

  const handleRemoveIp = (index) => {
    setIpAllowlist(ipAllowlist.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await api.put(`/applications/${application.id}`, { ip_allowlist: ipAllowlist });
      toast.success('Application updated successfully');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to update application');
    } finally {
      setSaving(false);
    }
  };

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121214] border-[#27272A] text-zinc-50 max-w-2xl" data-testid="update-app-dialog">
        <DialogHeader>
          <DialogTitle className="text-zinc-50" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Update Application - {application.name}
          </DialogTitle>
          <div className="text-sm text-zinc-400 font-mono">Namespace: {application.namespace}</div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label className="text-zinc-50 text-xs tracking-[0.2em] uppercase font-bold">IP Allowlist</Label>
            
            {/* Add IP */}
            <div className="flex gap-2">
              <Input
                placeholder="10.0.0.1 or 10.0.0.0/24"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIp())}
                className="bg-[#09090B] border-[#27272A] text-zinc-50 font-mono"
                data-testid="ip-input"
              />
              <Button
                type="button"
                onClick={handleAddIp}
                className="bg-blue-600 hover:bg-blue-500"
                data-testid="add-ip-button"
              >
                <Plus size={18} />
              </Button>
            </div>
            <p className="text-xs text-zinc-500">Enter IP address (e.g., 192.168.1.1) or CIDR range (e.g., 10.0.0.0/24)</p>

            {/* IP List */}
            {ipAllowlist.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-[#27272A] rounded-md p-3">
                {ipAllowlist.map((ip, index) => (
                  <div key={index} className="flex items-center justify-between bg-[#09090B] border border-[#27272A] rounded px-3 py-2" data-testid={`ip-item-${index}`}>
                    <span className="text-sm font-mono text-zinc-50">{ip}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-red-400"
                      onClick={() => handleRemoveIp(index)}
                      data-testid={`remove-ip-${index}`}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-[#27272A] rounded-md text-zinc-500">
                No IP addresses added yet
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-[#27272A] text-zinc-50 hover:bg-[#18181B]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
              disabled={saving}
              data-testid="update-app-submit"
            >
              {saving ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};