import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser"
dotenv.config();
const app = express();
const MONGO_URI = process.env.MONGO_URI;
await mongoose.connect(MONGO_URI);
const allowedOrigins = process.env.CLIENT_URL.split(',');
console.log("origins: ", allowedOrigins)
// const allowedOrigins = process.env.CLIENT_URL.split(",");

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) {
            cb(null, origin);   // 👈 return SAME origin string
        } else {
            cb(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));


app.use(cookieParser())
app.use(express.json());
app.use('/ProductsUploads', express.static('uploads'));
import ProductsRoutes from "./ProductsRoutes/productsRoute.js"
import ProductsAuthRoutes from "./ProductsAuth/productsAuthRoutes.js"
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

