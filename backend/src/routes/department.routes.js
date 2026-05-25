import express from 'express';
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/department.controller.js';
import isAuth from '../middleware/isAuth.js';
import { authorizeRoles } from '../middleware/roleCheck.middleware.js';

const router = express.Router();

// Anyone logged in can see departments (needed for forms)
router.get('/', getAllDepartments);

// Only Admin can create departments
router.post('/', isAuth, authorizeRoles('admin'), createDepartment);

router.patch('/:id',  isAuth, authorizeRoles('admin'), updateDepartment);
router.delete('/:id', isAuth, authorizeRoles('admin'), deleteDepartment);

export default router;
