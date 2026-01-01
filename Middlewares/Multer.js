import multer from "multer"
import path from "path"
const storage = multer.diskStorage({
    // tell the folder name
    destination: function (req, file, cb) {
        cb(null, "uploads/")
    },
    // create the file name
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext)
    }
})
const fileFilter = (req, file, cb) => {
    // get extension of file
    const ext = path.extname(file.originalname).toLowerCase();
    // prescribe allowed formats
    const allowed_formats = /\.(jpeg|jpg|png|avif|webp)$/;
    // test extracted extension with allowed
    if (allowed_formats.test(ext)) {
        cb(null, true)
    } else {
        cb(new Error("Only JPEG, JPG and PNG files are allowed"))
    }
}
const uploads = multer({ 
    storage, 
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
})
export default uploads
