// src/controllers/vc.controller.js
import mongoose from 'mongoose';
import { Application, ApplicationHistory, User, Department } from '../models/index.js';

// ── 1. VC Personal Stats ──────────────────────────────────────────────────────
// GET /api/v1/vc/personal
// ─────────────────────────────────────────────────────────────────────────────
export const getVCPersonalStats = async (req, res) => {
  try {
    const vcId = req.user._id;

    const [pendingApps, vcUser, recentlyActioned, urgentInbox] = await Promise.all([

      Application.find({
        currentRecipient: vcId,
        status: { $in: ['pending', 'forwarded'] },
      })
        .populate('student',     'firstName lastName studentId profilePictureUrl')
        .populate('department',  'name code')
        .populate('attachments', 'originalName url mimetype size')
        .sort({ isUrgent: -1, submittedDate: 1 }),

      User.findById(vcId).select('stats firstName lastName'),

      ApplicationHistory.find({ actionBy: vcId })
        .populate({
          path: 'application',
          select: 'applicationId title status applicationType isUrgent submittedDate',
          populate: [
            { path: 'student',    select: 'firstName lastName studentId' },
            { path: 'department', select: 'name code' },
          ],
        })
        .sort({ timestamp: -1 })
        .limit(15),

      Application.find({
        currentRecipient: vcId,
        isUrgent: true,
        status:   { $in: ['pending', 'forwarded'] },
      })
        .populate('student',    'firstName lastName studentId')
        .populate('department', 'name code')
        .sort({ submittedDate: 1 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        inbox: {
          all:            pendingApps,
          urgent:         urgentInbox,
          totalCount:     pendingApps.length,
          urgentCount:    urgentInbox.length,
          forwardedCount: pendingApps.filter(a => a.status === 'forwarded').length,
        },
        myStats:          vcUser?.stats || {},
        recentlyActioned,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 2. VC University-Wide Overview ────────────────────────────────────────────
// GET /api/v1/vc/university
//
// FIX 1: byDepartment now includes ALL departments even with zero apps.
// FIX 2: examinationOfficerWorkload always returned — even if officers have 0 apps,
//         they still appear so VC knows they exist.
// ─────────────────────────────────────────────────────────────────────────────
export const getVCUniversityView = async (req, res) => {
  try {
    const vcId = req.user._id;

    const [
      universityTotals,
      appsByDept,         // only depts that HAVE applications
      byType,
      byStatus,
      urgentPending,
      recentApplications,
      roleBreakdown,
      allDepartments,     // ALL active depts regardless of app count
      examOfficers,       // ALL active exam officers regardless of pending count
    ] = await Promise.all([

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
          },
        },
      ]),

      // Application counts — only depts that have apps
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

      // ✅ FIX: ALL active departments
      Department.find({ isActive: true })
        .select('_id name code hod chairperson')
        .populate('hod',         'firstName lastName')
        .populate('chairperson', 'firstName lastName')
        .sort({ name: 1 }),

      // ✅ FIX: ALL active exam officers — not just ones with pending apps
      User.find({ role: 'examination_officer', isActive: true })
        .select('_id firstName lastName role email profilePictureUrl stats'),
    ]);

    // ✅ FIX: Merge app counts into ALL departments
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

    // ✅ FIX: Get workload for exam officers (even 0-pending ones still appear)
    let examinationOfficerWorkload = [];
    if (examOfficers.length) {
      const examIds = examOfficers.map(e => e._id);
      const workload = await Application.aggregate([
        {
          $match: {
            currentRecipient: { $in: examIds },
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
      const wMap = {};
      workload.forEach(w => { wMap[w._id.toString()] = w; });

      examinationOfficerWorkload = examOfficers.map(o => ({
        ...o.toObject(),
        pendingCount: wMap[o._id.toString()]?.pendingCount || 0,
        urgentCount:  wMap[o._id.toString()]?.urgentCount  || 0,
      }));
    }

    const myPendingCount = await Application.countDocuments({
      currentRecipient: vcId,
      status:           { $in: ['pending', 'forwarded'] },
    });

    res.status(200).json({
      success: true,
      data: {
        totals: universityTotals[0] || {
          total: 0, pending: 0, approved: 0, rejected: 0, completed: 0, urgent: 0,
        },
        byDepartment,           // ✅ ALL departments, zero-count ones included
        byType,
        byStatus,
        urgentPending,
        recentApplications,
        examinationOfficerWorkload, // ✅ ALL exam officers, zero-pending ones included
        roleBreakdown,
        myPendingCount,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 3. VC Department Drill-Down ───────────────────────────────────────────────
// GET /api/v1/vc/department/:departmentId
//
// FIX: Returns staffWithWorkload (ALL staff, HOD first) instead of just
//      staffWorkload (only staff with pending apps).
// ─────────────────────────────────────────────────────────────────────────────
export const getVCDepartmentDrill = async (req, res) => {
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

      // Pending counts only — for merging
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
      ]),

      // ✅ FIX: ALL staff — HOD, chairperson, staff
      User.find({
        department: departmentId,
        role:       { $in: ['hod', 'chairperson', 'staff'] },
        isActive:   true,
      }).select('firstName lastName email role staffType profilePictureUrl'),

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

    // ✅ FIX: Sort staff — HOD first, chairperson second, then regular staff
    const ROLE_ORDER = { hod: 0, chairperson: 1, staff: 2 };
    const wMap = {};
    staffWorkload.forEach(w => { wMap[w._id.toString()] = w; });

    const staffWithWorkload = allStaff
      .map(s => s.toObject())
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))
      .map(s => ({
        ...s,
        pendingCount: wMap[s._id.toString()]?.pendingCount || 0,
        urgentCount:  wMap[s._id.toString()]?.urgentCount  || 0,
      }));

    res.status(200).json({
      success: true,
      data: {
        department,
        studentCount,
        stats:              stats[0] || { total: 0, pending: 0, approved: 0, rejected: 0, urgent: 0 },
        byType,
        byStatus,
        staffWithWorkload,  // ✅ HOD first, all staff, with workload counts merged
        recentApplications,
        urgentPending,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 4. VC — View Any Single Application ──────────────────────────────────────
// GET /api/v1/vc/applications/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getVCApplicationById = async (req, res) => {
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

    const isCurrentRecipient =
      application.currentRecipient?._id?.toString() === req.user._id.toString();

    res.status(200).json({
      success: true,
      data: { ...application.toObject(), history, isCurrentRecipient },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── 5. VC — Browse All Applications ──────────────────────────────────────────
// GET /api/v1/vc/applications
// ─────────────────────────────────────────────────────────────────────────────
export const getVCAllApplications = async (req, res) => {
  try {
    const {
      status,
      department,
      applicationType,
      isUrgent,
      page      = 1,
      limit     = 20,
      sortBy    = 'submittedDate',
      sortOrder = 'desc',
    } = req.query;

    const query = {};
    if (status)               query.status          = status;
    if (department)           query.department       = department;
    if (applicationType)      query.applicationType  = applicationType;
    if (isUrgent === 'true')  query.isUrgent         = true;

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