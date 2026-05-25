import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { signUp, clearError, selectAuthLoading, selectAuthError } from '../../store/slices/authSlice';
import { departmentAPI } from '../../services/api';
import { Eye, EyeOff, GraduationCap, User, Mail, Lock, Phone, Building2, Info, RefreshCw, Sun, Moon } from 'lucide-react';
import { toggleTheme, selectTheme } from '../../store/slices/uiSlice';

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading  = useSelector(selectAuthLoading);
  const error    = useSelector(selectAuthError);
  const theme    = useSelector(selectTheme);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    contactNumber: '', department: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [departments,  setDepartments]  = useState([]);
  const [deptLoading,  setDeptLoading]  = useState(true);
  const [deptError,    setDeptError]    = useState(false);
  const [localError,   setLocalError]   = useState('');

  // ── Fetch departments — same pattern as ManageUsersPage ───────────────────
  const fetchDepartments = () => {
    setDeptLoading(true);
    setDeptError(false);
    departmentAPI.getAll()
      .then(res => setDepartments(res.data.data || []))
      .catch(() => setDeptError(true))
      .finally(() => setDeptLoading(false));
  };

  useEffect(() => {
    fetchDepartments();
    return () => dispatch(clearError());
  }, [dispatch]);

  const handleChange = (e) => {
    setLocalError('');
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setLocalError('Passwords do not match'); return; }
    if (form.password.length < 8) { setLocalError('Password must be at least 8 characters'); return; }
    const { confirmPassword, ...submitData } = form;
    dispatch(signUp({ ...submitData, role: 'student' }))
      .unwrap()
      .then(() => navigate('/student/dashboard'))
      .catch(() => {});
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-obsidian-850 flex items-center justify-center relative overflow-hidden py-10">
      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => dispatch(toggleTheme())}
        className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/10 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl animate-pulse-slow animate-delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gray-50 dark:bg-obsidian-800/30 rounded-full blur-3xl" />
      </div>
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(to right, #4f46e5 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 w-full max-w-lg px-6 animate-slide-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-5 shadow-glow">
            <GraduationCap className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Student Registration</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Create your student account to get started</p>
        </div>

        {/* Staff notice */}
        <div className="mb-5 flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Info className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
            <span className="font-semibold">Staff accounts (HOD, Chairperson, VC, Exam Officer)</span> are
            created by the Admin. If you are staff, please contact your administrator for login credentials.
          </p>
        </div>

        <div className="card p-8">
          {displayError && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-fade-in">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                  <input name="firstName" value={form.firstName} onChange={handleChange}
                    className="input-field pl-9" placeholder="Ahmad" required />
                </div>
              </div>
              <div>
                <label className="label">Last Name</label>
                <input name="lastName" value={form.lastName} onChange={handleChange}
                  className="input-field" placeholder="Khan" required />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  className="input-field pl-9" placeholder="ahmad@university.edu" required />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="label">Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input name="contactNumber" value={form.contactNumber} onChange={handleChange}
                  className="input-field pl-9" placeholder="+92 300 1234567" />
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="label">Department</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 z-10" />
                <select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  className="input-field pl-9"
                  required
                  disabled={deptLoading || deptError || departments.length === 0}
                >
                  {deptLoading ? (
                    <option value="">Loading departments...</option>
                  ) : deptError ? (
                    <option value="">Failed to load — try again</option>
                  ) : departments.length === 0 ? (
                    <option value="">No departments available yet</option>
                  ) : (
                    <>
                      <option value="">Select your department...</option>
                      {departments.map(d => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {deptLoading && (
                <p className="text-gray-400 dark:text-slate-500 text-xs mt-1 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Fetching departments...
                </p>
              )}
              {deptError && (
                <button type="button" onClick={fetchDepartments}
                  className="text-indigo-400 hover:text-indigo-300 text-xs mt-1 flex items-center gap-1 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Retry loading departments
                </button>
              )}
              {!deptLoading && !deptError && departments.length === 0 && (
                <p className="text-gray-400 dark:text-slate-600 text-xs mt-1">No departments have been created yet — contact your admin.</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} name="password"
                  value={form.password} onChange={handleChange}
                  className="input-field pl-9 pr-10" placeholder="Minimum 8 characters" required />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} name="confirmPassword"
                  value={form.confirmPassword} onChange={handleChange}
                  className="input-field pl-9" placeholder="Re-enter password" required />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || deptLoading || departments.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
                : 'Create Student Account'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-200 dark:border-white/5 text-center">
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}