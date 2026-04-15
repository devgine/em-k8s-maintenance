import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { History, ChevronLeft, ChevronRight, Shield, Server, BookmarkCheck, Power } from 'lucide-react';
import api from '../utils/api';
import { toast } from 'sonner';

const ACTION_ICONS = {
  created: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  updated: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  deleted: { color: 'text-red-400', bg: 'bg-red-500/10' },
  toggled: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const TARGET_ICONS = {
  application: Server,
  template: BookmarkCheck,
};

const PAGE_SIZE = 20;

export const AuditLogDialog = ({ open, onOpenChange }) => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filterAction, setFilterAction] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
      if (filterAction !== 'all') params.set('action', filterAction);
      if (filterType !== 'all') params.set('target_type', filterType);
      const { data } = await api.get(`/audit-logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [offset, filterAction, filterType]);

  useEffect(() => {
    if (open) {
      setOffset(0);
      fetchLogs();
    }
  }, [open]);

  useEffect(() => {
    if (open) fetchLogs();
  }, [offset, filterAction, filterType, fetchLogs]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121214] border-[#27272A] text-zinc-50 max-w-3xl max-h-[85vh] flex flex-col" data-testid="audit-log-dialog">
        <DialogHeader>
          <DialogTitle className="text-zinc-50 flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <History size={22} className="text-blue-400" />
            Audit Log
          </DialogTitle>
          <p className="text-sm text-zinc-400">Track all changes made to applications and templates.</p>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setOffset(0); }}>
            <SelectTrigger className="w-40 bg-[#09090B] border-[#27272A] text-zinc-50 h-9" data-testid="filter-action">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent className="bg-[#121214] border-[#27272A] text-zinc-50">
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="toggled">Toggled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setOffset(0); }}>
            <SelectTrigger className="w-40 bg-[#09090B] border-[#27272A] text-zinc-50 h-9" data-testid="filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-[#121214] border-[#27272A] text-zinc-50">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="application">Application</SelectItem>
              <SelectItem value="template">Template</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-zinc-500 self-center">{total} entries</div>
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1" data-testid="audit-log-list">
          {loading ? (
            <div className="text-center py-12 text-zinc-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <History size={40} className="mx-auto mb-3 text-zinc-600" />
              <p>No audit log entries yet</p>
            </div>
          ) : (
            logs.map((log, idx) => {
              const style = ACTION_ICONS[log.action] || { color: 'text-zinc-400', bg: 'bg-zinc-500/10' };
              const TargetIcon = TARGET_ICONS[log.target_type] || Shield;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-md bg-[#09090B] border border-[#27272A] hover:border-[#3F3F46] transition-colors"
                  data-testid={`audit-entry-${idx}`}
                >
                  <div className={`mt-0.5 w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                    <TargetIcon size={14} className={style.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-200">{log.user}</span>
                      <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-zinc-500">{log.target_type}</span>
                      <span className="text-sm font-mono text-zinc-50">{log.target_name}</span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-600 whitespace-nowrap flex-shrink-0 mt-0.5">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="border-[#27272A] text-zinc-50 hover:bg-[#18181B] h-8"
              data-testid="audit-prev-page"
            >
              <ChevronLeft size={14} className="mr-1" /> Prev
            </Button>
            <span className="text-xs text-zinc-500">Page {currentPage} of {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="border-[#27272A] text-zinc-50 hover:bg-[#18181B] h-8"
              data-testid="audit-next-page"
            >
              Next <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        )}

        <div className="flex justify-end">
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
