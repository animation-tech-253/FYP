// src/services/applicationEmail.service.js
// Handles ALL notifications for application events:
//   ✓ Emails (via nodemailer)
//   ✓ In-app DB Notifications (via Notification model)
//   ✓ Real-time Socket events (via socket/index.js)
//
// ACCOUNTABILITY CHAIN (submission):
//   Student submits → staff      → staff + HOD + VC + Admin notified
//   Student submits → HOD        → HOD + VC + Admin notified
//   Student submits → exam_off.  → exam_officer + HOD + VC + Admin notified
//   Student submits → VC         → VC + Admin notified
//
// ACCOUNTABILITY CHAIN (processing):
//   Staff approves/rejects       → Student + Admin notified
//   Staff forwards to HOD        → HOD + VC + Admin + Student notified
//   HOD approves/rejects         → Student + VC + Admin notified
//   HOD forwards to exam_off/VC  → target + VC (if not target) + Admin + Student notified
//   Exam officer verifies/reject → Student + HOD + VC + Admin notified
//   VC approves/rejects          → Student + Admin notified

import { User, Notification } from '../models/index.js';
import { sendEmail } from './email.service.js';
import { emitToUser } from '../socket/index.js';
import {
  recipientTemplate,
  hodNotificationTemplate,
  vcNotificationTemplate,
  adminNotificationTemplate,
  studentConfirmationTemplate,
  applicationStatusUpdateTemplate,
  forwardedToRecipientTemplate,
  accountabilityNotificationTemplate,
} from './emailTemplates.service.js';

// ── Role hierarchy ─────────────────────────────────────────────────────────────
const ROLE_RANK = {
  student:             0,
  staff:               1,
  examination_officer: 2,
  chairperson:         2,
  hod:                 3,
  vc:                  4,
  admin:               99,
};

const getRecipientLabel = (user) => {
  if (!user) return 'Unknown';
  if (user.role === 'staff') {
    const typeMap = {
      professor:      'Professor',
      lecturer:       'Lecturer',
      clerk:          'Clerk',
      lab_technician: 'Lab Technician',
      other:          'Staff',
    };
    return typeMap[user.staffType] || 'Staff';
  }
  const roleMap = {
    hod:                 'Head of Department',
    chairperson:         'Chairperson',
    examination_officer: 'Examination Officer',
    vc:                  'Vice Chancellor',
    admin:               'Administrator',
    student:             'Student',
  };
  return roleMap[user.role] || user.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ── Internal helper: create DB notification + emit socket event ───────────────
const notify = async ({ recipientId, message, type = 'info', applicationId }) => {
  if (!recipientId) return;
  try {
    const notification = await Notification.create({
      recipient:          recipientId,
      message,
      type,
      relatedApplication: applicationId,
    });

    emitToUser(recipientId.toString(), 'newNotification', {
      notification: {
        _id:                notification._id,
        message:            notification.message,
        type:               notification.type,
        isRead:             false,
        relatedApplication: applicationId,
        createdAt:          notification.createdAt,
      },
    });

    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false,
    });
    emitToUser(recipientId.toString(), 'notification_count_update', { unreadCount });

  } catch (err) {
    console.error('[Notify] Failed:', err.message);
  }
};

// ── Helper: resolve HOD for a department ──────────────────────────────────────
const getHodForDepartment = async (departmentId) => {
  if (!departmentId) return null;
  return User.findOne({ role: 'hod', department: departmentId });
};

// ── Helper: resolve VC ────────────────────────────────────────────────────────
const getVC = async () => User.findOne({ role: 'vc' });

// ── Helper: resolve Admin ─────────────────────────────────────────────────────
const getAdmin = async () => User.findOne({ role: 'admin' });

// ─────────────────────────────────────────────────────────────────────────────
// sendApplicationSubmissionEmails
// Called when a student submits a new application.
//
// FULL ACCOUNTABILITY CHAIN:
//  1. Direct recipient → Email + Socket
//  2. Student          → Confirmation Email + Socket
//  3. HOD              → Email + Socket  (if recipient rank < HOD, i.e. staff/exam_officer)
//  4. VC               → Email + Socket  (if recipient IS hod OR rank >= hod)
//  5. Admin            → Email + Socket  (always)
// ─────────────────────────────────────────────────────────────────────────────
export const sendApplicationSubmissionEmails = async (studentId, recipientId, application) => {
  try {
    const [student, recipient, admin] = await Promise.all([
      User.findById(studentId).populate('department'),
      User.findById(recipientId).populate('department'),
      getAdmin(),
    ]);

    if (!student || !recipient) {
      console.error('[Notify] Missing student or recipient — skipping.');
      return;
    }

    const department    = student.department;
    const recipientRank = ROLE_RANK[recipient.role] ?? 0;
    const hodRank       = ROLE_RANK['hod'];
    const vcRank        = ROLE_RANK['vc'];

    recipient.label = getRecipientLabel(recipient);

    const appData = { student, application, recipient, department };

    // ── 1. Direct recipient ───────────────────────────────────────────────
    const re = recipientTemplate(appData);
    await sendEmail(recipient.email, re.subject, re.html);
    await notify({
      recipientId:   recipient._id,
      message:       `📨 New application "${application.title}" submitted by ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'}).`,
      type:          application.isUrgent ? 'warning' : 'info',
      applicationId: application._id,
    });

    // ── 2. Student confirmation ───────────────────────────────────────────
    const sc = studentConfirmationTemplate(appData);
    await sendEmail(student.email, sc.subject, sc.html);
    await notify({
      recipientId:   student._id,
      message:       `✅ Your application "${application.title}" (${application.applicationId}) was submitted successfully to ${recipient.label} ${recipient.firstName} ${recipient.lastName}. Status: Pending.`,
      type:          'success',
      applicationId: application._id,
    });

    // ── 3. Accountability: notify HOD if recipient is below HOD rank ──────
    //    (covers: staff, examination_officer, chairperson sending to themselves)
    if (recipientRank < hodRank && recipient.role !== 'hod') {
      const hod = await getHodForDepartment(student.department?._id);
      if (hod && hod._id.toString() !== recipient._id.toString()) {
        const he = hodNotificationTemplate(appData);
        await sendEmail(hod.email, he.subject, he.html);
        await notify({
          recipientId:   hod._id,
          message:       `📋 [Accountability] ${recipient.label} ${recipient.firstName} ${recipient.lastName} received a new application from ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'}) in your department (${department?.name || 'N/A'}). Application: "${application.title}" (${application.applicationId}).`,
          type:          'info',
          applicationId: application._id,
        });
      }
    }

    // ── 4. Accountability: notify VC ──────────────────────────────────────
    //    Always notify VC when recipient is HOD or higher (but not VC/admin themselves)
    if (recipientRank >= hodRank && recipient.role !== 'vc' && recipient.role !== 'admin') {
      const vc = await getVC();
      if (vc && vc._id.toString() !== recipient._id.toString()) {
        const ve = vcNotificationTemplate({ ...appData, hod: recipient });
        await sendEmail(vc.email, ve.subject, ve.html);
        await notify({
          recipientId:   vc._id,
          message:       `📋 [Accountability] ${recipient.label} ${recipient.firstName} ${recipient.lastName} (${department?.name || 'N/A'}) received an application from ${student.firstName} ${student.lastName}. Application: "${application.title}" (${application.applicationId}).`,
          type:          'info',
          applicationId: application._id,
        });
      }
    }

    // ── 5. Admin (always, unless admin is the recipient) ──────────────────
    if (admin && admin._id.toString() !== recipient._id.toString()) {
      const ae = adminNotificationTemplate(appData);
      await sendEmail(admin.email, ae.subject, ae.html);
      await notify({
        recipientId:   admin._id,
        message:       `📋 [New Application] ${student.firstName} ${student.lastName} submitted "${application.title}" (${application.applicationId}) to ${recipient.label} ${recipient.firstName} ${recipient.lastName} — ${department?.name || 'N/A'}.`,
        type:          'info',
        applicationId: application._id,
      });
    }

  } catch (error) {
    console.error('[Notify] sendApplicationSubmissionEmails error:', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// sendApplicationStatusUpdateEmail
// Called when anyone processes an application (approve / reject / forward / verify).
//
// FULL ACCOUNTABILITY CHAIN:
//  ✓ Student always gets email + DB notification + socket
//  ✓ Forwarded recipient gets DB notification + socket (no email)
//  ✓ Admin always gets DB notification + socket
//  ✓ HOD gets notified when:
//      - A staff member (below HOD) approves/rejects/forwards
//      - An exam officer verifies/rejects
//  ✓ VC gets notified when:
//      - HOD takes any action (approve/reject/forward)
//      - Application is forwarded to HOD (HOD becomes accountable)
//  ✓ HOD gets notified when application is forwarded TO them (they are now accountable)
// ─────────────────────────────────────────────────────────────────────────────
export const sendApplicationStatusUpdateEmail = async (
  applicationId,
  actionByUserId,
  action,
  remarks,
  forwardedToId = null
) => {
  try {
    const { Application } = await import('../models/index.js');

    const [application, actionBy, admin] = await Promise.all([
      Application.findById(applicationId).populate('student').populate('department'),
      User.findById(actionByUserId),
      getAdmin(),
    ]);

    if (!application || !actionBy) return;

    const student       = application.student;
    const department    = application.department;
    const actionByLabel = getRecipientLabel(actionBy);
    const actionByRank  = ROLE_RANK[actionBy.role] ?? 0;
    const hodRank       = ROLE_RANK['hod'];

    const notifType =
      action === 'approved' || action === 'verified' ? 'success' :
      action === 'rejected'                          ? 'warning' : 'info';

    // ── Email + DB notification + socket to STUDENT ───────────────────────
    const template = applicationStatusUpdateTemplate({ student, application, action, remarks, actionBy });
    await sendEmail(student.email, template.subject, template.html);

    const studentMsg =
      action === 'forwarded'
        ? `📤 Your application "${application.title}" (${application.applicationId}) has been forwarded by ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName} for further review.`
        : action === 'verified'
        ? `✅ Your application "${application.title}" (${application.applicationId}) has been academically verified by the Examination Office.`
        : `${action === 'approved' ? '✅' : '❌'} Your application "${application.title}" (${application.applicationId}) was ${action} by ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName}${remarks ? `: "${remarks}"` : '.'}`;

    await notify({
      recipientId:   student._id,
      message:       studentMsg,
      type:          notifType,
      applicationId: application._id,
    });

    // ── DB notification + socket to FORWARDED RECIPIENT ───────────────────
    // Also triggers escalation notifications (HOD/VC accountability)
    if (action === 'forwarded' && forwardedToId) {
      const forwardedTo = await User.findById(forwardedToId);
      const forwardedToLabel = getRecipientLabel(forwardedTo);
      const forwardedToRank  = ROLE_RANK[forwardedTo?.role] ?? 0;

      // Notify the person it was forwarded to
      await notify({
        recipientId:   forwardedToId,
        message:       `📨 Application "${application.title}" (${application.applicationId}) from student ${student.firstName} ${student.lastName} has been forwarded to you by ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName}.`,
        type:          'info',
        applicationId: application._id,
      });

      // If forwarded TO HOD → notify VC (HOD is now accountable)
      if (forwardedTo?.role === 'hod') {
        const vc = await getVC();
        if (vc && vc._id.toString() !== forwardedToId.toString()) {
          await notify({
            recipientId:   vc._id,
            message:       `📋 [Accountability] Application "${application.title}" (${application.applicationId}) of student ${student.firstName} ${student.lastName} has been forwarded by ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName} to HOD ${forwardedTo.firstName} ${forwardedTo.lastName} (${department?.name || 'N/A'}).`,
            type:          'info',
            applicationId: application._id,
          });
        }
      }

      // If forwarded TO examination officer → notify HOD (if not the forwarder) + VC
      if (forwardedTo?.role === 'examination_officer') {
        const hod = await getHodForDepartment(department?._id);
        if (hod && hod._id.toString() !== actionByUserId.toString()) {
          await notify({
            recipientId:   hod._id,
            message:       `📋 [Accountability] Application "${application.title}" (${application.applicationId}) from ${student.firstName} ${student.lastName} has been forwarded by ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName} to the Examination Officer for academic verification.`,
            type:          'info',
            applicationId: application._id,
          });
        }
        const vc = await getVC();
        if (vc) {
          await notify({
            recipientId:   vc._id,
            message:       `📋 [Accountability] Application "${application.title}" (${application.applicationId}) from ${student.firstName} ${student.lastName} (${department?.name || 'N/A'}) has been forwarded to Examination Office by ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName}.`,
            type:          'info',
            applicationId: application._id,
          });
        }
      }

      // If forwarded TO VC → just notify VC (already gets it above as recipient)
      // No extra notification needed as they're the forwardedTo target
    }

    // ── HOD accountability: notify HOD when staff (rank < hod) acts ───────
    if (actionByRank < hodRank && action !== 'forwarded') {
      // Staff approved/rejected — HOD should know
      const hod = await getHodForDepartment(department?._id);
      if (hod && hod._id.toString() !== actionByUserId.toString()) {
        const actionVerb = action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : action;
        await notify({
          recipientId:   hod._id,
          message:       `📋 [Accountability] ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName} has ${actionVerb} application "${application.title}" (${application.applicationId}) from student ${student.firstName} ${student.lastName} in your department.${remarks ? ` Remarks: "${remarks}"` : ''}`,
          type:          notifType,
          applicationId: application._id,
        });
      }
    }

    // ── VC accountability: notify VC when HOD acts ────────────────────────
    if (actionBy.role === 'hod' && action !== 'forwarded') {
      const vc = await getVC();
      if (vc) {
        const actionVerb = action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : action;
        await notify({
          recipientId:   vc._id,
          message:       `📋 [Accountability] HOD ${actionBy.firstName} ${actionBy.lastName} (${department?.name || 'N/A'}) has ${actionVerb} application "${application.title}" (${application.applicationId}) from student ${student.firstName} ${student.lastName}.${remarks ? ` Remarks: "${remarks}"` : ''}`,
          type:          notifType,
          applicationId: application._id,
        });
      }
    }

    // ── HOD + VC accountability: notify when exam officer acts ────────────
    if (actionBy.role === 'examination_officer') {
      const [hod, vc] = await Promise.all([
        getHodForDepartment(department?._id),
        getVC(),
      ]);
      const actionVerb = action === 'verified' ? 'academically verified' : action === 'rejected' ? 'rejected' : action;

      if (hod && hod._id.toString() !== actionByUserId.toString()) {
        await notify({
          recipientId:   hod._id,
          message:       `📋 [Accountability] Examination Officer ${actionBy.firstName} ${actionBy.lastName} has ${actionVerb} application "${application.title}" (${application.applicationId}) from student ${student.firstName} ${student.lastName} in your department.${remarks ? ` Remarks: "${remarks}"` : ''}`,
          type:          notifType,
          applicationId: application._id,
        });
      }

      if (vc) {
        await notify({
          recipientId:   vc._id,
          message:       `📋 [Accountability] Examination Officer ${actionBy.firstName} ${actionBy.lastName} has ${actionVerb} application "${application.title}" (${application.applicationId}) from ${student.firstName} ${student.lastName} (${department?.name || 'N/A'}).${remarks ? ` Remarks: "${remarks}"` : ''}`,
          type:          notifType,
          applicationId: application._id,
        });
      }
    }

    // ── Admin always (unless admin took the action) ────────────────────────
    if (admin && admin._id.toString() !== actionByUserId.toString()) {
      const actionVerb = action === 'verified' ? 'verified' : action;
      await notify({
        recipientId:   admin._id,
        message:       `📋 [Update] Application "${application.title}" (${application.applicationId}) was ${actionVerb} by ${actionByLabel} ${actionBy.firstName} ${actionBy.lastName}${remarks ? ` — "${remarks}"` : ''}.`,
        type:          notifType,
        applicationId: application._id,
      });
    }

  } catch (error) {
    console.error('[Notify] sendApplicationStatusUpdateEmail error:', error.message);
  }
};