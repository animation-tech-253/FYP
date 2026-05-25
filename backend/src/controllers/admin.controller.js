// src/controllers/admin.controller.js
import mongoose from 'mongoose';
import { Application, ApplicationHistory, User, Department } from '../models/index.js';

// ── 1. Admin System Overview ──────────────────────────────────────────────────
// GET /api/v1/admin/overview
//
// FIX 1: byDepartment now includes ALL active departments even with zero apps.
//         We fetch departments first, then merge application counts into them.
// FIX 2: noDeptRoleWorkload is now split: { vc: [...], examinationOfficers: [...] }
//         so the frontend can render them in separate sections.
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminOverview = async (req, res) => {
  try {
    const [
      universityTotals,
      appsByDept,       // only depts that HAVE applications
      byType,
      byStatus,
      urgentPending,
      recentApplications,
      userStats,
      allDepartments,   // ALL active departments regardless of app count
    ] = await Promise.all([

      // Overall totals
      Application.aggregate([
        {
          $group: {
            _id:       null,
            total:     { $sum: 1 },
            pending:   { $sum: { $cond: [{ $in: ['$status', ['pending', 'forwarded']] }, 1, 0] } },
            approved:  { $sum: { $cond: [{ $eq: ['$status', 'approved']  }, 1, 0] } },
            rejected:  { $sum: { $cond: [{ $eq: ['$status', 'rejected']  }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            urgent:    { $sum: { $cond: ['$isUrgent', 1, 0] } },
            avgProcessingDays: {
              $avg: {
                $cond: [
                  { $and: ['$completedDate', '$submittedDate'] },
                  { $divide: [{ $subtract: ['$completedDate', '$submittedDate'] }, 86400000] },
                  null,
                ],
              },
            },
          },
        },
      ]),

      // Application counts grouped by department (only depts with apps)
      Application.aggregate([
        {
          $group: {
            _id:      '$department',
            total:    { $sum: 1 },
            pending:  { $sum: { $cond: [{ $in: ['$status', ['pending', 'forwarded']] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            urgent:   { $sum: { $cond: ['$isUrgent', 1, 0] } },
          },
        },
      ]),

      Application.aggregate([
        { $group: { _id: '$applicationType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Application.find({ isUrgent: true, status: { $in: ['pending', 'forwarded'] } })
        .populate('student',          'firstName lastName studentId')
        .populate('department',       'name code')
        .populate('currentRecipient', 'firstName lastName role staffType')
        .sort({ submittedDate: 1 })
        .limit(20),

      Application.find({})
        .populate('student',          'firstName lastName studentId')
        .populate('department',       'name code')
        .populate('currentRecipient', 'firstName lastName role')
        .sort({ submittedDate: -1 })
        .limit(10),

      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),

      // ✅ FIX: Fetch ALL active departments — not just ones with applications
      Department.find({ isActive: true })
        .select('_id name code hod chairperson')
        .populate('hod',         'firstName lastName email profilePictureUrl')
        .populate('chairperson', 'firstName lastName email profilePictureUrl')
        .sort({ name: 1 }),
    ]);

    // ✅ FIX: Merge app counts into ALL departments (zero counts for depts with no apps)
    const appCountMap = {};
    appsByDept.forEach(a => {
      if (a._id) appCountMap[a._id.toString()] = a;
    });

    const byDepartment = allDepartments.map(dept => {
      const counts = appCountMap[dept._id.toString()] || {};
      return {
        departmentId: dept._id,
        name:         dept.name,
        code:         dept.code,
        hod:          dept.hod,
        chairperson:  dept.chairperson,
        total:    counts.total    || 0,
        pending:  counts.pending  || 0,
        approved: counts.approved || 0,
        rejected: counts.rejected || 0,
        urgent:   counts.urgent   || 0,
      };
    }).sort((a, b) => b.pending - a.pending || b.total - a.total);

    // ✅ FIX: Split no-dept roles — VC separate from ExamOfficers
    const [vcUsers, examOfficers] = await Promise.all([
      User.find({ role: 'vc', isActive: true })
        .select('_id firstName lastName role email profilePictureUrl stats'),
      User.find({ role: 'examination_officer', isActive: true })
        .select('_id firstName lastName role email profilePictureUrl stats'),
    ]);

    const allNoDeptUsers = [...vcUsers, ...examOfficers];
    const noDeptIds      = allNoDeptUsers.map(u => u._id);

    let workloadMap = {};
    if (noDeptIds.length) {
      const workload = await Application.aggregate([
        {
          $match: {
            currentRecipient: { $in: noDeptIds },
            status: { $in: ['pending', 'forwarded'] },
          },
        },
        {
          $group: {
            _id:          '$currentRecipient',
            pendingCount: { $sum: 1 },
            urgentCount:  { $sum: { $cond: ['$isUrgent', 1, 0] } },
          },
        },
      ]);
      workload.forEach(w => { workloadMap[w._id.toString()] = w; });
    }

    const enrichNoDept = (users) => users.map(u => ({
      ...u.toObject(),
      pendingCount: workloadMap[u._id.toString()]?.pendingCount || 0,
      urgentCount:  workloadMap[u._id.toString()]?.urgentCount  || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        totals: universityTotals[0] || {
          total: 0, pending: 0, approved: 0, rejected: 0, completed: 0, urgent: 0,
        },
        byDepartment,
        byType,
        byStatus,
        urgentPending,
        recentApplications,
        userStats,
        departmentList: allDepartments,
        // ✅ FIX: VC and ExamOfficers now in separate keys
        vcWorkload:             enrichNoDept(vcUsers),
        examinationOfficers:    enrichNoDept(examOfficers),
        // Keep combined for backwards compat with any other consumers
        noDeptRoleWorkload:     enrichNoDept(allNoDeptUsers),
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 2. Admin Department Drill-Down ───────────────────────────────────────────
// GET /api/v1/admin/department/:departmentId
//
// FIX: staffList now returned separately from staffWorkload.
//      staffList = ALL staff in dept (sorted: HOD first, then chairperson, then others).
//      staffWorkload = staff who have pending apps (from aggregation).
//      Frontend merges them so HOD always shows even with 0 pending.
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminDepartmentDrill = async (req, res) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid department ID.' });
    }

    const department = await Department.findById(departmentId)
      .populate('hod',         'firstName lastName email profilePictureUrl role')
      .populate('chairperson', 'firstName lastName email profilePictureUrl role');

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    const deptObjId = new mongoose.Types.ObjectId(departmentId);

    const [
      stats,
      byType,
      byStatus,
      staffWorkload,
      allStaff,
      recentApplications,
      urgentPending,
      studentCount,
    ] = await Promise.all([

      Application.aggregate([
        { $match: { department: deptObjId } },
        {
          $group: {
            _id:      null,
            total:    { $sum: 1 },
            pending:  { $sum: { $cond: [{ $in: ['$status', ['pending', 'forwarded']] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved']  }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected']  }, 1, 0] } },
            urgent:   { $sum: { $cond: ['$isUrgent', 1, 0] } },
            avgProcessingDays: {
              $avg: {
                $cond: [
                  { $and: ['$completedDate', '$submittedDate'] },
                  { $divide: [{ $subtract: ['$completedDate', '$submittedDate'] }, 86400000] },
                  null,
                ],
              },
            },
          },
        },
      ]),

      Application.aggregate([
        { $match: { department: deptObjId } },
        { $group: { _id: '$applicationType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Application.aggregate([
        { $match: { department: deptObjId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Pending workload (only staff WITH pending apps)
      Application.aggregate([
        {
          $match: {
            department: deptObjId,
            status:     { $in: ['pending', 'forwarded'] },
          },
        },
        {
          $group: {
            _id:          '$currentRecipient',
            pendingCount: { $sum: 1 },
            urgentCount:  { $sum: { $cond: ['$isUrgent', 1, 0] } },
          },
        },
        {
          $lookup: {
            from: 'users', localField: '_id', foreignField: '_id', as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            pendingCount: 1,
            urgentCount:  1,
            firstName:         { $ifNull: ['$user.firstName', 'Unknown'] },
            lastName:          { $ifNull: ['$user.lastName',  ''] },
            role:              { $ifNull: ['$user.role',      'unknown'] },
            staffType:         { $ifNull: ['$user.staffType', null] },
            profilePictureUrl: { $ifNull: ['$user.profilePictureUrl', ''] },
          },
        },
        { $sort: { pendingCount: -1 } },
      ]),

      // ✅ FIX: ALL staff in dept — HOD first, chairperson second, others after
      // Role sort order: hod=0, chairperson=1, staff=2
      User.find({
        department: departmentId,
        role:       { $in: ['hod', 'chairperson', 'staff'] },
        isActive:   true,
      })
        .select('firstName lastName email role staffType profilePictureUrl')
        .sort({ role: 1 }),   // hod < chairperson < staff alphabetically — we re-sort below

      Application.find({ department: departmentId })
        .populate('student',          'firstName lastName studentId profilePictureUrl')
        .populate('currentRecipient', 'firstName lastName role staffType')
        .sort({ submittedDate: -1 })
        .limit(10),

      Application.find({
        department: departmentId,
        isUrgent:   true,
        status:     { $in: ['pending', 'forwarded'] },
      })
        .populate('student',          'firstName lastName studentId')
        .populate('currentRecipient', 'firstName lastName role')
        .sort({ submittedDate: 1 }),

      User.countDocuments({ department: departmentId, role: 'student', isActive: true }),
    ]);

    // ✅ FIX: Sort staff — HOD first, chairperson second, then everyone else
    const ROLE_ORDER = { hod: 0, chairperson: 1, staff: 2 };
    const sortedStaff = allStaff
      .map(s => s.toObject())
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));

    // Merge workload counts into staff list
    const wMap = {};
    staffWorkload.forEach(w => { wMap[w._id.toString()] = w; });

    const staffWithWorkload = sortedStaff.map(s => ({
      ...s,
      pendingCount: wMap[s._id.toString()]?.pendingCount || 0,
      urgentCount:  wMap[s._id.toString()]?.urgentCount  || 0,
    }));

    const staffCount = sortedStaff.filter(s => ['staff', 'hod', 'chairperson'].includes(s.role)).length;

    res.status(200).json({
      success: true,
      data: {
        department,
        studentCount,
        staffCount,
        stats:              stats[0] || { total: 0, pending: 0, approved: 0, rejected: 0, urgent: 0 },
        byType,
        byStatus,
        staffWithWorkload,  // ✅ All staff, HOD first, with pending counts merged in
        recentApplications,
        urgentPending,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 3. Admin — No-Dept Roles Detail ─────────────────────────────────────────
// GET /api/v1/admin/no-dept-roles
//
// FIX: Response now includes separate `vcList` and `examOfficerList` arrays
//      so frontend can render them in separate priority sections.
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminNoDeptRoles = async (req, res) => {
  try {
    const [vcUsers, examOfficers] = await Promise.all([
      User.find({ role: 'vc', isActive: true })
        .select('_id firstName lastName role email profilePictureUrl stats createdAt lastLogin'),
      User.find({ role: 'examination_officer', isActive: true })
        .select('_id firstName lastName role email profilePictureUrl stats createdAt lastLogin'),
    ]);

    const enrichUser = async (u) => {
      const [pendingApps, recentHistory] = await Promise.all([
        Application.find({
          currentRecipient: u._id,
          status: { $in: ['pending', 'forwarded'] },
        })
          .populate('student',    'firstName lastName studentId')
          .populate('department', 'name code')
          .sort({ isUrgent: -1, submittedDate: 1 })
          .limit(10),

        ApplicationHistory.find({ actionBy: u._id })
          .populate({ path: 'application', select: 'applicationId title status' })
          .sort({ timestamp: -1 })
          .limit(10),
      ]);

      return {
        user:         u.toObject(),
        pendingApps,
        recentHistory,
        pendingCount: pendingApps.length,
        urgentCount:  pendingApps.filter(a => a.isUrgent).length,
      };
    };

    const [vcEnriched, examEnriched] = await Promise.all([
      Promise.all(vcUsers.map(enrichUser)),
      Promise.all(examOfficers.map(enrichUser)),
    ]);

    res.status(200).json({
      success: true,
      data: {
        // ✅ FIX: Separate arrays — VC shown first (higher priority), then ExamOfficers
        vcList:           vcEnriched,
        examOfficerList:  examEnriched,
        // Combined for any consumer that needs a flat list
        all:              [...vcEnriched, ...examEnriched],
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 4. Admin — View Any Single Application ────────────────────────────────────
// GET /api/v1/admin/applications/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminApplicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('student',          'firstName lastName email studentId profilePictureUrl contactNumber')
      .populate('department',       'name code')
      .populate('currentRecipient', 'firstName lastName role staffType profilePictureUrl')
      .populate('submittedBy',      'firstName lastName role');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const history = await ApplicationHistory.find({ application: id })
      .populate('actionBy',          'firstName lastName role staffType profilePictureUrl')
      .populate('previousRecipient', 'firstName lastName role staffType')
      .populate('newRecipient',      'firstName lastName role staffType')
      .sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...application.toObject(),
        history,
        isCurrentRecipient: true, // admin can always process
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 5. Admin — Browse All Applications ───────────────────────────────────────
// GET /api/v1/admin/applications
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminAllApplications = async (req, res) => {
  try {
    const {
      status,
      department,
      applicationType,
      isUrgent,
      currentRecipient,
      page      = 1,
      limit     = 20,
      sortBy    = 'submittedDate',
      sortOrder = 'desc',
    } = req.query;

    const query = {};
    if (status)               query.status           = status;
    if (department)           query.department        = department;
    if (applicationType)      query.applicationType   = applicationType;
    if (isUrgent === 'true')  query.isUrgent          = true;
    if (currentRecipient)     query.currentRecipient  = currentRecipient;

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('student',          'firstName lastName studentId email')
        .populate('department',       'name code')
        .populate('currentRecipient', 'firstName lastName role staffType')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Application.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        page:  parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};