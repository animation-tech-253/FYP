import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI, userAPI, setAppInitialized } from '../../services/api';
import { disconnectSocket } from '../../services/socket';
import toast from 'react-hot-toast';

export const signUp = createAsyncThunk('auth/signUp', async (data, { rejectWithValue }) => {
  try {
    const res = await authAPI.signUp(data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const signIn = createAsyncThunk('auth/signIn', async (data, { rejectWithValue }) => {
  try {
    const res = await authAPI.signIn(data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const signOut = createAsyncThunk('auth/signOut', async (_, { rejectWithValue }) => {
  try {
    await authAPI.signOut();
    disconnectSocket();
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Logout failed');
  }
});

export const getMe = createAsyncThunk('auth/getMe', async (_, { rejectWithValue }) => {
  try {
    const res = await userAPI.getMe();
    return res.data.data;
  } catch (err) {
    // 401 here just means "not logged in" — totally expected on fresh visit.
    // rejectWithValue so the slice can set initialized: true and unblock routing.
    return rejectWithValue(err.response?.data?.message || 'Not authenticated');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: false,
    initialized: false,   // false = still probing session, block all route renders
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    setUser: (state, action) => {
      state.user           = action.payload;
      state.isAuthenticated = !!action.payload;
    },
  },
  extraReducers: (builder) => {

    // ─ Sign Up ──────────────────────────────────────────────────────────────
    builder
      .addCase(signUp.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading         = false;
        state.user            = action.payload;
        state.isAuthenticated = true;
        state.initialized     = true;
        toast.success(`Welcome, ${action.payload.firstName}! Account created.`);
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
        toast.error(action.payload);
      });

    // ── Sign In ──────────────────────────────────────────────────────────────
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading         = false;
        state.user            = action.payload;
        state.isAuthenticated = true;
        state.initialized     = true;
        toast.success(`Welcome back, ${action.payload.firstName}!`);
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
        toast.error(action.payload);
      });

    // ── Sign Out ─────────────────────────────────────────────────────────────
    builder
      .addCase(signOut.fulfilled, (state) => {
        state.user            = null;
        state.isAuthenticated = false;
        state.loading         = false;
        toast.success('Logged out successfully');
      })
      .addCase(signOut.rejected, (_, action) => {
        toast.error(action.payload);
      });

    // ── Get Me (app init probe) ──────────────────────────────────────────────
    // This runs ONCE on every page load to rehydrate session from httpOnly cookie.
    // Both fulfilled AND rejected MUST set initialized: true — otherwise the
    // spinner never clears and the app is stuck.
    // After either settles, we also tell the API interceptor it's safe to do
    // 401 redirects for real protected calls going forward.
    builder
      .addCase(getMe.pending, (state) => {
        state.loading = true;
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.loading         = false;
        state.initialized     = true;     // ✅ unblock routing
        state.user            = action.payload;
        state.isAuthenticated = true;
        setAppInitialized();              // ✅ allow 401 redirects from now on
      })
      .addCase(getMe.rejected, (state) => {
        state.loading         = false;
        state.initialized     = true;     // ✅ unblock routing (not logged in is fine)
        state.user            = null;
        state.isAuthenticated = false;
        setAppInitialized();              // ✅ allow 401 redirects from now on
      });
  },
});

export const { clearError, setUser } = authSlice.actions;

export const selectUser             = (state) => state.auth.user;
export const selectIsAuthenticated  = (state) => state.auth.isAuthenticated;
export const selectAuthLoading      = (state) => state.auth.loading;
export const selectAuthError        = (state) => state.auth.error;
export const selectInitialized      = (state) => state.auth.initialized;
export const selectUserRole         = (state) => state.auth.user?.role;

export default authSlice.reducer;