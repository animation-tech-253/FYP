// src/services/emailTemplates.service.js
// All HTML email templates for SUATS notifications

const baseTemplate = (title, bodyContent) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body  { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { background: #fff; border-radius: 8px; max-width: 600px; margin: 0 auto; padding: 30px; border-top: 4px solid #4f46e5; }
    h2   { color: #4f46e5; margin-top: 0; }
    p    { color: #333; line-height: 1.6; }
    .highlight { background: #f0f4ff; border-left: 3px solid #4f46e5; padding: 10px 15px; border-radius: 4px; margin: 15px 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
    .badge-info    { background: #e0e7ff; color: #4f46e5; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #d97706; }
    .badge-danger  { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 30px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>📋 SUATS — ${title}</h2>
    ${bodyContent}
    <div class="footer">
      This is an automated message from the Smart University Application &amp; Tracking System (SUATS).<br/>
      Please do not reply to this email.
    </div>
  </div>
</body>
</html>
`;

// ── 0. Student welcome email (sent on registration) ──────────────────────────
export const welcomeStudentTemplate = ({ student }) => ({
  subject: `Welcome to SUATS — Your Student ID is ${student.studentId}`,
  html: baseTemplate('Welcome to SUATS', `
    <p>Dear <strong>${student.firstName} ${student.lastName}</strong>,</p>
    <p>Welcome aboard! Your student account has been successfully created on the
    <strong>Smart University Application &amp; Tracking System (SUATS)</strong>.</p>

    <div class="highlight">
      <p><strong>Your Student ID:</strong> <span class="badge badge-info">${student.studentId}</span></p>
      <p><strong>Registered Email:</strong> ${student.email}</p>
      ${student.department ? `<p><strong>Department:</strong> ${student.department}</p>` : ''}
      ${student.contactNumber ? `<p><strong>Contact Number:</strong> ${student.contactNumber}</p>` : ''}
    </div>

    <p><strong>What is SUATS?</strong><br/>
    SUATS is a digital platform that lets you submit and track all your university
    applications in one place — from academic requests to administrative approvals.
    No more paper forms or in-person queues.</p>

    <p><strong>What you can do:</strong></p>
    <ul style="color:#333;line-height:1.8;padding-left:18px;">
      <li>Submit applications (fee waivers, course changes, degree certificates, and more)</li>
      <li>Track real-time status as your application moves through departments</li>
      <li>Receive instant email and in-app notifications at every step</li>
      <li>Download approved application PDFs for your records</li>
    </ul>

    <p>Log in to the portal anytime to get started. Keep your Student ID
    <strong>${student.studentId}</strong> handy — you'll need it for official correspondence.</p>

    <p style="margin-top:20px;">If you did not create this account, please contact your university administrator immediately.</p>
  `),
});

// ── 1. Direct recipient ───────────────────────────────────────────────────────
export const recipientTemplate = ({ student, application, recipient }) => ({
  subject: `New Application Received — ${application.title}`,
  html: baseTemplate('New Application Received', `
    <p>Dear <strong>${recipient.firstName} ${recipient.lastName}</strong>,</p>
    <p>A new application has been submitted to you.</p>
    <div class="highlight">
      <p><strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'})</p>
      <p><strong>Student Department:</strong> ${student.department?.name || 'N/A'}</p>
      <p><strong>Application:</strong> ${application.title}</p>
      <p><strong>Type:</strong> ${application.applicationType.replace(/_/g, ' ').toUpperCase()}</p>
      <p><strong>Application ID:</strong> ${application.applicationId}</p>
      ${application.isUrgent ? '<p><span class="badge badge-warning">⚠ URGENT</span></p>' : ''}
    </div>
    <p>Please log in to the SUATS portal to review and action this application.</p>
  `),
});

// ── 2. HOD — staff below them received an application ────────────────────────
export const hodNotificationTemplate = ({ student, application, recipient, department }) => ({
  subject: `Application Activity in Your Department — ${department?.name || 'Your Department'}`,
  html: baseTemplate('Department Application Activity', `
    <p>Dear <strong>HOD</strong>,</p>
    <p>A staff member in your department has received a new student application.</p>
    <div class="highlight">
      <p><strong>Staff Member:</strong> ${recipient.firstName} ${recipient.lastName}</p>
      <p><strong>Staff Role:</strong> <span class="badge badge-info">${recipient.label || recipient.role.replace(/_/g, ' ').toUpperCase()}</span></p>
      <p><strong>Department:</strong> ${department?.name || 'N/A'}</p>
      <p><strong>From Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'})</p>
      <p><strong>Application:</strong> ${application.title} &nbsp;|&nbsp; ID: ${application.applicationId}</p>
    </div>
    <p>No action required unless this application is escalated to you.</p>
  `),
});

// ── 3. VC — HOD received an application ──────────────────────────────────────
export const vcNotificationTemplate = ({ student, application, hod, department }) => ({
  subject: `Application Submitted to HOD — ${department?.name || 'Department'}`,
  html: baseTemplate('Application Submitted to HOD', `
    <p>Dear <strong>Vice Chancellor</strong>,</p>
    <p>For your awareness, a student has submitted an application directly to a Head of Department.</p>
    <div class="highlight">
      <p><strong>HOD:</strong> ${hod.firstName} ${hod.lastName}</p>
      <p><strong>Department:</strong> ${department?.name || 'N/A'}</p>
      <p><strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'})</p>
      <p><strong>Application:</strong> ${application.title} &nbsp;|&nbsp; ID: ${application.applicationId}</p>
      <p><strong>Type:</strong> ${application.applicationType.replace(/_/g, ' ').toUpperCase()}</p>
    </div>
  `),
});

// ── 4. Admin — full summary ───────────────────────────────────────────────────
export const adminNotificationTemplate = ({ student, application, recipient, department }) => ({
  subject: `[Admin Alert] New Application — ${application.applicationId}`,
  html: baseTemplate('New Application — Admin Summary', `
    <p>Dear <strong>Administrator</strong>,</p>
    <p>A new application has been submitted in the system.</p>
    <div class="highlight">
      <p><strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'})</p>
      <p><strong>Department:</strong> ${department?.name || 'N/A'}</p>
      <p><strong>Submitted To:</strong> ${recipient.firstName} ${recipient.lastName}</p>
      <p><strong>Recipient Role/Type:</strong> <span class="badge badge-info">${recipient.label || recipient.role.replace(/_/g, ' ').toUpperCase()}</span></p>
      <p><strong>Application Title:</strong> ${application.title}</p>
      <p><strong>Application ID:</strong> ${application.applicationId}</p>
      <p><strong>Type:</strong> ${application.applicationType.replace(/_/g, ' ').toUpperCase()}</p>
      ${application.isUrgent ? '<p><span class="badge badge-warning">⚠ URGENT</span></p>' : ''}
    </div>
  `),
});

// ── 5. Student confirmation ───────────────────────────────────────────────────
export const studentConfirmationTemplate = ({ student, application, recipient }) => ({
  subject: `Application Submitted Successfully — ${application.applicationId}`,
  html: baseTemplate('Application Submitted', `
    <p>Dear <strong>${student.firstName} ${student.lastName}</strong>,</p>
    <p>Your application has been submitted successfully and is now pending review.</p>
    <div class="highlight">
      <p><strong>Application ID:</strong> ${application.applicationId}</p>
      <p><strong>Title:</strong> ${application.title}</p>
      <p><strong>Submitted To:</strong> ${recipient.firstName} ${recipient.lastName} (${recipient.label || recipient.role.replace(/_/g, ' ')})</p>
      ${(recipient.role !== 'vc' && recipient.role !== 'examination_officer' && recipient.department?.name)
        ? `<p><strong>Recipient Department:</strong> ${recipient.department.name}</p>`
        : ''}
      <p><strong>Status:</strong> <span class="badge badge-info">PENDING</span></p>
    </div>
    <p>You will receive an email when your application status is updated. You can also track it anytime on the SUATS portal.</p>
  `),
});

// ── 6. Student status update (approve / reject / forward / verify) ────────────
export const applicationStatusUpdateTemplate = ({ student, application, action, remarks, actionBy }) => {
  const statusStyles = {
    approved:  { style: 'background:#d1fae5;color:#065f46;', icon: '✅' },
    rejected:  { style: 'background:#fee2e2;color:#991b1b;', icon: '❌' },
    forwarded: { style: 'background:#e0e7ff;color:#3730a3;', icon: '➡️' },
    verified:  { style: 'background:#d1fae5;color:#065f46;', icon: '✅' },
  };
  const { style, icon } = statusStyles[action] || statusStyles.forwarded;

  return {
    subject: `Application ${action.toUpperCase()} — ${application.applicationId}`,
    html: baseTemplate(`Application ${action.charAt(0).toUpperCase() + action.slice(1)}`, `
      <p>Dear <strong>${student.firstName} ${student.lastName}</strong>,</p>
      <p>Your application status has been updated.</p>
      <div class="highlight">
        <p><strong>Application ID:</strong> ${application.applicationId}</p>
        <p><strong>Title:</strong> ${application.title}</p>
        <p><strong>New Status:</strong> <span class="badge" style="${style}">${icon} ${action.toUpperCase()}</span></p>
        ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
        <p><strong>Actioned By:</strong> ${actionBy.firstName} ${actionBy.lastName} (${actionBy.role.replace(/_/g, ' ')})</p>
      </div>
      <p>Log in to the SUATS portal to view full details.</p>
    `),
  };
};


export const forwardedToRecipientTemplate = ({ student, application, actionBy, recipient }) => ({
  subject: `Application Forwarded to You — ${application.applicationId}`,
  html: baseTemplate('Application Forwarded to You', `
    <p>Dear <strong>${recipient.firstName} ${recipient.lastName}</strong>,</p>
    <p>An application has been forwarded to you for further review and action.</p>
    <div class="highlight">
      <p><strong>Application ID:</strong> ${application.applicationId}</p>
      <p><strong>Title:</strong> ${application.title}</p>
      <p><strong>Type:</strong> ${application.applicationType.replace(/_/g, ' ').toUpperCase()}</p>
      <p><strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'})</p>
      <p><strong>Student Department:</strong> ${student.department?.name || 'N/A'}</p>
      <p><strong>Forwarded By:</strong> ${actionBy.firstName} ${actionBy.lastName} (${actionBy.role.replace(/_/g, ' ')})</p>
      ${application.isUrgent ? '<p><span class="badge badge-warning">⚠ URGENT</span></p>' : ''}
    </div>
    <p>Please log in to the SUATS portal to review and action this application at your earliest convenience.</p>
  `),
});
 
// ── 8. Accountability notification (HOD / VC oversight emails) ────────────────
export const accountabilityNotificationTemplate = ({
  recipientRole,      // 'hod' | 'vc'
  recipientName,      // first + last
  student,
  application,
  actionBy,           // the staff/hod who took the action
  action,             // 'submitted' | 'approved' | 'rejected' | 'forwarded' | 'verified'
  department,
  remarks,
}) => {
  const actionPast = {
    submitted:  'submitted',
    approved:   'approved',
    rejected:   'rejected',
    forwarded:  'forwarded',
    verified:   'academically verified',
  }[action] || action;
 
  const roleLabel  = recipientRole === 'vc' ? 'Vice Chancellor' : 'Head of Department';
  const colorClass = action === 'approved' || action === 'verified' ? 'badge-success'
                   : action === 'rejected' ? 'badge-danger'
                   : 'badge-info';
 
  return {
    subject: `[Accountability] Application ${actionPast.toUpperCase()} — ${application.applicationId}`,
    html: baseTemplate(`Accountability Update — ${roleLabel}`, `
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>This is an automated accountability notification for your awareness.</p>
      <div class="highlight">
        <p><strong>Action Taken:</strong> <span class="badge ${colorClass}">${actionPast.toUpperCase()}</span></p>
        <p><strong>Action By:</strong> ${actionBy.firstName} ${actionBy.lastName}
          <span class="badge badge-info">${actionBy.role.replace(/_/g, ' ').toUpperCase()}</span>
        </p>
        <p><strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId || 'N/A'})</p>
        <p><strong>Department:</strong> ${department?.name || 'N/A'}</p>
        <p><strong>Application:</strong> ${application.title} &nbsp;|&nbsp; ID: ${application.applicationId}</p>
        <p><strong>Type:</strong> ${application.applicationType.replace(/_/g, ' ').toUpperCase()}</p>
        ${remarks ? `<p><strong>Remarks:</strong> <em>${remarks}</em></p>` : ''}
        ${application.isUrgent ? '<p><span class="badge badge-warning">⚠ URGENT</span></p>' : ''}
      </div>
      <p style="color:#64748b;font-size:12px;">
        This notification is sent to you as part of the SUATS accountability framework.
        No action is required from you unless this application is escalated to your level.
      </p>
    `),
  };
};
 
// NOTE: The baseTemplate function is defined at the top of emailTemplates.service.js
// These exports rely on it being in scope. If you paste these into a separate file,
// import baseTemplate from the parent file or copy the function here.
 