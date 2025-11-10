import jwt from 'jsonwebtoken';
import User from '../ProductsModel/productsUserSchema.js';
import ExpressError from './ExpressError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new ExpressError('Access denied. No token provided.', 401);
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            throw new ExpressError('Invalid token.', 401);
        }

        req.user = { id: user._id, username: user.username, email: user.email };
        next();
    } catch (error) {
        throw new ExpressError('Invalid token.', 401);
    }
};