// src/middleware/upload.js
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

// Allow common document and image types at the multer level.
// Fine-grained validation against SystemSettings happens inside the controller.
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, PDF, DOC, DOCX.`));
    }
};

const multerConfig = {
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB hard cap at multer level; real limit comes from SystemSettings
    fileFilter,
};

// ── Single file (profile picture, legacy use) ─────────────────────────────────
// field name: 'file'
export const uploadSingleFile = multer(multerConfig).single('file');

// ── Multiple files (application attachments — up to 10) ──────────────────────
// field name: 'files'  →  send as FormData: files[0], files[1], ...
export const uploadMultipleFiles = multer(multerConfig).array('files', 10);

// ── Profile picture specifically (field: 'profilePicture') ───────────────────
export const uploadProfilePicture = multer(multerConfig).single('profilePicture');