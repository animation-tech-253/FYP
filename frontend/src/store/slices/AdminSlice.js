// src/store/slices/adminSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { adminAPI } from '../../services/api';

export const fetchAdminOverview = createAsyncThunk(
  'admin/fetchOverview',
  async (_, { rejectWithValue }) => {
    try {
      const res = await adminAPI.getOverview();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load overview');
    }
  }
);

export const fetchAdminNoDeptRoles = createAsyncThunk(
  'admin/fetchNoDeptRoles',
  async (_, { rejectWithValue }) => {
    try {
      const res = await adminAPI.getNoDeptRoles();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load role data');
    }
  }
);

export const fetchAdminDepartment = createAsyncThunk(
  'admin/fetchDepartment',
  async (departmentId, { rejectWithValue }) => {
    try {
      const res = await adminAPI.getDepartment(departmentId);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load department');
    }
  }
);

export const fetchAdminAllApplications = createAsyncThunk(
  'admin/fetchAllApplications',
  async (params, { rejectWithValue }) => {
    try {
      const res = await adminAPI.getAllApplications(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load applications');
    }
  }
);

export const fetchAdminApplicationById = createAsyncThunk(
  'admin/fetchApplicationById',
  async (id, { rejectWithValue }) => {
    try {
      const res = await adminAPI.getApplicationById(id);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load application');
    }
  }
);

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    totals: {
      total: 0, pending: 0, approved: 0, rejected: 0,
      completed: 0, urgent: 0, avgProcessingDays: null,
    },
    byDepartment:       [],
    byType:             [],
    byStatus:           [],
    urgentPending:      [],
    recentApplications: [],
    userStats:          [],
    departmentList:     [],

    // Separate keys for VC and ExamOfficers in overview
    vcWorkload:          [],
    examinationOfficers: [],
    noDeptRoleWorkload:  [],   // combined fallback

    // Detail view (from /no-dept-roles)
    vcList:          [],
    examOfficerList: [],

    selectedDepartment:  null,
    applications:        [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    currentApplication:  null,

    overviewLoading:     false,
    noDeptLoading:       false,
    departmentLoading:   false,
    applicationsLoading: false,
    applicationLoading:  false,

    error:       null,
    lastFetched: null,
  },

  reducers: {
    clearAdminError:         (state) => { state.error = null; },
    clearSelectedDepartment: (state) => { state.selectedDepartment = null; },
    clearCurrentApplication: (state) => { state.currentApplication = null; },
    incrementPendingCount:   (state) => {
      state.totals.total   += 1;
      state.totals.pending += 1;
    },
  },

  extraReducers: (builder) => {

    builder
      .addCase(fetchAdminOverview.pending, (state) => {
        state.overviewLoading = true; state.error = null;
      })
      .addCase(fetchAdminOverview.fulfilled, (state, action) => {
        const p = action.payload;
        state.overviewLoading    = false;
        state.totals             = p.totals;
        state.byDepartment       = p.byDepartment;
        state.byType             = p.byType;
        state.byStatus           = p.byStatus;
        state.urgentPending      = p.urgentPending;
        state.recentApplications = p.recentApplications;
        state.userStats          = p.userStats;
        state.departmentList     = p.departmentList;
        state.vcWorkload          = p.vcWorkload          || [];
        state.examinationOfficers = p.examinationOfficers || [];
        state.noDeptRoleWorkload  = p.noDeptRoleWorkload  || [];
        state.lastFetched         = new Date().toISOString();
      })
      .addCase(fetchAdminOverview.rejected, (state, action) => {
        state.overviewLoading = false; state.error = action.payload;
      });

    builder
      .addCase(fetchAdminNoDeptRoles.pending, (state) => {
        state.noDeptLoading = true; state.error = null;
      })
      .addCase(fetchAdminNoDeptRoles.fulfilled, (state, action) => {
        state.noDeptLoading   = false;
        state.vcList          = action.payload.vcList          || [];
        state.examOfficerList = action.payload.examOfficerList || [];
      })
      .addCase(fetchAdminNoDeptRoles.rejected, (state, action) => {
        state.noDeptLoading = false; state.error = action.payload;
      });

    builder
      .addCase(fetchAdminDepartment.pending, (state) => {
        state.departmentLoading = true; state.error = null;
      })
      .addCase(fetchAdminDepartment.fulfilled, (state, action) => {
        state.departmentLoading  = false;
        state.selectedDepartment = action.payload;
      })
      .addCase(fetchAdminDepartment.rejected, (state, action) => {
        state.departmentLoading = false; state.error = action.payload;
      });

    builder
      .addCase(fetchAdminAllApplications.pending, (state) => {
        state.applicationsLoading = true; state.error = null;
      })
      .addCase(fetchAdminAllApplications.fulfilled, (state, action) => {
        state.applicationsLoading = false;
        state.applications        = action.payload.data;
        state.pagination          = action.payload.pagination;
      })
      .addCase(fetchAdminAllApplications.rejected, (state, action) => {
        state.applicationsLoading = false; state.error = action.payload;
      });

    builder
      .addCase(fetchAdminApplicationById.pending, (state) => {
        state.applicationLoading = true; state.error = null;
      })
      .addCase(fetchAdminApplicationById.fulfilled, (state, action) => {
        state.applicationLoading = false;
        state.currentApplication = action.payload;
      })
      .addCase(fetchAdminApplicationById.rejected, (state, action) => {
        state.applicationLoading = false; state.error = action.payload;
      });
  },
});

export const {
  clearAdminError, clearSelectedDepartment, clearCurrentApplication, incrementPendingCount,
} = adminSlice.actions;

export const selectAdminTotals             = (s) => s.admin.totals;
export const selectAdminByDepartment       = (s) => s.admin.byDepartment;
export const selectAdminByType             = (s) => s.admin.byType;
export const selectAdminByStatus           = (s) => s.admin.byStatus;
export const selectAdminUrgentPending      = (s) => s.admin.urgentPending;
export const selectAdminRecentApplications = (s) => s.admin.recentApplications;
export const selectAdminUserStats          = (s) => s.admin.userStats;
export const selectAdminDepartmentList     = (s) => s.admin.departmentList;
export const selectAdminOverviewLoading    = (s) => s.admin.overviewLoading;
export const selectAdminLastFetched        = (s) => s.admin.lastFetched;
export const selectAdminVCWorkload         = (s) => s.admin.vcWorkload;
export const selectAdminExamOfficers       = (s) => s.admin.examinationOfficers;
export const selectAdminNoDeptWorkload     = (s) => s.admin.noDeptRoleWorkload;
export const selectAdminVCList             = (s) => s.admin.vcList;
export const selectAdminExamOfficerList    = (s) => s.admin.examOfficerList;
export const selectAdminNoDeptLoading      = (s) => s.admin.noDeptLoading;
export const selectAdminSelectedDepartment = (s) => s.admin.selectedDepartment;
export const selectAdminDepartmentLoading  = (s) => s.admin.departmentLoading;
export const selectAdminApplications       = (s) => s.admin.applications;
export const selectAdminPagination         = (s) => s.admin.pagination;
export const selectAdminApplicationsLoading= (s) => s.admin.applicationsLoading;
export const selectAdminCurrentApplication = (s) => s.admin.currentApplication;
export const selectAdminApplicationLoading = (s) => s.admin.applicationLoading;
export const selectAdminError              = (s) => s.admin.error;

export default adminSlice.reducer;