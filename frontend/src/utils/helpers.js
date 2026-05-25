// src/utils/helpers.js

export const formatDistanceToNow = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diff = Math.floor((now - past) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return past.toLocaleDateString();
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const STATUS_STYLES = {
  pending: 'badge bg-amber-500/20 text-amber-400 border border-amber-500/30',
  under_review: 'badge bg-blue-500/20 text-blue-400 border border-blue-500/30',
  approved: 'badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  rejected: 'badge bg-red-500/20 text-red-400 border border-red-500/30',
  forwarded: 'badge bg-purple-500/20 text-purple-400 border border-purple-500/30',
  completed: 'badge bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

export const APP_TYPE_LABELS = {
  result_card_request: 'Result Card Request',
  trip_permission: 'Trip Permission',
  certificate_request: 'Certificate Request',
  other: 'Other',
};

export const ROLE_LABELS = {
  student: 'Student',
  staff:'Staff',
  hod: 'Head of Department',
  chairperson: 'Chairperson',
  examination_officer: 'Examination Officer',
  vc: 'Vice Chancellor',
  admin: 'Administrator',
};

// ✅ ADD THIS OBJECT:
export const ROLE_BADGE = {
  student:             'bg-blue-500/20 text-blue-400 border-blue-500/30',
  staff:               'bg-purple-500/20 text-purple-400 border-purple-500/30',
  hod:                 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  chairperson:         'bg-amber-500/20 text-amber-400 border-amber-500/30',
  examination_officer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  vc:                  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  admin:               'bg-red-500/20 text-red-400 border-red-500/30',
};