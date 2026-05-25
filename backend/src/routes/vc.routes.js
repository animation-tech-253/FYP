// src/routes/vc.routes.js
import { Router } from 'express';
import {
  getVCPersonalStats,
  getVCUniversityView,
  getVCDepartmentDrill,
  getVCApplicationById,
  getVCAllApplications,
} from '../controllers/vc.controller.js';
import isAuth from '../middleware/isAuth.js';
import { authorizeRoles } from '../middleware/roleCheck.middleware.js';

const router = Router();

// All VC routes require authentication + vc role
router.use(isAuth, authorizeRoles('vc'));

// ── Personal inbox (first screen after login) ─────────────────────────────────
router.get('/personal', getVCPersonalStats);

// ── University-wide overview (analytics tab) ──────────────────────────────────
router.get('/university', getVCUniversityView);

// ── Department drill-down (VC clicks a dept card) ────────────────────────────
// NOTE: must be defined BEFORE /applications/:id to avoid route conflict
router.get('/department/:departmentId', getVCDepartmentDrill);

// ── Browse all applications with filters ─────────────────────────────────────
router.get('/applications', getVCAllApplications);

// ── View a single application in full detail ──────────────────────────────────
router.get('/applications/:id', getVCApplicationById);

export default router;