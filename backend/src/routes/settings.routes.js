
import { getSettings, updateSettings } from '../controllers/systemSettings.controller.js';
import isAuth from '../middleware/isAuth.js';
import { authorizeRoles } from '../middleware/roleCheck.middleware.js';
import express from 'express'

const router = express.Router();

// Anyone logged in can view basic settings (e.g. for theme)
router.get('/', isAuth, getSettings);

// Only admin can update settings
router.patch('/', isAuth, authorizeRoles('admin'), updateSettings);

export default router;
