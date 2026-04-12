import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, X, BookmarkCheck, Pencil, Check } from 'lucide-react';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

export const IPTemplatesDialog = ({ open, onOpenChange }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', value: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', value: '', description: '' });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ip-templates');
      setTemplates(data.templates);
    } catch (error) {
      toast.error('Failed to load IP templates');
    } finally {
      setLoading(false);
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

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    
    if (!validateIp(newTemplate.value)) {
      toast.error('Invalid IP address or CIDR range');
      return;
    }
    
    setSaving(true);
    try {
      await api.post('/ip-templates', newTemplate);
      toast.success('IP template saved successfully');
      setNewTemplate({ name: '', value: '', description: '' });
      setShowAddForm(false);
      fetchTemplates();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (template) => {
    setEditingId(template.id);
    setEditForm({
      name: template.name,
      value: template.value,
      description: template.description || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', value: '', description: '' });
  };

  const handleSaveEdit = async (templateId) => {
    if (editForm.value && !validateIp(editForm.value)) {
      toast.error('Invalid IP address or CIDR range');
      return;
    }
    
    setUpdating(true);
    try {
      const { data } = await api.put(`/ip-templates/${templateId}`, editForm);
      const affected = data.affected_apps || [];
      
      if (affected.length > 0) {
        toast.success(`Template updated. ${affected.length} application(s) updated: ${affected.join(', ')}`);
      } else {
        toast.success('Template updated successfully');
      }
      
      setEditingId(null);
      fetchTemplates();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to update template');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this IP template? Linked entries in applications will become manual entries.')) return;
    
    try {
      const { data } = await api.delete(`/ip-templates/${templateId}`);
      toast.success(data.message || 'Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121214] border-[#27272A] text-zinc-50 max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="ip-templates-dialog">
        <DialogHeader>
          <DialogTitle className="text-zinc-50 flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <BookmarkCheck size={24} className="text-blue-400" />
            Saved IP Templates
          </DialogTitle>
          <p className="text-sm text-zinc-400">Reusable IP addresses and CIDR ranges. Editing a template updates all linked applications.</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Template Button/Form */}
          {!showAddForm ? (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-blue-600 hover:bg-blue-500"
              data-testid="show-add-form-button"
            >
              <Plus size={18} className="mr-2" />
              Add New Template
            </Button>
          ) : (
            <form onSubmit={handleAddTemplate} className="space-y-3 p-4 bg-[#09090B] border border-[#27272A] rounded-md">
              <div className="space-y-2">
                <Label className="text-zinc-50 text-xs tracking-[0.2em] uppercase font-bold">Template Name</Label>
                <Input
                  placeholder="Office Network, VPN IPs, etc."
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="bg-[#121214] border-[#27272A] text-zinc-50"
                  data-testid="template-name-input"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-50 text-xs tracking-[0.2em] uppercase font-bold">IP or CIDR</Label>
                <Input
                  placeholder="192.168.1.0/24 or 10.0.0.1"
                  value={newTemplate.value}
                  onChange={(e) => setNewTemplate({ ...newTemplate, value: e.target.value })}
                  className="bg-[#121214] border-[#27272A] text-zinc-50 font-mono"
                  data-testid="template-value-input"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-50 text-xs tracking-[0.2em] uppercase font-bold">Description (Optional)</Label>
                <Textarea
                  placeholder="Main office network"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="bg-[#121214] border-[#27272A] text-zinc-50 h-20"
                  data-testid="template-description-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 border-[#27272A] text-zinc-50 hover:bg-[#18181B]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                  disabled={saving}
                  data-testid="save-template-button"
                >
                  {saving ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </form>
          )}

          {/* Templates List */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Saved Templates ({templates.length})</h4>
            {loading ? (
              <div className="text-center py-8 text-zinc-500">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 border border-[#27272A] rounded-md">
                <BookmarkCheck size={48} className="mx-auto mb-3 text-zinc-600" />
                <p className="text-zinc-500">No saved IP templates yet</p>
                <p className="text-xs text-zinc-600 mt-1">Create reusable IP addresses to use across applications</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="templates-list">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-[#09090B] border border-[#27272A] rounded-md p-3 hover:border-[#3F3F46] transition-colors"
                    data-testid={`template-${template.id}`}
                  >
                    {editingId === template.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-zinc-400 text-xs uppercase">Name</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="bg-[#121214] border-[#27272A] text-zinc-50 h-9"
                            data-testid={`edit-name-${template.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400 text-xs uppercase">IP / CIDR</Label>
                          <Input
                            value={editForm.value}
                            onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                            className="bg-[#121214] border-[#27272A] text-zinc-50 font-mono h-9"
                            data-testid={`edit-value-${template.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400 text-xs uppercase">Description</Label>
                          <Input
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="bg-[#121214] border-[#27272A] text-zinc-50 h-9"
                            data-testid={`edit-desc-${template.id}`}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="flex-1 border-[#27272A] text-zinc-50 hover:bg-[#18181B]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(template.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-500"
                            disabled={updating}
                            data-testid={`save-edit-${template.id}`}
                          >
                            {updating ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-zinc-50">{template.name}</h5>
                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs font-mono text-blue-400">
                              {template.value}
                            </span>
                          </div>
                          {template.description && (
                            <p className="text-xs text-zinc-500">{template.description}</p>
                          )}
                          <p className="text-xs text-zinc-600 mt-1">
                            Created by {template.created_by}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-blue-400"
                            onClick={() => handleStartEdit(template)}
                            data-testid={`edit-template-${template.id}`}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                            onClick={() => handleDeleteTemplate(template.id)}
                            data-testid={`delete-template-${template.id}`}
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#27272A] text-zinc-50 hover:bg-[#18181B]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
