# SUATS Frontend

## Smart University Application & Tracking System

Built with **React 18**, **Redux Toolkit**, **Tailwind CSS**, **Socket.IO Client**, and **Recharts**.

---

## Project Structure

```
src/
├── components/
│   ├── common/         # ProtectedRoute, RoleRoute, PublicRoute
│   ├── notifications/  # NotificationBell (real-time)
│   └── chatbot/        # AI Chatbot floating widget
├── hooks/
│   └── useSocket.js    # Socket.IO integration
├── layouts/
│   └── AppLayout.jsx   # Sidebar + topbar shell
├── pages/
│   ├── auth/           # Login, Register, ForgotPassword
│   ├── student/        # Dashboard, My Applications, Submit
│   ├── staff/          # HOD/Chairperson/VC/Exam review dashboard
│   └── admin/          # Dashboard, Users, Applications, Depts, Settings
├── services/
│   ├── api.js          # Axios instance + all API calls
│   └── socket.js       # Socket.IO connection & event helpers
├── store/
│   ├── slices/
│   │   ├── authSlice.js          # Auth state (user, loading, errors)
│   │   ├── applicationsSlice.js  # All application states
│   │   ├── notificationsSlice.js # Real-time notifications
│   │   └── uiSlice.js            # Sidebar, chatbot, theme
│   └── index.js        # Redux store
└── utils/
    └── helpers.js      # Date formatting, status styles, labels
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and set your backend URL
cp .env.example .env

# 3. Start development server
npm start
```

---

## Authentication Flow

1. Cookie-based JWT — backend sets `httpOnly` cookie on login
2. On app load, `getMe()` thunk calls `GET /api/v1/users/me` — if cookie exists, user is restored
3. `PublicRoute` redirects authenticated users to their role dashboard
4. `ProtectedRoute` redirects unauthenticated users to `/login`
5. `RoleRoute` restricts pages by role — returns `/unauthorized` if role doesn't match

## Role Dashboards

| Role | Dashboard |
|------|-----------|
| `student` | `/student/dashboard` |
| `hod`, `chairperson`, `vc`, `examination_officer` | `/staff/dashboard` |
| `admin` | `/admin/dashboard` |

## Socket Events Handled

| Event | Action |
|-------|--------|
| `newApplication` | Adds to review list + notification |
| `applicationStatusUpdate` | Updates application in Redux + notification |
| `applicationForwarded` | Adds forwarded app to review queue |
| `settingsUpdated` | Toast notification to all users |

---

## Backend Compatibility

- Base URL: `http://localhost:5000/api/v1`
- Auth: Cookie-based JWT (`httpOnly`, `sameSite: strict`)
- Socket: Authenticate via `socket.emit('authenticate', token)`
