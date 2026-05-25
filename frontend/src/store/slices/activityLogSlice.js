// src/store/slices/activityLogSlice.js
import { createSlice } from '@reduxjs/toolkit';

// Max entries to keep in memory — prevents unbounded growth
const MAX_LOG_ENTRIES = 200;

const activityLogSlice = createSlice({
  name: 'activityLog',
  initialState: {
    entries:  [],  // newest first
    unseenCount: 0,
    isWatching:  false, // true when admin has the streams page open
  },
  reducers: {
    // Called by useSocket when admin_activity_log event arrives
    addLogEntry: (state, action) => {
      state.entries.unshift(action.payload);
      // Trim to max
      if (state.entries.length > MAX_LOG_ENTRIES) {
        state.entries = state.entries.slice(0, MAX_LOG_ENTRIES);
      }
      // Only increment unseen if admin is NOT on the streams page
      if (!state.isWatching) {
        state.unseenCount += 1;
      }
    },

    // Called when admin opens the streams page
    setWatching: (state, action) => {
      state.isWatching  = action.payload;
      if (action.payload) state.unseenCount = 0;
    },

    clearLog: (state) => {
      state.entries     = [];
      state.unseenCount = 0;
    },
  },
});

export const { addLogEntry, setWatching, clearLog } = activityLogSlice.actions;

export const selectActivityLogEntries  = (state) => state.activityLog.entries;
export const selectActivityLogUnseen   = (state) => state.activityLog.unseenCount;
export const selectActivityLogWatching = (state) => state.activityLog.isWatching;

export default activityLogSlice.reducer;