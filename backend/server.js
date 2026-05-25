import 'dotenv/config'; // ← SABSE PEHLE, koi bhi import se pehle

import { createServer } from 'http';
import { connectDB }     from './src/config/db.js';
import { initializeSocket } from './src/socket/index.js';
import app from './src/app.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        console.log('✅ Database connected');

        const httpServer = createServer(app);
        initializeSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

    } catch (error) {
        console.error('❌ Startup failed:', error.message);
        process.exit(1);
    }
};

startServer();