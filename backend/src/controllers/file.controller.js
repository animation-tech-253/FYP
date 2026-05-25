import fs from 'fs';
import { Application, File, Notification, SystemSettings } from '../models/index.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import { emitToUser } from '../socket/index.js';

// ── Internal helper: clean up temp files multer left on disk ──────────────────
const cleanupTempFiles = (files) => {
    for (const f of files) {
        if (f.path) {
            fs.unlink(f.path, (err) => {
                if (err) console.error(`[File] Failed to delete temp file ${f.path}:`, err.message);
            });
        }
    }
};

// ── Upload one OR multiple files for an application ───────────────────────────
export const uploadFile = async (req, res) => {
    const incomingFiles = req.files?.length
        ? req.files
        : req.file
        ? [req.file]
        : [];

    try {
        if (!incomingFiles.length) {
            return res.status(400).json({ success: false, message: 'No file(s) uploaded.' });
        }

        const { applicationId } = req.body;
        if (!applicationId) {
            cleanupTempFiles(incomingFiles);
            return res.status(400).json({ success: false, message: 'Application ID is required.' });
        }

        // ── Fetch application + settings in parallel ──────────────────────
        const [application, settings] = await Promise.all([
            Application.findById(applicationId),
            SystemSettings.findOne(),
        ]);

        if (!application) {
            cleanupTempFiles(incomingFiles);
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        // ── Authorization ─────────────────────────────────────────────────
        const isOwner     = application.student.toString()           === req.user._id.toString();
        const isRecipient = application.currentRecipient.toString()  === req.user._id.toString();
        const isAdmin     = req.user.role === 'admin';

        if (!isOwner && !isRecipient && !isAdmin) {
            cleanupTempFiles(incomingFiles);
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to upload files to this application.',
            });
        }

        // ── File validation ───────────────────────────────────────────────
        const maxSizeBytes = (settings?.maxFileSizeMB || 10) * 1024 * 1024;
        const allowedTypes = settings?.allowedFileTypes?.length
            ? settings.allowedFileTypes
            : [
                'application/pdf', 'image/jpeg', 'image/png',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              ];

        for (const f of incomingFiles) {
            if (f.size > maxSizeBytes) {
                cleanupTempFiles(incomingFiles);
                return res.status(400).json({
                    success: false,
                    message: `File "${f.originalname}" exceeds the maximum allowed size of ${settings?.maxFileSizeMB || 10}MB.`,
                });
            }
            if (!allowedTypes.includes(f.mimetype)) {
                cleanupTempFiles(incomingFiles);
                return res.status(400).json({
                    success: false,
                    message: `File type "${f.mimetype}" is not allowed for "${f.originalname}".`,
                });
            }
        }

        // ── Upload to Cloudinary in parallel ──────────────────────────────
        const uploadResults = await Promise.allSettled(
            incomingFiles.map(f => uploadOnCloudinary(f.path))
        );

        // Temp files no longer needed after Cloudinary upload attempts
        cleanupTempFiles(incomingFiles);

        const savedFiles  = [];
        const failedFiles = [];
        const newFileIds  = [];

        // ── Save successful uploads to DB ─────────────────────────────────
        // Using Promise.allSettled so one DB failure doesn't abort the rest
        const dbResults = await Promise.allSettled(
            uploadResults.map((result, i) => {
                if (result.status !== 'fulfilled' || !result.value) {
                    failedFiles.push(incomingFiles[i].originalname);
                    return Promise.resolve(null);
                }
                const cloudRes = result.value;
                const orig     = incomingFiles[i];
                return File.create({
                    filename:        cloudRes.public_id,
                    originalName:    orig.originalname,
                    mimetype:        orig.mimetype,
                    size:            orig.size,
                    url:             cloudRes.secure_url,
                    storageProvider: 'cloudinary',
                    providerFileId:  cloudRes.public_id,
                    uploadedBy:      req.user._id,
                    application:     applicationId,
                });
            })
        );

        for (const r of dbResults) {
            if (r.status === 'fulfilled' && r.value) {
                savedFiles.push(r.value);
                newFileIds.push(r.value._id);
            }
        }

        if (!savedFiles.length) {
            return res.status(500).json({
                success: false,
                message: `All uploads failed: ${failedFiles.join(', ')}`,
            });
        }

        // ── Attach file IDs to application + create notification in parallel ──
        const fileWord       = savedFiles.length === 1 ? 'document' : `${savedFiles.length} documents`;
        const notifRecipient = isOwner ? application.currentRecipient : application.student;
        const socketEvent    = isOwner ? 'newAttachmentFromStudent' : 'newFileUploaded';
        const messageContent = isOwner
            ? `Student uploaded ${fileWord} to application: "${application.title}"`
            : `An officer uploaded ${fileWord} to your application: "${application.title}"`;

        await Promise.all([
            Application.findByIdAndUpdate(
                applicationId,
                { $push: { attachments: { $each: newFileIds } } }
            ),
            Notification.create({
                recipient:          notifRecipient,
                message:            messageContent,
                type:               'info',
                relatedApplication: application._id,
                relatedFile:        savedFiles[0]._id,
            }),
        ]);

        emitToUser(notifRecipient.toString(), socketEvent, {
            message:       messageContent,
            files:         savedFiles,
            applicationId: application._id,
        });

        // ── Response ──────────────────────────────────────────────────────
        const response = { success: true, data: savedFiles };
        if (failedFiles.length) {
            response.warnings = `Some files failed to upload: ${failedFiles.join(', ')}`;
        }

        res.status(201).json(response);

    } catch (error) {
        cleanupTempFiles(incomingFiles);
        console.error('[uploadFile] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Get all files for a specific application ──────────────────────────────────
export const getFilesByApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await Application.findById(applicationId);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        const isOwner     = application.student.toString()          === req.user._id.toString();
        const isRecipient = application.currentRecipient.toString() === req.user._id.toString();
        const isAdmin     = req.user.role === 'admin';
        const isStaff     = ['hod', 'staff', 'chairperson', 'vc', 'examination_officer'].includes(req.user.role);

        if (!isOwner && !isRecipient && !isAdmin && !isStaff) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view files of this application.',
            });
        }

        const files = await File.find({ application: applicationId })
            .populate('uploadedBy', 'firstName lastName role')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: files.length, data: files });
    } catch (error) {
        console.error('[getFilesByApplication] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Stream a file inline (or as attachment) through the server ────────────────
// GET /api/v1/files/:fileId/view          → inline (PDF viewer)
// GET /api/v1/files/:fileId/view?download=1 → attachment (download)
export const viewFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.fileId).populate('application', 'student currentRecipient');
        if (!file) return res.status(404).json({ success: false, message: 'File not found.' });

        const app     = file.application;
        const isOwner = app.student.toString()           === req.user._id.toString();
        const isRecip = app.currentRecipient.toString()  === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        const isStaff = ['hod', 'staff', 'chairperson', 'vc', 'examination_officer'].includes(req.user.role);

        if (!isOwner && !isRecip && !isAdmin && !isStaff) {
            return res.status(403).json({ success: false, message: 'Not authorized to access this file.' });
        }

        const upstream = await fetch(file.url);
        if (!upstream.ok) return res.status(502).json({ success: false, message: 'Failed to fetch file from storage.' });

        const disposition = req.query.download === '1'
            ? `attachment; filename="${file.originalName}"`
            : `inline; filename="${file.originalName}"`;

        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', disposition);
        if (upstream.headers.get('content-length')) {
            res.setHeader('Content-Length', upstream.headers.get('content-length'));
        }

        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Delete a file (Uploader or Admin only) ────────────────────────────────────
export const deleteFile = async (req, res) => {
    try {
        const { fileId } = req.params;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found.' });
        }

        const isOwner = file.uploadedBy.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this file.' });
        }

        // Remove from application attachments array + delete file doc in parallel
        await Promise.all([
            Application.findByIdAndUpdate(file.application, { $pull: { attachments: file._id } }),
            File.findByIdAndDelete(fileId),
        ]);

        // Uncomment when you want Cloudinary cleanup:
        // await cloudinary.uploader.destroy(file.providerFileId);

        res.status(200).json({ success: true, message: 'File deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};