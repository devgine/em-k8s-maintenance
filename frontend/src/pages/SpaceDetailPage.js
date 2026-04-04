import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Plus, MagnifyingGlass, Users, FileArrowDown, FileArrowUp, Trash, ShieldCheck } from '@phosphor-icons/react';
import { CredentialCard } from '../components/CredentialCard';
import { CredentialDialog } from '../components/CredentialDialog';
import { TeamDialog } from '../components/TeamDialog';
import { PasswordGenerator } from '../components/PasswordGenerator';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

export const SpaceDetailPage = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [space, setSpace] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [filteredCredentials, setFilteredCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);

  const userRole = space?.members?.find(m => m.user_id === user?.id)?.role || 'viewer';
  const canEdit = ['admin', 'editor'].includes(userRole);

  useEffect(() => {
    fetchSpaceAndCredentials();
  }, [spaceId]);

  useEffect(() => {
    filterCredentials();
  }, [credentials, searchQuery, typeFilter]);

  const fetchSpaceAndCredentials = async () => {
    try {
      const [spaceRes, credsRes] = await Promise.all([
        api.get(`/spaces/${spaceId}`),
        api.get(`/credentials/${spaceId}`)
      ]);
      setSpace(spaceRes.data);
      setCredentials(credsRes.data);
    } catch (error) {
      toast.error('Failed to load space data');
    } finally {
      setLoading(false);
    }
  };

  const filterCredentials = () => {
    let filtered = credentials;
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.type === typeFilter);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.decrypted_data?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.decrypted_data?.url?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredCredentials(filtered);
  };

  const handleCreateCredential = () => {
    setEditingCredential(null);
    setCredentialDialogOpen(true);
  };

  const handleEditCredential = (credential) => {
    setEditingCredential(credential);
    setCredentialDialogOpen(true);
  };

  const handleDeleteCredential = async (credentialId) => {
    if (!window.confirm('Are you sure you want to delete this credential?')) return;
    
    try {
      await api.delete(`/credential/${credentialId}`);
      setCredentials(credentials.filter(c => c.id !== credentialId));
      toast.success('Credential deleted successfully');
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to delete credential');
    }
  };

  const handleCredentialSaved = () => {
    fetchSpaceAndCredentials();
    setCredentialDialogOpen(false);
  };

  const handleExport = async () => {
    try {
      const { data } = await api.get(`/export/${spaceId}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${space.name}_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Credentials exported successfully');
    } catch (error) {
      toast.error('Failed to export credentials');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post(`/import/${spaceId}`, data);
      toast.success('Credentials imported successfully');
      fetchSpaceAndCredentials();
    } catch (error) {
      toast.error('Failed to import credentials');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-[#F8FAFC]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]" data-testid="space-detail-page">
      {/* Header */}
      <div className="bg-[#050505]/70 backdrop-blur-xl border-b border-white/10 saturate-150 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                className="text-[#94A3B8] hover:text-[#F8FAFC]"
                data-testid="back-button"
              >
                <ArrowLeft size={20} />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-r from-[#3B82F6] to-[#10B981] flex items-center justify-center">
                  <ShieldCheck size={24} weight="duotone" className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#F8FAFC]" style={{ fontFamily: "'Chivo', sans-serif" }}>{space?.name}</h1>
                  <p className="text-sm text-[#64748B]">{credentials.length} credentials</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setTeamDialogOpen(true)}
                variant="outline"
                className="border-[#27272A] text-[#F8FAFC] hover:bg-[#1A1A1D]"
                data-testid="manage-team-button"
              >
                <Users size={16} className="mr-2" />
                Team
              </Button>
              <Button
                onClick={handleExport}
                variant="outline"
                className="border-[#27272A] text-[#F8FAFC] hover:bg-[#1A1A1D]"
                data-testid="export-button"
              >
                <FileArrowDown size={16} className="mr-2" />
                Export
              </Button>
              <Button
                onClick={() => document.getElementById('import-file').click()}
                variant="outline"
                className="border-[#27272A] text-[#F8FAFC] hover:bg-[#1A1A1D]"
                disabled={!canEdit}
                data-testid="import-button"
              >
                <FileArrowUp size={16} className="mr-2" />
                Import
              </Button>
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <PasswordGenerator />
            
            {/* Filter */}
            <div className="bg-[#0F0F11] border border-[#27272A] rounded-md p-4">
              <h3 className="text-sm font-bold text-[#F8FAFC] mb-3 tracking-[0.2em] uppercase" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>Filter</h3>
              <div className="space-y-2">
                {['all', 'password', 'ssh_key', 'tls_cert', 'other'].map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      typeFilter === type
                        ? 'bg-[#3B82F6] text-white'
                        : 'text-[#94A3B8] hover:bg-[#1A1A1D]'
                    }`}
                    data-testid={`filter-${type}`}
                  >
                    {type === 'all' ? 'All Types' : type.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Search and Add */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <MagnifyingGlass size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <Input
                  placeholder="Search credentials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#0F0F11] border-[#27272A] text-[#F8FAFC]"
                  data-testid="search-input"
                />
              </div>
              {canEdit && (
                <Button
                  onClick={handleCreateCredential}
                  className="bg-[#3B82F6] hover:bg-[#60A5FA] text-white"
                  data-testid="add-credential-button"
                >
                  <Plus size={20} weight="bold" className="mr-2" />
                  Add Credential
                </Button>
              )}
            </div>

            {/* Credentials List */}
            {filteredCredentials.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-32 h-32 mx-auto mb-6 opacity-50">
                  <img 
                    src="https://static.prod-images.emergentagent.com/jobs/1c84658e-2f93-4ed7-8258-1a5b6c6f3bd0/images/b44ad2c00b9b26c9a9710d5486a302f1df52397154d4457470e9ab85fa5421c1.png"
                    alt="Empty vault"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-xl font-semibold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Chivo', sans-serif" }}>No credentials found</h3>
                <p className="text-[#94A3B8]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {searchQuery || typeFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first credential to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="credentials-list">
                {filteredCredentials.map(credential => (
                  <CredentialCard
                    key={credential.id}
                    credential={credential}
                    onEdit={handleEditCredential}
                    onDelete={handleDeleteCredential}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CredentialDialog
        open={credentialDialogOpen}
        onOpenChange={setCredentialDialogOpen}
        spaceId={spaceId}
        credential={editingCredential}
        onSaved={handleCredentialSaved}
      />

      <TeamDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        space={space}
        onUpdate={fetchSpaceAndCredentials}
        userRole={userRole}
      />
    </div>
  );
};