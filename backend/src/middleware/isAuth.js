import jwt from "jsonwebtoken";
import { User } from '../models/index.js'; 

const isAuth = async (req, res, next) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({ success: false, message: "Please login to access this resource." });
        }

        const verifyToken = jwt.verify(token, process.env.JWT_SECRET);

        if (!verifyToken) {
            return res.status(401).json({ success: false, message: "Invalid token." });
        }

        // Fetch the user from DB and attach to req.user
        const user = await User.findById(verifyToken.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found." });
        }

        req.user = user; // Attach full user object
        req.userId = user._id; // Attach ID for convenience

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: "Invalid token." });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: "Token expired." });
        }
        return res.status(500).json({ success: false, message: `Authentication Error: ${error.message}` });
    }
};

export default isAuth;
