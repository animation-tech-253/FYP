// src/store/slices/applicationsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { applicationAPI, examinerAPI } from '../../services/api';
import toast from 'react-hot-toast';

export const bulkProcessApplications = createAsyncThunk(
  'applications/bulkProcess',
  async (data, { rejectWithValue }) => {
    try {
      const res = await examinerAPI.bulkProcess(data);
      const { succeeded, failed } = res.data.data;
      toast.success(`${succeeded.length} application(s) ${data.action === 'verified' ? 'verified' : 'rejected'}.${failed.length > 0 ? ` ${failed.length} failed.` : ''}`);
      return res.data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk action failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchMyApplications = createAsyncThunk(
  'applications/fetchMy',
  async (_, { rejectWithValue }) => {
    try { return (await applicationAPI.getMyApplications()).data.data; }
    catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchReviewApplications = createAsyncThunk(
  'applications/fetchReview',
  async (_, { rejectWithValue }) => {
    try { return (await applicationAPI.getForReview()).data.data; }
    catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchAllApplicationsAdmin = createAsyncThunk(
  'applications/fetchAdmin',
  async (params, { rejectWithValue }) => {
    try { return (await applicationAPI.getAllAdmin(params)).data.data; }
    catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchApplicationById = createAsyncThunk(
  'applications/fetchById',
  async (id, { rejectWithValue }) => {
    try { return (await applicationAPI.getById(id)).data.data; }
    catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const submitApplication = createAsyncThunk(
  'applications/submit',
  async (data, { rejectWithValue }) => {
    try {
      const res = await applicationAPI.submit(data);
      toast.success('Application submitted successfully!');
      return res.data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const processApplication = createAsyncThunk(
  'applications/process',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await applicationAPI.process(id, data);
      const label = {
        approved:     'Application approved',
        rejected:     'Application rejected',
        forwarded:    'Application forwarded',
        verified:     'Application verified — HOD notified for final approval',
        request_docs: 'Document request sent to student',
      }[data.action] || `Application ${data.action}`;
      toast.success(label);
      return res.data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const resolveDocumentRequest = createAsyncThunk(
  'applications/resolveDocs',
  async (applicationId, { rejectWithValue }) => {
    try {
      await applicationAPI.resolveDocumentRequest(applicationId);
      toast.success('Documents submitted. Examiner has been notified.');
      return applicationId;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit documents');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Examiner: server-side filtered dashboard
// params: { search, department, applicationType, isUrgent }
export const fetchExaminerDashboard = createAsyncThunk(
  'applications/fetchExaminerDashboard',
  async (params = {}, { rejectWithValue }) => {
    try { return (await examinerAPI.getDashboard(params)).data.data; }
    catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

// Examiner: full server-side analytics aggregations
export const fetchExaminerAnalytics = createAsyncThunk(
  'applications/fetchExaminerAnalytics',
  async (_, { rejectWithValue }) => {
    try { return (await examinerAPI.getAnalytics()).data.data; }
    catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const applicationsSlice = createSlice({
  name: 'applications',
  initialState: {
    myApplications:     [],
    reviewApplications: [],
    adminApplications:  [],
    currentApplication: null,

    examiner: {
      // Dashboard queues
      pendingVerification: [],
      awaitingDocs:        [],
      recentlyVerified:    [],
      pendingCount:        0,
      urgentCount:         0,
      awaitingDocCount:    0,
      totalVerifiedCount:  0,
      loading:             false,

      // Analytics (from separate /examiner/analytics endpoint)
      analytics: null,        // null = not fetched yet
      analyticsLoading: false,
    },

    // Admin real-time application event stream
    adminAppStream: [],

    loading:        false,
    submitLoading:  false,
    processLoading: false,
    error:          null,
    filters: { status: '', department: '', applicationType: '' },
  },

  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentApplication: (state) => { state.currentApplication = null; },
    clearErrors:             (state) => { state.error = null; },

    // Real-time patch for any list
    updateApplicationInList: (state, action) => {
      const updated = action.payload;
      const patch   = (arr) => { const i = arr.findIndex(a => a._id === updated._id); if (i !== -1) arr[i] = { ...arr[i], ...updated }; };
      patch(state.myApplications);
      patch(state.reviewApplications);
      patch(state.adminApplications);
      if (state.currentApplication?._id === updated._id) state.currentApplication = { ...state.currentApplication, ...updated };
    },

    // Add to HOD/staff review queue from socket
    addApplicationToReview: (state, action) => {
      const exists = state.reviewApplications.find(a => a._id === action.payload._id);
      if (!exists) state.reviewApplications.unshift(action.payload);
    },

    // Mark app as verified in HOD's review list (from socket: application_verified_returned)
    markApplicationVerifiedInList: (state, action) => {
      const { applicationId, academicVerification } = action.payload;
      const patch = (arr) => {
        const i = arr.findIndex(a => a._id === applicationId);
        if (i !== -1) {
          arr[i].academicVerification  = academicVerification;
          arr[i].awaitingFinalApproval = true;
          arr[i].needsExaminerFirst    = false;
          arr[i].status                = 'forwarded';
        }
      };
      patch(state.reviewApplications);
      patch(state.adminApplications);
      if (state.currentApplication?._id === applicationId) {
        state.currentApplication.academicVerification  = academicVerification;
        state.currentApplication.awaitingFinalApproval = true;
      }
    },

    // Remove from examiner awaiting-docs list when student resolves
    markDocRequestResolved: (state, action) => {
      const id = action.payload;
      state.examiner.awaitingDocs    = state.examiner.awaitingDocs.filter(a => a._id !== id);
      state.examiner.awaitingDocCount = Math.max(0, state.examiner.awaitingDocCount - 1);
    },

    // Invalidate cached analytics so next tab visit re-fetches
    invalidateAnalytics: (state) => { state.examiner.analytics = null; },

    // Admin application stream
    addAdminAppStreamEntry: (state, action) => {
      state.adminAppStream.unshift(action.payload);
      if (state.adminAppStream.length > 100) state.adminAppStream = state.adminAppStream.slice(0, 100);
    },
    clearAdminAppStream: (state) => { state.adminAppStream = []; },
  },

  extraReducers: (builder) => {
    const pending  = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchMyApplications.pending,   pending)
      .addCase(fetchMyApplications.fulfilled, (state, a) => { state.loading = false; state.myApplications = a.payload; })
      .addCase(fetchMyApplications.rejected,  rejected)

      .addCase(fetchReviewApplications.pending,   pending)
      .addCase(fetchReviewApplications.fulfilled, (state, a) => { state.loading = false; state.reviewApplications = a.payload; })
      .addCase(fetchReviewApplications.rejected,  rejected)

      .addCase(fetchAllApplicationsAdmin.pending,   pending)
      .addCase(fetchAllApplicationsAdmin.fulfilled, (state, a) => { state.loading = false; state.adminApplications = a.payload; })
      .addCase(fetchAllApplicationsAdmin.rejected,  rejected)

      .addCase(fetchApplicationById.pending,   pending)
      .addCase(fetchApplicationById.fulfilled, (state, a) => { state.loading = false; state.currentApplication = a.payload; })
      .addCase(fetchApplicationById.rejected,  rejected)

      .addCase(submitApplication.pending,   (state) => { state.submitLoading = true; })
      .addCase(submitApplication.fulfilled, (state, a) => { state.submitLoading = false; state.myApplications.unshift(a.payload); })
      .addCase(submitApplication.rejected,  (state) => { state.submitLoading = false; })

      .addCase(processApplication.pending,   (state) => { state.processLoading = true; })
      .addCase(processApplication.fulfilled, (state, a) => {
        state.processLoading = false;
        const updated = a.payload;
        const i = state.reviewApplications.findIndex(a => a._id === updated._id);
        if (i !== -1) state.reviewApplications.splice(i, 1);
        const adminI = state.adminApplications.findIndex(a => a._id === updated._id);
        if (adminI !== -1) state.adminApplications[adminI] = updated;
        const myI = state.myApplications.findIndex(a => a._id === updated._id);
        if (myI !== -1) state.myApplications[myI] = updated;
        if (state.currentApplication?._id === updated._id) state.currentApplication = updated;
        state.examiner.pendingVerification = state.examiner.pendingVerification.filter(a => a._id !== updated._id);
        if (updated.status === 'approved' || updated.status === 'rejected') {
          state.examiner.pendingCount = Math.max(0, state.examiner.pendingCount - 1);
        }
        // Analytics stale after any examiner action
        state.examiner.analytics = null;
      })
      .addCase(processApplication.rejected, (state, a) => { state.processLoading = false; state.error = a.payload; })

      .addCase(bulkProcessApplications.pending,   (state) => { state.processLoading = true; })
      .addCase(bulkProcessApplications.fulfilled, (state, a) => {
        state.processLoading = false;
        const succeededIds = (a.payload.succeeded || []).map(s => s.id);
        state.examiner.pendingVerification = state.examiner.pendingVerification.filter(app => !succeededIds.includes(app._id));
        state.examiner.pendingCount = Math.max(0, state.examiner.pendingCount - succeededIds.length);
        state.examiner.analytics = null;
      })
      .addCase(bulkProcessApplications.rejected, (state) => { state.processLoading = false; })

      .addCase(resolveDocumentRequest.fulfilled, (state, a) => {
        const id = a.payload;
        const i = state.myApplications.findIndex(a => a._id === id);
        if (i !== -1) state.myApplications[i].hasPendingDocRequest = false;
      })

      // Examiner dashboard
      .addCase(fetchExaminerDashboard.pending,   (state) => { state.examiner.loading = true; })
      .addCase(fetchExaminerDashboard.fulfilled, (state, a) => {
        state.examiner.loading              = false;
        state.examiner.pendingVerification  = a.payload.pendingVerification  || [];
        state.examiner.awaitingDocs         = a.payload.awaitingDocs         || [];
        state.examiner.recentlyVerified     = a.payload.recentlyVerified     || [];
        state.examiner.pendingCount         = a.payload.pendingCount         || 0;
        state.examiner.urgentCount          = a.payload.urgentCount          || 0;
        state.examiner.awaitingDocCount     = a.payload.awaitingDocCount     || 0;
        state.examiner.totalVerifiedCount   = a.payload.totalVerifiedCount   || 0;
      })
      .addCase(fetchExaminerDashboard.rejected,  (state) => { state.examiner.loading = false; })

      // Examiner analytics
      .addCase(fetchExaminerAnalytics.pending,   (state) => { state.examiner.analyticsLoading = true; })
      .addCase(fetchExaminerAnalytics.fulfilled, (state, a) => { state.examiner.analyticsLoading = false; state.examiner.analytics = a.payload; })
      .addCase(fetchExaminerAnalytics.rejected,  (state) => { state.examiner.analyticsLoading = false; });
  },
});

export const {
  setFilters,
  clearCurrentApplication,
  clearErrors,
  updateApplicationInList,
  addApplicationToReview,
  markApplicationVerifiedInList,
  markDocRequestResolved,
  invalidateAnalytics,
  addAdminAppStreamEntry,
  clearAdminAppStream,
} = applicationsSlice.actions;

// Selectors
export const selectMyApplications       = (s) => s.applications.myApplications;
export const selectReviewApplications   = (s) => s.applications.reviewApplications;
export const selectAdminApplications    = (s) => s.applications.adminApplications;
export const selectCurrentApplication   = (s) => s.applications.currentApplication;
export const selectApplicationsLoading  = (s) => s.applications.loading;
export const selectSubmitLoading        = (s) => s.applications.submitLoading;
export const selectProcessLoading       = (s) => s.applications.processLoading;
export const selectApplicationError     = (s) => s.applications.error;
export const selectFilters              = (s) => s.applications.filters;

// Examiner selectors
export const selectExaminerData           = (s) => s.applications.examiner;
export const selectExaminerPending        = (s) => s.applications.examiner.pendingVerification;
export const selectExaminerAwaitingDocs   = (s) => s.applications.examiner.awaitingDocs;
export const selectExaminerVerified       = (s) => s.applications.examiner.recentlyVerified;
export const selectExaminerLoading        = (s) => s.applications.examiner.loading;
export const selectExaminerAnalytics      = (s) => s.applications.examiner.analytics;
export const selectExaminerAnalyticsLoading = (s) => s.applications.examiner.analyticsLoading;

// Admin stream
export const selectAdminAppStream       = (s) => s.applications.adminAppStream;

export default applicationsSlice.reducer;