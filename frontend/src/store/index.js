import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import applicationsReducer from './slices/applicationsSlice';
import notificationsReducer from './slices/notificationsSlice';
import uiReducer from './slices/uiSlice';
import usersReducer from './slices/UserSlice';
// import analyticsReducer from './slices/analyticsSlice';
import vcReducer           from './slices/vcSlice';
import activityLogReducer  from './slices/activityLogSlice';
import adminReducer        from './slices/AdminSlice';
import settingsReducer     from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    applications: applicationsReducer,
    notifications: notificationsReducer,
    ui: uiReducer,
    users: usersReducer,
    // analytics:analyticsReducer,
    vc:vcReducer,
    activityLog:activityLogReducer,
    admin:adminReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export default store;
