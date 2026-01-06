import dotenv from "dotenv";
dotenv.config();
import express from "express";

import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser"
console.log("Environment loaded:");
console.log("MONGO_URI:", process.env.MONGO_URI ? "SET" : "NOT SET");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "***" : "NOT SET");

import ProductsRoutes from "./ProductsRoutes/productsRoute.js"
import ProductsAuthRoutes from "./ProductsAuth/productsAuthRoutes.js"

const app = express();
const MONGO_URI = process.env.MONGO_URI;
await mongoose.connect(MONGO_URI);
const allowedOrigins = process.env.CLIENT_URL.split(',');
console.log("origins: ", allowedOrigins)

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) {
            cb(null, origin);
        } else {
            cb(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));
app.set("trust proxy", 1);

app.use(cookieParser())
app.use(express.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/ProductsUploads', express.static('uploads'));
app.use("/api/products", ProductsRoutes)
app.use("/api/auth", ProductsAuthRoutes)
app.get("/", (req, res) => {
    res.send("Server running...");
});

const PORT = process.env.PORT || 3000;
app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).json({ error: message });
});
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

