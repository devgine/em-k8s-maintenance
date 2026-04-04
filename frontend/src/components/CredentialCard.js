import React, { useState } from 'react';
import { Key, Copy, Eye, EyeSlash, Certificate, FileText, PencilSimple, Trash } from '@phosphor-icons/react';
import { Button } from './ui/button';
import { copyToClipboard } from '../utils/clipboard';

const typeIcons = {
  password: Key,
  ssh_key: FileText,
  tls_cert: Certificate,
  other: FileText
};

const typeColors = {
  password: '#3B82F6',
  ssh_key: '#10B981',
  tls_cert: '#F59E0B',
  other: '#94A3B8'
};

export const CredentialCard = ({ credential, onEdit, onDelete, canEdit }) => {
  const [showPassword, setShowPassword] = useState(false);
  const Icon = typeIcons[credential.type] || FileText;
  const color = typeColors[credential.type];
  const data = credential.decrypted_data || {};

  return (
    <div 
      className="bg-[#0F0F11] border border-[#27272A] rounded-md p-4 hover:-translate-y-[1px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-[#3F3F46] transition-all duration-200"
      data-testid={`credential-card-${credential.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-md bg-[#1A1A1D] border border-[#27272A] flex items-center justify-center flex-shrink-0">
            <Icon size={20} weight="duotone" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-semibold text-[#F8FAFC] mb-1" style={{ fontFamily: "'Chivo', sans-serif" }}>
              {credential.title}
            </h4>
            <div className="space-y-1">
              {data.username && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B] uppercase tracking-wider">Username:</span>
                  <span className="text-sm text-[#94A3B8] font-mono">{data.username}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-[#64748B] hover:text-[#F8FAFC]"
                    onClick={() => copyToClipboard(data.username, 'Username')}
                    data-testid={`copy-username-${credential.id}`}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              )}
              {data.password && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B] uppercase tracking-wider">Password:</span>
                  <span className="text-sm text-[#94A3B8] font-mono">
                    {showPassword ? data.password : '•'.repeat(12)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-[#64748B] hover:text-[#F8FAFC]"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid={`toggle-password-${credential.id}`}
                  >
                    {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-[#64748B] hover:text-[#F8FAFC]"
                    onClick={() => copyToClipboard(data.password, 'Password')}
                    data-testid={`copy-password-${credential.id}`}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              )}
              {data.url && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B] uppercase tracking-wider">URL:</span>
                  <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#3B82F6] hover:text-[#60A5FA]">
                    {data.url}
                  </a>
                </div>
              )}
              {data.notes && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-[#64748B] uppercase tracking-wider">Notes:</span>
                  <span className="text-sm text-[#94A3B8]">{data.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#3B82F6]"
              onClick={() => onEdit(credential)}
              data-testid={`edit-credential-${credential.id}`}
            >
              <PencilSimple size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#EF4444]"
              onClick={() => onDelete(credential.id)}
              data-testid={`delete-credential-${credential.id}`}
            >
              <Trash size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};