// src/services/applicationEmail.service.js
//
// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION RULES — based on your confirmed scenario table
//
// VC is notified ONLY when:
//   - An application is finally APPROVED (by HOD, staff, or VC themselves)
//   - An application is REJECTED (final decision)
//   - Student submits directly to VC
//
// VC is NOT notified on:
//   - Forwarding between staff/HOD/examiner
//   - Examiner verification (that is internal dept flow)
//
// Admin is notified on ALL actions via DB notification + real-time activity log.
//
// ACCOUNTABILITY CHAIN:
//   admin (99) → vc (4) → hod (3) → examiner/chairperson (2) → staff (1) → student (0)
// ═══════════════════════════════════════════════════════════════════════════════

import { User, Notification } from '../models/index.js';
import { sendEmail }          from './email.service.js';
import { emitToUser, emitAdminActivityLog, emitAdminApplicationUpdate } from '../socket/index.js';
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

// ── Role hierarchy ────────────────────────────────────────────────────────────
const ROLE_RANK = {
  student:             0,
  staff:               1,
  examination_officer: 2,
  chairperson:         2,
  hod:                 3,
  vc:                  4,
  admin:               99,
};

const getLabel = (user) => {
  if (!user) return 'Unknown';
  if (user.role === 'staff') {
    const map = {
      professor: 'Professor', lecturer: 'Lecturer', clerk: 'Clerk',
      lab_technician: 'Lab Technician', other: 'Staff',
    };
    return map[user.staffType] || 'Staff';
  }
  const map = {
    hod:                 'Head of Department',
    chairperson:         'Chairperson',
    examination_officer: 'Examination Officer',
    vc:                  'Vice Chancellor',
    admin:               'Administrator',
    student:             'Student',
  };
  return map[user.role] || user.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const fullName = (user) => user ? `${user.firstName} ${user.lastName}` : 'Unknown';

// ── Internal: create DB notification + emit socket ───────────────────────────
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
    // Update unread badge count non-blocking
    Notification.countDocuments({ recipient: recipientId, isRead: false })
      .then(unreadCount => {
        emitToUser(recipientId.toString(), 'notification_count_update', { unreadCount });
      })
      .catch(err => console.error(`[notify] unreadCount failed for ${recipientId}:`, err.message));
  } catch (err) {
    console.error(`[notify] Failed for ${recipientId}:`, err.message);
  }
};

// ── DB lookups ────────────────────────────────────────────────────────────────
const getHOD   = (deptId) => deptId ? User.findOne({ role: 'hod', department: deptId }) : null;
const getVC    = ()       => User.findOne({ role: 'vc' });
const getAdmin = ()       => User.findOne({ role: 'admin' });

// ═══════════════════════════════════════════════════════════════════════════════
// sendApplicationSubmissionEmails
//
// Scenario table implemented:
//   Submit → own dept staff  : student, staff, HOD(own), VC, admin
//   Submit → own HOD         : student, HOD, VC, admin
//   Submit → other dept HOD  : student, HOD(EE), NO HOD(CS), VC, admin
//   Submit → Examiner        : student, examiner, NO HOD(CS), VC, admin
//   Submit → VC              : student, VC, admin
// ═══════════════════════════════════════════════════════════════════════════════
export const sendApplicationSubmissionEmails = async (studentId, recipientId, application) => {
  try {
    console.log(`\n[SUBMISSION] App: ${application.applicationId} | Student: ${studentId} → Recipient: ${recipientId}`);

    const [student, recipient, admin] = await Promise.all([
      User.findById(studentId).populate('department'),
      User.findById(recipientId).populate('department'),
      getAdmin(),
    ]);

    if (!student || !recipient) {
      console.error('  [SUBMISSION] Missing student or recipient — skipping.');
      return;
    }

    const studentDept        = student.department;
    const studentDeptId      = studentDept?._id?.toString();
    const recipientDeptId    = recipient.department?._id?.toString();
    const isSameDept         = studentDeptId && recipientDeptId && studentDeptId === recipientDeptId;
    const recipientHasNoDept = !recipient.department;
    const recipientRank      = ROLE_RANK[recipient.role] ?? 0;
    const hodRank            = ROLE_RANK['hod'];
    recipient.label          = getLabel(recipient);
    const appData            = { student, application, recipient, department: studentDept };

    // ── 1. Direct recipient ───────────────────────────────────────────────
    const re = recipientTemplate(appData);
    await sendEmail(recipient.email, re.subject, re.html);
    await notify({
      recipientId:   recipient._id,
      message:       `New application "${application.title}" (${application.applicationId}) submitted by ${fullName(student)}${student.studentId ? ` (${student.studentId})` : ''}.`,
      type:          application.isUrgent ? 'warning' : 'info',
      applicationId: application._id,
    });

    // ── 2. Student confirmation ───────────────────────────────────────────
    const sc = studentConfirmationTemplate(appData);
    await sendEmail(student.email, sc.subject, sc.html);
    await notify({
      recipientId:   student._id,
      message:       `Your application "${application.title}" (${application.applicationId}) was submitted to ${recipient.label} ${fullName(recipient)}. Status: Pending.`,
      type:          'success',
      applicationId: application._id,
    });

    // ── 3. HOD notification (accountability) ─────────────────────────────
    // Own dept staff received app → notify own dept HOD
    if (!recipientHasNoDept && recipient.role !== 'vc' && isSameDept && recipientRank < hodRank) {
      const hod = await getHOD(studentDeptId);
      if (hod && hod._id.toString() !== recipient._id.toString()) {
        const he = hodNotificationTemplate(appData);
        await sendEmail(hod.email, he.subject, he.html);
        await notify({
          recipientId:   hod._id,
          message:       `[Accountability] ${recipient.label} ${fullName(recipient)} received an application from ${fullName(student)} in your department. Application: "${application.title}" (${application.applicationId}).`,
          type:          'info',
          applicationId: application._id,
        });
      }
    }
    // Cross-dept staff received app → notify recipient's dept HOD
    else if (!recipientHasNoDept && recipient.role !== 'vc' && !isSameDept && recipientRank < hodRank) {
      const recipientHod = await getHOD(recipientDeptId);
      if (recipientHod && recipientHod._id.toString() !== recipient._id.toString()) {
        const he = hodNotificationTemplate({ ...appData, department: recipient.department });
        await sendEmail(recipientHod.email, he.subject, he.html);
        await notify({
          recipientId:   recipientHod._id,
          message:       `[Cross-Dept] ${recipient.label} ${fullName(recipient)} in your department received an application from ${fullName(student)} (${studentDept?.name || 'N/A'}). Application: "${application.title}" (${application.applicationId}).`,
          type:          'info',
          applicationId: application._id,
        });
      }
    }

    // ── 4. VC — only on direct submission to VC or to VC's subordinates ──
    // Per scenario table: VC is notified on all submissions for accountability
    // (they see the initial submission; final approval is what matters most)
    if (recipient.role !== 'vc' && recipient.role !== 'admin') {
      const vc = await getVC();
      if (vc && vc._id.toString() !== recipient._id.toString()) {
        const ve = vcNotificationTemplate({ ...appData, hod: recipient });
        await sendEmail(vc.email, ve.subject, ve.html);
        await notify({
          recipientId:   vc._id,
          message:       `[Accountability] ${recipient.label} ${fullName(recipient)} (${recipientHasNoDept ? 'University-Wide' : (recipient.department?.name || 'N/A')}) received an application from ${fullName(student)} (${studentDept?.name || 'N/A'}). Application: "${application.title}" (${application.applicationId}).`,
          type:          application.isUrgent ? 'warning' : 'info',
          applicationId: application._id,
        });
      }
    }

    // ── 5. Admin always ───────────────────────────────────────────────────
    if (admin && admin._id.toString() !== recipient._id.toString()) {
      const ae = adminNotificationTemplate(appData);
      await sendEmail(admin.email, ae.subject, ae.html);
      await notify({
        recipientId:   admin._id,
        message:       `[New Application] ${fullName(student)} submitted "${application.title}" (${application.applicationId}) to ${recipient.label} ${fullName(recipient)} — ${studentDept?.name || 'N/A'}.`,
        type:          'info',
        applicationId: application._id,
      });
    }

    // ── 6. Admin real-time activity stream ────────────────────────────────
    emitAdminActivityLog({
      event:         'application_submitted',
      message:       `${fullName(student)} submitted "${application.title}" (${application.applicationId}) to ${recipient.label} ${fullName(recipient)}`,
      actor:         fullName(student),
      actorRole:     'student',
      targetRole:    recipient.role,
      department:    studentDept?.name || 'N/A',
      applicationId: application.applicationId,
      severity:      application.isUrgent ? 'warning' : 'info',
    });

    // ── 7. Admin dashboard table update ──────────────────────────────────
    emitAdminApplicationUpdate({
      applicationId: application._id.toString(),
      appCode:       application.applicationId,
      action:        'submitted',
      status:        'pending',
      department:    studentDept?.name || 'N/A',
      student:       { firstName: student.firstName, lastName: student.lastName, studentId: student.studentId },
      actor:         { firstName: student.firstName, lastName: student.lastName, role: 'student' },
    });

    console.log(`[SUBMISSION COMPLETE]\n`);
  } catch (error) {
    console.error('[Notify] sendApplicationSubmissionEmails error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// sendApplicationStatusUpdateEmail
//
// VC notification rules (from your confirmed scenario table):
//
//   approved (any actor)   → Student, VC, Admin          ← VC ALWAYS on approval
//   rejected (any actor)   → Student, VC, Admin          ← VC ALWAYS on rejection
//   forwarded (staff/HOD)  → Student, new recipient, relevant HOD, Admin  ← NO VC
//   verified (examiner)    → Student, HOD (auto-return)  ← NO VC (internal dept flow)
//
// Admin notification rules:
//   ALL actions → Admin DB notification + real-time activity log stream
//
// HOD notification rules (per scenario table):
//   Staff approve/reject   → HOD of application's dept
//   Staff forward→same HOD → HOD is new recipient (already notified)
//   Staff forward→other    → HOD of staff's own dept (app left dept)
//   Staff forward→examiner → HOD of staff's dept
//   Staff forward→VC       → HOD of staff's dept
//   HOD acts               → No separate HOD notify (HOD IS actor)
//   Examiner verified      → HOD auto-notified in controller directly (not here)
//   Examiner rejected      → HOD of student's dept
// ═══════════════════════════════════════════════════════════════════════════════
export const sendApplicationStatusUpdateEmail = async (
  applicationId,
  actionByUserId,
  action,
  remarks,
  forwardedToId = null
) => {
  try {
    console.log(`\n[UPDATE] Action: ${action} | By: ${actionByUserId} | App: ${applicationId}`);

    const { Application } = await import('../models/index.js');

    const [application, actionBy, admin] = await Promise.all([
      Application.findById(applicationId).populate('student').populate('department'),
      User.findById(actionByUserId).populate('department'),
      getAdmin(),
    ]);

    if (!application || !actionBy) return;

    const student        = application.student;
    const appDept        = application.department;
    const appDeptId      = appDept?._id?.toString();
    const actionByLabel  = getLabel(actionBy);
    const actionByDeptId = actionBy.department?._id?.toString();
    const hodRank        = ROLE_RANK['hod'];

    const isFinalDecision = action === 'approved' || action === 'rejected';

    const notifType =
      action === 'approved' || action === 'verified' ? 'success' :
      action === 'rejected'                          ? 'warning' : 'info';

    const actionVerb =
      action === 'verified'  ? 'academically verified' :
      action === 'approved'  ? 'approved' :
      action === 'rejected'  ? 'rejected' :
      action === 'forwarded' ? 'forwarded' : action;

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 — Always notify student
    // ═══════════════════════════════════════════════════════════════════════
    const emailTpl = applicationStatusUpdateTemplate({ student, application, action, remarks, actionBy });
    await sendEmail(student.email, emailTpl.subject, emailTpl.html);

    const studentMsg =
      action === 'forwarded'
        ? `Your application "${application.title}" (${application.applicationId}) was forwarded by ${actionByLabel} ${fullName(actionBy)} for further review.`
        : action === 'verified'
        ? `Your application "${application.title}" (${application.applicationId}) has been academically verified. Awaiting final HOD approval.`
        : `${action === 'approved' ? 'Approved' : 'Rejected'}: Your application "${application.title}" (${application.applicationId}) was ${actionVerb} by ${actionByLabel} ${fullName(actionBy)}${remarks ? `. Remarks: "${remarks}"` : '.'}`;

    await notify({
      recipientId:   student._id,
      message:       studentMsg,
      type:          notifType,
      applicationId: application._id,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 — If forwarded: notify new recipient
    // ═══════════════════════════════════════════════════════════════════════
    let forwardedTo = null;
    if (action === 'forwarded' && forwardedToId) {
      forwardedTo = await User.findById(forwardedToId).populate('department');
      if (forwardedTo) {
        const fwdEmail = forwardedToRecipientTemplate({ student, application, actionBy, recipient: forwardedTo });
        await sendEmail(forwardedTo.email, fwdEmail.subject, fwdEmail.html);
        await notify({
          recipientId:   forwardedTo._id,
          message:       `Application "${application.title}" (${application.applicationId}) from ${fullName(student)} was forwarded to you by ${actionByLabel} ${fullName(actionBy)}.`,
          type:          'info',
          applicationId: application._id,
        });
      }
    }

    // When verified action, forwardedToId = HOD id (passed from controller)
    // The controller already notified HOD directly, but we still send email here
    if (action === 'verified' && forwardedToId) {
      forwardedTo = forwardedTo || await User.findById(forwardedToId).populate('department');
      if (forwardedTo) {
        const fwdEmail = forwardedToRecipientTemplate({ student, application, actionBy, recipient: forwardedTo });
        await sendEmail(forwardedTo.email, fwdEmail.subject, fwdEmail.html);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3 — HOD notification (accountability on non-approved actions)
    // ═══════════════════════════════════════════════════════════════════════
    let hodToNotify  = null;
    let hodNotifyMsg = '';

    if (actionBy.role === 'staff' || actionBy.role === 'chairperson') {
      if (action !== 'forwarded') {
        // Staff approved/rejected → HOD of application's dept
        hodToNotify  = await getHOD(appDeptId);
        hodNotifyMsg = `[Accountability] ${actionByLabel} ${fullName(actionBy)} ${actionVerb} application "${application.title}" (${application.applicationId}) from ${fullName(student)} in your department.${remarks ? ` Remarks: "${remarks}"` : ''}`;
      } else if (forwardedTo) {
        const fwdDeptId     = forwardedTo.department?._id?.toString();
        const isSameDeptFwd = actionByDeptId && fwdDeptId && actionByDeptId === fwdDeptId;
        if (!isSameDeptFwd || ['examination_officer', 'vc'].includes(forwardedTo.role)) {
          hodToNotify  = await getHOD(actionByDeptId || appDeptId);
          const dest   = forwardedTo.role === 'vc'
            ? 'Vice Chancellor'
            : forwardedTo.role === 'examination_officer'
            ? 'Examination Officer'
            : `HOD ${fullName(forwardedTo)} (${forwardedTo.department?.name || 'N/A'})`;
          hodNotifyMsg = `[Accountability] ${actionByLabel} ${fullName(actionBy)} forwarded "${application.title}" (${application.applicationId}) from ${fullName(student)} to ${dest}.`;
        }
      }
    } else if (actionBy.role === 'examination_officer' && action === 'rejected') {
      // Examiner rejected → notify student's HOD
      // (verified case: controller already notified HOD directly)
      hodToNotify  = await getHOD(appDeptId);
      hodNotifyMsg = `[Accountability] Examination Officer ${fullName(actionBy)} rejected application "${application.title}" (${application.applicationId}) from ${fullName(student)} in your department.${remarks ? ` Remarks: "${remarks}"` : ''}`;
    }

    if (hodToNotify && hodToNotify._id.toString() !== actionByUserId.toString()) {
      const hodEmail = accountabilityNotificationTemplate({
        recipientRole: 'hod',
        recipientName: fullName(hodToNotify),
        student, application, actionBy, action, department: appDept, remarks,
      });
      await sendEmail(hodToNotify.email, hodEmail.subject, hodEmail.html);
      await notify({
        recipientId:   hodToNotify._id,
        message:       hodNotifyMsg,
        type:          notifType,
        applicationId: application._id,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4 — VC notification
    // VC is notified ONLY on final decisions (approved / rejected).
    // NOT on: forwarding, verification, doc requests.
    // ═══════════════════════════════════════════════════════════════════════
    if (isFinalDecision && actionBy.role !== 'vc' && actionBy.role !== 'admin') {
      const vc = await getVC();
      if (vc) {
        const vcMsg   = `[Accountability] ${actionByLabel} ${fullName(actionBy)} (${appDept?.name || 'N/A'}) ${actionVerb} application "${application.title}" (${application.applicationId}) from ${fullName(student)}.${remarks ? ` Remarks: "${remarks}"` : ''}`;
        const vcEmail = accountabilityNotificationTemplate({
          recipientRole: 'vc',
          recipientName: fullName(vc),
          student, application, actionBy, action, department: appDept, remarks,
        });
        await sendEmail(vc.email, vcEmail.subject, vcEmail.html);
        await notify({
          recipientId:   vc._id,
          message:       vcMsg,
          type:          notifType,
          applicationId: application._id,
        });
      }
    }

    // VC acts → only admin notified (no self-notify)
    if (actionBy.role === 'vc' && isFinalDecision) {
      // Just falls through to admin step below
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5 — Admin: DB notification on ALL actions + real-time activity log
    // ═══════════════════════════════════════════════════════════════════════
    if (admin && admin._id.toString() !== actionByUserId.toString()) {
      let adminMsg = '';
      if (action === 'forwarded' && forwardedTo) {
        adminMsg = `[Update] "${application.title}" (${application.applicationId}) forwarded by ${actionByLabel} ${fullName(actionBy)} to ${getLabel(forwardedTo)} ${fullName(forwardedTo)}.`;
      } else if (action === 'verified') {
        adminMsg = `[Update] "${application.title}" (${application.applicationId}) academically verified by Examiner ${fullName(actionBy)} — returned to HOD for final approval.`;
      } else {
        adminMsg = `[Update] "${application.title}" (${application.applicationId}) was ${actionVerb} by ${actionByLabel} ${fullName(actionBy)}${remarks ? ` — "${remarks}"` : ''}.`;
      }
      await notify({
        recipientId:   admin._id,
        message:       adminMsg,
        type:          notifType,
        applicationId: application._id,
      });
    }

    // Real-time admin activity stream — fires on every action
    let logMessage = '';
    if (action === 'forwarded' && forwardedTo) {
      logMessage = `${actionByLabel} ${fullName(actionBy)} forwarded "${application.title}" (${application.applicationId}) from ${fullName(student)} to ${getLabel(forwardedTo)} ${fullName(forwardedTo)}`;
    } else if (action === 'verified') {
      logMessage = `Examiner ${fullName(actionBy)} verified "${application.title}" (${application.applicationId}) from ${fullName(student)} — returned to HOD for final approval`;
    } else {
      logMessage = `${actionByLabel} ${fullName(actionBy)} ${actionVerb} "${application.title}" (${application.applicationId}) from ${fullName(student)}${remarks ? ` — "${remarks}"` : ''}`;
    }

    emitAdminActivityLog({
      event:         `application_${action}`,
      message:       logMessage,
      actor:         fullName(actionBy),
      actorRole:     actionBy.role,
      department:    appDept?.name || 'N/A',
      applicationId: application.applicationId,
      severity:      notifType,
    });

    // Admin dashboard table row update
    const statusAfterAction = { approved: 'approved', rejected: 'rejected', forwarded: 'forwarded', verified: 'forwarded' }[action] || action;
    emitAdminApplicationUpdate({
      applicationId: application._id.toString(),
      appCode:       application.applicationId,
      action,
      status:        statusAfterAction,
      department:    appDept?.name || 'N/A',
      student:       { firstName: student.firstName, lastName: student.lastName, studentId: student.studentId },
      actor:         { firstName: actionBy.firstName, lastName: actionBy.lastName, role: actionBy.role },
    });

    console.log(`[UPDATE COMPLETE]\n`);
  } catch (error) {
    console.error('[Notify] sendApplicationStatusUpdateEmail error:', error.message);
  }
};