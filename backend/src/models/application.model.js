// src/models/application.model.js
import mongoose from 'mongoose';

const documentRequestSchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now },
  message:     { type: String, required: true },
  isResolved:  { type: Boolean, default: false },
  resolvedAt:  { type: Date, default: null },
}, { _id: true });

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true },

  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',       required: true },
  department:  { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  applicationType: {
    type: String,
    enum: [
      'result_card_request',
      'certificate_request',
      'transcript_request',
      'trip_permission',
      'fee_concession',
      'society_event',
      'other',
    ],
    required: true,
  },

  // Auto-set on submission based on applicationType.
  // Types that need examiner verification before HOD gives final approval:
  //   result_card_request, certificate_request, transcript_request
  requiresExaminerVerification: { type: Boolean, default: false },

  title:       { type: String, required: true, trim: true },
  description: { type: String, required: true },
  tags:        [{ type: String }],

  currentRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'forwarded', 'completed'],
    default: 'pending',
  },

  isUrgent: { type: Boolean, default: false },
  dueDate:  { type: Date },

  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  history:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'ApplicationHistory' }],

  finalRemarks: { type: String, default: '' },

  // Stamped by examination_officer during "verified" action.
  // After verification, app returns to HOD for final approval.
  academicVerification: {
    isVerified:     { type: Boolean, default: false },
    cgpa:           { type: Number,  default: null },
    attendanceMet:  { type: Boolean, default: null },
    isEligible:     { type: Boolean, default: null },
    remarks:        { type: String,  default: '' },
    verifiedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:     { type: Date },
  },

  // Examiner can request additional documents from the student mid-review.
  // Each entry is one request; student resolves it via PATCH /:id/resolve-docs.
  documentRequests: {
    type:    [documentRequestSchema],
    default: [],
  },

  submittedDate: { type: Date, default: Date.now },
  lastUpdated:   { type: Date, default: Date.now },
  completedDate: { type: Date },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────
applicationSchema.index({ applicationId: 1 }, { unique: true });
applicationSchema.index({ student: 1, status: 1 });
applicationSchema.index({ currentRecipient: 1, status: 1 });
applicationSchema.index({ department: 1, status: 1 });
applicationSchema.index({ submittedDate: -1 });
applicationSchema.index({ applicationType: 1 });
applicationSchema.index({ 'academicVerification.verifiedBy': 1 });
applicationSchema.index({ 'documentRequests.isResolved': 1 });

export default mongoose.model('Application', applicationSchema);