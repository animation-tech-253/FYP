import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  GraduationCap, LayoutDashboard, FileText, Bell, Settings,
  LogOut, Menu, X, MessageSquare, Users, Building2,
  Shield, User, ChevronDown, Activity, Sun, Moon,
  Inbox, BarChart3,
} from 'lucide-react';
import { selectUser, signOut }       from '../store/slices/authSlice';
import { selectUnreadCount }          from '../store/slices/notificationsSlice';
import {
  selectSidebarOpen, selectTheme,
  toggleSidebar, toggleTheme, toggleChatbot,
} from '../store/slices/uiSlice';
import { selectAiChatbotEnabled } from '../store/slices/settingsSlice';
import NotificationBell from '../components/notifications/NotificationBell';

// ── Nav links per role ────────────────────────────────────────────────────────
const getNavLinks = (role) => {
  let dashboardPath;
  if      (role === 'student')             dashboardPath = '/student/dashboard';
  else if (role === 'admin')               dashboardPath = '/admin/dashboard';
  else if (role === 'hod')                 dashboardPath = '/hod/dashboard';
  else if (role === 'vc')                  dashboardPath = '/vc/dashboard';
  else if (role === 'examination_officer') dashboardPath = '/examiner/dashboard';
  else                                     dashboardPath = '/staff/dashboard';

  const links = [{ to: dashboardPath, icon: LayoutDashboard, label: 'Dashboard' }];

  if (role === 'student') {
    links.push(
      { to: '/student/applications', icon: FileText,      label: 'My Applications' },
      { to: '/student/submit',       icon: FileText,      label: 'New Application' },
    );
  }
  if (role === 'hod') {
    links.push(
      { to: '/hod/applications', icon: FileText,  label: 'Applications' },
      { to: '/hod/staff',        icon: Users,     label: 'Staff' },
      { to: '/hod/review',       icon: Inbox,     label: 'My Review Queue' },
    );
  }
  if (role === 'vc') {
    links.push(
      { to: '/vc/university', icon: Building2, label: 'University Overview' },
      { to: '/vc/review',     icon: Inbox,     label: 'Review Applications' },
    );
  }
  if (['staff', 'chairperson'].includes(role)) links.push({ to: '/staff/review', icon: FileText, label: 'Review Applications' });
  if (role === 'examination_officer') {
    links.push(
      { to: '/examiner/analytics', icon: BarChart3, label: 'Analytics' },
    );
  }
  if (role === 'admin') {
    links.push(
      { to: '/admin/applications', icon: FileText,   label: 'Applications' },
      { to: '/admin/users',        icon: Users,      label: 'Users' },
      { to: '/admin/departments',  icon: Building2,  label: 'Departments' },
      { to: '/admin/activity',     icon: Activity,   label: 'Activity Stream' },
      { to: '/admin/settings',     icon: Settings,   label: 'Settings' },
    );
  }
  links.push({ to: '/notifications', icon: Bell, label: 'Notifications', badge: true });
  return links;
};

const ROLE_LABELS = {
  student:             'Student',
  hod:                 'Head of Department',
  chairperson:         'Chairperson',
  examination_officer: 'Examination Officer',
  vc:                  'Vice Chancellor',
  admin:               'Administrator',
  staff:               'Staff',
};
const ROLE_COLORS = {
  student:             'text-blue-600 dark:text-blue-400',
  hod:                 'text-emerald-600 dark:text-emerald-400',
  chairperson:         'text-violet-600 dark:text-violet-400',
  examination_officer: 'text-orange-600 dark:text-orange-400',
  vc:                  'text-amber-600 dark:text-amber-400',
  admin:               'text-red-600 dark:text-red-400',
  staff:               'text-slate-600 dark:text-slate-400',
};

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 'sm' }) {
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${dim} rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-600/20 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0`}>
      {user?.profilePictureUrl
        ? <img src={user.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
        : <span className="font-semibold text-blue-600 dark:text-blue-400">{initials || <User className="w-4 h-4" />}</span>
      }
    </div>
  );
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-obsidian-800/40 transition-colors duration-150"
      >
        <Avatar user={user} size="sm" />
        <span className="hidden sm:block text-sm font-medium text-gray-900 dark:text-white">
          {user?.firstName}
        </span>
        <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-gray-400 dark:text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-obsidian-800 border border-slate-200 dark:border-white/5 rounded-xl shadow-dropdown overflow-hidden z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/5">
            <Avatar user={user} size="md" />
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-slate-100 text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <div className="p-1.5 space-y-0.5">
            <Link to="/profile" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-obsidian-800/50 transition-colors duration-150 text-sm group">
              <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-obsidian-800/50 group-hover:bg-blue-50 dark:group-hover:bg-blue-600/15 flex items-center justify-center transition-colors">
                <User className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </div>
              My Profile
            </Link>
            <button onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 text-sm group">
              <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-obsidian-800/50 group-hover:bg-red-50 dark:group-hover:bg-red-500/15 flex items-center justify-center transition-colors">
                <LogOut className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400" />
              </div>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function AppLayout() {
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const user        = useSelector(selectUser);
  const sidebarOpen      = useSelector(selectSidebarOpen);
  const theme            = useSelector(selectTheme);
  const unreadCount      = useSelector(selectUnreadCount);
  const chatbotEnabled   = useSelector(selectAiChatbotEnabled);

  const navLinks = getNavLinks(user?.role || 'student');

  const handleSignOut = () => dispatch(signOut()).then(() => navigate('/login'));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-obsidian-850 flex">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white dark:bg-obsidian-850 border-r border-slate-200 dark:border-white/5 transition-all duration-200 ${sidebarOpen ? 'w-60' : 'w-[60px]'}`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-3.5 py-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in overflow-hidden">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight tracking-tight">SUATS</p>
              <p className="text-slate-400 dark:text-slate-500 text-[11px] leading-tight">University System</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, icon: Icon, label, badge }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} relative ${!sidebarOpen ? 'justify-center px-2' : ''}`
              }
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-4 h-4" />
                {badge && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {sidebarOpen && <span className="animate-fade-in">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* AI Assistant button — students only, when chatbot is enabled */}
        {user?.role === 'student' && chatbotEnabled && (
          <div className="px-2 pb-2">
            <button
              onClick={() => dispatch(toggleChatbot())}
              className={`sidebar-link w-full text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/15 hover:bg-blue-100 dark:hover:bg-blue-600/25 border border-blue-200 dark:border-blue-500/20 ${!sidebarOpen ? 'justify-center px-2' : ''}`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>Application Assistant</span>}
            </button>
          </div>
        )}

        {/* User card */}
        <div className="border-t border-slate-100 dark:border-white/5 p-2.5">
          {sidebarOpen ? (
            <Link to="/profile" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-obsidian-800/40 transition-colors duration-150 group">
              <Avatar user={user} size="sm" />
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-slate-900 dark:text-slate-100 text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className={`text-xs truncate ${ROLE_COLORS[user?.role]}`}>
                  {ROLE_LABELS[user?.role]}
                </p>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); handleSignOut(); }}
                className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </Link>
          ) : (
            <Link to="/profile" className="flex justify-center py-1" title="My Profile">
              <Avatar user={user} size="sm" />
            </Link>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ${sidebarOpen ? 'ml-60' : 'ml-[60px]'}`}>

        {/* Top bar */}
        <header className="sticky top-0 z-30 h-13 h-[52px] flex items-center justify-between px-5 bg-white/95 dark:bg-obsidian-850/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/5">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-obsidian-800/40 transition-colors duration-150"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* Role badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-obsidian-800/80 border border-slate-200 dark:border-white/5">
              <Shield className={`w-3 h-3 ${ROLE_COLORS[user?.role]}`} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{ROLE_LABELS[user?.role]}</span>
            </div>



            {/* Theme toggle */}
            <button
              onClick={() => dispatch(toggleTheme())}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-800 dark:hover:bg-obsidian-700 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-300"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <ProfileDropdown user={user} onSignOut={handleSignOut} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
