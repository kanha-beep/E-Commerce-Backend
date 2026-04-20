import jwt from 'jsonwebtoken';
import User from '../ProductsModel/productsUserSchema.js';
import ExpressError from './ExpressError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

function extractToken(req) {
    const authHeader = req.get("authorization") || req.get("Authorization") || "";

    if (authHeader.toLowerCase().startsWith("bearer ")) {
        return authHeader.slice(7).trim();
    }

    return "";
}

export const verifyToken = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) return next(new ExpressError('Please login first.', 401));

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select("username email roles");
        if (!user) return next(new ExpressError('User not authorized.', 401));

        req.user = { id: user._id, username: user.username, email: user.email, roles: user.roles };
        next();
    } catch (error) {
        next(new ExpressError('Invalid or expired token.', 401));
    }
};
