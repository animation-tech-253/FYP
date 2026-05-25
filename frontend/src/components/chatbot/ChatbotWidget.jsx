import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MessageSquare, X, Send, Bot, User, Sparkles, ChevronDown } from 'lucide-react';
import { selectChatbotOpen, toggleChatbot, selectChatbotAppType, setChatbotAppType } from '../../store/slices/uiSlice';
import { chatbotAPI } from '../../services/api';

const APP_TYPES = [
  { value: 'result_card_request', label: 'Result Card Request' },
  { value: 'certificate_request', label: 'Certificate Request' },
  { value: 'transcript_request',  label: 'Transcript Request' },
  { value: 'trip_permission',     label: 'Trip Permission' },
  { value: 'fee_concession',      label: 'Fee Concession' },
  { value: 'society_event',       label: 'Society / Club Event' },
  { value: 'other',               label: 'Other' },
];

const QUICK_ACTIONS = [
  { label: 'How to submit?',         message: 'How do I submit an application?' },
  { label: 'What docs needed?',      message: 'What documents do I need for my application?' },
  { label: 'Track my application',   message: 'How can I track the status of my application?' },
  { label: 'Who should I send to?',  message: 'Who should I send my application to?' },
];

const WELCOME_MSG = { role: 'assistant', text: "Hi! I'm your SUATS assistant. Ask me anything about applications, submitting requests, or what documents you need. You can also select an application type below for more specific help." };

export default function ChatbotWidget() {
  const dispatch = useDispatch();
  const open     = useSelector(selectChatbotOpen);

  const appType = useSelector(selectChatbotAppType);

  const [messages,   setMessages]   = useState([WELCOME_MSG]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [typeOpen,   setTypeOpen]   = useState(false);
  const [quicksDone, setQuicksDone] = useState(false);

  const endRef    = useRef(null);
  const inputRef  = useRef(null);
  const typeRef   = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const close = (e) => { if (typeRef.current && !typeRef.current.contains(e.target)) setTypeOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;
    setQuicksDone(true);
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await chatbotAPI.getMessage({ message: text, applicationType: appType, history: messages });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I'm having trouble right now. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const selectedTypeLabel = APP_TYPES.find(t => t.value === appType)?.label || 'Select type';

  if (!open) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-80 sm:w-[22rem] flex flex-col rounded-2xl overflow-hidden animate-slide-up shadow-2xl dark:shadow-black/60 border border-gray-200 dark:border-white/5/60"
      style={{ maxHeight: '78vh' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-slate-900 dark:text-white font-semibold text-sm leading-tight">SUATS Assistant</p>
            <p className="text-indigo-200 text-xs leading-tight">Here to help</p>
          </div>
        </div>
        <button
          onClick={() => dispatch(toggleChatbot())}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-indigo-100 hover:text-white transition-all"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Application type selector ── */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-obsidian-800/80 border-b border-gray-200 dark:border-white/5/50 flex-shrink-0" ref={typeRef}>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-1.5">Context</p>
        <button
          type="button"
          onClick={() => setTypeOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-obsidian-850/60 border border-gray-200 dark:border-white/5/50 text-gray-700 dark:text-slate-300 text-xs font-medium hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            {selectedTypeLabel}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-500 transition-transform ${typeOpen ? 'rotate-180' : ''}`} />
        </button>
        {typeOpen && (
          <div className="absolute z-10 mt-1 w-56 bg-white dark:bg-obsidian-850 border border-gray-200 dark:border-white/5/60 rounded-xl shadow-lg dark:shadow-black/40 overflow-hidden animate-fade-in">
            {APP_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { dispatch(setChatbotAppType(t.value)); setTypeOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                  appType === t.value
                    ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-obsidian-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-obsidian-850 p-3 space-y-3 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === 'user'
                ? 'bg-indigo-600'
                : 'bg-gray-200 dark:bg-obsidian-800/60 border border-gray-300 dark:border-white/5'
            }`}>
              {msg.role === 'user'
                ? <User className="w-3 h-3 text-white" />
                : <Bot className="w-3 h-3 text-indigo-600 dark:text-slate-300" />
              }
            </div>
            <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed max-w-[80%] whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-none'
                : 'bg-white dark:bg-obsidian-800 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-white/5/50 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-obsidian-800/60 border border-gray-300 dark:border-white/5 flex items-center justify-center">
              <Bot className="w-3 h-3 text-indigo-600 dark:text-slate-300" />
            </div>
            <div className="bg-white dark:bg-obsidian-800 border border-gray-200 dark:border-white/5/50 px-3 py-2.5 rounded-2xl rounded-tl-none flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quick actions — shown once, disappear after first user message */}
        {!quicksDone && messages.length === 1 && !loading && (
          <div className="pt-1 space-y-1.5 animate-fade-in">
            <p className="text-xs text-gray-400 dark:text-slate-600 pl-1">Quick questions</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => sendMessage(qa.message)}
                  className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-obsidian-800 border border-gray-200 dark:border-white/5/60 text-gray-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:bg-indigo-50 dark:hover:bg-indigo-600/10 transition-all"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Input ── */}
      <div className="flex gap-2 p-3 bg-white dark:bg-obsidian-800 border-t border-gray-200 dark:border-white/5/50 flex-shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-gray-50 dark:bg-obsidian-850/60 text-gray-900 dark:text-slate-200 text-xs rounded-xl px-3 py-2 resize-none border border-gray-200 dark:border-white/5/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 placeholder-gray-400 dark:placeholder-slate-600 transition-all"
          rows={1}
          placeholder="Ask me anything…"
          style={{ maxHeight: '80px' }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 dark:disabled:bg-obsidian-800/60 flex items-center justify-center flex-shrink-0 self-end transition-all disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5 text-white disabled:text-gray-400" />
        </button>
      </div>
    </div>
  );
}
