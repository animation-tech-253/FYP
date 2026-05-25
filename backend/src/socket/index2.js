// src/socket/index.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

let ioInstance = null;

// Map<userId → { sockets: Set<socketId>, departmentId, role }>
const connectedUsers = new Map();

// Optional lightweight cache (avoid repeated DB hits)
const userCache = new Map(); // userId → { departmentId, role, ts }

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

const addOnlineUser = (userId, socketId, departmentId, role) => {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, {
      sockets: new Set(),
      departmentId,
      role,
    });
  }
  connectedUsers.get(userId).sockets.add(socketId);
};

const removeOnlineUser = (userId, socketId) => {
  if (!connectedUsers.has(userId)) return false;

  const user = connectedUsers.get(userId);
  user.sockets.delete(socketId);

  if (user.sockets.size === 0) {
    connectedUsers.delete(userId);
    return true;
  }

  return false;
};

export const getOnlineUserIds = () => [...connectedUsers.keys()];
export const getIO = () => ioInstance;

// ───────────────────────────────────────────────────────────────
// Cache + DB fetch (optimized)
// ───────────────────────────────────────────────────────────────

const getUserMeta = async (userId) => {
  const cached = userCache.get(userId);

  // cache valid for 30s
  if (cached && Date.now() - cached.ts < 30000) {
    return cached;
  }

  const user = await User.findById(userId)
    .select('department role')
    .lean();

  if (!user) return null;

  const data = {
    departmentId: user.department?.toString(),
    role: user.role,
    ts: Date.now(),
  };

  userCache.set(userId, data);
  return data;
};

// ───────────────────────────────────────────────────────────────
// Core Room Join Logic
// ───────────────────────────────────────────────────────────────

const joinUserRooms = async (socket, userId) => {
  const userIdStr = userId.toString();

  const meta = await getUserMeta(userIdStr);
  if (!meta) {
    socket.emit('auth_error', 'User not found');
    return socket.disconnect();
  }

  const { departmentId, role } = meta;

  socket.userId = userIdStr;

  // Join rooms
  socket.join(`user_${userIdStr}`);
  if (departmentId) socket.join(`dept_${departmentId}`);
  if (role) socket.join(`role_${role}`);

  const isFirstConn = !connectedUsers.has(userIdStr);

  addOnlineUser(userIdStr, socket.id, departmentId, role);

  if (isFirstConn) {
    socket.broadcast.emit('user_online', { userId: userIdStr });
  }

  socket.emit('online_users_list', {
    userIds: getOnlineUserIds(),
  });

  console.log(
    `[Socket] ${userIdStr} → user_${userIdStr}, dept_${departmentId}, role_${role}`
  );
};

// ───────────────────────────────────────────────────────────────
// Room Change (REAL-TIME FIX 🔥)
// ───────────────────────────────────────────────────────────────

export const changeUserRooms = (userId, newDept, newRole) => {
  if (!ioInstance) return;

  const userIdStr = userId.toString();
  const user = connectedUsers.get(userIdStr);
  if (!user) return;

  const { departmentId: oldDept, role: oldRole } = user;

  user.departmentId = newDept;
  user.role = newRole;

  // update cache
  userCache.set(userIdStr, {
    departmentId: newDept,
    role: newRole,
    ts: Date.now(),
  });

  const sockets = ioInstance.sockets.adapter.rooms.get(`user_${userIdStr}`);

  if (!sockets) return;

  for (const socketId of sockets) {
    const socket = ioInstance.sockets.sockets.get(socketId);
    if (!socket) continue;

    if (oldDept) socket.leave(`dept_${oldDept}`);
    if (oldRole) socket.leave(`role_${oldRole}`);

    if (newDept) socket.join(`dept_${newDept}`);
    if (newRole) socket.join(`role_${newRole}`);
  }
};

// ───────────────────────────────────────────────────────────────
// Initialize Socket
// ───────────────────────────────────────────────────────────────

export const initializeSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    // Auth via cookie
    socket.on('authenticate_cookie', async () => {
      try {
        const raw = socket.handshake.headers.cookie || '';
        const match = raw.match(/(?:^|;\s*)token=([^;]+)/);

        if (!match) {
          socket.emit('auth_error', 'No token');
          return;
        }

        const decoded = jwt.verify(match[1], process.env.JWT_SECRET);

        await joinUserRooms(socket, decoded.userId);
      } catch (err) {
        socket.emit('auth_error', 'Authentication failed');
        socket.disconnect();
      }
    });

    socket.on('disconnect', () => {
      const userId = socket.userId;

      if (userId) {
        const offline = removeOnlineUser(userId, socket.id);

        if (offline) {
          ioInstance.emit('user_offline', { userId });
        }
      }

      console.log('Disconnected:', socket.id);
    });
  });

  return ioInstance;
};

// ───────────────────────────────────────────────────────────────
// Emit Helpers
// ───────────────────────────────────────────────────────────────

export const emitToUser = (userId, event, data) => {
  ioInstance?.to(`user_${userId}`).emit(event, data);
};

export const emitToDepartment = (deptId, event, data) => {
  ioInstance?.to(`dept_${deptId}`).emit(event, data);
};

export const emitToRole = (role, event, data) => {
  ioInstance?.to(`role_${role}`).emit(event, data);
};

// ───────────────────────────────────────────────────────────────
// Admin Streams
// ───────────────────────────────────────────────────────────────

export const emitAdminActivityLog = (entry) => {
  ioInstance?.to('role_admin').emit('admin_activity_log', {
    ...entry,
    timestamp: new Date().toISOString(),
  });
};

export const emitAdminApplicationUpdate = (data) => {
  ioInstance?.to('role_admin').emit('admin_application_update', {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// ───────────────────────────────────────────────────────────────
// Force Logout
// ───────────────────────────────────────────────────────────────

export const forceLogoutUser = (userId) => {
  const userIdStr = userId.toString();

  ioInstance?.to(`user_${userIdStr}`).emit('forced_logout', {
    message: 'Account deactivated',
  });

  connectedUsers.delete(userIdStr);

  ioInstance?.emit('user_offline', { userId: userIdStr });
};