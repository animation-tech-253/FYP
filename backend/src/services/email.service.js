// src/services/email.service.js
import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use a Google App Password — NOT your real Gmail password
  },
});

/**
 * Core email sender. Never throws — logs and silently fails
 * so email issues never crash the main application flow.
 */
export const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"SUATS System" <${process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    });



    console.log(`[Email] ✓ Sent "${subject}" → ${to}`);
  } catch (error) {
    console.error(`[Email] ✗ Failed "${subject}":`, error.message);
  }
};