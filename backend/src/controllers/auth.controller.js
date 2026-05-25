// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import { User, ApplicationHistory, Department, Notification, SystemSettings } from '../models/index.js';
import { genToken } from '../utils/token.js';
import { emitToUser } from '../socket/index.js';
import { sendEmail } from '../services/email.service.js';
import { welcomeStudentTemplate } from '../services/emailTemplates.service.js';

// ── Sign Up ───────────────────────────────────────────────────────────────────
export const signUp = async (req, res) => {
    try {
        let { firstName, lastName, email, password, contactNumber, role, department } = req.body;

        if (!firstName || !lastName || !email || !password || !role) {
            return res.status(400).json({ success: false, message: "Please fill all required credentials." });
        }

        let existUser = await User.findOne({ email });
        if (existUser) {
            return res.status(400).json({ success: false, message: "User already exists with this email." });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
        }

        let studentId;
        if (role === 'student') {
            const settings = await SystemSettings.findOneAndUpdate(
                {},
                { $inc: { currentStudentNumber: 1 } },
                { returnDocument: 'after', upsert: true }
            );
            studentId = `STU${settings.currentStudentNumber.toString().padStart(4, '0')}`;
        }

        const user = await User.create({ firstName, lastName, email, password, contactNumber, role, department, studentId });
        const token = genToken(user._id);

        res.cookie("token", token, {
            sameSite: 'strict',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        user.password = undefined;

        await Notification.create({
            recipient: user._id,
            message: `Welcome to SUATS, ${user.firstName}! Your account has been created successfully.`,
            type: 'success',
        });

        if (role === 'student') {
            await user.populate('department');
            const { subject, html } = welcomeStudentTemplate({
                student: { ...user.toObject(), email, department: user.department?.name || null },
            });
            await sendEmail(email, subject, html);
        }

        emitToUser(user._id, 'signup_success', { message: 'Account created successfully', user });

        return res.status(201).json({ success: true, data: user });

    } catch (error) {
        console.error('SignUp error:', error.stack);
        return res.status(500).json({ success: false, message: `SignUp error: ${error.message}` });
    }
};

// ── Sign In ───────────────────────────────────────────────────────────────────
export const signIn = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Please provide email and password." });
        }

        const existUser = await User.findOne({ email }).select('+password');

        if (!existUser) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // ── Banned / Deactivated account check ────────────────────────────────
        if (!existUser.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact the administrator.",
            });
        }

        const isMatch = await bcrypt.compare(password, existUser.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        existUser.lastLogin = new Date();
        await existUser.save();

        const token = genToken(existUser._id);

        res.cookie("token", token, {
            sameSite: 'strict',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        existUser.password = undefined;

        await Notification.create({
            recipient: existUser._id,
            message: `Welcome back, ${existUser.firstName}! You have logged in successfully.`,
            type: 'info',
        });

        emitToUser(existUser._id, 'login_success', { message: 'Login successful', user: existUser });

        return res.status(200).json({ success: true, data: existUser });

    } catch (error) {
        return res.status(500).json({ success: false, message: `Sign In error: ${error.message}` });
    }
};

// ── Sign Out ──────────────────────────────────────────────────────────────────
export const signOut = async (req, res) => {
    try {
        const userId = req.user._id;

        res.clearCookie("token");

        await Notification.create({
            recipient: userId,
            message: 'You have been logged out.',
            type: 'info',
        });

        emitToUser(userId, 'logout_success', { message: 'Logged out successfully.' });

        return res.status(200).json({ success: true, message: "Logged out successfully." });
    } catch (error) {
        return res.status(500).json({ success: false, message: `Sign Out error: ${error.message}` });
    }
};