import React, { useEffect, useState } from 'react';
import { settingsAPI } from '../../services/api';
import { Settings, Save, Bot, BotOff, Cpu, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PROVIDER_DEFAULTS = {
  groq:       'llama-3.3-70b-versatile',
  openrouter: 'openai/gpt-oss-120b:free',
  together:   'meta-llama/Llama-3-8b-chat-hf',
  gemini:     'gemini-1.5-flash',
};

export default function AdminSettingsPage() {
  const [settings,    setSettings]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [modelCache,  setModelCache]  = useState({});

  useEffect(() => {
    settingsAPI.get()
      .then(res => {
        const data = res.data.data;
        setSettings(data);
        // Seed cache with the model that's currently saved in DB for the active provider
        if (data.aiProvider && data.aiModel) {
          setModelCache({ [data.aiProvider]: data.aiModel });
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.update(settings);
      toast.success('Settings updated and broadcasted to all users!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center"><div className="w-8 h-8 border-2 border-gray-200 dark:border-white/5 border-t-indigo-500 rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="animate-fade-in">
        <h1 className="page-title flex items-center gap-3"><Settings className="w-7 h-7 text-indigo-400" /> System Settings</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">Changes are broadcast in real-time to all connected users</p>
      </div>

      {settings && (
        <div className="space-y-4 animate-slide-up">
          <div className="card p-6 space-y-4">
            <h3 className="section-title text-base border-b border-gray-200 dark:border-white/5 pb-3">Institution</h3>
            <div><label className="label">Institution Name</label>
              <input value={settings.institutionName || ''} onChange={e => setSettings(p => ({ ...p, institutionName: e.target.value }))} className="input-field" /></div>
            <div><label className="label">Support Email</label>
              <input value={settings.supportEmail || ''} onChange={e => setSettings(p => ({ ...p, supportEmail: e.target.value }))} className="input-field" /></div>
            <div><label className="label">Logo URL</label>
              <input value={settings.logoUrl || ''} onChange={e => setSettings(p => ({ ...p, logoUrl: e.target.value }))} className="input-field" /></div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="section-title text-base border-b border-gray-200 dark:border-white/5 pb-3">Applications</h3>
            <div><label className="label">Application ID Prefix</label>
              <input value={settings.applicationPrefix || ''} onChange={e => setSettings(p => ({ ...p, applicationPrefix: e.target.value }))} className="input-field" placeholder="APP" /></div>
            <div><label className="label">Max File Size (MB)</label>
              <input type="number" value={settings.maxFileSizeMB || 10} onChange={e => setSettings(p => ({ ...p, maxFileSizeMB: parseInt(e.target.value) }))} className="input-field" /></div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="section-title text-base border-b border-gray-200 dark:border-white/5 pb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" /> AI Provider
            </h3>

            {/* Key status badges */}
            {settings.configuredProviders && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'groq',       label: 'Groq',        value: settings.configuredProviders.groq },
                  { key: 'openrouter', label: 'OpenRouter',  value: settings.configuredProviders.openrouter },
                  { key: 'together',   label: 'Together.ai', value: settings.configuredProviders.together },
                  { key: 'gemini',     label: 'Gemini',      value: settings.configuredProviders.gemini },
                ].map(({ key, label, value }) => {
                  const configured = key === 'groq' ? value > 0 : !!value;
                  return (
                    <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
                      configured
                        ? 'border-emerald-300 dark:border-emerald-600/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-obsidian-800/40 text-gray-400 dark:text-slate-500'
                    }`}>
                      {configured
                        ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        : <XCircle      className="w-3.5 h-3.5 flex-shrink-0" />}
                      {label}
                      {key === 'groq' && configured && (
                        <span className="ml-auto text-emerald-600 dark:text-emerald-400">{value} key{value > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="label">Active Provider</label>
              <select
                value={settings.aiProvider || 'groq'}
                onChange={e => {
                  const newProvider  = e.target.value;
                  const curProvider  = settings.aiProvider || 'groq';
                  // Save current model into cache before switching
                  const updated = { ...modelCache, [curProvider]: settings.aiModel };
                  setModelCache(updated);
                  // Restore cached model for new provider, or fall back to default
                  const model = updated[newProvider] || PROVIDER_DEFAULTS[newProvider];
                  setSettings(p => ({ ...p, aiProvider: newProvider, aiModel: model }));
                }}
                className="input-field"
              >
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                <option value="together">Together.ai</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>

            <div>
              <label className="label">Model</label>
              {(settings.aiProvider || 'groq') === 'groq' ? (
                <select
                  value={settings.aiModel || 'llama-3.3-70b-versatile'}
                  onChange={e => setSettings(p => ({ ...p, aiModel: e.target.value }))}
                  className="input-field"
                >
                  <option value="llama-3.3-70b-versatile">LLaMA 3.3 70B Versatile — Best quality (Free)</option>
                  <option value="llama-3.1-8b-instant">LLaMA 3.1 8B Instant — Fastest (Free)</option>
                  <option value="gemma2-9b-it">Gemma 2 9B (Free)</option>
                </select>
              ) : (
                <input
                  value={settings.aiModel || ''}
                  onChange={e => setSettings(p => ({ ...p, aiModel: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. openai/gpt-oss-120b:free"
                />
              )}
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {(settings.aiProvider || 'groq') === 'groq'
                  ? "All listed models are on Groq's free tier."
                  : 'Paste the model ID from your provider\'s dashboard. Saved to DB — no restart needed.'}
              </p>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="section-title text-base border-b border-gray-200 dark:border-white/5 pb-3">Features</h3>

            <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${
              settings.aiChatbotEnabled
                ? 'border-emerald-400/60 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-red-300/60 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  settings.aiChatbotEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-500/20'
                    : 'bg-red-100 dark:bg-red-500/20'
                }`}>
                  {settings.aiChatbotEnabled
                    ? <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    : <BotOff className="w-4 h-4 text-red-500 dark:text-red-400" />
                  }
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium text-sm">AI Chatbot</p>
                  <p className="text-gray-500 dark:text-slate-400 text-xs">
                    {settings.aiChatbotEnabled ? 'Visible to students on their dashboard' : 'Hidden from student dashboard'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  settings.aiChatbotEnabled
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20'
                    : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20'
                }`}>
                  {settings.aiChatbotEnabled ? 'Enabled' : 'Disabled'}
                </span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.aiChatbotEnabled}
                  onClick={() => setSettings(p => ({ ...p, aiChatbotEnabled: !p.aiChatbotEnabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-obsidian-850 ${
                    settings.aiChatbotEnabled
                      ? 'bg-emerald-500 focus:ring-emerald-400'
                      : 'bg-red-400 dark:bg-red-500 focus:ring-red-400'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 flex items-center justify-center ${
                    settings.aiChatbotEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}>
                    {settings.aiChatbotEnabled
                      ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      : <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    }
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Broadcast
          </button>
        </div>
      )}
    </div>
  );
}
