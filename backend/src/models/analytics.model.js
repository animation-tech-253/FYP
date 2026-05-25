import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true, 
    unique: true
  },
  
  totalApplications: { type: Number, default: 0 },
  
  statusBreakdown: {
    pending: { type: Number, default: 0 },
    under_review: { type: Number, default: 0 },
    approved: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    forwarded: { type: Number, default: 0 },
  },

  typeBreakdown: {
    result_card_request: { type: Number, default: 0 },
    trip_permission: { type: Number, default: 0 },
    certificate_request: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },

  topDepartments: [{
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    count: { type: Number, default: 0 }
  }]
}, { 
  timestamps: true 
});

export default mongoose.model('Analytics', analyticsSchema);
