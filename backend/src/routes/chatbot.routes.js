import express from 'express';
import { getChatbotResponse, getSuggestion } from '../controllers/chatbot.controller.js';
import isAuth from '../middleware/isAuth.js';

const router = express.Router();

router.post('/',       isAuth, getChatbotResponse);
router.post('/suggest', isAuth, getSuggestion);

export default router;
