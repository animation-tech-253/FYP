// src/utils/routeHelpers.js
export const getDashboardPath = (role) => {
  switch (role) {
    case 'admin':               return '/admin/dashboard';
    case 'student':             return '/student/dashboard';
    case 'hod':                 return '/hod/dashboard';
    case 'vc':                  return '/vc/dashboard';
    case 'examination_officer': return '/examiner/dashboard';
    case 'staff':
    case 'chairperson':         return '/staff/dashboard';
    default:                    return '/login';
  }
};