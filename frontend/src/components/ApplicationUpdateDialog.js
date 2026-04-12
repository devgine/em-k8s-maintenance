import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, X, BookmarkCheck, Pencil } from 'lucide-react';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

export const ApplicationUpdateDialog = ({ open, onOpenChange, application, onSaved }) => {
  const [ipAllowlist, setIpAllowlist] = useState([]);
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [inputMethod, setInputMethod] = useState('manual');

  useEffect(() => {
    if (application) {
      // Normalize ip_allowlist: support both old string[] and new object[] formats
      const normalized = (application.ip_allowlist || []).map(entry => {
        if (typeof entry === 'string') {
          return { type: 'manual', value: entry };
        }
        return entry;
      });
      setIpAllowlist(normalized);
    }
  }, [application]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    try {
      const { data } = await api.get('/ip-templates');
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const validateIp = (ip) => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('/');
    const ipParts = parts[0].split('.');
    
    for (const part of ipParts) {
      const num = parseInt(part);
      if (num < 0 || num > 255) return false;
    }
    
    if (parts.length === 2) {
      const cidr = parseInt(parts[1]);
      if (cidr < 0 || cidr > 32) return false;
    }
    
    return true;
  };

  const handleAddIp = () => {
    if (inputMethod === 'manual') {
      if (!newIp.trim()) {
        toast.error('Please enter an IP address');
        return;
      }
      
      if (!validateIp(newIp.trim())) {
        toast.error('Invalid IP address or range format');
        return;
      }
      
      const ipToAdd = newIp.trim();
      
      if (ipAllowlist.some(e => e.value === ipToAdd)) {
        toast.error('IP already in list');
        return;
      }
      
      setIpAllowlist([...ipAllowlist, { type: 'manual', value: ipToAdd }]);
      setNewIp('');
    } else {
      if (!selectedTemplate) {
        toast.error('Please select a template');
        return;
      }
      
      const template = templates.find(t => t.id === selectedTemplate);
      if (!template) {
        toast.error('Template not found');
        return;
      }
      
      // Check if same template is already linked
      if (ipAllowlist.some(e => e.template_id === template.id)) {
        toast.error('This template is already in the list');
        return;
      }
      
      setIpAllowlist([...ipAllowlist, {
        type: 'template',
        value: template.value,
        template_id: template.id,
        template_name: template.name
      }]);
      setSelectedTemplate('');
    }
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
            
            {/* Input Method Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setInputMethod('manual')}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  inputMethod === 'manual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#09090B] text-zinc-400 hover:text-zinc-200 border border-[#27272A]'
                }`}
                data-testid="manual-input-toggle"
              >
                <Pencil size={14} />
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('template')}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  inputMethod === 'template'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#09090B] text-zinc-400 hover:text-zinc-200 border border-[#27272A]'
                }`}
                data-testid="template-input-toggle"
              >
                <BookmarkCheck size={14} />
                From Template
              </button>
            </div>
            
            {/* Add IP - Manual or Template */}
            <div className="flex gap-2">
              {inputMethod === 'manual' ? (
                <Input
                  placeholder="10.0.0.1 or 10.0.0.0/24"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIp())}
                  className="bg-[#09090B] border-[#27272A] text-zinc-50 font-mono"
                  data-testid="ip-input"
                />
              ) : (
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="bg-[#09090B] border-[#27272A] text-zinc-50" data-testid="template-select">
                    <SelectValue placeholder="Select a saved template..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121214] border-[#27272A] text-zinc-50 max-h-64">
                    {templates.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-zinc-500">
                        No templates saved yet
                      </div>
                    ) : (
                      templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{template.name}</span>
                            <span className="text-xs text-zinc-400 font-mono">{template.value}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                onClick={handleAddIp}
                className="bg-blue-600 hover:bg-blue-500"
                data-testid="add-ip-button"
              >
                <Plus size={18} />
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              {inputMethod === 'manual' 
                ? 'Enter IP address (e.g., 192.168.1.1) or CIDR range (e.g., 10.0.0.0/24)'
                : 'Select from your saved IP templates. Updating a template later will auto-update this app.'
              }
            </p>

            {/* IP List */}
            {ipAllowlist.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-[#27272A] rounded-md p-3">
                {ipAllowlist.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between rounded px-3 py-2 ${
                      entry.type === 'template'
                        ? 'bg-blue-500/5 border border-blue-500/20'
                        : 'bg-[#09090B] border border-[#27272A]'
                    }`}
                    data-testid={`ip-item-${index}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.type === 'template' ? (
                        <>
                          <BookmarkCheck size={14} className="text-blue-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-blue-400 truncate">{entry.template_name}</span>
                          <span className="text-xs text-zinc-500">:</span>
                          <span className="text-sm font-mono text-zinc-50">{entry.value}</span>
                        </>
                      ) : (
                        <span className="text-sm font-mono text-zinc-50">{entry.value}</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-red-400 flex-shrink-0"
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
