import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationAPI } from '../../services/api';

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await notificationAPI.getAll();
      return res.data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const res = await notificationAPI.getUnreadCount();
      return res.data.unreadCount;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { rejectWithValue }) => {
    try {
      await notificationAPI.markRead(id);
      return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const markAllRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationAPI.markAllRead();
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const deleteNotification = createAsyncThunk(
  'notifications/deleteOne',
  async (id, { rejectWithValue }) => {
    try {
      await notificationAPI.deleteOne(id);
      return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const deleteAllNotifications = createAsyncThunk(
  'notifications/deleteAll',
  async (_, { rejectWithValue }) => {
    try {
      await notificationAPI.deleteAll();
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items:       [],
    unreadCount: 0,
    loading:     false,
  },
  reducers: {
    // Called by useSocket when a real-time newNotification event arrives
    addNotification: (state, action) => {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },

    // Called by useSocket when notification_count_update event arrives
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },

    // Called by useSocket when notification_read arrives from another tab
    socketMarkRead: (state, action) => {
      const notif = state.items.find(n => n._id === action.payload);
      if (notif && !notif.isRead) {
        notif.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },

    // Called by useSocket when notifications_all_read arrives from another tab
    socketMarkAllRead: (state) => {
      state.items.forEach(n => { n.isRead = true; });
      state.unreadCount = 0;
    },

    // Called by useSocket when notification_deleted arrives from another tab
    socketDeleteOne: (state, action) => {
      const idx = state.items.findIndex(n => n._id === action.payload);
      if (idx !== -1) {
        if (!state.items[idx].isRead) state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.items.splice(idx, 1);
      }
    },

    // Called by useSocket when notifications_all_deleted arrives from another tab
    socketDeleteAll: (state) => {
      state.items       = [];
      state.unreadCount = 0;
    },

    // Called by useSocket on connect — merges unread notifications that were
    // created while the user was offline. Uses server count as ground truth.
    loadMissedNotifications: (state, action) => {
      const { notifications, unreadCount } = action.payload;
      const existingIds = new Set(state.items.map(n => n._id));
      const newOnes     = notifications.filter(n => !existingIds.has(n._id));
      state.items       = [...newOnes, ...state.items];
      state.unreadCount = unreadCount;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending,   (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading    = false;
        state.items      = action.payload;
        state.unreadCount = action.payload.filter(n => !n.isRead).length;
      })
      .addCase(fetchNotifications.rejected,  (state) => { state.loading = false; })

      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })

      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const notif = state.items.find(n => n._id === action.payload);
        if (notif && !notif.isRead) {
          notif.isRead  = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })

      .addCase(markAllRead.fulfilled, (state) => {
        state.items.forEach(n => { n.isRead = true; });
        state.unreadCount = 0;
      })

      .addCase(deleteNotification.fulfilled, (state, action) => {
        const idx = state.items.findIndex(n => n._id === action.payload);
        if (idx !== -1) {
          if (!state.items[idx].isRead) state.unreadCount = Math.max(0, state.unreadCount - 1);
          state.items.splice(idx, 1);
        }
      })

      .addCase(deleteAllNotifications.fulfilled, (state) => {
        state.items       = [];
        state.unreadCount = 0;
      });
  },
});

export const {
  addNotification,
  setUnreadCount,
  socketMarkRead,
  socketMarkAllRead,
  socketDeleteOne,
  socketDeleteAll,
  loadMissedNotifications,
} = notificationsSlice.actions;

export const selectNotifications        = (state) => state.notifications.items;
export const selectUnreadCount          = (state) => state.notifications.unreadCount;
export const selectNotificationsLoading = (state) => state.notifications.loading;

export default notificationsSlice.reducer;