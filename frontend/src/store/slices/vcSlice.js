// src/store/slices/vcSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { vcAPI } from '../../services/api';

// ══════════════════════════════════════════════════════════════════════════════
// THUNKS — one per VC endpoint
// ══════════════════════════════════════════════════════════════════════════════

// Tab 1: VC's personal inbox
export const fetchVCPersonal = createAsyncThunk(
  'vc/fetchPersonal',
  async (_, { rejectWithValue }) => {
    try {
      const res = await vcAPI.getPersonal();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load inbox');
    }
  }
);

// Tab 2: University-wide overview
export const fetchVCUniversity = createAsyncThunk(
  'vc/fetchUniversity',
  async (_, { rejectWithValue }) => {
    try {
      const res = await vcAPI.getUniversity();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load university overview');
    }
  }
);

// Tab 3: Drill into a specific department
export const fetchVCDepartment = createAsyncThunk(
  'vc/fetchDepartment',
  async (departmentId, { rejectWithValue }) => {
    try {
      const res = await vcAPI.getDepartment(departmentId);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load department');
    }
  }
);

// Browse all applications (filterable list)
export const fetchVCAllApplications = createAsyncThunk(
  'vc/fetchAllApplications',
  async (params, { rejectWithValue }) => {
    try {
      const res = await vcAPI.getAllApplications(params);
      return res.data;  // { data, pagination }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load applications');
    }
  }
);

// View a single application
export const fetchVCApplicationById = createAsyncThunk(
  'vc/fetchApplicationById',
  async (id, { rejectWithValue }) => {
    try {
      const res = await vcAPI.getApplicationById(id);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load application');
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// SLICE
// ══════════════════════════════════════════════════════════════════════════════

const vcSlice = createSlice({
  name: 'vc',
  initialState: {

    // ── Tab 1: Personal inbox ──────────────────────────────────────────────
    inbox: {
      all:            [],   // all pending apps assigned to VC
      urgent:         [],   // subset that are urgent
      totalCount:     0,
      urgentCount:    0,
      forwardedCount: 0,
    },
    myStats:          {},   // VC's own lifetime action stats
    recentlyActioned: [],   // last 15 apps VC acted on

    // ── Tab 2: University overview ─────────────────────────────────────────
    totals: {
      total: 0, pending: 0, approved: 0, rejected: 0, completed: 0, urgent: 0,
    },
    byDepartment:              [],  // per-dept breakdown, sorted by pending desc
    byType:                    [],
    byStatus:                  [],
    urgentPending:             [],  // university-wide urgent pending
    recentApplications:        [],  // 10 most recent
    examinationOfficerWorkload:[],  // exam officers surfaced separately (no dept)
    roleBreakdown:             [],  // user count by role
    myPendingCount:            0,

    // ── Tab 3: Department drill-down ───────────────────────────────────────
    selectedDepartment: null,  // full department detail (populated, HOD, chairperson)

    // ── Application list (browse all) ─────────────────────────────────────
    applications: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },

    // ── Single application view ────────────────────────────────────────────
    currentApplication: null,  // includes history[] and isCurrentRecipient flag

    // ── Loading states — one per tab so tabs don't block each other ────────
    personalLoading:    false,
    universityLoading:  false,
    departmentLoading:  false,
    applicationsLoading:false,
    applicationLoading: false,

    error: null,
  },

  reducers: {
    clearVCError: (state) => { state.error = null; },

    clearSelectedDepartment: (state) => { state.selectedDepartment = null; },

    clearCurrentApplication: (state) => { state.currentApplication = null; },

    // Called by useSocket when a new application lands in VC's inbox
    addToVCInbox: (state, action) => {
      const app = action.payload;
      const exists = state.inbox.all.find(a => a._id === app._id);
      if (!exists) {
        state.inbox.all.unshift(app);
        state.inbox.totalCount += 1;
        if (app.isUrgent) {
          state.inbox.urgent.unshift(app);
          state.inbox.urgentCount += 1;
        }
        state.myPendingCount += 1;
      }
    },

    // Called by useSocket when VC processes an app (remove from inbox)
    removeFromVCInbox: (state, action) => {
      const id = action.payload;
      const wasUrgent = state.inbox.urgent.some(a => a._id === id);
      state.inbox.all     = state.inbox.all.filter(a => a._id !== id);
      state.inbox.urgent  = state.inbox.urgent.filter(a => a._id !== id);
      state.inbox.totalCount  = Math.max(0, state.inbox.totalCount - 1);
      if (wasUrgent) state.inbox.urgentCount = Math.max(0, state.inbox.urgentCount - 1);
      state.myPendingCount = Math.max(0, state.myPendingCount - 1);
    },
  },

  extraReducers: (builder) => {

    // ── fetchVCPersonal ────────────────────────────────────────────────────
    builder
      .addCase(fetchVCPersonal.pending, (state) => {
        state.personalLoading = true;
        state.error = null;
      })
      .addCase(fetchVCPersonal.fulfilled, (state, action) => {
        state.personalLoading    = false;
        state.inbox              = action.payload.inbox;
        state.myStats            = action.payload.myStats;
        state.recentlyActioned   = action.payload.recentlyActioned;
      })
      .addCase(fetchVCPersonal.rejected, (state, action) => {
        state.personalLoading = false;
        state.error           = action.payload;
      });

    // ── fetchVCUniversity ─────────────────────────────────────────────────
    builder
      .addCase(fetchVCUniversity.pending, (state) => {
        state.universityLoading = true;
        state.error = null;
      })
      .addCase(fetchVCUniversity.fulfilled, (state, action) => {
        state.universityLoading             = false;
        state.totals                        = action.payload.totals;
        state.byDepartment                  = action.payload.byDepartment;
        state.byType                        = action.payload.byType;
        state.byStatus                      = action.payload.byStatus;
        state.urgentPending                 = action.payload.urgentPending;
        state.recentApplications            = action.payload.recentApplications;
        state.examinationOfficerWorkload    = action.payload.examinationOfficerWorkload;
        state.roleBreakdown                 = action.payload.roleBreakdown;
        state.myPendingCount                = action.payload.myPendingCount;
      })
      .addCase(fetchVCUniversity.rejected, (state, action) => {
        state.universityLoading = false;
        state.error             = action.payload;
      });

    // ── fetchVCDepartment ─────────────────────────────────────────────────
    builder
      .addCase(fetchVCDepartment.pending, (state) => {
        state.departmentLoading = true;
        state.error = null;
      })
      .addCase(fetchVCDepartment.fulfilled, (state, action) => {
        state.departmentLoading  = false;
        state.selectedDepartment = action.payload;
      })
      .addCase(fetchVCDepartment.rejected, (state, action) => {
        state.departmentLoading = false;
        state.error             = action.payload;
      });

    // ── fetchVCAllApplications ────────────────────────────────────────────
    builder
      .addCase(fetchVCAllApplications.pending, (state) => {
        state.applicationsLoading = true;
        state.error = null;
      })
      .addCase(fetchVCAllApplications.fulfilled, (state, action) => {
        state.applicationsLoading = false;
        state.applications        = action.payload.data;
        state.pagination          = action.payload.pagination;
      })
      .addCase(fetchVCAllApplications.rejected, (state, action) => {
        state.applicationsLoading = false;
        state.error               = action.payload;
      });

    // ── fetchVCApplicationById ────────────────────────────────────────────
    builder
      .addCase(fetchVCApplicationById.pending, (state) => {
        state.applicationLoading = true;
        state.error = null;
      })
      .addCase(fetchVCApplicationById.fulfilled, (state, action) => {
        state.applicationLoading = false;
        state.currentApplication = action.payload;
      })
      .addCase(fetchVCApplicationById.rejected, (state, action) => {
        state.applicationLoading = false;
        state.error              = action.payload;
      });
  },
});

export const {
  clearVCError,
  clearSelectedDepartment,
  clearCurrentApplication,
  addToVCInbox,
  removeFromVCInbox,
} = vcSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────

// Personal inbox
export const selectVCInbox             = (state) => state.vc.inbox;
export const selectVCMyStats           = (state) => state.vc.myStats;
export const selectVCRecentlyActioned  = (state) => state.vc.recentlyActioned;
export const selectVCPersonalLoading   = (state) => state.vc.personalLoading;

// University overview
export const selectVCTotals                     = (state) => state.vc.totals;
export const selectVCByDepartment               = (state) => state.vc.byDepartment;
export const selectVCByType                     = (state) => state.vc.byType;
export const selectVCByStatus                   = (state) => state.vc.byStatus;
export const selectVCUrgentPending              = (state) => state.vc.urgentPending;
export const selectVCRecentApplications         = (state) => state.vc.recentApplications;
export const selectVCExamOfficerWorkload        = (state) => state.vc.examinationOfficerWorkload;
export const selectVCRoleBreakdown              = (state) => state.vc.roleBreakdown;
export const selectVCMyPendingCount             = (state) => state.vc.myPendingCount;
export const selectVCUniversityLoading          = (state) => state.vc.universityLoading;

// Department drill-down
export const selectVCSelectedDepartment = (state) => state.vc.selectedDepartment;
export const selectVCDepartmentLoading  = (state) => state.vc.departmentLoading;

// Application list
export const selectVCApplications        = (state) => state.vc.applications;
export const selectVCPagination          = (state) => state.vc.pagination;
export const selectVCApplicationsLoading = (state) => state.vc.applicationsLoading;

// Single application
export const selectVCCurrentApplication = (state) => state.vc.currentApplication;
export const selectVCApplicationLoading = (state) => state.vc.applicationLoading;

// Generic
export const selectVCError = (state) => state.vc.error;

export default vcSlice.reducer;