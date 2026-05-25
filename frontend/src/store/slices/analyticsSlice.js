// import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// import { analyticsAPI } from '../../services/api';

// export const fetchAnalytics = createAsyncThunk(
//   'analytics/fetchDashboard',
//   async (_, { rejectWithValue }) => {
//     try {
//       const res = await analyticsAPI.getDashboard();
//       return res.data.data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || 'Failed to fetch analytics');
//     }
//   }
// );

// const analyticsSlice = createSlice({
//   name: 'analytics',
//   initialState: {
//     totalApplications: 0,
//     totalUsers:        0,
//     statusBreakdown:   [],
//     typeBreakdown:     [],
//     topDepartments:    [],
//     loading:           false,
//     error:             null,
//     lastFetched:       null,
//   },
//   reducers: {
//     clearAnalytics: (state) => {
//       state.totalApplications = 0;
//       state.totalUsers        = 0;
//       state.statusBreakdown   = [];
//       state.typeBreakdown     = [];
//       state.topDepartments    = [];
//       state.error             = null;
//     },
//   },
//   extraReducers: (builder) => {
//     builder
//       .addCase(fetchAnalytics.pending,   (state) => {
//         state.loading = true;
//         state.error   = null;
//       })
//       .addCase(fetchAnalytics.fulfilled, (state, action) => {
//         state.loading           = false;
//         state.totalApplications = action.payload.totalApplications;
//         state.totalUsers        = action.payload.totalUsers;
//         state.statusBreakdown   = action.payload.statusBreakdown;
//         state.typeBreakdown     = action.payload.typeBreakdown;
//         state.topDepartments    = action.payload.topDepartments;
//         state.lastFetched       = new Date().toISOString();
//       })
//       .addCase(fetchAnalytics.rejected,  (state, action) => {
//         state.loading = false;
//         state.error   = action.payload;
//       });
//   },
// });

// export const { clearAnalytics } = analyticsSlice.actions;

// export const selectAnalytics        = (state) => state.analytics;
// export const selectAnalyticsLoading = (state) => state.analytics.loading;
// export const selectAnalyticsError   = (state) => state.analytics.error;
// export const selectStatusBreakdown  = (state) => state.analytics.statusBreakdown;
// export const selectTypeBreakdown    = (state) => state.analytics.typeBreakdown;
// export const selectTopDepartments   = (state) => state.analytics.topDepartments;

// export default analyticsSlice.reducer;