// src/models/user.model.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const societyMembershipSchema = new mongoose.Schema({
  societyName: { type: String, required: true, trim: true },
  position: { type: String, trim: true, default: 'Member' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
  },

  role: {
    type: String,
    //  'chairperson' bhi add kiya — application.controller.js mein use ho raha tha
    enum: ['student', 'staff', 'hod', 'vc', 'examination_officer', 'chairperson', 'admin'],
    required: true,
    default: 'student',
  },

  staffType: {
    type: String,
    enum: ['professor', 'lecturer', 'clerk', 'lab_technician', 'other'],
    default: null,
    validate: {
      validator: function (v) {
        if (this.role === 'staff') return v != null;
        return true;
      },
      message: 'staffType is required when role is staff.',
    },
  },

  societies: {
    type: [societyMembershipSchema],
    default: [],
  },

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
    // FIX: VC aur examination_officer university-wide hote hain — unka koi department nahi
    // Pehle sirf admin ko exempt kiya tha — yeh galat tha
    required: function () {
      const noDepartmentRoles = ['admin', 'vc', 'examination_officer'];
      return !noDepartmentRoles.includes(this.role);
    },
  },

  studentId:  { type: String },
  employeeId: { type: String },

  profilePictureUrl: { type: String, default: '' },
  contactNumber: { type: String },

  isActive:               { type: Boolean, default: true },
  isEmailVerified:        { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  passwordResetToken:     { type: String },
  passwordResetExpires:   { type: Date },

  lastLogin: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  stats: {
    applicationsSubmitted: { type: Number, default: 0 },
    applicationsReceived:  { type: Number, default: 0 },
    applicationsAccepted:  { type: Number, default: 0 },
    applicationsRejected:  { type: Number, default: 0 },
    applicationsForwarded: { type: Number, default: 0 },
    remarksGiven:          { type: Number, default: 0 },
  },

}, { timestamps: true });

// ─────────────────────────────────────────────────────────────
// CLEAN + PROFESSIONAL INDEX SECTION
// User Model Indexes
// ─────────────────────────────────────────────────────────────

// Email unique
userSchema.index(
  { email: 1 },
  { unique: true, name: "unique_email" }
);

// Search / Filters
userSchema.index(
  { role: 1, department: 1 },
  { name: "role_department_index" }
);

userSchema.index(
  { staffType: 1 },
  { name: "staff_type_index" }
);

userSchema.index(
  { "societies.societyName": 1 },
  { name: "society_name_index" }
);

// Optional Unique IDs
userSchema.index(
  { studentId: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_student_id"
  }
);

userSchema.index(
  { employeeId: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_employee_id"
  }
);

// ─────────────────────────────────────────────
// ONLY ONE VC + ONE EXAMINATION OFFICER
// Entire University
// ─────────────────────────────────────────────

userSchema.index(
  { role: 1 },
  {
    unique: true,
    name: "unique_vc_and_exam_officer",
    partialFilterExpression: {
      role: {
        $in: ["vc", "examination_officer"]
      }
    }
  }
);

// ─────────────────────────────────────────────
// ONLY ONE HOD PER DEPARTMENT
// ─────────────────────────────────────────────

userSchema.index(
  { department: 1, role: 1 },
  {
    unique: true,
    name: "unique_hod_per_department",
    partialFilterExpression: {
      role: "hod"
    }
  }
);

// ─────────────────────────────────────────────
// ONLY ONE PRESIDENT PER SOCIETY
// ─────────────────────────────────────────────

userSchema.index(
  {
    "societies.societyName": 1,
    "societies.position": 1
  },
  {
    unique: true,
    name: "unique_society_president",
    partialFilterExpression: {
      "societies.position": "President"
    }
  }
);
// ── Password hashing ──────────────────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

export default mongoose.model('User', userSchema);