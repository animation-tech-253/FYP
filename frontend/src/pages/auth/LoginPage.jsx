import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { signIn, clearError, selectAuthLoading, selectAuthError, selectIsAuthenticated } from '../../store/slices/authSlice';
import { getDashboardPath } from '../../utils/routeHelpers';
import { Eye, EyeOff, GraduationCap, Mail, Lock, Sun, Moon } from 'lucide-react';
import { toggleTheme, selectTheme } from '../../store/slices/uiSlice';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(state => state.auth.user);

  const theme = useSelector(selectTheme);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from || getDashboardPath(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  useEffect(() => { return () => dispatch(clearError()); }, [dispatch]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    dispatch(signIn(form));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-obsidian-850 flex items-center justify-center relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl animate-pulse-slow animate-delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gray-50 dark:bg-obsidian-800/30 rounded-full blur-3xl" />
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => dispatch(toggleTheme())}
        className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/10 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(to right, #4f46e5 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 w-full max-w-md px-6 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-5 shadow-glow">
            <GraduationCap className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white mb-1">SUATS</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Smart University Application & Tracking System</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white mb-1">Welcome back</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-7">Sign in to your account</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="email" name="email" value={form.email} onChange={handleChange}
                  className="input-field pl-10" placeholder="student@university.edu"
                  autoComplete="email" required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'} name="password"
                  value={form.password} onChange={handleChange}
                  className="input-field pl-10 pr-11" placeholder="••••••••" required
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/5 text-center">
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Register here
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-gray-400 dark:text-slate-600 text-xs">Role-based access • Secure JWT authentication</p>
        </div>
      </div>
    </div>
  );
}