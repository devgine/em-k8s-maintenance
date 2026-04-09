import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

export const ApplicationDialog = ({ open, onOpenChange, onSaved }) => {
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('');
  const [namespaces, setNamespaces] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);

  useEffect(() => {
    if (open) {
      fetchNamespaces();
    }
  }, [open]);

  const fetchNamespaces = async () => {
    setLoadingNamespaces(true);
    try {
      const { data } = await api.get('/namespaces');
      setNamespaces(data.namespaces);
    } catch (error) {
      toast.error('Failed to load namespaces');
    } finally {
      setLoadingNamespaces(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await api.post('/applications', { name, namespace });
      toast.success('Application created successfully');
      setName('');
      setNamespace('');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to create application');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121214] border-[#27272A] text-zinc-50" data-testid="create-app-dialog">
        <DialogHeader>
          <DialogTitle className="text-zinc-50" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Create Application</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-50 text-xs tracking-[0.2em] uppercase font-bold">Application Name</Label>
            <Input
              placeholder="my-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#09090B] border-[#27272A] text-zinc-50 font-mono"
              data-testid="app-name-input"
              required
            />
            <p className="text-xs text-zinc-500">Lowercase alphanumeric with hyphens</p>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-50 text-xs tracking-[0.2em] uppercase font-bold">Namespace</Label>
            {loadingNamespaces ? (
              <div className="text-sm text-zinc-400">Loading namespaces...</div>
            ) : (
              <Select value={namespace} onValueChange={setNamespace} required>
                <SelectTrigger className="bg-[#09090B] border-[#27272A] text-zinc-50 font-mono" data-testid="namespace-select">
                  <SelectValue placeholder="Select namespace" />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#27272A] text-zinc-50">
                  {namespaces.map((ns) => (
                    <SelectItem key={ns} value={ns} className="font-mono">{ns}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-zinc-500">Existing Kubernetes namespace</p>
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
              disabled={saving || !namespace}
              data-testid="create-app-submit"
            >
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};