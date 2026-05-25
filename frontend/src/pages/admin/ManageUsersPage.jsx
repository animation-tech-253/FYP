import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAllUsers,
  createUser,
  updateUser,
  toggleUserActive,
  deleteUser,
  fetchUserStats,
  addUserToSociety,
  removeUserFromSociety,
  selectAllUsers,
  selectUsersLoading,
  selectOnlineUserIds,
} from '../../store/slices/UserSlice';
import { departmentAPI, userAPI } from '../../services/api';
import { Eye, EyeOff } from 'lucide-react';
import {
  Users, Search, Plus, Edit2, Trash2, Activity, X,
  ShieldOff, ShieldCheck, Wifi, WifiOff, AlertTriangle,
  Camera, UserPlus,
} from 'lucide-react';
import { ROLE_LABELS, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ROLES = ['student', 'staff', 'hod', 'chairperson', 'examination_officer', 'vc', 'admin'];

const STAFF_TYPES = ['professor', 'lecturer', 'clerk', 'lab_technician', 'other'];

const ROLE_BADGE = {
  student:             'bg-blue-500/20 text-blue-400 border-blue-500/30',
  staff:               'bg-purple-500/20 text-purple-400 border-purple-500/30',
  hod:                 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  chairperson:         'bg-amber-500/20 text-amber-400 border-amber-500/30',
  examination_officer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  vc:                  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  admin:               'bg-red-500/20 text-red-400 border-red-500/30',
};

// ── Presence dot ──────────────────────────────────────────────────────────────
const PresenceDot = ({ isOnline }) => (
  <span
    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-obsidian-850 transition-colors duration-500
      ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`}
    title={isOnline ? 'Online' : 'Offline'}
  />
);

// ── Avatar with presence ──────────────────────────────────────────────────────
const UserAvatar = ({ user, isOnline }) => (
  <div className="relative w-9 h-9 flex-shrink-0">
    <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold
      ${isOnline ? 'bg-blue-600/30 ring-1 ring-blue-500/40' : 'bg-gray-200 dark:bg-obsidian-800/50'}`}>
      {user.profilePictureUrl ? (
        <img src={user.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <span className={isOnline ? 'text-blue-400' : 'text-gray-400 dark:text-slate-500'}>
          {user.firstName?.[0]}{user.lastName?.[0]}
        </span>
      )}
    </div>
    <PresenceDot isOnline={isOnline} />
  </div>
);

// ── Confirm modal ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, title, description, confirmLabel, confirmClass, icon: Icon, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="card p-6 w-full max-w-sm animate-slide-up shadow-2xl border border-gray-300 dark:border-white/5/60">
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${confirmClass?.includes('red') ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
            {Icon && <Icon className={`w-5 h-5 ${confirmClass?.includes('red') ? 'text-red-400' : 'text-amber-400'}`} />}
          </div>
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-1">{title}</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 text-sm font-medium px-4 py-2.5 rounded-xl transition-all duration-200 ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Society modal ─────────────────────────────────────────────────────────────
const SocietyModal = ({ user, onClose, dispatch }) => {
  const [societyName, setSocietyName] = useState('');
  const [position,    setPosition]    = useState('Member');
  const [loading,     setLoading]     = useState(false);

  const handleAdd = async () => {
    if (!societyName.trim()) return;
    setLoading(true);
    await dispatch(addUserToSociety({ userId: user._id, societyName: societyName.trim(), position }));
    setLoading(false);
    setSocietyName('');
  };

  const handleRemove = async (name) => {
    await dispatch(removeUserFromSociety({ userId: user._id, societyName: name }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Manage Societies</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">{user.firstName} {user.lastName}</p>

        {/* Current societies */}
        <div className="space-y-2">
          {(!user.societies || user.societies.length === 0) && (
            <p className="text-xs text-gray-400 dark:text-slate-500">No society memberships yet</p>
          )}
          {user.societies?.map(s => (
            <div key={s.societyName} className="flex items-center justify-between bg-gray-100 dark:bg-obsidian-800/60 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm text-slate-900 dark:text-white">{s.societyName}</p>
                <p className="text-xs text-blue-500">{s.position}</p>
              </div>
              <button
                onClick={() => handleRemove(s.societyName)}
                className="text-gray-400 dark:text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add society */}
        <div className="border-t border-gray-200 dark:border-white/5 pt-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Add to Society</p>
          <input
            className="form-input text-sm"
            placeholder="Society name"
            value={societyName}
            onChange={e => setSocietyName(e.target.value)}
          />
          <select
            className="form-input text-sm"
            value={position}
            onChange={e => setPosition(e.target.value)}
          >
            <option>Member</option>
            <option>President</option>
            <option>Vice President</option>
            <option>Secretary</option>
            <option>Treasurer</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={loading || !societyName.trim()}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><UserPlus className="w-4 h-4" /> Add</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManageUsersPage() {
  const dispatch      = useDispatch();
  const users         = useSelector(selectAllUsers);
  const loading       = useSelector(selectUsersLoading);
  const onlineUserIds = useSelector(selectOnlineUserIds);

  const [departments, setDepartments] = useState([]);
  const [search,      setSearch]      = useState('');
  const [filterRole,  setFilterRole]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editUser,  setEditUser]  = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    role: 'student', staffType: '', department: '', contactNumber: '', studentId: '',
  });

  // Profile pic
  const [picFile,    setPicFile]    = useState(null);
  const [picPreview, setPicPreview] = useState(null);
  const picRef = useRef(null);

  // Society modal
  const [societyUser, setSocietyUser] = useState(null);

  // Activity panel
  const [activityUser, setActivityUser] = useState(null);
  const [activity,     setActivity]     = useState([]);

  // Confirm modal
  const [confirmState, setConfirmState] = useState({ isOpen: false, type: null, targetUser: null });

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchAllUsers({}));
    dispatch(fetchUserStats());
    departmentAPI.getAll()
      .then(res => setDepartments(res.data.data || []))
      .catch(() => {});
  }, [dispatch]);

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const matchSearch = !search ||
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  // ── Open create modal ───────────────────────────────────────────────────────
const openCreate = () => {
  setShowPassword(false);
  setEditUser(null);
  setForm({
    firstName: '', lastName: '', email: '', password: '',
    role: 'student', staffType: '', department: '', contactNumber: '', studentId: '',
  });
  setPicFile(null);
  setPicPreview(null);
  setShowModal(true);
};

  // ── Open edit modal ─────────────────────────────────────────────────────────
  const openEdit = (user) => {
    setShowPassword(false);
    setEditUser(user);
    setForm({
      firstName:     user.firstName,
      lastName:      user.lastName,
      email:         user.email,
      role:          user.role,
      staffType:     user.staffType || '',
      department:    user.department?._id || '',
      contactNumber: user.contactNumber || '',
      studentId:     user.studentId || '',
      password:      '',
    });
    setPicFile(null);
    setPicPreview(user.profilePictureUrl || null);
    setShowModal(true);
  };

  const handlePicPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPicFile(file);
    setPicPreview(URL.createObjectURL(file));
  };

  // ── Save (create or update) ─────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editUser) {
        const formData = new FormData();
        formData.append('firstName',     form.firstName.trim());
        formData.append('lastName',      form.lastName.trim());
        formData.append('email',         form.email.trim());
        formData.append('role',          form.role);
        formData.append('contactNumber', form.contactNumber.trim());
        if (form.department) formData.append('department', form.department);
        if (form.role === 'staff' && form.staffType) formData.append('staffType', form.staffType);
        if (form.role === 'student' && form.studentId) formData.append('studentId', form.studentId.trim());
        if (picFile) formData.append('file', picFile);
          // ✅ PASSWORD SUPPORT
        if (form.password.trim()) {
        formData.append('password', form.password.trim());
         }

        await dispatch(updateUser({ id: editUser._id, data: formData })).unwrap();
      } else {
        await dispatch(createUser(form)).unwrap();
        const creds = `Login Email: ${form.email}\nPassword: ${form.password}`;
        navigator.clipboard?.writeText(creds).catch(() => {});
        toast.success('Credentials copied to clipboard!', { duration: 5000 });
      }
      setShowModal(false);
    } catch {
      // errors toasted in slice
    } finally {
      setSaving(false);
    }
  };

  // ── Ban / Unban ─────────────────────────────────────────────────────────────
  const askToggleActive   = (user) => setConfirmState({ isOpen: true, type: 'toggle', targetUser: user });
  const confirmToggleActive = async () => {
    const { targetUser } = confirmState;
    setConfirmState({ isOpen: false, type: null, targetUser: null });
    try {
      await dispatch(toggleUserActive({ id: targetUser._id, isActive: !targetUser.isActive })).unwrap();
      toast.success(targetUser.isActive
        ? `${targetUser.firstName} has been banned.`
        : `${targetUser.firstName} has been reactivated.`);
    } catch {}
  };

  // ── Hard delete ─────────────────────────────────────────────────────────────
  const askDelete   = (user) => setConfirmState({ isOpen: true, type: 'delete', targetUser: user });
  const confirmDelete = async () => {
    const { targetUser } = confirmState;
    setConfirmState({ isOpen: false, type: null, targetUser: null });
    try { await dispatch(deleteUser(targetUser._id)).unwrap(); } catch {}
  };

  // ── Activity panel ──────────────────────────────────────────────────────────
  const loadActivity = async (user) => {
    setActivityUser(user);
    setActivity([]);
    try {
      const res = await userAPI.getActivity(user._id);
      setActivity(res.data.data);
    } catch { setActivity([]); }
  };

  const onlineCount = users.filter(u => onlineUserIds.includes(u._id)).length;

  // ── Confirm config ──────────────────────────────────────────────────────────
  const confirmConfig = (() => {
    if (!confirmState.targetUser) return {};
    const u = confirmState.targetUser;
    if (confirmState.type === 'toggle') {
      return u.isActive
        ? { title: `Ban ${u.firstName} ${u.lastName}?`, description: 'This user will be immediately logged out and prevented from signing in.', confirmLabel: 'Yes, Ban User', confirmClass: 'bg-red-600 hover:bg-red-500 text-white', icon: ShieldOff, onConfirm: confirmToggleActive }
        : { title: `Reactivate ${u.firstName} ${u.lastName}?`, description: 'This user will be able to sign in again.', confirmLabel: 'Yes, Reactivate', confirmClass: 'bg-emerald-600 hover:bg-emerald-500 text-white', icon: ShieldCheck, onConfirm: confirmToggleActive };
    }
    return { title: `Permanently Delete ${u.firstName} ${u.lastName}?`, description: 'This cannot be undone. All data will be removed forever.', confirmLabel: 'Delete Permanently', confirmClass: 'bg-red-700 hover:bg-red-600 text-white', icon: AlertTriangle, onConfirm: confirmDelete };
  })();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="page-title">Manage Users</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500 dark:text-slate-400 text-sm">{users.length} total users</p>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              <span className="text-emerald-400 text-sm font-medium">{onlineCount} online</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span className="text-gray-400 dark:text-slate-500 text-sm">{users.length - onlineCount} offline</span>
            </div>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search users..." />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input-field w-full sm:w-44">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS?.[r] || r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden animate-slide-up">
        {loading ? (
          <div className="p-10 text-center">
            <div className="w-8 h-8 border-2 border-gray-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-obsidian-800/30 border-b border-gray-200 dark:border-white/5">
                  {['User', 'Email', 'Role', 'Department', 'Societies', 'Status', 'Stats', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 dark:text-slate-600 text-sm">No users found</td></tr>
                ) : filtered.map((user, idx) => {
                  const isOnline = onlineUserIds.includes(user._id);
                  return (
                    <tr
                      key={user._id}
                      className={`hover:bg-gray-50 dark:hover:bg-obsidian-800/20 transition-colors animate-fade-in ${!user.isActive ? 'opacity-50' : ''}`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} isOnline={isOnline} />
                          <div>
                            <p className="text-gray-900 dark:text-white text-sm font-medium">{user.firstName} {user.lastName}</p>
                            {user.role === 'student' && user.studentId && (
                              <p className="text-blue-500 text-xs font-mono">{user.studentId}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isOnline
                                ? <><Wifi className="w-2.5 h-2.5 text-emerald-400" /><span className="text-emerald-400 text-xs">Online</span></>
                                : <><WifiOff className="w-2.5 h-2.5 text-gray-400 dark:text-slate-600" /><span className="text-gray-400 dark:text-slate-600 text-xs">Offline</span></>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{user.email}</td>

                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${ROLE_BADGE[user.role] || 'bg-slate-700/30 text-gray-500 dark:text-slate-400 border-slate-700/30'}`}>
                          {ROLE_LABELS?.[user.role] || user.role}
                        </span>
                        {user.staffType && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 capitalize">{user.staffType.replace('_', ' ')}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{user.department?.name || '—'}</td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.societies?.length > 0
                            ? user.societies.slice(0, 2).map(s => (
                                <span key={s.societyName} className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded px-1.5 py-0.5">
                                  {s.societyName}
                                </span>
                              ))
                            : <span className="text-xs text-gray-400 dark:text-slate-600">—</span>
                          }
                          {user.societies?.length > 2 && (
                            <span className="text-[10px] text-gray-400 dark:text-slate-500">+{user.societies.length - 2}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => askToggleActive(user)}
                          title={user.isActive ? 'Click to ban' : 'Click to reactivate'}
                          className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer select-none
                            ${user.isActive
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                              : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400'}`}
                        >
                          {user.isActive
                            ? <><ShieldCheck className="w-3 h-3" /><span className="group-hover:hidden">Active</span><span className="hidden group-hover:inline">Ban?</span></>
                            : <><ShieldOff className="w-3 h-3" /><span className="group-hover:hidden">Banned</span><span className="hidden group-hover:inline">Unban?</span></>}
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-400 dark:text-slate-500 space-y-0.5">
                          <p>Submitted: <span className="text-gray-600 dark:text-slate-300">{user.stats?.applicationsSubmitted || 0}</span></p>
                          <p>Accepted: <span className="text-emerald-400">{user.stats?.applicationsAccepted || 0}</span></p>
                          <p>Rejected: <span className="text-red-400">{user.stats?.applicationsRejected || 0}</span></p>
                          <p>Remarks: <span className="text-gray-600 dark:text-slate-300">{user.stats?.remarksGiven || 0}</span></p>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">{formatDate(user.createdAt)}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => loadActivity(user)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/10" title="View activity">
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setSocietyUser(user)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/10" title="Manage societies">
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(user)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-obsidian-800/50" title="Edit user">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => askDelete(user)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10" title="Delete permanently">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{editUser ? 'Edit User' : 'Create User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">

              {/* Profile picture — only shown when editing */}
              {editUser && (
                <div className="flex items-center gap-4 pb-3 border-b border-gray-200 dark:border-white/5">
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                      {picPreview ? (
                        <img src={picPreview} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-blue-500">
                          {editUser.firstName?.[0]}{editUser.lastName?.[0]}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => picRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-2 border-white dark:border-obsidian-850 flex items-center justify-center transition-colors"
                    >
                      <Camera className="w-3 h-3 text-white" />
                    </button>
                    <input ref={picRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={handlePicPick} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white text-sm font-medium">{editUser.firstName} {editUser.lastName}</p>
                    <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">
                      {picFile ? picFile.name : 'Click camera to change profile picture'}
                    </p>
                    {picFile && (
                      <button
                        type="button"
                        onClick={() => { setPicFile(null); setPicPreview(editUser.profilePictureUrl || null); }}
                        className="text-xs text-red-400 hover:text-red-300 mt-0.5 transition-colors"
                      >
                        Remove new image
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name</label>
                  <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} className="input-field" />
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input-field" />
              </div>

  <div>
  <label className="label">
    Password{' '}
    {editUser && (
      <span className="text-gray-400 dark:text-slate-500 text-xs">
        (leave empty to keep unchanged)
      </span>
    )}
  </label>

  <div className="relative">
    <input
      type={showPassword ? 'text' : 'password'}
      value={form.password}
      onChange={(e) =>
        setForm((p) => ({ ...p, password: e.target.value }))
      }
      className="input-field pr-10"
      placeholder={editUser ? 'Enter new password...' : ''}
    />

    <button
      type="button"
      onClick={() => setShowPassword((prev) => !prev)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300 transition-colors"
    >
      {showPassword ? (
        <EyeOff className="w-4 h-4" />
      ) : (
        <Eye className="w-4 h-4" />
      )}
    </button>
  </div>
</div>

              <div>
                <label className="label">Contact</label>
                <input value={form.contactNumber} onChange={e => setForm(p => ({ ...p, contactNumber: e.target.value }))} className="input-field" />
              </div>

              <div>
                <label className="label">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value, staffType: '' }))} className="input-field">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS?.[r] || r}</option>)}
                </select>
              </div>

              {/* Staff type — only shown when role is staff */}
              {form.role === 'staff' && (
                <div>
                  <label className="label">Staff Type</label>
                  <select value={form.staffType} onChange={e => setForm(p => ({ ...p, staffType: e.target.value }))} className="input-field">
                    <option value="">Select type…</option>
                    {STAFF_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              )}

              {form.role !== 'admin' && form.role !== 'vc' && form.role !== 'examination_officer' && (
                <div>
                  <label className="label">Department</label>
                  <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="input-field">
                    <option value="">Select...</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              {form.role === 'student' && (
                <div>
                  <label className="label">Student ID <span className="text-slate-400 dark:text-slate-500 font-normal">(university roll number)</span></label>
                  <input
                    value={form.studentId}
                    onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}
                    className="input-field"
                    placeholder="e.g. F21BSCS001"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Society Modal ───────────────────────────────────────────────── */}
      {societyUser && (
        <SocietyModal
          user={societyUser}
          onClose={() => setSocietyUser(null)}
          dispatch={dispatch}
        />
      )}

      {/* ── Activity Modal ──────────────────────────────────────────────── */}
      {activityUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Activity — {activityUser.firstName} {activityUser.lastName}</h3>
              <button onClick={() => setActivityUser(null)} className="text-gray-400 dark:text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-3">
              {activity.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-8">No activity recorded</p>
              ) : activity.map(h => (
                <div key={h._id} className="flex gap-3 p-3 bg-white/80 dark:bg-obsidian-850/50 rounded-xl text-sm">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-900 dark:text-white">{h.action?.toUpperCase()} — {h.application?.title}</p>
                    {h.remarks    && <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">"{h.remarks}"</p>}
                    {h.newRecipient && <p className="text-gray-400 dark:text-slate-500 text-xs">→ Forwarded to {h.newRecipient.firstName}</p>}
                    <p className="text-gray-400 dark:text-slate-600 text-xs">{formatDate(h.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ───────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onCancel={() => setConfirmState({ isOpen: false, type: null, targetUser: null })}
        {...confirmConfig}
      />
    </div>
  );
}