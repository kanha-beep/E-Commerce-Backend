import express from "express";
import User from "../ProductsModel/productsUserSchema.js";
import { generateToken, verifyToken } from "../Middlewares/auth.js";
import wrapAsync from "../Middlewares/WrapSync.js";
import ExpressError from "../Middlewares/ExpressError.js";


const router = express.Router();

// Register
router.post("/register", wrapAsync(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        throw new ExpressError("All fields are required", 400);
    }

    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existingUser) {
        throw new ExpressError("User already exists", 400);
    }
    
    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    });
}));

// Login
router.post("/login", wrapAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) return next(new ExpressError("Email and password are required", 400))

    const user = await User.findOne({ email });
    if (!user) return next(new ExpressError("Invalid credentials", 401))
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return next(new ExpressError("Invalid credentials", 402))

    const token = generateToken(user._id);
    res.json({
        message: "Login successful",
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    });
}));

// Get current user
router.get("/me", verifyToken, wrapAsync(async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email
        }
    });
}));

export default router;