import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { getDashboardPath } from '../utils/routeHelpers';

export default function UnauthorizedPage() {
  const user = useSelector(selectUser);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-obsidian-850 flex items-center justify-center">
      <div className="text-center animate-slide-up">
        <div className="w-20 h-20 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-8">You don't have permission to access this page.</p>
        <Link to={getDashboardPath(user?.role)} className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}