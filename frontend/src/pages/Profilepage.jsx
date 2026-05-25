import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, User, Mail, Phone, Shield,
  Building2, Save, Lock, Eye, EyeOff, CheckCircle, AlertCircle
} from 'lucide-react';
import { selectUser, setUser } from '../store/slices/authSlice';
import { userAPI } from '../services/api';
import toast from 'react-hot-toast';

const getDashboardPath = (role) => {
  if (role === 'student') return '/student/dashboard';
  if (role === 'admin')   return '/admin/dashboard';
  return '/staff/dashboard';
};

const ROLE_LABELS = {
  student:             'Student',
  hod:                 'Head of Department',
  chairperson:         'Chairperson',
  vc:                  'Vice Chancellor',
  examination_officer: 'Examination Officer',
  admin:               'Administrator',
};

const Field = ({ label, icon: Icon, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
      <Icon className="w-3.5 h-3.5" /> {label}
    </label>
    {children}
  </div>
);

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user     = useSelector(selectUser);
  const fileRef  = useRef(null);

  // ── Prefilled from Redux store ────────────────────────────────────────────
  const [form, setForm] = useState({
    firstName:     user?.firstName     || '',
    lastName:      user?.lastName      || '',
    contactNumber: user?.contactNumber || '',
  });
  const [preview,   setPreview]   = useState(user?.profilePictureUrl || null);
  const [imageFile, setImageFile] = useState(null);

  // ── Password fields — optional, only sent if currentPassword is filled ────
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [showPw, setShowPw] = useState({ cur: false, new: false, con: false });
  const [saving, setSaving] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const wantsPasswordChange = pwForm.currentPassword.length > 0;
  const passwordsMatch      = pwForm.newPassword === pwForm.confirmPassword;
  const initials            = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  const handleImagePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (wantsPasswordChange) {
      if (!pwForm.newPassword || !pwForm.confirmPassword) {
        toast.error('Please fill in new password and confirmation');
        return;
      }
      if (!passwordsMatch) {
        toast.error('New password and confirm password do not match');
        return;
      }
      if (pwForm.newPassword.length < 8) {
        toast.error('New password must be at least 8 characters');
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('firstName',     form.firstName.trim());
      formData.append('lastName',      form.lastName.trim());
      formData.append('contactNumber', form.contactNumber.trim());

      if (wantsPasswordChange) {
        formData.append('currentPassword', pwForm.currentPassword);
        formData.append('newPassword',     pwForm.newPassword);
        formData.append('confirmPassword', pwForm.confirmPassword);
      }

      if (imageFile) formData.append('file', imageFile);

      // Call API directly then sync Redux store so header updates instantly
      const res = await userAPI.updateMyProfile(formData);
      dispatch(setUser(res.data.data));

      toast.success(wantsPasswordChange ? 'Profile & password updated!' : 'Profile updated!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setImageFile(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* Back button */}
      <div className="flex items-center gap-4 animate-fade-in pt-1">
        <button
          onClick={() => navigate(getDashboardPath(user?.role))}
          className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-white transition-colors text-sm font-medium group"
        >
          <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-obsidian-800/60 border border-gray-200 dark:border-white/5 flex items-center justify-center group-hover:border-indigo-500/50 group-hover:bg-indigo-600/10 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Dashboard
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Avatar card */}
        <div className="card p-6 animate-slide-up">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-indigo-500/30 bg-indigo-600/20">
                {preview ? (
                  <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-indigo-400 font-display">
                    {initials || <User className="w-8 h-8" />}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 border-2 border-white dark:border-obsidian-850 flex items-center justify-center transition-colors shadow-lg"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleImagePick}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
                  {ROLE_LABELS[user?.role] || user?.role}
                </span>
                {user?.isActive
                  ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3 h-3" /> Active</span>
                  : <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3 h-3" /> Inactive</span>
                }
              </div>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{user?.email}</p>
            </div>
          </div>

          {imageFile && (
            <div className="mt-3 flex items-center justify-between px-3 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
              <span className="text-indigo-300 text-xs truncate">{imageFile.name}</span>
              <button
                type="button"
                onClick={() => { setImageFile(null); setPreview(user?.profilePictureUrl || null); }}
                className="text-gray-400 dark:text-slate-500 hover:text-red-400 text-xs ml-2 flex-shrink-0 transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Personal info */}
        <div className="card p-6 space-y-5 animate-slide-up animate-delay-100">
          <h2 className="section-title text-base flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" /> Personal Information
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" icon={User}>
              <input
                value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                className="input-field"
                placeholder="First name"
                required
              />
            </Field>
            <Field label="Last Name" icon={User}>
              <input
                value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                className="input-field"
                placeholder="Last name"
                required
              />
            </Field>
          </div>

          <Field label="Email Address" icon={Mail}>
            <div className="input-field opacity-50 cursor-not-allowed flex items-center justify-between text-sm text-gray-500 dark:text-slate-400">
              <span className="truncate">{user?.email}</span>
              <span className="text-xs text-gray-400 dark:text-slate-600 flex-shrink-0 ml-2">Cannot change</span>
            </div>
          </Field>

          <Field label="Contact Number" icon={Phone}>
            <input
              value={form.contactNumber}
              onChange={e => setForm(p => ({ ...p, contactNumber: e.target.value }))}
              className="input-field"
              placeholder="+92 xxx xxxxxxx"
            />
          </Field>

          <Field label="Department" icon={Building2}>
            <div className="input-field opacity-60 cursor-not-allowed flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-slate-300">
                {user?.department?.name || (user?.role === 'admin' ? 'N/A (Administrator)' : '—')}
              </span>
              <span className="text-xs text-gray-400 dark:text-slate-600 flex-shrink-0 ml-2">Cannot change</span>
            </div>
          </Field>

          <Field label="Role" icon={Shield}>
            <div className="input-field opacity-60 cursor-not-allowed text-sm text-gray-600 dark:text-slate-300">
              {ROLE_LABELS[user?.role] || user?.role}
            </div>
          </Field>
        </div>

        {/* Change Password — optional */}
        <div className="card p-6 space-y-4 animate-slide-up animate-delay-200">
          <div>
            <h2 className="section-title text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" /> Change Password
              <span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1">(optional)</span>
            </h2>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
              Leave all three fields empty to keep your current password unchanged.
            </p>
          </div>

          <Field label="Current Password" icon={Lock}>
            <div className="relative">
              <input
                type={showPw.cur ? 'text' : 'password'}
                value={pwForm.currentPassword}
                onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                className="input-field pr-10"
                placeholder="Enter your current password"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => ({ ...p, cur: !p.cur }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300 transition-colors"
              >
                {showPw.cur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Field label="New Password" icon={Lock}>
            <div className="relative">
              <input
                type={showPw.new ? 'text' : 'password'}
                value={pwForm.newPassword}
                onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                className="input-field pr-10"
                placeholder={wantsPasswordChange ? 'Min. 8 characters' : 'Fill current password first'}
                disabled={!wantsPasswordChange}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300 transition-colors"
              >
                {showPw.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Field label="Confirm New Password" icon={Lock}>
            <div className="relative">
              <input
                type={showPw.con ? 'text' : 'password'}
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                className="input-field pr-10"
                placeholder={wantsPasswordChange ? 'Repeat new password' : 'Fill current password first'}
                disabled={!wantsPasswordChange}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => ({ ...p, con: !p.con }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300 transition-colors"
              >
                {showPw.con ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwForm.confirmPassword && pwForm.newPassword && (
              <p className={`text-xs mt-1.5 flex items-center gap-1 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                {passwordsMatch
                  ? <><CheckCircle className="w-3 h-3" /> Passwords match</>
                  : <><AlertCircle className="w-3 h-3" /> Passwords do not match</>
                }
              </p>
            )}
          </Field>
        </div>

        {/* Single save button */}
        <button
          type="submit"
          disabled={saving || (wantsPasswordChange && (!passwordsMatch || !pwForm.newPassword))}
          className="btn-primary w-full flex items-center justify-center gap-2 animate-slide-up animate-delay-300"
        >
          {saving
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            : <><Save className="w-4 h-4" /> Save All Changes</>
          }
        </button>

      </form>
    </div>
  );
}