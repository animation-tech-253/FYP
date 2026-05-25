// src/socket/index.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User, Notification } from '../models/index.js';

let ioInstance = null;

// userId → { sockets: Set<socketId>, departmentId, role }
const connectedUsers = new Map();

const addOnlineUser = (userId, socketId, departmentId, role) => {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, { sockets: new Set(), departmentId, role });
  }
  connectedUsers.get(userId).sockets.add(socketId);
};

const removeOnlineUser = (userId, socketId) => {
  if (!connectedUsers.has(userId)) return false;
  connectedUsers.get(userId).sockets.delete(socketId);
  if (connectedUsers.get(userId).sockets.size === 0) {
    connectedUsers.delete(userId);
    return true;
  }
  return false;
};

export const getOnlineUserIds = () => Array.from(connectedUsers.keys());
export const getIO = () => ioInstance;

export const initializeSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin:  process.env.FRONTEND_URL,
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  // ── Auth Middleware ─────────────────────────────────────────────────────────
  // Runs before the `connection` event fires. Socket is rejected immediately if
  // the cookie token is missing or invalid — no room-join race condition possible.
  ioInstance.use(async (socket, next) => {
    try {
      const raw   = socket.handshake.headers.cookie || '';
      const match = raw.match(/(?:^|;\s*)token=([^;]+)/);
      if (!match) return next(new Error('NO_TOKEN'));

      const decoded = jwt.verify(match[1], process.env.JWT_SECRET);
      const user    = await User.findById(decoded.userId)
        .select('department role isActive')
        .lean();

      if (!user)          return next(new Error('USER_NOT_FOUND'));
      if (!user.isActive) return next(new Error('ACCOUNT_INACTIVE'));

      socket.data.userId       = decoded.userId.toString();
      socket.data.departmentId = user.department?.toString() || null;
      socket.data.role         = user.role;
      next();
    } catch {
      next(new Error('AUTH_FAILED'));
    }
  });

  ioInstance.on('connection', async (socket) => {
    const { userId, departmentId, role } = socket.data;
    console.log(`[Socket] Connected: ${socket.id} | User: ${userId} | Role: ${role}`);

    // Join rooms immediately — admin is in role_admin before any event fires.
    await joinUserRooms(socket, userId, departmentId, role);

    // Deliver any unread notifications that were created while this user was offline.
    deliverMissedNotifications(socket, userId).catch(err =>
      console.error(`[Socket] missedNotifications error for ${userId}:`, err.message)
    );

    // Backward-compat: old frontend code still emits authenticate_cookie.
    // Rooms are already joined above, so just confirm to the frontend.
    socket.on('authenticate_cookie', () => {
      socket.emit('authenticated', { userId, role });
    });

    socket.on('disconnect', (reason) => {
      const wentOffline = removeOnlineUser(userId, socket.id);
      if (wentOffline) ioInstance.emit('user_offline', { userId });
      console.log(`[Socket] Disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });

  return ioInstance;
};

// ── Join a user to their rooms ─────────────────────────────────────────────────
const joinUserRooms = async (socket, userId, departmentId, role) => {
  const userIdStr = userId.toString();
  const existing  = connectedUsers.get(userIdStr);

  // Prefer already-tracked dept/role (multi-tab scenario); fall back to fresh values.
  const finalDeptId = existing?.departmentId || departmentId;
  const finalRole   = existing?.role         || role;

  socket.join(`user_${userIdStr}`);
  if (finalDeptId) socket.join(`dept_${finalDeptId}`);
  if (finalRole)   socket.join(`role_${finalRole}`);

  const isFirstConn = !connectedUsers.has(userIdStr);
  addOnlineUser(userIdStr, socket.id, finalDeptId, finalRole);

  // Keep the map entry current (second tab may carry fresher dept/role).
  const entry = connectedUsers.get(userIdStr);
  if (entry) {
    entry.departmentId = finalDeptId;
    entry.role         = finalRole;
  }

  if (isFirstConn) {
    socket.broadcast.emit('user_online', { userId: userIdStr });
  }

  socket.emit('online_users_list', { userIds: getOnlineUserIds() });
  console.log(`[Socket] Rooms joined: user_${userIdStr} | dept_${finalDeptId} | role_${finalRole}`);
};

// ── Push unread notifications created while the user was offline ──────────────
const deliverMissedNotifications = async (socket, userId) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: userId, isRead: false })
      .populate('relatedApplication', 'title applicationId status')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  // Always sync the badge count on connect.
  socket.emit('notification_count_update', { unreadCount });

  if (unreadCount > 0) {
    socket.emit('missed_notifications', { notifications, unreadCount });
  }
};

// ── Move a user to new rooms when their role or department changes ─────────────
export const changeUserRooms = (userId, newDepartmentId, newRole) => {
  if (!ioInstance) return;
  const userIdStr = userId.toString();
  const entry     = connectedUsers.get(userIdStr);
  if (!entry) return;

  const { departmentId: oldDeptId, role: oldRole } = entry;
  entry.departmentId = newDepartmentId;
  entry.role         = newRole;

  const sockets = ioInstance.sockets.adapter.rooms.get(`user_${userIdStr}`);
  if (!sockets) return;

  for (const socketId of sockets) {
    const sock = ioInstance.sockets.sockets.get(socketId);
    if (!sock) continue;
    if (oldDeptId)       sock.leave(`dept_${oldDeptId}`);
    if (oldRole)         sock.leave(`role_${oldRole}`);
    if (newDepartmentId) sock.join(`dept_${newDepartmentId}`);
    if (newRole)         sock.join(`role_${newRole}`);
  }
};

// ── Standard emitters ─────────────────────────────────────────────────────────

export const emitToUser = (userId, event, data) => {
  if (ioInstance) ioInstance.to(`user_${userId}`).emit(event, data);
};

export const emitToDepartment = (departmentId, event, data) => {
  if (ioInstance && departmentId) ioInstance.to(`dept_${departmentId}`).emit(event, data);
};

export const emitToRole = (role, event, data) => {
  if (ioInstance && role) ioInstance.to(`role_${role}`).emit(event, data);
};

export const emitToVCAndAdmin = (event, data) => {
  emitToRole('vc',    event, data);
  emitToRole('admin', event, data);
};

// ── Admin real-time activity log ──────────────────────────────────────────────
// Every significant event is broadcast to all connected admins instantly.
//
// Entry shape:
// {
//   event        : string   — e.g. 'application_submitted' | 'application_approved'
//   message      : string   — human-readable description
//   actor        : string   — who did the action
//   actorRole    : string   — their role
//   targetRole?  : string   — recipient's role (submission only)
//   department   : string   — relevant department name
//   applicationId: string   — e.g. 'APP-0001'
//   severity     : 'info' | 'success' | 'warning' | 'alert'
//   timestamp    : ISO string (added here)
// }
export const emitAdminActivityLog = (logEntry) => {
  if (!ioInstance) return;
  const entry = { ...logEntry, timestamp: new Date().toISOString() };
  ioInstance.to('role_admin').emit('admin_activity_log', entry);
  console.log(`[AdminLog] ${(entry.severity || 'info').toUpperCase()} | ${entry.message}`);
};

// ── Admin live application update (dashboard table row refresh) ───────────────
// Fired whenever an application changes state so the admin table updates without
// a full page refresh or polling.
//
// Data shape:
// {
//   applicationId : MongoDB _id string
//   appCode       : e.g. 'APP-0001'
//   action        : 'submitted' | 'approved' | 'rejected' | 'forwarded' | 'verified' | 'request_docs'
//   status        : new status string
//   department    : department name
//   student       : { firstName, lastName, studentId }
//   actor         : { firstName, lastName, role }
//   timestamp     : ISO string (added here)
// }
export const emitAdminApplicationUpdate = (data) => {
  if (!ioInstance) return;
  ioInstance.to('role_admin').emit('admin_application_update', {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const forceLogoutUser = (userId) => {
  if (!ioInstance) return;
  ioInstance.to(`user_${userId}`).emit('forced_logout', {
    message: 'Your account has been deactivated by the administrator.',
  });
  if (connectedUsers.has(userId.toString())) {
    connectedUsers.delete(userId.toString());
    ioInstance.emit('user_offline', { userId: userId.toString() });
  }
};

export const broadcastUserStatusChange = (userId, isActive) => {
  if (ioInstance) {
    ioInstance.emit('user_status_changed', { userId: userId.toString(), isActive });
  }
};
