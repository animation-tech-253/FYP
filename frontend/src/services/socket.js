import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:7800';

let socket = null;

export const initSocket = () => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    // Keep for backward compat — backend responds with 'authenticated'.
    // Rooms are already joined by server middleware before this fires.
    socket.emit('authenticate_cookie');
  });

  socket.on('connect_error', (err) => {
    const reason = err.message;
    const labels = {
      NO_TOKEN:         'No auth token found in cookie.',
      USER_NOT_FOUND:   'User account not found.',
      ACCOUNT_INACTIVE: 'Account has been deactivated.',
      AUTH_FAILED:      'Session expired or invalid.',
    };
    console.error('[Socket] Connection rejected —', labels[reason] || reason);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Capture the socket instance at subscription time so the cleanup arrow always
// has a valid reference even after disconnectSocket() sets the module var to null.
export const subscribeToEvent = (event, callback) => {
  if (!socket) return () => {};
  const captured = socket;
  captured.on(event, callback);
  return () => captured.off(event, callback);
};
