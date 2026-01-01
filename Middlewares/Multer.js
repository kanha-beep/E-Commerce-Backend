import multer from "multer";
import { storage } from "./Cloudinary.js";

const uploads = multer({ storage });

export default uploads;