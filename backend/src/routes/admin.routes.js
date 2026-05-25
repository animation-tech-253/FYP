// src/routes/admin.routes.js
import { Router } from 'express';
import {
  getAdminOverview,
  getAdminDepartmentDrill,
  getAdminNoDeptRoles,
  getAdminApplicationById,
  getAdminAllApplications,
} from '../controllers/admin.controller.js';
import isAuth from '../middleware/isAuth.js';
import { authorizeRoles } from '../middleware/roleCheck.middleware.js';

const router = Router();

// All admin dashboard routes require authentication + admin role
router.use(isAuth, authorizeRoles('admin'));

// ── System-wide overview (first screen after login) ───────────────────────────
router.get('/overview', getAdminOverview);

// ── No-department roles: VC + ExamOfficer queues ─────────────────────────────
// Admin clicks "VC" or "Examination Officers" in sidebar
router.get('/no-dept-roles', getAdminNoDeptRoles);

// ── Department drill-down (admin clicks any dept card) ────────────────────────
// NOTE: must be before /applications/:id
router.get('/department/:departmentId', getAdminDepartmentDrill);

// ── Browse all applications with filters (including by recipient) ─────────────
router.get('/applications', getAdminAllApplications);

// ── View a single application in full detail ──────────────────────────────────
router.get('/applications/:id', getAdminApplicationById);

export default router;