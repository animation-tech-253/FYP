// src/App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { getMe } from './store/slices/authSlice';
import { selectInitialized, selectIsAuthenticated } from './store/slices/authSlice';
import { useSocket } from './hooks/useSocket';
import { getDashboardPath } from './utils/routeHelpers';
import { fetchSettings, selectAiChatbotEnabled } from './store/slices/settingsSlice';
import { setChatbotOpen } from './store/slices/uiSlice';

// Layouts
import AppLayout from './layouts/AppLayout';

// Guards
import {
  ProtectedRoute,
  PublicRoute,
  RoleRoute,
  StudentOnlyRoute,
} from './components/common/ProtectedRoute';

// Auth Pages
import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Student Pages
import StudentDashboard      from './pages/student/StudentDashboard';
import SubmitApplicationPage from './pages/student/SubmitApplicationPage';
import MyApplicationsPage    from './pages/student/MyApplicationsPage';
import ApplicationDetailPage from './pages/student/Applicationdetailpage';

// Staff Pages
import StaffDashboard from './pages/staff/StaffDashboard';

// HOD Pages
import HODDashboard        from './pages/hod/HODDashboard';
import HODApplicationsPage from './pages/hod/HODApplicationsPage';
import HODStaffPage        from './pages/hod/HODStaffPage';
import HODReviewPage       from './pages/hod/HODReviewPage';

// VC Pages
import VCDashboard      from './pages/vc/VCDashboard';
import VCUniversityPage from './pages/vc/VCUniversityPage';

// Examiner Pages
import ExaminerDashboard     from './pages/examiner/ExaminerDashboard';
import ExaminerAnalyticsPage from './pages/examiner/ExaminerAnalyticsPage';

// Admin Pages
import AdminDashboard        from './pages/admin/AdminDashboard';
import ManageUsersPage       from './pages/admin/ManageUsersPage';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage';
import DepartmentsPage       from './pages/admin/DepartmentsPage';
import AdminSettingsPage     from './pages/admin/AdminSettingsPage';
import AdminActivityPage     from './pages/admin/AdminActivityPage';

// Shared Pages
import NotificationsPage from './pages/NotificationsPage';
import UnauthorizedPage  from './pages/UnauthorizedPage';
import ProfilePage       from './pages/Profilepage';

// Chatbot
import ChatbotWidget from './components/chatbot/ChatbotWidget';

const STAFF_ROLES = ['staff', 'hod', 'chairperson', 'vc', 'examination_officer'];

const RootRedirect = () => {
  const initialized     = useSelector(selectInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user            = useSelector((state) => state.auth.user);

  if (!initialized) return null;
  if (isAuthenticated && user) return <Navigate to={getDashboardPath(user.role)} replace />;
  return <Navigate to="/login" replace />;
};

function AppContent() {
  const dispatch        = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const chatbotEnabled  = useSelector(selectAiChatbotEnabled);
  useSocket();

  useEffect(() => { dispatch(getMe()); }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchSettings());
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    if (!chatbotEnabled) dispatch(setChatbotOpen(false));
  }, [chatbotEnabled, dispatch]);

  return (
    <>
      <Routes>
        {/* ── Public ───────────────────────────────────────────────── */}
        <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register"        element={<StudentOnlyRoute><RegisterPage /></StudentOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/unauthorized"    element={<UnauthorizedPage />} />

        {/* ── Protected App Shell ──────────────────────────────────── */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>

          <Route index element={<RootRedirect />} />

          {/* Shared */}
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile"       element={<ProfilePage />} />

          {/* Student */}
          <Route path="student/dashboard"        element={<RoleRoute allowedRoles={['student']}><StudentDashboard /></RoleRoute>} />
          <Route path="student/applications"     element={<RoleRoute allowedRoles={['student']}><MyApplicationsPage /></RoleRoute>} />
          <Route path="student/submit"           element={<RoleRoute allowedRoles={['student']}><SubmitApplicationPage /></RoleRoute>} />
          <Route path="student/applications/:id" element={<RoleRoute allowedRoles={['student']}><ApplicationDetailPage /></RoleRoute>} />

          {/* HOD */}
          <Route path="hod/dashboard"    element={<RoleRoute allowedRoles={['hod']}><HODDashboard /></RoleRoute>} />
          <Route path="hod/applications" element={<RoleRoute allowedRoles={['hod']}><HODApplicationsPage /></RoleRoute>} />
          <Route path="hod/staff"        element={<RoleRoute allowedRoles={['hod']}><HODStaffPage /></RoleRoute>} />
          <Route path="hod/review"       element={<RoleRoute allowedRoles={['hod']}><HODReviewPage /></RoleRoute>} />

          {/* Staff + shared review roles */}
          <Route path="staff/dashboard" element={<RoleRoute allowedRoles={STAFF_ROLES}><StaffDashboard /></RoleRoute>} />
          <Route path="staff/review"    element={<RoleRoute allowedRoles={STAFF_ROLES}><StaffDashboard /></RoleRoute>} />

          {/* VC */}
          <Route path="vc/dashboard"  element={<RoleRoute allowedRoles={['vc']}><VCDashboard /></RoleRoute>} />
          <Route path="vc/university" element={<RoleRoute allowedRoles={['vc']}><VCUniversityPage /></RoleRoute>} />
          <Route path="vc/review"     element={<RoleRoute allowedRoles={['vc']}><StaffDashboard /></RoleRoute>} />

          {/* Examiner */}
          <Route path="examiner/dashboard" element={<RoleRoute allowedRoles={['examination_officer']}><ExaminerDashboard /></RoleRoute>} />
          <Route path="examiner/analytics" element={<RoleRoute allowedRoles={['examination_officer']}><ExaminerAnalyticsPage /></RoleRoute>} />

          {/* Admin */}
          <Route path="admin/dashboard"    element={<RoleRoute allowedRoles={['admin']}><AdminDashboard /></RoleRoute>} />
          <Route path="admin/applications" element={<RoleRoute allowedRoles={['admin']}><AdminApplicationsPage /></RoleRoute>} />
          <Route path="admin/users"        element={<RoleRoute allowedRoles={['admin']}><ManageUsersPage /></RoleRoute>} />
          <Route path="admin/departments"  element={<RoleRoute allowedRoles={['admin']}><DepartmentsPage /></RoleRoute>} />
          <Route path="admin/settings"     element={<RoleRoute allowedRoles={['admin']}><AdminSettingsPage /></RoleRoute>} />
          <Route path="admin/activity"     element={<RoleRoute allowedRoles={['admin']}><AdminActivityPage /></RoleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {chatbotEnabled && <ChatbotWidget />}

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1E293B',
            color: '#F8FAFC',
            border: '1px solid #334155',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: "'Inter', system-ui, sans-serif",
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          },
          success: { iconTheme: { primary: '#34D399', secondary: '#1E293B' } },
          error:   { iconTheme: { primary: '#F87171', secondary: '#1E293B' } },
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}