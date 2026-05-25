import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      // ✅ FIXED: Real API call instead of a fake setTimeout.
      // The backend should have a POST /auth/forgot-password route that:
      //   1. Looks up the user by email
      //   2. Generates a signed reset token (e.g. crypto.randomBytes)
      //   3. Saves the hashed token + expiry to the user document
      //   4. Sends an email with a link like: /reset-password?token=<token>
      //   5. Always responds with 200 (don't leak whether email exists)
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      // ✅ Don't show success toast here — the UI already shows a success state.
      // Avoid double feedback.
    } catch (err) {
      // Backend should return 200 even for unknown emails (security best practice).
      // Only show an error for actual server failures (500, network errors).
      const status = err.response?.status;
      if (!status || status >= 500) {
        toast.error('Something went wrong on our end. Please try again later.');
      } else {
        // 4xx errors — show the backend message if available
        toast.error(err.response?.data?.message || 'Request failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-obsidian-850 flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(to right, #4f46e5 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-6 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4 shadow-glow">
            <GraduationCap className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">We'll send you a link to reset it</p>
        </div>

        <div className="card p-8">
          {sent ? (
            /* ── Success State ── */
            <div className="text-center py-4 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2">Check Your Email</h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-2">
                If an account with <span className="text-indigo-400 font-medium">{email}</span> exists,
                you'll receive a password reset link shortly.
              </p>
              <p className="text-gray-400 dark:text-slate-600 text-xs mb-6">
                Didn't get it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors underline"
                >
                  try again
                </button>
                .
              </p>
              <Link to="/login" className="btn-primary inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          ) : (
            /* ── Form State ── */
            <>
              <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white mb-1">Forgot your password?</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-7">
                Enter your email and we'll send you a link to reset it.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input-field pl-10"
                      placeholder="your@email.edu"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-gray-200 dark:border-white/5 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}