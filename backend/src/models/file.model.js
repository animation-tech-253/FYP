import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  
  storageProvider: { type: String, default: 'cloudinary' },
  providerFileId: { type: String, required: true },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  isPublic: { type: Boolean, default: false }
}, {
  timestamps: true
});

fileSchema.index({ application: 1 });

export default mongoose.model('File', fileSchema);
