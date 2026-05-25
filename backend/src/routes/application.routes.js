// src/routes/application.routes.js
import { Router } from 'express';
import {
  submitApplication,
  getMyApplications,
  getApplicationsForReview,
  getDepartmentApplications,
  getDepartmentApplicationById,
  getDepartmentApplicationStats,
  getDepartmentStaffWithWorkload,
  processApplication,
  resolveDocumentRequest,
  getExaminerDashboard,
  getExaminerAnalytics,
  bulkProcessApplications,
  exportApplicationPDF,
  getAllApplicationsAdmin,
  getApplicationById,
} from '../controllers/application.controller.js';
import isAuth from '../middleware/isAuth.js';
import { authorizeRoles } from '../middleware/roleCheck.middleware.js';

const router = Router();

// ── Student routes ────────────────────────────────────────────────────────────
router.post('/',    isAuth, authorizeRoles('student'), submitApplication);
router.get('/my',   isAuth, authorizeRoles('student'), getMyApplications);

// Student resolves a document request from the examiner
// PATCH /api/v1/applications/:id/resolve-docs
// Body: (none required — student just confirms they uploaded files)
// Flow: examiner calls request_docs → student uploads file → student hits this endpoint
//       → examiner gets docs_uploaded socket event + notification
router.patch(
  '/:id/resolve-docs',
  isAuth,
  authorizeRoles('student'),
  resolveDocumentRequest
);

// ── Examiner routes ───────────────────────────────────────────────────────────
// NOTE: all /examiner/* routes must be before /:id to avoid conflict

router.get(
  '/examiner/dashboard',
  isAuth,
  authorizeRoles('examination_officer'),
  getExaminerDashboard
);

router.get(
  '/examiner/analytics',
  isAuth,
  authorizeRoles('examination_officer'),
  getExaminerAnalytics
);

// PATCH /api/v1/applications/examiner/bulk-process
// Body: { applicationIds, action: 'verified'|'rejected', verificationData?, remarks? }
router.patch(
  '/examiner/bulk-process',
  isAuth,
  authorizeRoles('examination_officer'),
  bulkProcessApplications
);

// ── HOD department routes ─────────────────────────────────────────────────────
router.get('/department',                isAuth, authorizeRoles('hod'), getDepartmentApplications);
router.get('/department/stats',          isAuth, authorizeRoles('hod'), getDepartmentApplicationStats);
router.get('/department/staff-workload', isAuth, authorizeRoles('hod'), getDepartmentStaffWithWorkload);
router.get('/department/:id',            isAuth, authorizeRoles('hod'), getDepartmentApplicationById);

// ── Review queue (inbox for all processing roles) ─────────────────────────────
// Response includes enriched tags:
//   awaitingFinalApproval — examiner verified, back with HOD for final call
//   needsExaminerFirst    — HOD needs to forward to examiner before approving
//   hasPendingDocRequest  — student hasn't resolved examiner doc request yet
router.get(
  '/review',
  isAuth,
  authorizeRoles('staff', 'hod', 'vc', 'examination_officer', 'chairperson', 'admin'),
  getApplicationsForReview
);

// ── Process (approve / reject / forward / verified / request_docs) ────────────
// Body shape per action:
//
//   approved:
//     { action: "approved", remarks: "..." }
//
//   rejected:
//     { action: "rejected", remarks: "reason" }
//
//   forwarded:
//     { action: "forwarded", newRecipientId: "<userId>", remarks?: "..." }
//
//   verified (examination_officer only):
//     {
//       action: "verified",
//       verificationData: {
//         cgpa: 3.4,
//         attendancePct: 85,       // optional
//         hasClearedDues: true,    // optional
//         isEligible: true,        // must be true — use rejected if false
//         remarks: "All checks passed"
//       }
//     }
//     NOTE: NO newRecipientId needed. System auto-finds HOD of student's dept.
//
//   request_docs (examination_officer only):
//     { action: "request_docs", remarks: "Please upload fee clearance certificate" }
//     NOTE: App stays with examiner. Student is notified to re-upload.
//           Student resolves via PATCH /:id/resolve-docs
router.patch(
  '/:id/process',
  isAuth,
  authorizeRoles('staff', 'hod', 'vc', 'examination_officer', 'chairperson', 'admin'),
  processApplication
);

// ── PDF export ────────────────────────────────────────────────────────────────
router.get(
  '/:id/pdf',
  isAuth,
  authorizeRoles('student', 'staff', 'hod', 'vc', 'examination_officer', 'chairperson', 'admin'),
  exportApplicationPDF
);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/admin/all', isAuth, authorizeRoles('admin'), getAllApplicationsAdmin);

// ── Generic single application (MUST be last — catches /:id) ─────────────────
router.get(
  '/:id',
  isAuth,
  authorizeRoles('student', 'staff', 'hod', 'vc', 'examination_officer', 'chairperson', 'admin'),
  getApplicationById
);

export default router;