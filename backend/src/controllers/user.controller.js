// user.controller.js
import mongoose from 'mongoose';
import { ApplicationHistory, Department, User } from "../models/index.js";
import { emitToUser, forceLogoutUser, broadcastUserStatusChange, changeUserRooms } from "../socket/index.js";
import uploadOnCloudinary from '../utils/cloudinary.js';
import bcrypt from 'bcryptjs';

// ── Get All Users (Admin) ─────────────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
    try {
        const { keyword, role, department, staffType } = req.query;
        const query = {};

        if (keyword) {
            query.$or = [
                { firstName: { $regex: keyword, $options: 'i' } },
                { lastName:  { $regex: keyword, $options: 'i' } },
                { email:     { $regex: keyword, $options: 'i' } },
            ];
        }
        if (role)       query.role       = role;
        if (department) query.department = department;
        if (staffType)  query.staffType  = staffType;

        const users = await User.find(query)
            .populate('department', 'name code')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// CREATE USER (FULL PRODUCTION READY)
// Admin Only
// ─────────────────────────────────────────────────────────────

export const createUser = async (req, res) => {
  try {
    let {
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      contactNumber,
      staffType,
      societies,
      studentId,
      employeeId,
    } = req.body;

    // ─────────────────────────────
    // Trim / Normalize Inputs
    // ─────────────────────────────
    firstName = firstName?.trim();
    lastName = lastName?.trim();
    email = email?.trim().toLowerCase();

    if (department === "") department = null;
    if (staffType === "") staffType = null;

    // Parse societies if frontend sends stringified JSON
    if (typeof societies === "string") {
      try {
        societies = JSON.parse(societies);
      } catch {
        societies = [];
      }
    }

    if (!Array.isArray(societies)) societies = [];

    // ─────────────────────────────
    // Required Fields
    // ─────────────────────────────
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "firstName, lastName, email, password and role are required.",
      });
    }

    // ─────────────────────────────
    // Roles without Department
    // ─────────────────────────────
    const noDepartmentRoles = [
      "admin",
      "vc",
      "examination_officer",
    ];

    // Department required for others
    if (!noDepartmentRoles.includes(role) && !department) {
      return res.status(400).json({
        success: false,
        message: "Department is required for this role.",
      });
    }

    // Force null department for global roles
    if (noDepartmentRoles.includes(role)) {
      department = null;
    }

    // ─────────────────────────────
    // Staff Validation
    // ─────────────────────────────
    if (role === "staff" && !staffType) {
      return res.status(400).json({
        success: false,
        message: "staffType is required when role is staff.",
      });
    }

    // ─────────────────────────────
    // Duplicate Email Check
    // ─────────────────────────────
    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists.",
      });
    }

    // ─────────────────────────────
    // Only One VC
    // ─────────────────────────────
    if (role === "vc") {
      const existingVC = await User.findOne({ role: "vc" });

      if (existingVC) {
        return res.status(400).json({
          success: false,
          message: "Only one VC is allowed in university.",
        });
      }
    }

    // ─────────────────────────────
    // Only One HOD Per Department
    // ─────────────────────────────
    if (role === "hod") {
      const existingHod = await User.findOne({
        role: "hod",
        department,
      });

      if (existingHod) {
        return res.status(400).json({
          success: false,
          message: "This department already has an HOD.",
        });
      }
    }

    // ─────────────────────────────
    // Society President Check
    // ─────────────────────────────
    for (const s of societies) {
      if (s.position === "President") {
        const existingPresident = await User.findOne({
          societies: {
            $elemMatch: {
              societyName: s.societyName,
              position: "President",
            },
          },
        });

        if (existingPresident) {
          return res.status(400).json({
            success: false,
            message: `President already exists for ${s.societyName}`,
          });
        }
      }
    }

    // ─────────────────────────────
    // Create User
    // ─────────────────────────────
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      contactNumber,
      staffType: role === "staff" ? staffType : null,
      societies,
      studentId,
      employeeId,
      createdBy: req.user._id,
    });

    // ─────────────────────────────
    // Update Department References
    // ─────────────────────────────
    if (role === "hod" || role === "chairperson") {
      await Department.findByIdAndUpdate(department, {
        [role]: user._id,
      });
    }

    user.password = undefined;

    return res.status(201).json({
      success: true,
      data: user,
    });

  } catch (error) {

    // Mongo Duplicate Error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate unique field detected.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ── Update any user (Admin only) ──────────────────────────────────────────────
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            firstName, lastName, email,
            role, department, contactNumber,
            staffType, societies,
            password // 👈 NEW
        } = req.body;

        let user = await User.findById(id).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            });
        }

        const oldDepartment = user.department?.toString();
        const oldRole = user.role;

        // ── VC constraint ───────────────────────────
        if (role === 'vc' && user.role !== 'vc') {
            const existingVC = await User.findOne({ role: 'vc' });
            if (existingVC) {
                return res.status(400).json({
                    success: false,
                    message: 'Only one VC is allowed.',
                });
            }
        }

        // ── HOD constraint ──────────────────────────
        if (role === 'hod') {
            const existingHod = await User.findOne({
                role: 'hod',
                department,
                _id: { $ne: id },
            });

            if (existingHod) {
                return res.status(400).json({
                    success: false,
                    message: 'Department already has an HOD.',
                });
            }
        }

        // ── Society President constraint ────────────
        if (Array.isArray(societies)) {
            for (const s of societies) {
                if (s.position === 'President') {
                    const existingPresident = await User.findOne({
                        _id: { $ne: id },
                        societies: {
                            $elemMatch: {
                                societyName: s.societyName,
                                position: 'President',
                            },
                        },
                    });

                    if (existingPresident) {
                        return res.status(400).json({
                            success: false,
                            message: `President already exists for ${s.societyName}`,
                        });
                    }
                }
            }
        }

        // ── Department role switching ───────────────
        if (user.role !== role || String(user.department) !== String(department)) {

            if (user.role === 'hod' || user.role === 'chairperson') {
                await Department.findByIdAndUpdate(user.department, {
                    $unset: { [user.role]: 1 },
                });
            }

            if (role === 'hod' || role === 'chairperson') {
                await Department.findByIdAndUpdate(department, {
                    [role]: user._id,
                });
            }
        }

        // ── Update fields ───────────────────────────
        const updateData = {
            firstName,
            lastName,
            email,
            role,
            department,
            contactNumber,
            staffType: role === 'staff' ? (staffType ?? user.staffType) : null,
            ...(Array.isArray(societies) && { societies }),
        };

        // ── Password update (ADMIN) ────────────────
        if (password) {
            updateData.password = await bcrypt.hash(password, 12);
        }

        // ── Profile picture ────────────────────────
        if (req.file) {
            const uploaded = await uploadOnCloudinary(req.file.path);
            if (uploaded?.secure_url) {
                updateData.profilePictureUrl = uploaded.secure_url;
            }
        }

        user = await User.findByIdAndUpdate(
            id,
            updateData,
            { returnDocument: 'after', runValidators: true }
        ).populate('department', 'name code');

        // ── Socket updates ─────────────────────────
        const newDepartment = user.department?.toString();
        const newRole = user.role;

        if (oldDepartment !== newDepartment || oldRole !== newRole) {
            changeUserRooms(user._id, newDepartment, newRole);

            emitToUser(user._id.toString(), 'profile_updated', {
                department: newDepartment,
                role: newRole,
                message: 'Your profile has been updated by the administrator.',
            });
        }

        user.password = undefined;

        res.status(200).json({
            success: true,
            data: user,
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate constraint violation (VC/HOD etc).',
            });
        }

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ── Update Own Profile ────────────────────────────────────────────────────────
export const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const { firstName, lastName, contactNumber, currentPassword, newPassword, confirmPassword } = req.body;

        const updateData = {};
        if (firstName)     updateData.firstName     = firstName.trim();
        if (lastName)      updateData.lastName      = lastName.trim();
        if (contactNumber) updateData.contactNumber = contactNumber.trim();

        if (req.file) {
            const uploaded = await uploadOnCloudinary(req.file.path);
            if (uploaded?.secure_url) updateData.profilePictureUrl = uploaded.secure_url;
        }

        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Provide currentPassword, newPassword, and confirmPassword to change password.',
                });
            }
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ success: false, message: 'New passwords do not match.' });
            }
            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
            }

            const userWithPw = await User.findById(userId).select('+password');
            if (!userWithPw) return res.status(404).json({ success: false, message: 'User not found.' });

            const isMatch = await bcrypt.compare(currentPassword, userWithPw.password);
            if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

            updateData.password = await bcrypt.hash(newPassword, 12);
        }

        const user = await User.findByIdAndUpdate(userId, updateData, { returnDocument: 'after', runValidators: true })
            .populate('department', 'name code');

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        user.password = undefined;
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Toggle Active / Ban (Admin only) ─────────────────────────────────────────
export const toggleUserActive = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const user = await User.findByIdAndUpdate(id, { isActive }, { returnDocument: 'after', runValidators: true })
            .populate('department', 'name code');

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (!isActive) forceLogoutUser(id);
        broadcastUserStatusChange(id, isActive);
        emitToUser(id, 'account_status_changed', {
            isActive,
            message: isActive
                ? 'Your account has been reactivated by the administrator.'
                : 'Your account has been deactivated by the administrator.',
        });

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Soft Delete ───────────────────────────────────────────────────────────────
export const deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;
        await User.findByIdAndUpdate(id, { isActive: false });
        res.status(200).json({ success: true, message: 'User deactivated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Hard Delete (Admin only) ──────────────────────────────────────────────────
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (user.role === 'hod' || user.role === 'chairperson') {
            await Department.findByIdAndUpdate(user.department, { $unset: { [user.role]: 1 } });
        }

        forceLogoutUser(id);
        emitToUser(id, 'account_deleted', { message: 'Your account has been permanently deleted by the administrator.' });
        await User.findByIdAndDelete(id);
        broadcastUserStatusChange(id, false);

        res.status(200).json({ success: true, message: 'User deleted permanently.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── User Statistics (Admin only) ──────────────────────────────────────────────
export const getUserStats = async (req, res) => {
    try {
        const [roleStats, staffTypeStats, societyStats] = await Promise.all([
            User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]),
            User.aggregate([
                { $match: { role: 'staff', staffType: { $ne: null } } },
                { $group: { _id: '$staffType', count: { $sum: 1 } } }
            ]),
            User.aggregate([
                { $unwind: '$societies' },
                { $group: { _id: '$societies.societyName', memberCount: { $sum: 1 } } },
                { $sort: { memberCount: -1 } }
            ])
        ]);

        res.status(200).json({
            success: true,
            data: { byRole: roleStats, staffByType: staffTypeStats, bySociety: societyStats },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Get My Profile ────────────────────────────────────────────────────────────
export const getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('department', 'name code');
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── User Activity History (Admin only) ───────────────────────────────────────
export const getUserActivityHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const history = await ApplicationHistory.find({ actionBy: id })
            .populate('application', 'applicationId title status')
            .populate('newRecipient', 'firstName lastName role')
            .sort({ timestamp: -1 });

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Add society membership to a user (Admin only) ─────────────────────────────
// PATCH /api/v1/users/:id/societies
// Body: { societyName: "Cricket Society", position: "President" }
export const addUserToSociety = async (req, res) => {
    try {
        const { id } = req.params;
        const { societyName, position = 'Member' } = req.body;

        if (!societyName) {
            return res.status(400).json({ success: false, message: 'societyName is required.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const alreadyMember = user.societies.some(
            s => s.societyName.toLowerCase() === societyName.toLowerCase()
        );
        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                message: `User is already a member of ${societyName}.`,
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $push: { societies: { societyName, position } } },
            { returnDocument: 'after' }
        ).populate('department', 'name code');

        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Remove society membership from a user (Admin only) ────────────────────────
// DELETE /api/v1/users/:id/societies
// Body: { societyName: "Cricket Society" }
export const removeUserFromSociety = async (req, res) => {
    try {
        const { id } = req.params;
        const { societyName } = req.body;

        if (!societyName) {
            return res.status(400).json({ success: false, message: 'societyName is required.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $pull: { societies: { societyName: { $regex: new RegExp(`^${societyName}$`, 'i') } } } },
            { returnDocument: 'after' }
        ).populate('department', 'name code');

        if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found.' });

        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Get Forwardable Recipients — for staff/HOD "Forward" picker ───────────────
// GET /api/v1/users/forwardable?role=hod&department=<id>
// Returns all active non-student users, excluding the requester.
// Any authenticated user may call this (unlike getAllUsers which is admin-only).
export const getForwardableRecipients = async (req, res) => {
    try {
        const { role, department } = req.query;
        const query = {
            role: { $in: ['staff', 'hod', 'chairperson', 'examination_officer', 'vc'] },
            isActive: true,
            _id: { $ne: req.user._id },
        };
        if (role)       query.role       = role;
        if (department) query.department = department;

        const users = await User.find(query)
            .select('firstName lastName role staffType department profilePictureUrl')
            .populate('department', 'name code')
            .sort({ role: 1, firstName: 1 });

        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Get Staff by Department — for student "Staff" tab ─────────────────────────
// GET /api/v1/users/department/:departmentId/staff?staffType=professor
// Returns: Aamir (Professor), Sara (Clerk), etc.
export const getStaffByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { staffType } = req.query;

        const query = {
            department: departmentId,
            role: { $in: ['staff', 'hod', 'chairperson', 'examination_officer', 'vc'] },
            isActive: true,
        };

        if (staffType) query.staffType = staffType;

        const staff = await User.find(query)
            .select('firstName lastName role staffType societies profilePictureUrl')
            .populate('department', 'name code')
            .sort({ role: 1, firstName: 1 });

        res.status(200).json({ success: true, data: staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Get All Societies in a Department — for student "Societies" tab ───────────
// GET /api/v1/users/department/:departmentId/societies
// Returns: [{ societyName: "Cricket Society", memberCount: 8 }, ...]
export const getSocietiesByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const result = await User.aggregate([
            {
                $match: {
                    department: new mongoose.Types.ObjectId(departmentId),
                    isActive: true,
                    'societies.0': { $exists: true },
                }
            },
            { $unwind: '$societies' },
            {
                $group: {
                    _id: '$societies.societyName',
                    memberCount: { $sum: 1 },
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    societyName: '$_id',
                    memberCount: 1,
                }
            }
        ]);

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Get Members of a Specific Society — student clicks a society name ──────────
// GET /api/v1/users/department/:departmentId/societies/:societyName
// Returns: Aamir (Cricket Society - President), Ali (Cricket Society - Member)
export const getSocietyMembers = async (req, res) => {
    try {
        const { departmentId, societyName } = req.params;

        const members = await User.find({
            department: departmentId,
            isActive: true,
            societies: {
                $elemMatch: {
                    societyName: { $regex: new RegExp(`^${societyName}$`, 'i') }
                }
            }
        })
        .select('firstName lastName role staffType societies profilePictureUrl')
        .populate('department', 'name code');

        // Attach matched society position to each member for easy frontend display
        const membersWithPosition = members.map(member => {
            const membership = member.societies.find(
                s => s.societyName.toLowerCase() === societyName.toLowerCase()
            );
            return {
                ...member.toObject(),
                societyPosition: membership?.position || 'Member',
            };
        });

        res.status(200).json({ success: true, data: membersWithPosition });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};