import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Plus, FolderOpen, Users, SignOut, ShieldCheck } from '@phosphor-icons/react';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSpace, setNewSpace] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    try {
      const { data } = await api.get('/spaces');
      setSpaces(data);
    } catch (error) {
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post('/spaces', newSpace);
      setSpaces([...spaces, data]);
      setCreateDialogOpen(false);
      setNewSpace({ name: '', description: '' });
      toast.success('Space created successfully');
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to create space');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-[#F8FAFC]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]" data-testid="dashboard-page">
      {/* Header */}
      <div className="bg-[#050505]/70 backdrop-blur-xl border-b border-white/10 saturate-150 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-gradient-to-r from-[#3B82F6] to-[#10B981] flex items-center justify-center">
              <ShieldCheck size={24} weight="duotone" className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#F8FAFC]" style={{ fontFamily: "'Chivo', sans-serif" }}>VaultKeeper</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#94A3B8] text-sm" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>{user?.email}</span>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-[#27272A] text-[#F8FAFC] hover:bg-[#1A1A1D]"
              data-testid="logout-button"
            >
              <SignOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Chivo', sans-serif" }}>Your Spaces</h2>
            <p className="text-[#94A3B8]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Organize your credentials into secure spaces
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#3B82F6] hover:bg-[#60A5FA] text-white" data-testid="create-space-button">
                <Plus size={20} className="mr-2" weight="bold" />
                Create Space
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0F0F11] border-[#27272A] text-[#F8FAFC]">
              <DialogHeader>
                <DialogTitle className="text-[#F8FAFC]" style={{ fontFamily: "'Chivo', sans-serif" }}>Create New Space</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSpace} className="space-y-4" data-testid="create-space-form">
                <div className="space-y-2">
                  <Label htmlFor="space-name" className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Space Name</Label>
                  <Input
                    id="space-name"
                    placeholder="Personal, Work, etc."
                    value={newSpace.name}
                    onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                    className="bg-[#050505] border-[#27272A] text-[#F8FAFC]"
                    data-testid="space-name-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="space-description" className="text-[#F8FAFC] text-xs tracking-[0.2em] uppercase font-bold">Description</Label>
                  <Textarea
                    id="space-description"
                    placeholder="Optional description"
                    value={newSpace.description}
                    onChange={(e) => setNewSpace({ ...newSpace, description: e.target.value })}
                    className="bg-[#050505] border-[#27272A] text-[#F8FAFC]"
                    data-testid="space-description-input"
                  />
                </div>
                <Button type="submit" className="w-full bg-[#3B82F6] hover:bg-[#60A5FA]" disabled={creating} data-testid="create-space-submit">
                  {creating ? 'Creating...' : 'Create Space'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Spaces Grid */}
        {spaces.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-32 h-32 mx-auto mb-6 opacity-50">
              <img 
                src="https://static.prod-images.emergentagent.com/jobs/1c84658e-2f93-4ed7-8258-1a5b6c6f3bd0/images/b44ad2c00b9b26c9a9710d5486a302f1df52397154d4457470e9ab85fa5421c1.png"
                alt="Empty vault"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-xl font-semibold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Chivo', sans-serif" }}>No spaces yet</h3>
            <p className="text-[#94A3B8] mb-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>Create your first space to start managing credentials</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="spaces-grid">
            {spaces.map((space) => (
              <div
                key={space.id || space._id || space.owner_id}
                onClick={() => navigate(`/space/${space.id || space._id || space.owner_id}`)}
                className="bg-[#0F0F11] border border-[#27272A] rounded-md p-6 cursor-pointer hover:-translate-y-[1px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-[#3F3F46] transition-all duration-200"
                data-testid={`space-card-${space.id || space._id || space.owner_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-md bg-[#1A1A1D] border border-[#27272A] flex items-center justify-center">
                    <FolderOpen size={24} weight="duotone" className="text-[#3B82F6]" />
                  </div>
                  <div className="flex items-center gap-1 text-[#94A3B8]">
                    <Users size={16} />
                    <span className="text-sm">{space.members?.length || 1}</span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Chivo', sans-serif" }}>{space.name}</h3>
                <p className="text-[#94A3B8] text-sm" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {space.description || 'No description'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};