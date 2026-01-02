import express from "express";
//api/products
const router = express.Router();
import Products from "../ProductsModel/productsSchema.js";
import Cart from "../ProductsModel/productsCartSchema.js"
import WrapAsync from "../middlewares/WraapAsync.js";
import uploads from "../middlewares/Multer.js"
import ExpressError from "../middlewares/ExpressError.js"
import { cloudinary } from "../config/cloudinary.js"
import { verifyToken } from "../middlewares/auth.js";
import User from "../ProductsModel/productsUserSchema.js";

router.post("/new", verifyToken, uploads.single("image"), WrapAsync(async (req, res, next) => {
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    const userId = req.user.id;
    const { name, price } = req.body;
    if (!name || !price) return next(new ExpressError("Name and price are required", 400));

    const user = await User.findById({ _id: userId });
    user.roles = "seller";
    await user.save();
    console.log("role saved")
    let imageUrl = null;
    console.log("Image upload starts");
    if (req.file) {
        console.log("1")
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        console.log("2")
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        console.log("3")
        try {
            const result = await cloudinary.uploader.upload(dataURI, {
                folder: "products"
            });
            console.log("resilt: ", result)
            imageUrl = result.secure_url;
            console.log("Image uploaded successfully:", imageUrl);
        } catch (error) {
            console.error("Error uploading image to Cloudinary:", error);
            return next(new ExpressError("Error uploading image", 500));
        }

    }
    console.log("Image URL:", imageUrl);
    const product = await Products.create({ name, price, owner: userId, image: imageUrl });
    console.log("Product created:", product);
    res.status(201).json(product);
}))
router.patch(
    "/:productsId",
    verifyToken,
    uploads.single("image"),
    WrapAsync(async (req, res, next) => {
        const { productsId } = req.params;
        const { name, price } = req.body;
        const userId = req.user.id;

        const product = await Products.findById(productsId);
        if (!product) return next(new ExpressError("Product not found", 404));
        if (userId.toString() !== product.owner.toString())
            return next(new ExpressError("Not owner", 401));

        if (name) product.name = name;
        if (price) product.price = price;

        if (req.file) {
            const b64 = req.file.buffer.toString("base64");
            const dataURI = `data:${req.file.mimetype};base64,${b64}`;
            const result = await cloudinary.uploader.upload(dataURI, {
                folder: "products",
            });
            product.image = result.secure_url;
        }
        await product.save();
        res.status(200).json(product);
    })
);
//add product in cart
router.post("/:productsId/add-cart", verifyToken, WrapAsync(async (req, res, next) => {
    const { productsId } = req.params;
    const userId = req.user.id;

    const product = await Products.findById(productsId);
    if (!product) {
        console.log("Product not found");
        return next(new ExpressError("Product not found", 404));
    }

    let cart = await Cart.findOne({ owner: userId });
    if (!cart) {
        cart = await Cart.create({ owner: userId, products: [productsId] });
        product.cart.push({ cart: cart._id, buyer: userId });
        await product.save();
        return res.status(201).json({ message: "Product added to new cart", cart });
    }
    console.log("Existing cart found with", cart.products.length, "products");
    if (cart.products.includes(productsId)) {
        return next(new ExpressError("Product already in cart", 401));
    }

    cart.products.push(productsId);
    await cart.save();

    product.cart.push({ cart: cart._id, buyer: userId });
    await product.save();

    res.json({ message: "Product added to cart", cart });
}))
//cart details
router.get("/cart-details", verifyToken, WrapAsync(async (req, res) => {
    const cart = await Cart.findOne({ owner: req.user.id }).populate("products");
    if (!cart) {
        return res.json({ products: [] });
    }
    res.json(cart);
}))
router.delete("/cart-details/:id", verifyToken, WrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const cart = await Cart.findOne({ owner: req.user.id });
    if (!cart) return next(new ExpressError("Cart not found", 404))
    cart.products = cart.products.filter((productId) => productId.toString() !== id);
    await cart.save();
    const product = await Products.findById(id);
    if (!product) next(new ExpressError("Product not found", 405))
    console.log("removing id of cart from product")
    product.cart = product.cart.filter((cartItem) => cartItem.cart.toString() !== cart._id.toString());
    await product.save();

    res.json({ message: "Product removed from cart" });
}))
//one products
router.get("/:id", WrapAsync(async (req, res) => {
    const { id } = req.params;
    const product = await Products.findById(id);
    if (!product) {
        throw new ExpressError("Product not found", 404);
    }
    res.json(product);
}))



//all products
router.get("/", wrapAsync(async (req, res) => {
    const products = await Products.find({});
    res.json(products);
}))
export default router;