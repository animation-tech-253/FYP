import { SystemSettings }        from "../models/index.js";
import { getIO }                  from "../socket/index.js";
import { getConfiguredProviders } from "../services/aiProvider.service.js";

const ALLOWED_UPDATE_FIELDS = [
  'defaultTheme',
  'institutionName',
  'logoUrl',
  'supportEmail',
  'applicationPrefix',
  'aiChatbotEnabled',
  'aiProvider',
  'aiModel',
  'maxFileSizeMB',
  'allowedFileTypes',
];

export const getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();

    // Singleton — agar exist nahi karta toh create karo
    if (!settings) {
      settings = await SystemSettings.create({
        supportEmail: 'support@suats.com',
      });
    }

    res.status(200).json({ success: true, data: { ...settings.toObject(), configuredProviders: getConfiguredProviders() } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    // Sirf allowed fields hi update honge — currentApplicationNumber etc. protected hain
    const updateData = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    const settings = await SystemSettings.findOneAndUpdate(
      {},
      updateData,
      { returnDocument: 'after', upsert: true, runValidators: true }
    );

    // getIO() use karo — global.io nahi
    const io = getIO();
    if (io) {
      io.emit('settingsUpdated', settings);
    }

    res.status(200).json({
      success: true,
      message: 'System settings updated successfully.',
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};