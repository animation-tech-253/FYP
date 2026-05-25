// src/models/notification.model.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'alert'],
    default: 'info',
  },
  isRead:  { type: Boolean, default: false, index: true },
  readAt:  { type: Date, default: null }, // set when isRead flips to true

  relatedApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  relatedFile:        { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
}, {
  timestamps: true,
});

// Compound index: quickly fetch unread notifications for a user sorted by date
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);