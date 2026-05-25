import React, { useEffect, useState } from 'react';
import { departmentAPI } from '../../services/api';
import { Building2, Plus, X, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', code: '', description: '' };

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editDept,  setEditDept]  = useState(null); // null = create mode
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const fetchDepts = () => {
    setLoading(true);
    departmentAPI.getAll()
      .then(res => setDepartments(res.data.data))
      .catch(() => toast.error('Failed to load departments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDepts(); }, []);

  // ── Open modals ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditDept(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (dept) => {
    setEditDept(dept);
    setForm({ name: dept.name, code: dept.code, description: dept.description || '' });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditDept(null); setForm(EMPTY_FORM); };

  // ── Save (create or update) ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    setSaving(true);
    try {
      if (editDept) {
        await departmentAPI.update(editDept._id, form);
        toast.success('Department updated');
      } else {
        await departmentAPI.create(form);
        toast.success('Department created');
      }
      closeModal();
      fetchDepts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await departmentAPI.delete(deleteTarget._id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      fetchDepts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">{departments.length} active departments</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-10 text-center">
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-white/5 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : departments.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No departments yet</p>
          <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create first department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
          {departments.map((dept, idx) => (
            <div
              key={dept._id}
              className="card card-hover p-5 animate-slide-up group"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 dark:text-white font-semibold leading-tight">{dept.name}</h3>
                    <span className="font-mono text-xs text-indigo-500 dark:text-indigo-400">{dept.code}</span>
                  </div>
                </div>

                {/* Action buttons — visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => openEdit(dept)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-600/10 transition-all"
                    title="Edit department"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(dept)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                    title="Delete department"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {dept.description && (
                <p className="text-gray-400 dark:text-slate-500 text-sm mb-3 line-clamp-2">{dept.description}</p>
              )}

              <div className="space-y-1.5 text-xs border-t border-gray-100 dark:border-white/5 pt-3">
                {dept.hod ? (
                  <p className="text-gray-500 dark:text-slate-400">
                    HOD: <span className="text-gray-700 dark:text-slate-300 font-medium">{dept.hod.firstName} {dept.hod.lastName}</span>
                  </p>
                ) : (
                  <p className="text-gray-400 dark:text-slate-500 italic">No HOD assigned</p>
                )}
                {dept.chairperson && (
                  <p className="text-gray-500 dark:text-slate-400">
                    Chair: <span className="text-gray-700 dark:text-slate-300 font-medium">{dept.chairperson.firstName} {dept.chairperson.lastName}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="section-title text-base">
                {editDept ? 'Edit Department' : 'Create Department'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Department Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Computer Science"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Code</label>
                <input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="input-field"
                  placeholder="e.g. CS"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="label">Description <span className="text-gray-400 dark:text-slate-600 normal-case tracking-normal font-normal">(optional)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Brief description of the department…"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving
                  ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : null}
                {editDept ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 w-full max-w-sm animate-slide-up">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-1">Delete Department?</h3>
                <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-gray-700 dark:text-slate-200">"{deleteTarget.name}"</span>?
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-sm font-medium px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting
                  ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
