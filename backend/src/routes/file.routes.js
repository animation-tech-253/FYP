import express from 'express';
import {
    uploadFile,
    getFilesByApplication,
    deleteFile,
    viewFile,
} from '../controllers/file.controller.js';
import isAuth from '../middleware/isAuth.js';
import { uploadMultipleFiles } from '../middleware/upload.js';

const router = express.Router();

// Upload one or multiple files (controller handles both req.file and req.files)
router.post(   '/',                          isAuth, uploadMultipleFiles, uploadFile);
router.get(    '/application/:applicationId', isAuth, getFilesByApplication);
router.get(    '/:fileId/view',               isAuth, viewFile);
router.delete( '/:fileId',                   isAuth, deleteFile);

export default router;