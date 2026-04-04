import { toast } from 'sonner';

export const copyToClipboard = async (text, label = 'Text') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
    return true;
  } catch (error) {
    toast.error('Failed to copy to clipboard');
    return false;
  }
};