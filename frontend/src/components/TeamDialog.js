import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPlus, Trash, ShieldCheck, PencilSimple, Eye } from '@phosphor-icons/react';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

const roleIcons = {
  admin: ShieldCheck,
  editor: PencilSimple,
  viewer: Eye
};

const roleColors = {
  admin: '#EF4444',
  editor: '#3B82F6',
  viewer: '#10B981'
};

export const TeamDialog = ({ open, onOpenChange, space, onUpdate, userRole }) => {
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');
  const [loading, setLoading] = useState(false);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/spaces/${space.id}/members`, {
        email: newMemberEmail,
        role: newMemberRole
      });
      toast.success('Member added successfully');
      setNewMemberEmail('');
      setNewMemberRole('viewer');
      setAddingMember(false);
      onUpdate();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await api.delete(`/spaces/${space.id}/members/${userId}`);
      toast.success('Member removed successfully');
      onUpdate();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/spaces/${space.id}/members/${userId}/role`, { role: newRole });
      toast.success('Role updated successfully');
      onUpdate();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to update role');
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC] max-w-2xl" data-testid="team-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]" style={{ fontFamily: "'Chivo', sans-serif" }}>Team Management</DialogTitle>
        </DialogHeader>

        {/* Add Member Form */}
        {isAdmin && (
          <div className="mb-6">
            {!addingMember ? (
              <Button
                onClick={() => setAddingMember(true)}
                className="bg-[#3B82F6] hover:bg-[#60A5FA] text-white"
                data-testid="add-member-button"
              >
                <UserPlus size={16} className="mr-2" />
                Add Member
              </Button>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-3 p-4 bg-[#050505] border border-[#27272A] rounded-md">
                <div className="space-y-2">
                  <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Email</Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC]"
                    data-testid="member-email-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Role</Label>
                  <Select value={newMemberRole} onValueChange={setNewMemberRole} data-testid="member-role-select">
                    <SelectTrigger className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC]">
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddingMember(false)}
                    className="flex-1 border-[#27272A] text-[#F8FAFC] hover:bg-[#1A1A1D]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#3B82F6] hover:bg-[#60A5FA] text-white"
                    disabled={loading}
                    data-testid="add-member-submit"
                  >
                    {loading ? 'Adding...' : 'Add Member'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Members List */}
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-[#F8FAFC] mb-3 tracking-[0.2em] uppercase" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Members ({space?.members?.length || 0})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="members-list">
            {space?.members?.map((member) => {
              const RoleIcon = roleIcons[member.role];
              const roleColor = roleColors[member.role];
              const isOwner = member.user_id === space.owner_id;
              
              return (
                <div
                  key={member.user_id}
                  className="bg-[#050505] border border-[#27272A] rounded-md p-3 flex items-center justify-between"
                  data-testid={`member-${member.user_id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1A1A1D] border border-[#27272A] flex items-center justify-center">
                      <RoleIcon size={20} weight="duotone" style={{ color: roleColor }} />
                    </div>
                    <div>
                      <div className="text-[#F8FAFC] font-medium">
                        {member.name}
                        {isOwner && (
                          <span className="ml-2 text-xs bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-2 py-0.5 rounded">Owner</span>
                        )}
                      </div>
                      <div className="text-sm text-[#94A3B8]">{member.email}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isAdmin && !isOwner ? (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleUpdateRole(member.user_id, value)}
                          data-testid={`role-select-${member.user_id}`}
                        >
                          <SelectTrigger className="w-32 bg-[#0F0F11] border-[#27272A] text-[#F8FAFC] text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC]">
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#EF4444]"
                          onClick={() => handleRemoveMember(member.user_id)}
                          data-testid={`remove-member-${member.user_id}`}
                        >
                          <Trash size={16} />
                        </Button>
                      </>
                    ) : (
                      <span 
                        className="px-3 py-1 rounded text-xs font-medium capitalize"
                        style={{ 
                          backgroundColor: `${roleColor}20`,
                          color: roleColor,
                          border: `1px solid ${roleColor}40`
                        }}
                      >
                        {member.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};