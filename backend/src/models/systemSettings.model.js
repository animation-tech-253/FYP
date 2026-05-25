import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  defaultTheme:     { type: String, enum: ['light', 'dark'], default: 'light' },
  institutionName:  { type: String, default: 'Smart University' },
  logoUrl:          { type: String, default: '' },
  supportEmail:     { type: String, required: true, default: 'support@suats.com' },

  applicationPrefix:        { type: String, required: true, default: 'APP' },
  currentApplicationNumber: { type: Number, required: true, default: 1 },

  studentPrefix:        { type: String, required: true, default: 'STU' },
  currentStudentNumber: { type: Number, required: true, default: 0 },

  aiChatbotEnabled: { type: Boolean, default: true },
  aiProvider: {
    type:    String,
    enum:    ['groq', 'openrouter', 'together', 'gemini'],
    default: 'groq',
  },
  aiModel: { type: String, default: 'llama-3.3-70b-versatile' },

  maxFileSizeMB: { type: Number, default: 10 },

  // ✅ FIX: Array-level default — previously inner `default` never populated the array
  allowedFileTypes: {
    type: [String],
    default: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
}, {
  timestamps: true,
});

export default mongoose.model('SystemSettings', systemSettingsSchema);