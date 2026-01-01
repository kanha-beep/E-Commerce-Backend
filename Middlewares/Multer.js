import multer from "multer";
import { storage } from "../config/cloudinary.js";

const uploads = multer({ storage });

export default uploads;