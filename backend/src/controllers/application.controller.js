// src/controllers/application.controller.js
import mongoose from 'mongoose';
import { Application, ApplicationHistory, User, SystemSettings, Notification, Department } from '../models/index.js';
import { emitToUser, emitToDepartment, emitAdminActivityLog, emitAdminApplicationUpdate } from '../socket/index.js';
import { generateApplicationPDF } from '../utils/pdfGenerator.js';
import {
  sendApplicationSubmissionEmails,
  sendApplicationStatusUpdateEmail,
} from '../services/applicationEmail.service.js';

// Application types that always require examiner verification before HOD final approval
const EXAMINER_REQUIRED_TYPES = [
  'result_card_request',
  'certificate_request',
  'transcript_request',
];

// ── Submit a new application ──────────────────────────────────────────────────
export const submitApplication = async (req, res) => {
  try {
    const { applicationType, title, description, recipientId: directId, recipientRole, isUrgent } = req.body;

    let recipientId = directId;

    // If caller sent a role name instead of a specific ID, resolve it to a user.
    // HOD and Chairperson are department-scoped; other roles are university-wide.
    if (!recipientId && recipientRole) {
      const query = { role: recipientRole, isActive: true };
      if (['hod', 'chairperson'].includes(recipientRole)) {
        query.department = req.user.department;
      }
      const roleUser = await User.findOne(query).select('_id');
      if (!roleUser) {
        return res.status(404).json({
          success: false,
          message: `No active ${recipientRole.replace(/_/g, ' ')} found. Please select a specific recipient.`,
        });
      }
      recipientId = roleUser._id;
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found.' });
    }

    const allowedRecipientRoles = ['staff', 'hod', 'vc', 'examination_officer', 'chairperson', 'admin'];
    if (!allowedRecipientRoles.includes(recipient.role)) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit application to a user with role "${recipient.role}".`,
      });
    }

    // Enforce: only EXAMINER_REQUIRED_TYPES can be submitted to the Examination Officer.
    // All other types must go to HOD, Chairperson, VC, or Staff.
    if (recipient.role === 'examination_officer' && !EXAMINER_REQUIRED_TYPES.includes(applicationType)) {
      return res.status(400).json({
        success: false,
        message: `The Examination Officer does not handle "${applicationType.replace(/_/g, ' ')}" applications. They only accept: Result Card Request, Certificate Request, and Transcript Request.`,
      });
    }

    const settings = await SystemSettings.findOneAndUpdate(
      {},
      { $inc: { currentApplicationNumber: 1 } },
      { returnDocument: 'after', upsert: true }
    );

    const applicationId = `${settings.applicationPrefix}${settings.currentApplicationNumber.toString().padStart(4, '0')}`;

    const application = await Application.create({
      applicationId,
      student:                      req.user._id,
      department:                   req.user.department,
      submittedBy:                  req.user._id,
      applicationType,
      title,
      description,
      currentRecipient:             recipientId,
      isUrgent:                     isUrgent || false,
      requiresExaminerVerification: EXAMINER_REQUIRED_TYPES.includes(applicationType),
    });

    await ApplicationHistory.create({
      application:  application._id,
      actionBy:     req.user._id,
      action:       'submitted',
      statusAfter:  'pending',
      newRecipient: recipientId,
    });

    await sendApplicationSubmissionEmails(req.user._id, recipientId, {
      _id: application._id,
      applicationId,
      title,
      applicationType,
      isUrgent: isUrgent || false,
    });

    res.status(201).json({ success: true, data: application });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get applications for the logged-in student ────────────────────────────────
export const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate('currentRecipient', 'firstName lastName role staffType')
      .populate('attachments',      'originalName url mimetype size')
      .sort({ submittedDate: -1 });

    const enriched = applications.map(app => {
      const obj = app.toObject();
      obj.hasPendingDocRequest = app.documentRequests?.some(r => !r.isResolved) || false;
      return obj;
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get applications for a user to review (assigned to them) ──────────────────
// Returns ALL applications the user has ever acted on (history) PLUS any currently
// in their active queue. Enriched with tags for HOD workflow.
export const getApplicationsForReview = async (req, res) => {
  try {
    // All application IDs this user has taken any reviewer action on
    const reviewedAppIds = await ApplicationHistory.find({
      actionBy: req.user._id,
      action:   { $nin: ['submitted'] },
    }).distinct('application');

    const applications = await Application.find({
      $or: [
        { currentRecipient: req.user._id },          // active queue (any status)
        { _id: { $in: reviewedAppIds } },             // historical actions
      ],
    })
      .populate('student',          'firstName lastName email studentId profilePictureUrl')
      .populate('department',       'name')
      .populate('currentRecipient', 'firstName lastName role')
      .populate('attachments',      'originalName url mimetype size')
      .sort({ isUrgent: -1, submittedDate: -1 });

    const enriched = applications.map(app => {
      const obj = app.toObject();

      // HOD sees this tag → examiner verified, ready for HOD final approval
      obj.awaitingFinalApproval =
        app.requiresExaminerVerification &&
        app.academicVerification?.isVerified === true;

      // HOD sees this tag → needs to forward to examiner first
      obj.needsExaminerFirst =
        app.requiresExaminerVerification &&
        !app.academicVerification?.isVerified;

      // Examiner / anyone sees this tag → student has unresolved doc requests
      obj.hasPendingDocRequest = app.documentRequests?.some(r => !r.isResolved) || false;

      return obj;
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── HOD: Get ALL applications in their department ─────────────────────────────
export const getDepartmentApplications = async (req, res) => {
  try {
    const departmentId = req.user.department?.toString() || req.query.department;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department ID is required.' });
    }

    const {
      status,
      applicationType,
      isUrgent,
      studentName,
      dateFrom,
      dateTo,
      assignedToMe,
      page      = 1,
      limit     = 20,
      sortBy    = 'submittedDate',
      sortOrder = 'desc',
    } = req.query;

    const query = { department: departmentId };

    if (status === 'pending_review') {
      query.currentRecipient = req.user._id;
      query.status = { $in: ['pending', 'forwarded'] };
    } else {
      if (assignedToMe === 'true')       query.currentRecipient = req.user._id;
      else if (assignedToMe === 'false') query.currentRecipient = { $ne: req.user._id };

      if (status === 'pending') query.status = { $in: ['pending', 'forwarded'] };
      else if (status)          query.status = status;
      else                      query.status = { $ne: 'completed' };
    }

    if (applicationType)     query.applicationType = applicationType;
    if (isUrgent === 'true') query.isUrgent = true;

    if (studentName) {
      const studentIds = await User.find({
        department: departmentId,
        role: 'student',
        $or: [
          { firstName: { $regex: studentName, $options: 'i' } },
          { lastName:  { $regex: studentName, $options: 'i' } },
          { studentId: { $regex: studentName, $options: 'i' } },
        ],
      }).select('_id');
      query.student = { $in: studentIds.map(s => s._id) };
    }

    if (dateFrom || dateTo) {
      query.submittedDate = {};
      if (dateFrom) query.submittedDate.$gte = new Date(dateFrom);
      if (dateTo)   query.submittedDate.$lte = new Date(dateTo);
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [applications, total, stats] = await Promise.all([
      Application.find(query)
        .populate('student',          'firstName lastName email studentId profilePictureUrl')
        .populate('department',       'name code')
        .populate('currentRecipient', 'firstName lastName role staffType profilePictureUrl')
        .populate('submittedBy',      'firstName lastName role')
        .populate('attachments',      'originalName url mimetype size')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Application.countDocuments(query),
      Application.aggregate([
        { $match: { department: new mongoose.Types.ObjectId(departmentId) } },
        {
          $group: {
            _id:          null,
            total:        { $sum: 1 },
            pending:      { $sum: { $cond: [{ $in: ['$status', ['pending', 'forwarded']] }, 1, 0] } },
            approved:     { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            rejected:     { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            urgent:       { $sum: { $cond: ['$isUrgent', 1, 0] } },
            assignedToMe: { $sum: { $cond: [{ $eq: ['$currentRecipient', req.user._id] }, 1, 0] } },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: applications,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      stats: stats[0] || { total: 0, pending: 0, approved: 0, rejected: 0, urgent: 0, assignedToMe: 0 },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── HOD: Get single application with full history ─────────────────────────────
export const getDepartmentApplicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('student',          'firstName lastName email studentId profilePictureUrl contactNumber')
      .populate('department',       'name code')
      .populate('currentRecipient', 'firstName lastName role staffType profilePictureUrl')
      .populate('submittedBy',      'firstName lastName role')
      .populate('attachments',      'originalName url mimetype size');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const isDepartmentHOD = req.user.role === 'hod' &&
      application.department?._id?.toString() === req.user.department?.toString();
    const isRecipient = application.currentRecipient?._id?.toString() === req.user._id.toString();
    const isAdmin     = req.user.role === 'admin';

    if (!isDepartmentHOD && !isRecipient && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this application.' });
    }

    const history = await ApplicationHistory.find({ application: id })
      .populate('actionBy',          'firstName lastName role staffType profilePictureUrl')
      .populate('previousRecipient', 'firstName lastName role staffType')
      .populate('newRecipient',      'firstName lastName role staffType')
      .sort({ timestamp: 1 });

    res.status(200).json({ success: true, data: { ...application.toObject(), history } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── HOD: Department application statistics ────────────────────────────────────
export const getDepartmentApplicationStats = async (req, res) => {
  try {
    const departmentId = req.user.department?.toString() || req.query.department;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department ID is required.' });
    }

    const [overallStats, byType, byStatus, recentActivity, staffWorkload] = await Promise.all([
      Application.aggregate([
        { $match: { department: new mongoose.Types.ObjectId(departmentId) } },
        {
          $group: {
            _id:      null,
            total:    { $sum: 1 },
            pending:  { $sum: { $cond: [{ $in: ['$status', ['pending', 'forwarded']] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            urgent:   { $sum: { $cond: ['$isUrgent', 1, 0] } },
            avgProcessingTimeDays: {
              $avg: {
                $cond: [
                  { $and: ['$completedDate', '$submittedDate'] },
                  { $divide: [{ $subtract: ['$completedDate', '$submittedDate'] }, 1000 * 60 * 60 * 24] },
                  null,
                ],
              },
            },
          },
        },
      ]),
      Application.aggregate([
        { $match: { department: new mongoose.Types.ObjectId(departmentId) } },
        { $group: { _id: '$applicationType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Application.aggregate([
        { $match: { department: new mongoose.Types.ObjectId(departmentId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.find({ department: departmentId })
        .populate('student',          'firstName lastName studentId')
        .populate('currentRecipient', 'firstName lastName role staffType')
        .sort({ submittedDate: -1 })
        .limit(10),
      Application.aggregate([
        {
          $match: {
            department: new mongoose.Types.ObjectId(departmentId),
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
          $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id:          1,
            pendingCount: 1,
            urgentCount:  1,
            firstName:    { $ifNull: ['$user.firstName', 'Unknown'] },
            lastName:     { $ifNull: ['$user.lastName',  ''] },
            role:         { $ifNull: ['$user.role',      'unknown'] },
            staffType:    { $ifNull: ['$user.staffType', null] },
          },
        },
        { $sort: { pendingCount: -1 } },
      ]),
    ]);

    const myPendingCount = await Application.countDocuments({
      department:       departmentId,
      currentRecipient: req.user._id,
      status:           { $in: ['pending', 'forwarded'] },
    });

    res.status(200).json({
      success: true,
      data: {
        overall:        overallStats[0] || { total: 0, pending: 0, approved: 0, rejected: 0, urgent: 0 },
        byType,
        byStatus,
        recentActivity,
        staffWorkload,
        myPendingCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── HOD: Staff list with pending application counts ───────────────────────────
export const getDepartmentStaffWithWorkload = async (req, res) => {
  try {
    const departmentId = req.user.department?.toString() || req.query.department;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department ID is required.' });
    }

    const staff = await User.find({
      department: departmentId,
      role:       { $in: ['staff', 'examination_officer'] },
      isActive:   true,
    })
      .select('firstName lastName role staffType profilePictureUrl email')
      .sort({ role: 1, firstName: 1 });

    const staffIds = staff.map(s => s._id);
    const workload = await Application.aggregate([
      {
        $match: {
          department:       new mongoose.Types.ObjectId(departmentId),
          currentRecipient: { $in: staffIds },
          status:           { $in: ['pending', 'forwarded'] },
        },
      },
      {
        $group: {
          _id:     '$currentRecipient',
          pending: { $sum: 1 },
          urgent:  { $sum: { $cond: ['$isUrgent', 1, 0] } },
        },
      },
    ]);

    const workloadMap = {};
    workload.forEach(w => { workloadMap[w._id.toString()] = { pending: w.pending, urgent: w.urgent }; });

    const result = staff.map(s => ({
      ...s.toObject(),
      workload: workloadMap[s._id.toString()] || { pending: 0, urgent: 0 },
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Process an application ────────────────────────────────────────────────────
// Actions: approved | rejected | forwarded | verified | request_docs
export const processApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks, newRecipientId, verificationData } = req.body;

    const application = await Application.findById(id).populate('student department');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const isCurrentRecipient = application.currentRecipient.toString() === req.user._id.toString();
    const isAdmin             = req.user.role === 'admin';
    if (!isCurrentRecipient && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not the current recipient of this application.' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ACTION: request_docs
    // Examiner asks student to upload additional documents.
    // App stays with examiner; student is notified to re-upload then resolve.
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'request_docs') {
      if (req.user.role !== 'examination_officer' && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Only examination officers can request documents.' });
      }
      if (!remarks?.trim()) {
        return res.status(400).json({ success: false, message: 'A message describing required documents is required.' });
      }

      application.documentRequests.push({
        requestedBy: req.user._id,
        message:     remarks.trim(),
      });
      application.lastUpdated = new Date();
      await application.save();

      await ApplicationHistory.create({
        application:  application._id,
        actionBy:     req.user._id,
        action:       'request_docs',
        remarks:      remarks.trim(),
        statusBefore: application.status,
        statusAfter:  application.status,
      });

      // Notify student
      const studentNotif = await Notification.create({
        recipient:          application.student._id,
        message:            `The Examination Office has requested additional documents for "${application.title}" (${application.applicationId}). Required: ${remarks.trim()}`,
        type:               'warning',
        relatedApplication: application._id,
      });
      emitToUser(application.student._id.toString(), 'newNotification', {
        notification: { ...studentNotif.toObject(), isRead: false },
      });
      emitToUser(application.student._id.toString(), 'docs_requested', {
        applicationId: application._id,
        message:       remarks.trim(),
      });
      Notification.countDocuments({ recipient: application.student._id, isRead: false })
        .then(unreadCount => emitToUser(application.student._id.toString(), 'notification_count_update', { unreadCount }))
        .catch(() => {});

      // Admin activity log + table update
      emitAdminActivityLog({
        event:         'docs_requested',
        message:       `Examiner ${req.user.firstName} ${req.user.lastName} requested documents for "${application.title}" (${application.applicationId})`,
        actor:         `${req.user.firstName} ${req.user.lastName}`,
        actorRole:     'examination_officer',
        department:    application.department?.name || 'N/A',
        applicationId: application.applicationId,
        severity:      'info',
      });
      emitAdminApplicationUpdate({
        applicationId: application._id.toString(),
        appCode:       application.applicationId,
        action:        'request_docs',
        status:        application.status,
        department:    application.department?.name || 'N/A',
        student:       { firstName: application.student.firstName, lastName: application.student.lastName, studentId: application.student.studentId },
        actor:         { firstName: req.user.firstName, lastName: req.user.lastName, role: req.user.role },
      });

      return res.status(200).json({ success: true, message: 'Document request sent to student.', data: application });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ACTION: verified
    // Examiner stamps transcript verification and returns app to HOD.
    // HOD is the final approver — VC is NOT involved in this chain.
    // verificationData is optional; only remarks are expected from the examiner.
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'verified') {
      if (req.user.role !== 'examination_officer' && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Only examination officers can verify applications.' });
      }

      // Find HOD of the student's department
      const hodOfDept = await User.findOne({
        role:       'hod',
        department: application.department._id,
      });
      if (!hodOfDept) {
        return res.status(400).json({
          success: false,
          message: 'No HOD found for this department. Cannot return application after verification.',
        });
      }

      const previousRecipient = application.currentRecipient;
      const statusBefore      = application.status;

      const cgpaVal      = verificationData?.cgpa != null ? parseFloat(verificationData.cgpa) : null;
      const attendanceMet = verificationData?.attendanceMet ?? null;
      const isEligible    = cgpaVal != null ? (cgpaVal >= 2.8 && attendanceMet === true) : null;

      application.academicVerification = {
        isVerified:    true,
        cgpa:          cgpaVal,
        attendanceMet,
        isEligible,
        remarks:       verificationData?.remarks || '',
        verifiedBy:    req.user._id,
        verifiedAt:    new Date(),
      };
      application.status           = 'forwarded';
      application.currentRecipient = hodOfDept._id;
      application.lastUpdated      = new Date();
      await application.save();

      await ApplicationHistory.create({
        application:       application._id,
        actionBy:          req.user._id,
        action:            'verified',
        remarks:           verificationData.remarks || '',
        previousRecipient,
        newRecipient:      hodOfDept._id,
        statusBefore,
        statusAfter:       'forwarded',
      });

      // Notify HOD — app is back, ready for final approval
      const hodNotif = await Notification.create({
        recipient:          hodOfDept._id,
        message:            `Transcript verified for "${application.title}" (${application.applicationId}). ${verificationData?.remarks ? `Examiner notes: ${verificationData.remarks}. ` : ''}Please give final approval.`,
        type:               'success',
        relatedApplication: application._id,
      });
      emitToUser(hodOfDept._id.toString(), 'newNotification', {
        notification: { ...hodNotif.toObject(), isRead: false },
      });
      emitToUser(hodOfDept._id.toString(), 'application_verified_returned', {
        applicationId: application._id,
        message:       'Transcript verified by examiner — awaiting your final approval.',
      });
      Notification.countDocuments({ recipient: hodOfDept._id, isRead: false })
        .then(unreadCount => emitToUser(hodOfDept._id.toString(), 'notification_count_update', { unreadCount }))
        .catch(() => {});

      // Notify student — verification done, waiting for HOD
      const studentNotif = await Notification.create({
        recipient:          application.student._id,
        message:            `Your application "${application.title}" (${application.applicationId}) has been academically verified. Awaiting final HOD approval.`,
        type:               'info',
        relatedApplication: application._id,
      });
      emitToUser(application.student._id.toString(), 'newNotification', {
        notification: { ...studentNotif.toObject(), isRead: false },
      });
      Notification.countDocuments({ recipient: application.student._id, isRead: false })
        .then(unreadCount => emitToUser(application.student._id.toString(), 'notification_count_update', { unreadCount }))
        .catch(() => {});

      // Admin live feed
      emitAdminActivityLog({
        event:         'application_verified',
        message:       `Examiner ${req.user.firstName} ${req.user.lastName} verified "${application.title}" (${application.applicationId}) — returned to HOD ${hodOfDept.firstName} ${hodOfDept.lastName}`,
        actor:         `${req.user.firstName} ${req.user.lastName}`,
        actorRole:     'examination_officer',
        department:    application.department?.name || 'N/A',
        applicationId: application.applicationId,
        severity:      'success',
      });

      // Fire the email service for examiner verified action
      await sendApplicationStatusUpdateEmail(
        application._id,
        req.user._id,
        'verified',
        verificationData?.remarks || '',
        hodOfDept._id.toString()
      );

      return res.status(200).json({
        success: true,
        message: `Application verified. Returned to HOD ${hodOfDept.firstName} ${hodOfDept.lastName} for final approval.`,
        data:    application,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STANDARD ACTIONS: approved | rejected | forwarded
    // ═══════════════════════════════════════════════════════════════════════
    const statusMap = { approved: 'approved', rejected: 'rejected', forwarded: 'forwarded' };
    if (!statusMap[action]) {
      return res.status(400).json({ success: false, message: `Unknown action "${action}".` });
    }

    const previousRecipient = application.currentRecipient;
    const statusBefore      = application.status;
    const statusAfter       = statusMap[action];
    let newRecipient        = previousRecipient;

    if (action === 'forwarded') {
      const { recipientRole: fwdByRole } = req.body;

      if (!newRecipientId && !fwdByRole) {
        return res.status(400).json({ success: false, message: 'newRecipientId or recipientRole is required for forwarding.' });
      }

      if (fwdByRole) {
        // Block forwarding non-examiner types to examination_officer
        if (fwdByRole === 'examination_officer' && !EXAMINER_REQUIRED_TYPES.includes(application.applicationType)) {
          return res.status(400).json({
            success: false,
            message: `The Examination Officer does not handle "${application.applicationType.replace(/_/g, ' ')}" applications. They only accept: Result Card Request, Certificate Request, and Transcript Request.`,
          });
        }
        // Resolve by role — examination_officer and vc are university-wide
        const roleQuery = { role: fwdByRole, isActive: true };
        if (!['examination_officer', 'vc', 'admin'].includes(fwdByRole)) {
          roleQuery.department = application.department._id;
        }
        const roleUser = await User.findOne(roleQuery).select('_id');
        if (!roleUser) {
          return res.status(404).json({
            success: false,
            message: `No active ${fwdByRole.replace(/_/g, ' ')} found to forward to.`,
          });
        }
        newRecipient = roleUser._id;
      } else {
        const fwdRecipient = await User.findById(newRecipientId);
        if (!fwdRecipient) {
          return res.status(404).json({ success: false, message: 'Forward recipient not found.' });
        }
        // Block forwarding non-examiner types to examination_officer by direct ID
        if (fwdRecipient.role === 'examination_officer' && !EXAMINER_REQUIRED_TYPES.includes(application.applicationType)) {
          return res.status(400).json({
            success: false,
            message: `The Examination Officer does not handle "${application.applicationType.replace(/_/g, ' ')}" applications. They only accept: Result Card Request, Certificate Request, and Transcript Request.`,
          });
        }
        newRecipient = newRecipientId;
      }
    }

    application.status           = statusAfter;
    application.currentRecipient = newRecipient;
    application.lastUpdated      = new Date();

    if (action === 'approved' || action === 'rejected') {
      application.finalRemarks  = remarks || '';
      application.completedDate = new Date();
    }

    await application.save();

    await ApplicationHistory.create({
      application: application._id,
      actionBy:    req.user._id,
      action,
      remarks:     remarks || '',
      previousRecipient,
      newRecipient,
      statusBefore,
      statusAfter,
    });

    // ── Notify student ──────────────────────────────────────────────────────
    const studentMsg =
      action === 'approved'
        ? `Your application "${application.title}" (${application.applicationId}) has been approved by ${req.user.firstName} ${req.user.lastName}.`
        : action === 'rejected'
        ? `Your application "${application.title}" (${application.applicationId}) has been rejected by ${req.user.firstName} ${req.user.lastName}. ${remarks ? `Reason: ${remarks}` : ''}`
        : `Your application "${application.title}" (${application.applicationId}) has been forwarded for further review.`;

    const studentNotif = await Notification.create({
      recipient:          application.student._id,
      message:            studentMsg,
      type:               action === 'approved' ? 'success' : action === 'rejected' ? 'alert' : 'info',
      relatedApplication: application._id,
    });
    emitToUser(application.student._id.toString(), 'newNotification', {
      notification: { ...studentNotif.toObject(), isRead: false },
    });
    Notification.countDocuments({ recipient: application.student._id, isRead: false })
      .then(unreadCount => emitToUser(application.student._id.toString(), 'notification_count_update', { unreadCount }))
      .catch(() => {});

    // ── Notify new recipient when forwarded ────────────────────────────────
    if (action === 'forwarded') {
      const fwdNotif = await Notification.create({
        recipient:          newRecipient,
        message:            `Application "${application.title}" (${application.applicationId}) has been forwarded to you by ${req.user.firstName} ${req.user.lastName} for review.`,
        type:               'info',
        relatedApplication: application._id,
      });
      emitToUser(newRecipient.toString(), 'newNotification', {
        notification: { ...fwdNotif.toObject(), isRead: false },
      });
      Notification.countDocuments({ recipient: newRecipient, isRead: false })
        .then(unreadCount => emitToUser(newRecipient.toString(), 'notification_count_update', { unreadCount }))
        .catch(() => {});
    }

    // ── Notify all previous handlers in the chain ─────────────────────────
    // When an application is approved, rejected, or forwarded, every staff member
    // who previously touched it (submitted, forwarded, verified) should know the outcome.
    // Admins are notified separately below, so we exclude them here.
    const handlerHistory = await ApplicationHistory.find({
      application: application._id,
      action:      { $in: ['submitted', 'forwarded', 'verified'] },
    }).select('actionBy').lean();

    const adminIds    = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    const adminIdSet  = new Set(adminIds.map(a => a._id.toString()));
    const actorStr    = req.user._id.toString();
    const studentStr  = application.student._id.toString();

    const uniqueHandlerIds = [
      ...new Set(handlerHistory.map(h => h.actionBy.toString())),
    ].filter(id => id !== actorStr && id !== studentStr && !adminIdSet.has(id));

    if (uniqueHandlerIds.length > 0) {
      const handlerMsg =
        action === 'approved'
          ? `Application "${application.title}" (${application.applicationId}) that you handled has been approved by ${req.user.firstName} ${req.user.lastName} (${req.user.role.replace(/_/g, ' ')}).`
          : action === 'rejected'
          ? `Application "${application.title}" (${application.applicationId}) that you handled has been rejected by ${req.user.firstName} ${req.user.lastName} (${req.user.role.replace(/_/g, ' ')}).${remarks ? ` Reason: ${remarks}` : ''}`
          : `Application "${application.title}" (${application.applicationId}) that you handled has been forwarded to ${req.user.firstName} ${req.user.lastName} for further review.`;

      await Promise.all(uniqueHandlerIds.map(async (handlerId) => {
        const handlerNotif = await Notification.create({
          recipient:          handlerId,
          message:            handlerMsg,
          type:               action === 'approved' ? 'success' : action === 'rejected' ? 'alert' : 'info',
          relatedApplication: application._id,
        });
        emitToUser(handlerId, 'newNotification', {
          notification: { ...handlerNotif.toObject(), isRead: false },
        });
        Notification.countDocuments({ recipient: handlerId, isRead: false })
          .then(unreadCount => emitToUser(handlerId, 'notification_count_update', { unreadCount }))
          .catch(() => {});
      }));
    }

    // ── Notify all admins ──────────────────────────────────────────────────
    const admins = adminIds;
    const adminMsg =
      action === 'approved'
        ? `Application "${application.title}" (${application.applicationId}) approved by ${req.user.firstName} ${req.user.lastName} (${req.user.role.replace(/_/g, ' ')}).`
        : action === 'rejected'
        ? `Application "${application.title}" (${application.applicationId}) rejected by ${req.user.firstName} ${req.user.lastName} (${req.user.role.replace(/_/g, ' ')}). ${remarks ? `Reason: ${remarks}` : ''}`
        : `Application "${application.title}" (${application.applicationId}) forwarded by ${req.user.firstName} ${req.user.lastName} (${req.user.role.replace(/_/g, ' ')}).`;

    await Promise.all(admins.map(async (admin) => {
      const adminNotif = await Notification.create({
        recipient:          admin._id,
        message:            adminMsg,
        type:               action === 'approved' ? 'success' : action === 'rejected' ? 'alert' : 'info',
        relatedApplication: application._id,
      });
      emitToUser(admin._id.toString(), 'newNotification', {
        notification: { ...adminNotif.toObject(), isRead: false },
      });
      Notification.countDocuments({ recipient: admin._id, isRead: false })
        .then(unreadCount => emitToUser(admin._id.toString(), 'notification_count_update', { unreadCount }))
        .catch(() => {});
    }));

    // ── Admin live feed ────────────────────────────────────────────────────
    emitAdminActivityLog({
      event:         `application_${action}`,
      message:       `${req.user.firstName} ${req.user.lastName} ${action} "${application.title}" (${application.applicationId})${remarks ? `: ${remarks}` : ''}`,
      actor:         `${req.user.firstName} ${req.user.lastName}`,
      actorRole:     req.user.role,
      department:    application.department?.name || 'N/A',
      applicationId: application.applicationId,
      severity:      action === 'approved' ? 'success' : action === 'rejected' ? 'alert' : 'info',
    });
    emitAdminApplicationUpdate({
      applicationId: application._id.toString(),
      appCode:       application.applicationId,
      action,
      status:        statusAfter,
      department:    application.department?.name || 'N/A',
      student:       {
        firstName: application.student.firstName,
        lastName:  application.student.lastName,
        studentId: application.student.studentId,
      },
      actor: { firstName: req.user.firstName, lastName: req.user.lastName, role: req.user.role },
    });

    await sendApplicationStatusUpdateEmail(
      application._id,
      req.user._id,
      action,
      remarks || '',
      action === 'forwarded' ? newRecipient.toString() : null
    );

    res.status(200).json({ success: true, data: application });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Student resolves a document request from the examiner ─────────────────────
// PATCH /api/v1/applications/:id/resolve-docs
export const resolveDocumentRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id).populate('currentRecipient', 'firstName lastName role');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (application.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your application.' });
    }

    const pendingRequest = application.documentRequests
      .filter(r => !r.isResolved)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0];

    if (!pendingRequest) {
      return res.status(400).json({ success: false, message: 'No pending document request found.' });
    }

    pendingRequest.isResolved = true;
    pendingRequest.resolvedAt = new Date();
    application.lastUpdated   = new Date();
    await application.save();

    // Notify examiner
    const examinerNotif = await Notification.create({
      recipient:          application.currentRecipient._id,
      message:            `Student ${req.user.firstName} ${req.user.lastName} has uploaded the requested documents for "${application.title}" (${application.applicationId}). You can now proceed with verification.`,
      type:               'info',
      relatedApplication: application._id,
    });
    emitToUser(application.currentRecipient._id.toString(), 'newNotification', {
      notification: { ...examinerNotif.toObject(), isRead: false },
    });
    emitToUser(application.currentRecipient._id.toString(), 'docs_uploaded', {
      applicationId: application._id,
      studentName:   `${req.user.firstName} ${req.user.lastName}`,
    });
    Notification.countDocuments({ recipient: application.currentRecipient._id, isRead: false })
      .then(unreadCount => emitToUser(application.currentRecipient._id.toString(), 'notification_count_update', { unreadCount }))
      .catch(() => {});

    res.status(200).json({ success: true, message: 'Documents submitted. Examiner has been notified.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Examiner dashboard ────────────────────────────────────────────────────────
// GET /api/v1/applications/examiner/dashboard
export const getExaminerDashboard = async (req, res) => {
  try {
    const [pendingVerification, awaitingDocs, recentlyVerified] = await Promise.all([
      // Apps in examiner's inbox waiting for verification
      Application.find({
        currentRecipient:                req.user._id,
        status:                          { $in: ['pending', 'forwarded'] },
        'academicVerification.isVerified': { $ne: true },
      })
        .populate('student',      'firstName lastName studentId profilePictureUrl')
        .populate('department',   'name code')
        .populate('attachments',  'originalName url mimetype size')
        .sort({ isUrgent: -1, submittedDate: 1 }),

      // Apps where student has an unresolved doc request (examiner waiting on student)
      Application.find({
        currentRecipient:             req.user._id,
        'documentRequests.isResolved': false,
      })
        .populate('student',      'firstName lastName studentId')
        .populate('department',   'name code')
        .populate('attachments',  'originalName url mimetype size'),

      // Apps this examiner already verified (history — last 20)
      Application.find({
        'academicVerification.verifiedBy': req.user._id,
        'academicVerification.isVerified': true,
      })
        .select('applicationId title applicationType status academicVerification submittedDate department attachments')
        .populate('student',     'firstName lastName studentId')
        .populate('department',  'name code')
        .populate('attachments', 'originalName url mimetype size _id')
        .sort({ 'academicVerification.verifiedAt': -1 })
        .limit(20),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pendingVerification,
        pendingCount:      pendingVerification.length,
        urgentCount:       pendingVerification.filter(a => a.isUrgent).length,
        awaitingDocs,
        awaitingDocCount:  awaitingDocs.length,
        recentlyVerified,
        totalVerifiedCount: recentlyVerified.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Examiner analytics ────────────────────────────────────────────────────────
// GET /api/v1/applications/examiner/analytics
export const getExaminerAnalytics = async (req, res) => {
  try {
    const examinerId = req.user._id;

    const verifiedFilter = {
      'academicVerification.verifiedBy': examinerId,
      'academicVerification.isVerified': true,
    };

    const [
      pendingCount,
      overviewAgg,
      byDepartmentAgg,
      byTypeAgg,
      cgpaAgg,
      monthlyAgg,
      attendanceAgg,
      duesAgg,
    ] = await Promise.all([
      Application.countDocuments({
        currentRecipient:                  examinerId,
        status:                            { $in: ['pending', 'forwarded'] },
        'academicVerification.isVerified': { $ne: true },
      }),

      Application.aggregate([
        { $match: verifiedFilter },
        {
          $group: {
            _id: null,
            totalVerified:   { $sum: 1 },
            avgCgpa:         { $avg: '$academicVerification.cgpa' },
            avgProcessDays: {
              $avg: {
                $divide: [
                  { $subtract: ['$academicVerification.verifiedAt', '$submittedDate'] },
                  86400000,
                ],
              },
            },
          },
        },
      ]),

      Application.aggregate([
        { $match: verifiedFilter },
        {
          $group: {
            _id:         '$department',
            total:       { $sum: 1 },
            avgCgpa:     { $avg: '$academicVerification.cgpa' },
            highCgpa:    { $sum: { $cond: [{ $gte: ['$academicVerification.cgpa', 3.0] }, 1, 0] } },
            duesCleared: { $sum: { $cond: [{ $eq: ['$academicVerification.hasClearedDues', true] }, 1, 0] } },
          },
        },
        {
          $lookup: {
            from:         'departments',
            localField:   '_id',
            foreignField: '_id',
            as:           'dept',
          },
        },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id:         1,
            name:        { $ifNull: ['$dept.name', 'Unknown'] },
            code:        { $ifNull: ['$dept.code', ''] },
            total:       1,
            avgCgpa:     { $round: ['$avgCgpa', 2] },
            highCgpa:    1,
            duesCleared: 1,
          },
        },
        { $sort: { total: -1 } },
      ]),

      Application.aggregate([
        { $match: verifiedFilter },
        { $group: { _id: '$applicationType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Application.aggregate([
        { $match: { ...verifiedFilter, 'academicVerification.cgpa': { $ne: null } } },
        {
          $bucket: {
            groupBy:    '$academicVerification.cgpa',
            boundaries: [0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.01],
            default:    'Other',
            output:     { count: { $sum: 1 } },
          },
        },
      ]),

      Application.aggregate([
        {
          $match: {
            ...verifiedFilter,
            'academicVerification.verifiedAt': {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 11)),
            },
          },
        },
        {
          $group: {
            _id:   { year: { $year: '$academicVerification.verifiedAt' }, month: { $month: '$academicVerification.verifiedAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      Application.aggregate([
        { $match: { ...verifiedFilter, 'academicVerification.attendancePct': { $ne: null } } },
        {
          $group: {
            _id:      null,
            below75:  { $sum: { $cond: [{ $lt:  ['$academicVerification.attendancePct', 75]  }, 1, 0] } },
            btw75_90: { $sum: { $cond: [{ $and: [{ $gte: ['$academicVerification.attendancePct', 75] }, { $lt: ['$academicVerification.attendancePct', 90] }] }, 1, 0] } },
            above90:  { $sum: { $cond: [{ $gte: ['$academicVerification.attendancePct', 90] }, 1, 0] } },
            avg:      { $avg: '$academicVerification.attendancePct' },
          },
        },
      ]),

      Application.aggregate([
        { $match: { ...verifiedFilter, 'academicVerification.hasClearedDues': { $ne: null } } },
        {
          $group: {
            _id:        null,
            cleared:    { $sum: { $cond: [{ $eq: ['$academicVerification.hasClearedDues', true]  }, 1, 0] } },
            notCleared: { $sum: { $cond: [{ $eq: ['$academicVerification.hasClearedDues', false] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const ov  = overviewAgg[0]   || {};
    const att = attendanceAgg[0] || {};
    const due = duesAgg[0]       || {};

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const CGPA_RANGES = ['< 1.5','1.5–2.0','2.0–2.5','2.5–3.0','3.0–3.5','3.5–4.0'];

    const cgpaDistribution = cgpaAgg
      .filter(b => b._id !== 'Other' && typeof b._id === 'number')
      .map((b, i) => ({ range: CGPA_RANGES[i] || `${b._id}+`, count: b.count }));

    const monthlyTrend = monthlyAgg.map(m => ({
      month: `${MONTHS[m._id.month - 1]} ${m._id.year}`,
      count: m.count,
    }));

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalVerified:  ov.totalVerified  || 0,
          avgCgpa:        ov.avgCgpa        != null ? Math.round(ov.avgCgpa * 100) / 100 : null,
          avgProcessDays: ov.avgProcessDays != null ? Math.round(ov.avgProcessDays * 10) / 10 : null,
          totalPending:   pendingCount,
        },
        byDepartment:   byDepartmentAgg,
        byType:         byTypeAgg,
        cgpaDistribution,
        monthlyTrend,
        attendanceStats: {
          below75:  att.below75  || 0,
          btw75_90: att.btw75_90 || 0,
          above90:  att.above90  || 0,
          avg:      att.avg != null ? Math.round(att.avg * 10) / 10 : null,
        },
        duesStats: {
          cleared:    due.cleared    || 0,
          notCleared: due.notCleared || 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Examiner bulk process ─────────────────────────────────────────────────────
// PATCH /api/v1/applications/examiner/bulk-process
// Body: { applicationIds: [...], action: 'verified'|'rejected', verificationData?: {...}, remarks?: string }
export const bulkProcessApplications = async (req, res) => {
  try {
    const { applicationIds, action, verificationData, remarks } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ success: false, message: 'applicationIds array is required.' });
    }
    if (applicationIds.length > 20) {
      return res.status(400).json({ success: false, message: 'Maximum 20 applications can be processed at once.' });
    }
    if (!['verified', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Bulk action must be "verified" or "rejected".' });
    }
    // CGPA is now optional — examiner verifies transcript content, not numeric CGPA
    if (action === 'rejected' && !remarks?.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const applications = await Application.find({
      _id:                               { $in: applicationIds },
      currentRecipient:                  req.user._id,
      'academicVerification.isVerified': { $ne: true },
    })
      .populate('student',    'firstName lastName studentId _id')
      .populate('department', 'name code _id');

    if (applications.length === 0) {
      return res.status(404).json({ success: false, message: 'No eligible applications found.' });
    }

    const succeeded = [];
    const failed    = [];

    for (const app of applications) {
      try {
        if (action === 'verified') {
          const hodOfDept = await User.findOne({ role: 'hod', department: app.department._id });
          if (!hodOfDept) {
            failed.push({ id: app._id, applicationId: app.applicationId, reason: 'No HOD found for department.' });
            continue;
          }

          const prevRecipient = app.currentRecipient;
          const statusBefore  = app.status;

          const bCgpa         = verificationData?.cgpa != null ? parseFloat(verificationData.cgpa) : null;
          const bAttendance   = verificationData?.attendanceMet ?? null;
          const bEligible     = bCgpa != null ? (bCgpa >= 2.8 && bAttendance === true) : null;

          app.academicVerification = {
            isVerified:    true,
            cgpa:          bCgpa,
            attendanceMet: bAttendance,
            isEligible:    bEligible,
            remarks:       verificationData?.remarks || 'Bulk verified',
            verifiedBy:    req.user._id,
            verifiedAt:    new Date(),
          };
          app.status           = 'forwarded';
          app.currentRecipient = hodOfDept._id;
          app.lastUpdated      = new Date();
          await app.save();

          await ApplicationHistory.create({
            application:       app._id,
            actionBy:          req.user._id,
            action:            'verified',
            remarks:           verificationData?.remarks || 'Bulk verified',
            previousRecipient: prevRecipient,
            newRecipient:      hodOfDept._id,
            statusBefore,
            statusAfter:       'forwarded',
          });

          const hodNotif = await Notification.create({
            recipient:          hodOfDept._id,
            message:            `Transcript verified for "${app.title}" (${app.applicationId}). ${verificationData?.remarks ? `Examiner notes: ${verificationData.remarks}. ` : ''}Please give final approval.`,
            type:               'success',
            relatedApplication: app._id,
          });
          emitToUser(hodOfDept._id.toString(), 'newNotification', { notification: { ...hodNotif.toObject(), isRead: false } });
          emitToUser(hodOfDept._id.toString(), 'application_verified_returned', { applicationId: app._id, message: 'Transcript verified by examiner.' });
          Notification.countDocuments({ recipient: hodOfDept._id, isRead: false })
            .then(c => emitToUser(hodOfDept._id.toString(), 'notification_count_update', { unreadCount: c }))
            .catch(() => {});

          const studentNotif = await Notification.create({
            recipient:          app.student._id,
            message:            `Your application "${app.title}" (${app.applicationId}) has been academically verified. Awaiting final HOD approval.`,
            type:               'info',
            relatedApplication: app._id,
          });
          emitToUser(app.student._id.toString(), 'newNotification', { notification: { ...studentNotif.toObject(), isRead: false } });

          succeeded.push({ id: app._id, applicationId: app.applicationId });

        } else {
          const statusBefore = app.status;
          app.status       = 'rejected';
          app.finalRemarks = remarks.trim();
          app.lastUpdated  = new Date();
          await app.save();

          await ApplicationHistory.create({
            application:  app._id,
            actionBy:     req.user._id,
            action:       'rejected',
            remarks:      remarks.trim(),
            statusBefore,
            statusAfter:  'rejected',
          });

          const studentNotif = await Notification.create({
            recipient:          app.student._id,
            message:            `Your application "${app.title}" (${app.applicationId}) has been rejected by the Examination Office. Reason: ${remarks.trim()}`,
            type:               'error',
            relatedApplication: app._id,
          });
          emitToUser(app.student._id.toString(), 'newNotification', { notification: { ...studentNotif.toObject(), isRead: false } });
          Notification.countDocuments({ recipient: app.student._id, isRead: false })
            .then(c => emitToUser(app.student._id.toString(), 'notification_count_update', { unreadCount: c }))
            .catch(() => {});

          emitAdminActivityLog({
            event:         'application_rejected',
            message:       `Examiner ${req.user.firstName} ${req.user.lastName} rejected (bulk) "${app.title}" (${app.applicationId})`,
            actor:         `${req.user.firstName} ${req.user.lastName}`,
            actorRole:     'examination_officer',
            department:    app.department?.name || 'N/A',
            applicationId: app.applicationId,
            severity:      'warning',
          });

          succeeded.push({ id: app._id, applicationId: app.applicationId });
        }
      } catch (err) {
        failed.push({ id: app._id, applicationId: app.applicationId, reason: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${succeeded.length} application(s).${failed.length > 0 ? ` ${failed.length} failed.` : ''}`,
      data: { succeeded, failed },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Export Application as PDF ─────────────────────────────────────────────────
export const exportApplicationPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('student',          'firstName lastName email studentId')
      .populate('department',       'name code')
      .populate('currentRecipient', 'firstName lastName role');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const isOwner        = application.student._id.toString() === req.user._id.toString();
    const isRecipient    = application.currentRecipient?._id.toString() === req.user._id.toString();
    const isAdmin        = req.user.role === 'admin';
    const isDeptHOD      = req.user.role === 'hod' &&
      application.department?._id?.toString() === req.user.department?.toString();
    const isStaff        = ['staff', 'chairperson', 'vc', 'examination_officer'].includes(req.user.role);

    if (!isOwner && !isRecipient && !isAdmin && !isDeptHOD && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized to download this report.' });
    }

    const history = await ApplicationHistory.find({ application: id })
      .populate('actionBy', 'firstName lastName role')
      .sort({ timestamp: 1 });

    const doc = generateApplicationPDF(application, history);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Application_${application.applicationId}.pdf"`);
    doc.pipe(res);
  } catch (error) {
    console.error('PDF Export Error:', error);
    res.status(500).json({ success: false, message: 'Error generating PDF.' });
  }
};

// ── Admin: Get all applications ───────────────────────────────────────────────
export const getAllApplicationsAdmin = async (req, res) => {
  try {
    const { status, department, applicationType, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status)          query.status          = status;
    if (department)      query.department       = department;
    if (applicationType) query.applicationType  = applicationType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('student',          'firstName lastName studentId email')
        .populate('department',       'name code')
        .populate('currentRecipient', 'firstName lastName role staffType')
        .populate('attachments',      'originalName url mimetype size')
        .sort({ submittedDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Application.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: total,
      pages: Math.ceil(total / parseInt(limit)),
      data:  applications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get single application by ID ──────────────────────────────────────────────
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('student',          'firstName lastName email studentId')
      .populate('department',       'name code')
      .populate('currentRecipient', 'firstName lastName role staffType')
      .populate('submittedBy',      'firstName lastName role')
      .populate('attachments',      'originalName url mimetype size');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const isOwner    = application.student._id.toString() === req.user._id.toString();
    const isRecipient = application.currentRecipient?._id?.toString() === req.user._id.toString();
    const isAdmin     = req.user.role === 'admin';
    const isDeptHOD   = req.user.role === 'hod' &&
      application.department?._id?.toString() === req.user.department?.toString();
    const isStaff     = ['staff', 'chairperson', 'vc', 'examination_officer'].includes(req.user.role);

    if (!isOwner && !isRecipient && !isAdmin && !isDeptHOD && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this application.' });
    }

    const history = await ApplicationHistory.find({ application: id })
      .populate('actionBy', 'firstName lastName role')
      .sort({ timestamp: 1 });

    res.status(200).json({ success: true, data: { ...application.toObject(), history } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};