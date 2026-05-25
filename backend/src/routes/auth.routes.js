import express from 'express';
import { signUp, signIn, signOut} from '../controllers/auth.controller.js';
import isAuth from '../middleware/isAuth.js';

const router = express.Router();

// Public Routes
router.post('/signup', signUp);
router.post('/login', signIn);

// Protected Routes
router.post('/logout', isAuth, signOut);


export default router;
