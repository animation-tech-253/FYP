// department.model.js
import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  hod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  chairperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// --- INDEXES ---
// Moved unique constraints from field definitions to explicit index definitions
// to avoid duplication warnings.
departmentSchema.index({ name: 1 }, { unique: true });
departmentSchema.index({ code: 1 }, { unique: true });

export default mongoose.model('Department', departmentSchema);