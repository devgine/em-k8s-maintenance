export const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: 'None', color: '#64748B' };
  
  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  // Normalize to 0-4 scale
  score = Math.min(Math.floor(score / 2), 4);
  
  const levels = [
    { score: 0, label: 'Very Weak', color: '#EF4444' },
    { score: 1, label: 'Weak', color: '#F59E0B' },
    { score: 2, label: 'Fair', color: '#F59E0B' },
    { score: 3, label: 'Good', color: '#10B981' },
    { score: 4, label: 'Strong', color: '#10B981' }
  ];
  
  return levels[score];
};