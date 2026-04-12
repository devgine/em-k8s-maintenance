import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { FileCode, Copy, Check } from 'lucide-react';
import api from '../utils/api';
import { toast } from 'sonner';

export const YamlPreviewDialog = ({ open, onOpenChange, application }) => {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState('');

  React.useEffect(() => {
    if (open && application) {
      fetchYaml();
    }
  }, [open, application]);

  const fetchYaml = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/applications/${application.id}/yaml`);
      setYaml(data.yaml);
      setSource(data.source);
    } catch (error) {
      toast.error('Failed to generate YAML');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    toast.success('YAML copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121214] border-[#27272A] text-zinc-50 max-w-2xl" data-testid="yaml-preview-dialog">
        <DialogHeader>
          <DialogTitle className="text-zinc-50 flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <FileCode size={22} className="text-amber-400" />
            Traefik Middleware YAML
          </DialogTitle>
          <div className="text-sm text-zinc-400 font-mono flex items-center gap-2">
            {application.name} / {application.namespace}
            {source && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                source === 'cluster'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
              }`} data-testid="yaml-source-badge">
                {source === 'cluster' ? 'Live from cluster' : 'Generated (cluster unavailable)'}
              </span>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-12 text-zinc-500">Generating YAML...</div>
        ) : (
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="absolute top-2 right-2 h-8 px-2 text-zinc-400 hover:text-zinc-100 z-10"
              data-testid="copy-yaml-button"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
            <pre
              className="bg-[#09090B] border border-[#27272A] rounded-md p-4 pr-20 text-sm font-mono text-amber-200/90 overflow-x-auto max-h-[60vh] whitespace-pre"
              data-testid="yaml-content"
            >
              {yaml}
            </pre>
          </div>
        )}

        <div className="flex justify-end pt-2">
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
