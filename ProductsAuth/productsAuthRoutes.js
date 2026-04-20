import express from "express";
import User from "../ProductsModel/productsUserSchema.js";
import { generateToken, verifyToken } from "../middlewares/auth.js";
import WrapAsync from "../middlewares/WrapAsync.js";
import ExpressError from "../middlewares/ExpressError.js";

const router = express.Router();

function getUserResponse(user) {
    return {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
    };
}

// Register
router.post("/register", WrapAsync(async (req, res, next) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || !password) return next(new ExpressError("All fields are required", 400));

    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });
    if (existingUser) return next(new ExpressError("User already exists", 409));

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);
    res.status(201).json({
        message: "User registered successfully",
        token,
        user: getUserResponse(user),
    });
}));

// Login
router.post("/login", WrapAsync(async (req, res, next) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) return next(new ExpressError("Email and password are required", 400));

    const user = await User.findOne({ email });
    if (!user) return next(new ExpressError("Invalid credentials", 401));

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return next(new ExpressError("Invalid credentials", 401));
    const token = generateToken(user._id);
    res.status(200).json({
        message: "Login successful",
        token,
        user: getUserResponse(user),
    });
}));

// Get current user
router.get("/me", verifyToken, WrapAsync(async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            roles: req.user.roles
        }
    });
}));
router.post("/logout", (req, res) => {
    res.status(200).json({ message: "Logged out successfully" });
});

export default router;
