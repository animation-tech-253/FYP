import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userAPI } from '../../services/api';
import toast from 'react-hot-toast';

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchAllUsers = createAsyncThunk(
  'users/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const res = await userAPI.getAll(params);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await userAPI.create(data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create user');
    }
  }
);

// Admin update — data must be a FormData object so profile pic upload works
export const updateUser = createAsyncThunk(
  'users/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await userAPI.update(id, data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update user');
    }
  }
);

export const deactivateUser = createAsyncThunk(
  'users/deactivate',
  async (id, { rejectWithValue }) => {
    try {
      await userAPI.deactivate(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to deactivate user');
    }
  }
);

export const toggleUserActive = createAsyncThunk(
  'users/toggleActive',
  async ({ id, isActive }, { rejectWithValue }) => {
    try {
      const res = await userAPI.toggleActive(id, { isActive });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to toggle user status');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/delete',
  async (id, { rejectWithValue }) => {
    try {
      await userAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete user');
    }
  }
);

export const fetchUserStats = createAsyncThunk(
  'users/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const res = await userAPI.getStats();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch stats');
    }
  }
);

// ── Department staff / society lookups (recipient picker) ────────────────────

export const fetchStaffByDepartment = createAsyncThunk(
  'users/fetchStaffByDepartment',
  async (deptId, { rejectWithValue }) => {
    try {
      const res = await userAPI.getStaffByDepartment(deptId);
      return res.data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchSocietiesByDepartment = createAsyncThunk(
  'users/fetchSocietiesByDepartment',
  async (deptId, { rejectWithValue }) => {
    try {
      const res = await userAPI.getSocietiesByDepartment(deptId);
      return res.data.data;  // [{ societyName, memberCount }]
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchSocietyMembers = createAsyncThunk(
  'users/fetchSocietyMembers',
  async ({ deptId, societyName }, { rejectWithValue }) => {
    try {
      const res = await userAPI.getSocietyMembers(deptId, societyName);
      return { societyName, members: res.data.data };
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

// ── Society admin actions ─────────────────────────────────────────────────────

export const addUserToSociety = createAsyncThunk(
  'users/addToSociety',
  async ({ userId, societyName, position }, { rejectWithValue }) => {
    try {
      const res = await userAPI.addToSociety(userId, { societyName, position });
      return res.data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const removeUserFromSociety = createAsyncThunk(
  'users/removeFromSociety',
  async ({ userId, societyName }, { rejectWithValue }) => {
    try {
      const res = await userAPI.removeFromSociety(userId, { societyName });
      return res.data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const usersSlice = createSlice({
  name: 'users',
  initialState: {
    items:               [],
    stats:               [],
    onlineUserIds:       [],
    // Recipient picker state
    departmentStaff:     [],
    departmentSocieties: [],   // [{ societyName, memberCount }]
    societyMembers:      {},   // { [societyName]: [...members] }
    loading:             false,
    staffLoading:        false,
    societiesLoading:    false,
    error:               null,
  },
  reducers: {
    // ── Online presence (admin dashboard) ──────────────────────────────────
    setUserOnline: (state, action) => {
      const userId = action.payload;
      if (!state.onlineUserIds.includes(userId)) state.onlineUserIds.push(userId);
      const user = state.items.find(u => u._id === userId);
      if (user) user.isOnline = true;
    },

    setUserOffline: (state, action) => {
      const userId = action.payload;
      state.onlineUserIds = state.onlineUserIds.filter(id => id !== userId);
      const user = state.items.find(u => u._id === userId);
      if (user) user.isOnline = false;
    },

    setOnlineUsers: (state, action) => {
      state.onlineUserIds = action.payload;
      state.items.forEach(u => { u.isOnline = action.payload.includes(u._id); });
    },

    // Called by useSocket when admin toggles a user's active status
    setUserActiveStatus: (state, action) => {
      const { id, isActive } = action.payload;
      const user = state.items.find(u => u._id === id);
      if (user) user.isActive = isActive;
    },

    // Recipient picker cleanup
    clearDepartmentRecipients: (state) => {
      state.departmentStaff     = [];
      state.departmentSocieties = [];
      state.societyMembers      = {};
    },

    clearUsersError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    // ── Fetch All ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchAllUsers.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.items   = action.payload.map(u => ({
          ...u,
          isOnline: state.onlineUserIds.includes(u._id),
        }));
      })
      .addCase(fetchAllUsers.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
        toast.error(action.payload);
      });

    // ── Create ─────────────────────────────────────────────────────────────
    builder
      .addCase(createUser.fulfilled, (state, action) => {
        state.items.unshift({ ...action.payload, isOnline: false });
        toast.success('User created successfully');
      })
      .addCase(createUser.rejected, (_, action) => { toast.error(action.payload); });

    // ── Update (admin) ─────────────────────────────────────────────────────
    builder
      .addCase(updateUser.fulfilled, (state, action) => {
        const idx = state.items.findIndex(u => u._id === action.payload._id);
        if (idx !== -1) {
          state.items[idx] = {
            ...action.payload,
            isOnline: state.onlineUserIds.includes(action.payload._id),
          };
        }
        toast.success('User updated successfully');
      })
      .addCase(updateUser.rejected, (_, action) => { toast.error(action.payload); });

    // ── Toggle Active ──────────────────────────────────────────────────────
    builder
      .addCase(toggleUserActive.fulfilled, (state, action) => {
        const idx = state.items.findIndex(u => u._id === action.payload._id);
        if (idx !== -1) {
          state.items[idx] = {
            ...action.payload,
            isOnline: state.onlineUserIds.includes(action.payload._id),
          };
        }
      })
      .addCase(toggleUserActive.rejected, (state, action) => {
        state.error = action.payload;
        toast.error(action.payload);
      });

    // ── Deactivate (soft delete) ───────────────────────────────────────────
    builder
      .addCase(deactivateUser.fulfilled, (state, action) => {
        const user = state.items.find(u => u._id === action.payload);
        if (user) user.isActive = false;
        toast.success('User deactivated');
      })
      .addCase(deactivateUser.rejected, (_, action) => { toast.error(action.payload); });

    // ── Delete (hard delete) ───────────────────────────────────────────────
    builder
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.items = state.items.filter(u => u._id !== action.payload);
        toast.success('User deleted permanently');
      })
      .addCase(deleteUser.rejected, (_, action) => { toast.error(action.payload); });

    // ── Stats ──────────────────────────────────────────────────────────────
    builder
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      });

    // ── fetchStaffByDepartment ─────────────────────────────────────────────
    builder
      .addCase(fetchStaffByDepartment.pending,   (state) => { state.staffLoading = true; })
      .addCase(fetchStaffByDepartment.fulfilled, (state, action) => {
        state.staffLoading    = false;
        state.departmentStaff = action.payload;
      })
      .addCase(fetchStaffByDepartment.rejected,  (state) => { state.staffLoading = false; });

    // ── fetchSocietiesByDepartment ────────────────────────────────────────
    builder
      .addCase(fetchSocietiesByDepartment.pending,   (state) => { state.societiesLoading = true; })
      .addCase(fetchSocietiesByDepartment.fulfilled, (state, action) => {
        state.societiesLoading    = false;
        state.departmentSocieties = action.payload;
      })
      .addCase(fetchSocietiesByDepartment.rejected,  (state) => { state.societiesLoading = false; });

    // ── fetchSocietyMembers ───────────────────────────────────────────────
    builder
      .addCase(fetchSocietyMembers.fulfilled, (state, action) => {
        state.societyMembers[action.payload.societyName] = action.payload.members;
      });

    // ── addUserToSociety / removeUserFromSociety ──────────────────────────
    builder
      .addCase(addUserToSociety.fulfilled, (state, action) => {
        const idx = state.items.findIndex(u => u._id === action.payload._id);
        if (idx !== -1) state.items[idx] = { ...action.payload, isOnline: state.onlineUserIds.includes(action.payload._id) };
      })
      .addCase(removeUserFromSociety.fulfilled, (state, action) => {
        const idx = state.items.findIndex(u => u._id === action.payload._id);
        if (idx !== -1) state.items[idx] = { ...action.payload, isOnline: state.onlineUserIds.includes(action.payload._id) };
      });
  },
});

export const {
  setUserOnline,
  setUserOffline,
  setOnlineUsers,
  setUserActiveStatus,
  clearDepartmentRecipients,
  clearUsersError,
} = usersSlice.actions;

// Selectors
export const selectAllUsers             = (state) => state.users.items;
export const selectUsersLoading         = (state) => state.users.loading;
export const selectUsersError           = (state) => state.users.error;
export const selectOnlineUserIds        = (state) => state.users.onlineUserIds;
export const selectUserStats            = (state) => state.users.stats;
export const selectIsUserOnline         = (userId) => (state) => state.users.onlineUserIds.includes(userId);
export const selectDepartmentStaff      = (state) => state.users.departmentStaff;
export const selectDepartmentSocieties  = (state) => state.users.departmentSocieties;
export const selectSocietyMembers       = (societyName) => (state) => state.users.societyMembers[societyName] || [];
export const selectStaffLoading         = (state) => state.users.staffLoading;
export const selectSocietiesLoading     = (state) => state.users.societiesLoading;

export default usersSlice.reducer;