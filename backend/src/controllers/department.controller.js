import { Department } from '../models/index.js';

// Get all departments
export const getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.find({ isActive: true })
            .populate('hod', 'firstName lastName email')
            .populate('chairperson', 'firstName lastName email');
        res.status(200).json({ success: true, data: departments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new department (Admin only)
export const createDepartment = async (req, res) => {
    try {
        const { name, code, description } = req.body;
        const department = await Department.create({
            name,
            code,
            description,
            createdBy: req.user._id
        });
        res.status(201).json({ success: true, data: department });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Department name or code already exists.' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description, isActive } = req.body;

        const department = await Department.findByIdAndUpdate(
            id,
            { name, code, description, isActive },
            { returnDocument: 'after', runValidators: true }
        );

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found.' });
        }

        res.status(200).json({ success: true, data: department });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Department name or code already exists.' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete — isActive false karo
        await Department.findByIdAndUpdate(id, { isActive: false });
        res.status(200).json({ success: true, message: 'Department deactivated.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};