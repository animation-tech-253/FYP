import express    from 'express';
import cookieParser from 'cookie-parser';
import cors       from 'cors';

import authRoutes         from './routes/auth.routes.js';
import userRoutes         from './routes/user.routes.js';
import departmentRoutes   from './routes/department.routes.js';
import applicationRoutes  from './routes/application.routes.js';
import fileRoutes         from './routes/file.routes.js';
import notificationRoutes from './routes/notification.routes.js';
// import analyticsRoutes    from './routes/analytics.routes.js';
import settingsRoutes     from './routes/settings.routes.js';
import chatbotRoutes      from './routes/chatbot.routes.js';
import vcRoutes      from './routes/vc.routes.js';
import adminRoutes      from './routes/admin.routes.js';

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/users',         userRoutes);
app.use('/api/v1/departments',   departmentRoutes);
app.use('/api/v1/applications',  applicationRoutes);
app.use('/api/v1/files',         fileRoutes);
app.use('/api/v1/notifications', notificationRoutes);
// app.use('/api/v1/analytics',     analyticsRoutes);
app.use('/api/v1/settings',      settingsRoutes);
app.use('/api/v1/chatbot',       chatbotRoutes);
app.use('/api/v1/vc',       vcRoutes);
app.use('/api/v1/admin',       adminRoutes);

app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));

app.get('/', (req, res) => res.send('SUATS API is running...'));

export default app;