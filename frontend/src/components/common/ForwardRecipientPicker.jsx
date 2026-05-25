import { useEffect, useState } from 'react';
import { Building2, Search, UserCheck, Loader2, X } from 'lucide-react';
import { departmentAPI, userAPI } from '../../services/api';

const QUICK_ROLES = [
  { value: 'vc',                  label: 'Vice Chancellor',    color: 'text-amber-600 dark:text-amber-400',   activeBg: 'bg-amber-500/15   border-amber-500/40'   },
  { value: 'hod',                 label: 'Head of Department', color: 'text-blue-600 dark:text-blue-400',     activeBg: 'bg-blue-500/15    border-blue-500/40'    },
  { value: 'examination_officer', label: 'Exam Officer',       color: 'text-emerald-600 dark:text-emerald-400', activeBg: 'bg-emerald-500/15 border-emerald-500/40' },
  { value: 'chairperson',         label: 'Chairperson',        color: 'text-violet-600 dark:text-violet-400', activeBg: 'bg-violet-500/15  border-violet-500/40'  },
  { value: 'staff',               label: 'Staff',              color: 'text-sky-600 dark:text-sky-400',       activeBg: 'bg-sky-500/15     border-sky-500/40'     },
];

// ── Scrollable list of selectable recipient cards ─────────────────────────────
function RecipientList({ users, loading, selectedId, onSelect, search, onSearch, showDept }) {
  const filtered = users.filter(u =>
    !search ||
    `${u.firstName} ${u.lastName} ${u.department?.name || ''} ${u.role || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={showDept ? 'Search by name, role, or department…' : 'Search by name or role…'}
          className="input-field pl-8 py-2 text-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
        {loading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-600 py-4 text-center italic">
            {users.length === 0 ? 'No recipients available' : 'No results for that search'}
          </p>
        ) : filtered.map(u => (
          <button
            key={u._id}
            type="button"
            onClick={() => onSelect(u)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
              selectedId === u._id
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 dark:bg-obsidian-800/60 border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-500/10'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
              selectedId === u._id
                ? 'bg-white/20 text-white'
                : 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400'
            }`}>
              {u.firstName?.[0]}{u.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${
                selectedId === u._id ? 'text-white' : 'text-slate-900 dark:text-slate-100'
              }`}>
                {u.firstName} {u.lastName}
              </p>
              <p className={`text-[10px] truncate capitalize ${
                selectedId === u._id ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {u.role?.replace(/_/g, ' ')}
                {u.staffType ? ` · ${u.staffType.replace(/_/g, ' ')}` : ''}
                {showDept && u.department?.name ? ` · ${u.department.name}` : ''}
              </p>
            </div>
            {selectedId === u._id && (
              <div className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main picker ───────────────────────────────────────────────────────────────
export default function ForwardRecipientPicker({ value, onChange, excludeUserId, excludeRoles = [] }) {
  const [tab,          setTab]          = useState('role');
  const [selectedRole, setSelectedRole] = useState('');
  const [roleUsers,    setRoleUsers]    = useState([]);
  const [roleLoading,  setRoleLoading]  = useState(false);
  const [departments,  setDepartments]  = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [deptUsers,    setDeptUsers]    = useState([]);
  const [deptLoading,  setDeptLoading]  = useState(false);
  const [roleSearch,   setRoleSearch]   = useState('');
  const [deptSearch,   setDeptSearch]   = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    departmentAPI.getAll()
      .then(res => setDepartments(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRole) { setRoleUsers([]); return; }
    setRoleLoading(true);
    userAPI.getForwardable({ role: selectedRole })
      .then(res => setRoleUsers((res.data.data || []).filter(u => u._id !== excludeUserId)))
      .catch(() => {})
      .finally(() => setRoleLoading(false));
  }, [selectedRole, excludeUserId]);

  useEffect(() => {
    if (!selectedDept) { setDeptUsers([]); return; }
    setDeptLoading(true);
    userAPI.getStaffByDepartment(selectedDept)
      .then(res => setDeptUsers((res.data.data || []).filter(u => u._id !== excludeUserId)))
      .catch(() => {})
      .finally(() => setDeptLoading(false));
  }, [selectedDept, excludeUserId]);

  const handleSelect = (user) => { setSelectedUser(user); onChange(user._id); };

  const handleTabChange = (newTab) => {
    setTab(newTab); setSelectedRole(''); setSelectedDept('');
    setRoleSearch(''); setDeptSearch(''); onChange(''); setSelectedUser(null);
  };

  const handleRoleClick = (roleValue) => {
    const next = selectedRole === roleValue ? '' : roleValue;
    setSelectedRole(next); setRoleSearch(''); onChange(''); setSelectedUser(null);
  };

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-obsidian-800/60 rounded-lg w-fit border border-slate-200 dark:border-white/5">
        {[
          { id: 'role', icon: UserCheck, label: 'By Role' },
          { id: 'dept', icon: Building2, label: 'By Department' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* By Role tab */}
      {tab === 'role' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ROLES.filter(r => !excludeRoles.includes(r.value)).map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => handleRoleClick(r.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  selectedRole === r.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : `bg-white dark:bg-obsidian-800/60 border-slate-200 dark:border-white/5 ${r.color} hover:border-blue-300 dark:hover:border-blue-500/40`
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {selectedRole && (
            <RecipientList
              users={roleUsers} loading={roleLoading} selectedId={value}
              onSelect={handleSelect} search={roleSearch} onSearch={setRoleSearch} showDept
            />
          )}
          {!selectedRole && (
            <p className="text-xs text-slate-400 dark:text-slate-600 italic py-2">
              Select a role above to see available recipients
            </p>
          )}
        </div>
      )}

      {/* By Department tab */}
      {tab === 'dept' && (
        <div className="space-y-3">
          <select
            value={selectedDept}
            onChange={e => { setSelectedDept(e.target.value); setDeptSearch(''); onChange(''); setSelectedUser(null); }}
            className="input-field"
          >
            <option value="">Select a department…</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>

          {selectedDept && (
            <RecipientList
              users={deptUsers} loading={deptLoading} selectedId={value}
              onSelect={handleSelect} search={deptSearch} onSearch={setDeptSearch}
            />
          )}
          {!selectedDept && (
            <p className="text-xs text-slate-400 dark:text-slate-600 italic py-2">
              Select a department to browse its staff
            </p>
          )}
        </div>
      )}

      {/* Selected recipient chip */}
      {selectedUser && value && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 rounded-lg">
          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
            {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
          </div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex-1 min-w-0 truncate">
            {selectedUser.firstName} {selectedUser.lastName}
            <span className="text-blue-500 dark:text-blue-500 font-normal ml-1 capitalize">
              ({selectedUser.role?.replace(/_/g, ' ')}
              {selectedUser.department?.name ? ` · ${selectedUser.department.name}` : ''})
            </span>
          </p>
          <button
            type="button"
            onClick={() => { onChange(''); setSelectedUser(null); }}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
