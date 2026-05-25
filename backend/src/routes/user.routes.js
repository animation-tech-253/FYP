// user.routes.js
import express from 'express';
import {
    getAllUsers,
    createUser,
    updateUser,
    updateMyProfile,
    deactivateUser,
    toggleUserActive,
    deleteUser,
    getUserStats,
    getMyProfile,
    getUserActivityHistory,
    addUserToSociety,
    removeUserFromSociety,
    getStaffByDepartment,
    getSocietiesByDepartment,
    getSocietyMembers,
    getForwardableRecipients,
} from '../controllers/user.controller.js';
import isAuth from '../middleware/isAuth.js';
import { authorizeRoles } from '../middleware/roleCheck.middleware.js';
import { uploadSingleFile } from '../middleware/upload.js';

const router = express.Router();

// ── Self — any authenticated user ─────────────────────────────────────────────
router.get(  '/me',        isAuth, getMyProfile);
router.patch('/me/update', isAuth, uploadSingleFile, updateMyProfile);

// ── Department recipient endpoints (used by student when submitting application)
// IMPORTANT: defined BEFORE /:id routes to avoid route conflicts

// "Staff" tab — returns all staff/hod/chairperson etc. in a department
// GET /api/v1/users/department/:departmentId/staff?staffType=professor
router.get('/department/:departmentId/staff', isAuth, getStaffByDepartment);

// "Societies" tab — returns list of all society names in a department
// GET /api/v1/users/department/:departmentId/societies
router.get('/department/:departmentId/societies', isAuth, getSocietiesByDepartment);

// Society drill-down — student clicks a society name to see its members
// GET /api/v1/users/department/:departmentId/societies/:societyName
router.get('/department/:departmentId/societies/:societyName', isAuth, getSocietyMembers);

// ── Forward recipient picker — any authenticated staff/hod/vc user ────────────
// GET /api/v1/users/forwardable?role=hod&department=<id>
router.get('/forwardable', isAuth, getForwardableRecipients);

// ── Admin only ────────────────────────────────────────────────────────────────
router.get('/stats', isAuth, authorizeRoles('admin'), getUserStats);

router.route('/')
    .get( isAuth, authorizeRoles('admin'), getAllUsers)
    .post(isAuth, authorizeRoles('admin'), createUser);

router.route('/:id')
    .put(   isAuth, authorizeRoles('admin'), uploadSingleFile, updateUser)
    .delete(isAuth, authorizeRoles('admin'), deleteUser);

router.patch( '/:id/toggle-active', isAuth, authorizeRoles('admin'), toggleUserActive);
router.patch('/:id/deactivate',        isAuth, authorizeRoles('admin'), deactivateUser);
router.get(   '/:id/activity',      isAuth, authorizeRoles('admin'), getUserActivityHistory);

// Society management — admin assigns/removes society memberships
// PATCH  /api/v1/users/:id/societies  → add user to a society
// DELETE /api/v1/users/:id/societies  → remove user from a society
router.patch( '/:id/societies', isAuth, authorizeRoles('admin'), addUserToSociety);
router.delete('/:id/societies', isAuth, authorizeRoles('admin'), removeUserFromSociety);

export default router;