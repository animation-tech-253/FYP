// import { Application, User } from '../models/index.js';

// // Get dashboard analytics for Admin
// export const getDashboardAnalytics = async (req, res) => {
//     try {
//         const totalApplications = await Application.countDocuments();
//         const totalUsers = await User.countDocuments({ isActive: true });
        
//         const statusBreakdown = await Application.aggregate([
//             { $group: { _id: '$status', count: { $sum: 1 } } }
//         ]);

//         const typeBreakdown = await Application.aggregate([
//             { $group: { _id: '$applicationType', count: { $sum: 1 } } }
//         ]);
        
//         const topDepartments = await Application.aggregate([
//             { $group: { _id: '$department', count: { $sum: 1 } } },
//             { $sort: { count: -1 } },
//             { $limit: 5 },
//             { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'departmentInfo' } },
//             { $unwind: '$departmentInfo' }
//         ]);

//         res.status(200).json({ success: true, data: {
//             totalApplications,
//             totalUsers,
//             statusBreakdown,
//             typeBreakdown,
//             topDepartments
//         }});
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };
