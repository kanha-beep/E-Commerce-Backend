if (process.env.NODE_ENV !== "production") {
    const dotenv = await import("dotenv");
    dotenv.config();
}
import express from "express";

import cors from "cors";
import mongoose from "mongoose";

import ProductsRoutes from "./ProductsRoutes/productsRoute.js"
import ProductsAuthRoutes from "./ProductsAuth/productsAuthRoutes.js"
import DemandRoutes from "./DemandRoutes/demandRoute.js"

const app = express();
const MONGO_URI = process.env.MONGO_URI;
await mongoose.connect(MONGO_URI);
const allowedOrigins = String(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) {
            cb(null, true);
        } else {
            cb(new Error("Not allowed by CORS"));
        }
    },
    credentials: false
}));
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/ProductsUploads', express.static('uploads'));
app.use("/api/products", ProductsRoutes)
app.use("/api/auth", ProductsAuthRoutes)
app.use("/api/demand", DemandRoutes)
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
