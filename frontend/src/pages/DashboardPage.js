import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Shield, Plus, LogOut, Power, PowerOff, Pencil, Trash2, Server } from 'lucide-react';
import { ApplicationDialog } from '../components/ApplicationDialog';
import { ApplicationUpdateDialog } from '../components/ApplicationUpdateDialog';
import api, { formatApiErrorDetail } from '../utils/api';
import { toast } from 'sonner';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, isAdmin, isUser } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data } = await api.get('/applications');
      setApplications(data.applications);
    } catch (error) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleToggle = async (app) => {
    try {
      await api.post(`/applications/${app.id}/toggle?enabled=${!app.enabled}`);
      toast.success(`Application ${!app.enabled ? 'enabled' : 'disabled'}`);
      fetchApplications();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to toggle application');
    }
  };

  const handleEdit = (app) => {
    setSelectedApp(app);
    setUpdateDialogOpen(true);
  };

  const handleDelete = async (app) => {
    if (!window.confirm(`Are you sure you want to delete "${app.name}"?`)) return;
    
    try {
      await api.delete(`/applications/${app.id}`);
      toast.success('Application deleted successfully');
      fetchApplications();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || 'Failed to delete application');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="text-zinc-50">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B]" data-testid="dashboard-page">
      {/* Header */}
      <div className="bg-[#09090B]/70 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-50" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>K8s Maintenance</h1>
              <p className="text-xs text-zinc-500 font-mono">{applications.length} applications</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-zinc-400">{user?.username || user?.email}</div>
              <div className="text-xs text-zinc-500">
                {user?.roles?.join(', ') || 'No roles'}
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-[#27272A] text-zinc-50 hover:bg-[#18181B]"
              data-testid="logout-button"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-zinc-50 mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Applications</h2>
            <p className="text-sm text-zinc-400">Manage Traefik middleware IP allowlists</p>
          </div>
          {isAdmin() && (
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white"
              data-testid="create-app-button"
            >
              <Plus size={18} className="mr-2" />
              Create Application
            </Button>
          )}
        </div>

        {/* Applications Table */}
        {applications.length === 0 ? (
          <div className="text-center py-20 border border-[#27272A] rounded-md">
            <Server size={48} className="mx-auto mb-4 text-zinc-600" />
            <h3 className="text-lg font-semibold text-zinc-50 mb-2">No applications yet</h3>
            <p className="text-zinc-400 mb-4">Create your first application to start managing middlewares</p>
            {isAdmin() && (
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-500">
                <Plus size={18} className="mr-2" />
                Create Application
              </Button>
            )}
          </div>
        ) : (
          <div className="border border-[#27272A] rounded-md overflow-hidden">
            <table className="w-full" data-testid="applications-table">
              <thead className="bg-[#121214]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#27272A]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#27272A]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#27272A]">Namespace</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#27272A]">IP Allowlist</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#27272A]">Created By</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#27272A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-900/50 transition-colors" data-testid={`app-row-${app.id}`}>
                    <td className="px-4 py-3">
                      {app.enabled ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Power size={12} className="mr-1" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <PowerOff size={12} className="mr-1" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-50 font-mono">{app.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">{app.namespace}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {app.ip_allowlist?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {app.ip_allowlist.slice(0, 2).map((ip, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-zinc-800 rounded text-xs">{ip}</span>
                          ))}
                          {app.ip_allowlist.length > 2 && (
                            <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs">+{app.ip_allowlist.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">No IPs</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{app.created_by}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin() && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-blue-400"
                            onClick={() => handleToggle(app)}
                            data-testid={`toggle-${app.id}`}
                          >
                            {app.enabled ? <PowerOff size={16} /> : <Power size={16} />}
                          </Button>
                        )}
                        {(isAdmin() || isUser()) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-blue-400"
                            onClick={() => handleEdit(app)}
                            data-testid={`edit-${app.id}`}
                          >
                            <Pencil size={16} />
                          </Button>
                        )}
                        {isAdmin() && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                            onClick={() => handleDelete(app)}
                            data-testid={`delete-${app.id}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ApplicationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSaved={fetchApplications}
      />

      <ApplicationUpdateDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        application={selectedApp}
        onSaved={fetchApplications}
      />
    </div>
  );
};