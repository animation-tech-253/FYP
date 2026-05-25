// src/pages/admin/AdminActivityPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Activity, Trash2, Radio, Wifi, WifiOff, FileText, CheckCircle, XCircle, Send, BookOpen } from 'lucide-react';
import {
  selectActivityLogEntries,
  setWatching,
  clearLog,
} from '../../store/slices/activityLogSlice';
import {
  selectAdminAppStream,
  clearAdminAppStream,
} from '../../store/slices/applicationsSlice';
import { selectAllUsers, selectOnlineUserIds, fetchAllUsers } from '../../store/slices/UserSlice';
import { ROLE_LABELS, ROLE_BADGE, formatDistanceToNow } from '../../utils/helpers';

// ── Severity config ───────────────────────────────────────────────────────────
const SEVERITY = {
  success: { dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  warning: { dot: 'bg-amber-400',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  info:    { dot: 'bg-blue-400',    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  alert:   { dot: 'bg-red-400',     badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

// Action icon + color
const ACTION_CONFIG = {
  submitted:    { icon: Send,        color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Submitted' },
  approved:     { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Approved' },
  rejected:     { icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Rejected' },
  forwarded:    { icon: Send,        color: 'text-purple-400',  bg: 'bg-purple-500/10',  label: 'Forwarded' },
  verified:     { icon: BookOpen,    color: 'text-orange-400',  bg: 'bg-orange-500/10',  label: 'Verified' },
  request_docs: { icon: FileText,    color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Docs Requested' },
};

// ── Activity log entry row ─────────────────────────────────────────────────────
const LogEntry = ({ entry, idx }) => {
  const sev = SEVERITY[entry.severity] || SEVERITY.info;
  return (
    <div className="flex gap-4 px-5 py-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-gray-50/80 dark:bg-obsidian-800/20 transition-colors animate-fade-in">
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-1">
        <span className={`w-2.5 h-2.5 rounded-full ${sev.dot} ${idx === 0 ? 'animate-pulse' : ''}`} />
        <div className="w-px flex-1 bg-gray-200/60 dark:bg-obsidian-800/30" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
            {entry.applicationId}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sev.badge}`}>
            {entry.event?.replace('application_', '').toUpperCase()}
          </span>
          {entry.department && entry.department !== 'N/A' && (
            <span className="text-[10px] text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-obsidian-800/60 px-1.5 py-0.5 rounded">
              {entry.department}
            </span>
          )}
        </div>
        <p className="text-gray-700 dark:text-slate-200 text-sm leading-relaxed">{entry.message}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLE_BADGE?.[entry.actorRole] || 'bg-slate-700/30 text-gray-500 dark:text-slate-400'}`}>
            {entry.actorRole?.replace('_', ' ')}
          </span>
          <span className="text-gray-400 dark:text-slate-600 text-xs">{formatDistanceToNow(entry.timestamp)}</span>
        </div>
      </div>
    </div>
  );
};

// ── Application stream entry ──────────────────────────────────────────────────
const AppStreamEntry = ({ entry, idx }) => {
  const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.submitted;
  const Icon = cfg.icon;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-white/5/20 hover:bg-gray-50 dark:hover:bg-gray-50/80 dark:bg-obsidian-800/20 transition-colors animate-fade-in"
      style={{ animationDelay: `${Math.min(idx * 15, 150)}ms` }}
    >
      <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-indigo-400">{entry.appCode}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          {entry.department && (
            <span className="text-[10px] text-gray-400 dark:text-slate-500">{entry.department}</span>
          )}
        </div>
        {entry.student && (
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">
            {entry.student.firstName} {entry.student.lastName}
            {entry.student.studentId ? ` · ${entry.student.studentId}` : ''}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {entry.actor && (
          <p className="text-gray-400 dark:text-slate-500 text-xs">{entry.actor.firstName} {entry.actor.lastName}</p>
        )}
        <p className="text-gray-300 dark:text-slate-700 text-[10px] mt-0.5">{formatDistanceToNow(entry.timestamp)}</p>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminActivityPage() {
  const dispatch   = useDispatch();
  const logEntries = useSelector(selectActivityLogEntries);
  const appStream  = useSelector(selectAdminAppStream);
  const allUsers   = useSelector(selectAllUsers);
  const onlineIds  = useSelector(selectOnlineUserIds);

  const [presenceLog,   setPresenceLog]   = useState([]);
  const [prevOnlineIds, setPrevOnlineIds] = useState(new Set());

  const logTopRef = useRef(null);
  const appTopRef = useRef(null);

  useEffect(() => {
    if (allUsers.length === 0) dispatch(fetchAllUsers({}));
  }, [dispatch, allUsers.length]);

  useEffect(() => {
    dispatch(setWatching(true));
    return () => dispatch(setWatching(false));
  }, [dispatch]);

  useEffect(() => {
    if (logEntries.length > 0) logTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [logEntries.length]);

  useEffect(() => {
    if (appStream.length > 0) appTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [appStream.length]);

  // Detect presence changes
  useEffect(() => {
    const currentSet = new Set(onlineIds);
    const changes = [];
    onlineIds.forEach(id => {
      if (!prevOnlineIds.has(id)) {
        const u = allUsers.find(u => u._id === id);
        if (u) changes.push({ id: Date.now() + Math.random(), type: 'online', user: u, timestamp: new Date() });
      }
    });
    prevOnlineIds.forEach(id => {
      if (!currentSet.has(id)) {
        const u = allUsers.find(u => u._id === id);
        if (u) changes.push({ id: Date.now() + Math.random(), type: 'offline', user: u, timestamp: new Date() });
      }
    });
    if (changes.length > 0) setPresenceLog(prev => [...changes, ...prev].slice(0, 50));
    setPrevOnlineIds(currentSet);
  }, [onlineIds, allUsers]);

  const onlineCount     = onlineIds.length;
  const onlineUsersList = allUsers.filter(u => onlineIds.includes(u._id));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Radio className="w-7 h-7 text-indigo-400" />
            Live Activity Stream
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Real-time feed of all system events and user presence</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">Live</span>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slide-up">
        {[
          { label: 'Online Now',    value: onlineCount,                                                                            color: 'text-emerald-400' },
          { label: 'App Events',    value: appStream.length,                                                                       color: 'text-blue-400' },
          { label: 'Activity Logs', value: logEntries.length,                                                                      color: 'text-slate-900 dark:text-white' },
          { label: 'Approvals',     value: logEntries.filter(e => e.event === 'application_approved' || e.event === 'application_verified').length, color: 'text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main grid — two columns on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── LEFT: Application Event Stream (NEW) ─────────────────────────── */}
        <div className="card overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-obsidian-800/20">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Application Stream
              </span>
              <span className="text-gray-400 dark:text-slate-600 text-xs">({appStream.length})</span>
            </div>
            {appStream.length > 0 && (
              <button
                onClick={() => dispatch(clearAdminAppStream())}
                className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div ref={appTopRef} />
          {appStream.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-slate-500 text-sm">Application updates will appear here in real-time</p>
              <p className="text-gray-300 dark:text-slate-700 text-xs mt-1">Every submission, approval, rejection and verification</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {appStream.map((entry, idx) => (
                <AppStreamEntry key={`${entry.applicationId}-${entry.timestamp}-${idx}`} entry={entry} idx={idx} />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Activity Event Log ─────────────────────────────────────── */}
        <div className="card overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-obsidian-800/20">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Activity Log
              </span>
              <span className="text-gray-400 dark:text-slate-600 text-xs">({logEntries.length})</span>
            </div>
            {logEntries.length > 0 && (
              <button
                onClick={() => dispatch(clearLog())}
                className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div ref={logTopRef} />
          {logEntries.length === 0 ? (
            <div className="p-10 text-center">
              <Radio className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-slate-500 text-sm">Waiting for events...</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {logEntries.map((entry, idx) => (
                <LogEntry key={`${entry.applicationId}-${entry.timestamp}-${idx}`} entry={entry} idx={idx} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Who's Online ─────────────────────────────────────────────────────── */}
      <div className="card p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            Who's Online ({onlineCount})
          </h3>
        </div>
        {onlineUsersList.length === 0 ? (
          <p className="text-center py-4 text-gray-400 dark:text-slate-600 text-sm">No users are currently online</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {onlineUsersList.map(u => (
              <div key={u._id} className="flex flex-col items-center p-3 rounded-xl bg-gray-100 dark:bg-obsidian-800/40 border border-emerald-500/20">
                <div className="relative mb-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300 overflow-hidden">
                    {u.profilePictureUrl
                      ? <img src={u.profilePictureUrl} alt="av" className="w-full h-full object-cover" />
                      : `${u.firstName?.[0]}${u.lastName?.[0]}`}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-obsidian-850 rounded-full" />
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-300 truncate w-full text-center">{u.firstName} {u.lastName}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 ${ROLE_BADGE?.[u.role] || 'bg-slate-700/30 text-gray-500 dark:text-slate-400'}`}>
                  {ROLE_LABELS?.[u.role] || u.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── User Presence Stream ──────────────────────────────────────────────── */}
      <div className="card p-5 animate-slide-up">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300 flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-indigo-400" />
          User Presence Stream
        </h3>
        <div className="max-h-[200px] overflow-y-auto space-y-2">
          {presenceLog.length === 0 ? (
            <p className="text-center py-4 text-gray-400 dark:text-slate-600 text-sm">Waiting for user activity...</p>
          ) : (
            presenceLog.map(log => (
              <div key={log.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-obsidian-850/40 border border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  {log.type === 'online'
                    ? <Wifi    className="w-4 h-4 text-emerald-400" />
                    : <WifiOff className="w-4 h-4 text-gray-400 dark:text-slate-500" />}
                  <div>
                    <span className="text-gray-600 dark:text-slate-300 font-medium">{log.user.firstName} {log.user.lastName}</span>
                    <span className="text-gray-400 dark:text-slate-500 text-xs ml-2">({ROLE_LABELS?.[log.user.role] || log.user.role})</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    log.type === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/30 text-gray-400 dark:text-slate-500'
                  }`}>
                    {log.type === 'online' ? 'Came Online' : 'Went Offline'}
                  </span>
                  <div className="text-[10px] text-gray-400 dark:text-slate-600 mt-0.5">{formatDistanceToNow(log.timestamp)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}