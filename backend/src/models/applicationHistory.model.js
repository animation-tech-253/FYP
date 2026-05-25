// src/models/applicationHistory.model.js
import mongoose from 'mongoose';

const applicationHistorySchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  actionBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',        required: true },

  action: {
    type: String,
    enum: [
      'submitted',
      'approved',
      'rejected',
      'forwarded',
      'verified',       // examiner stamps verification, returns to HOD
      'request_docs',   // examiner requests additional documents from student
      'remark_added',
      'completed',
    ],
    required: true,
  },

  remarks: { type: String, default: '' },

  previousRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  newRecipient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  statusBefore: { type: String },
  statusAfter:  { type: String },

  timestamp: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────
applicationHistorySchema.index({ application: 1, timestamp: -1 });
applicationHistorySchema.index({ actionBy: 1 });

// ── Stats hook ────────────────────────────────────────────────────────────────
// Single source of truth for denormalized User.stats counters.
//
// submitted    → student:        applicationsSubmitted++
// submitted    → newRecipient:   applicationsReceived++
// approved     → actionBy:       applicationsAccepted++
// rejected     → actionBy:       applicationsRejected++
// forwarded    → actionBy:       applicationsForwarded++
// verified     → actionBy:       applicationsForwarded++  ← NOT accepted.
//                                Examiner forwards back to HOD, not final approval.
// request_docs → no stat change. It's a mid-flow admin action, not a decision.
// forwarded/verified → newRecipient: applicationsReceived++
// any action with remarks → remarksGiven++
// ─────────────────────────────────────────────────────────────────────────────
applicationHistorySchema.post('save', async function (doc) {
  try {
    const User = mongoose.model('User');

    const actionByUpdate = {};

    if (doc.action === 'submitted') {
      actionByUpdate['stats.applicationsSubmitted'] = 1;
    } else if (doc.action === 'approved') {
      actionByUpdate['stats.applicationsAccepted'] = 1;
    } else if (doc.action === 'rejected') {
      actionByUpdate['stats.applicationsRejected'] = 1;
    } else if (doc.action === 'forwarded' || doc.action === 'verified') {
      // verified = examiner returning app to HOD — semantically a forward
      actionByUpdate['stats.applicationsForwarded'] = 1;
    }
    // request_docs — no stat change, it's a document request not a decision

    if (doc.remarks && doc.remarks.trim() !== '') {
      actionByUpdate['stats.remarksGiven'] = 1;
    }

    if (Object.keys(actionByUpdate).length > 0) {
      await User.findByIdAndUpdate(doc.actionBy, { $inc: actionByUpdate });
    }

    // Track received count for the new recipient
    // verified counts here too — HOD receives the app back after verification
    if (doc.newRecipient && (doc.action === 'submitted' || doc.action === 'forwarded' || doc.action === 'verified')) {
      await User.findByIdAndUpdate(doc.newRecipient, {
        $inc: { 'stats.applicationsReceived': 1 },
      });
    }

  } catch (err) {
    console.error('[ApplicationHistory hook] Stats update failed:', err.message);
  }
});

export default mongoose.model('ApplicationHistory', applicationHistorySchema);