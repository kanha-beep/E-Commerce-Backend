import express from "express";
import User from "../ProductsModel/productsUserSchema.js";
import { generateToken, verifyToken } from "../Middlewares/auth.js";
import wrapAsync from "../Middlewares/WrapSync.js";
import ExpressError from "../Middlewares/ExpressError.js";
const isProd = process.env.NODE_ENV === "production";

const router = express.Router();

// Register
router.post("/register", wrapAsync(async (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) return next(new ExpressError("All fields are required", 400))

    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });
    if (existingUser) return next(new ExpressError("User already exists", 403))

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);
    res.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    })
        .status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles
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
    console.log("Setting cookie with secure:", process.env.NODE_ENV === 'production');
    res.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    })
        .status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles
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
router.post("/logout", (req, res) => {
    res
        .clearCookie("token", {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            path: "/",
        })
        .status(200)
        .json({ message: "Logged out successfully" });
});

export default router;