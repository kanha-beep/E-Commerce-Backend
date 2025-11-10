import express from "express";
//api/products
const router = express.Router();
import Products from "../ProductsModel/productsSchema.js";
import Cart from "../ProductsModel/productsCartSchema.js"
import wrapAsync from "../Middlewares/WrapSync.js";
import ExpressError from "../Middlewares/ExpressError.js"
import uploads from "../Middlewares/Multer.js"
import { verifyToken } from "../Middlewares/auth.js";
//add
router.post("/new", verifyToken, uploads.single("image"), wrapAsync(async (req, res) => {
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    
    const { name, price } = req.body;
    if (!name || !price) {
        throw new ExpressError("Name and price are required", 400);
    }
    
    const userId = req.user.id;
    const imgPath = req.file ? req.file.filename : null;
    
    const product = await Products.create({ name, price, owner: userId, image: imgPath });
    console.log("Product created:", product);
    res.status(201).json(product);
}))
//one products
router.get("/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const product = await Products.findById(id);
    if (!product) {
        throw new ExpressError("Product not found", 404);
    }
    res.json(product);
}))
//add product in cart
router.post("/:productsId/add-cart", verifyToken, wrapAsync(async (req, res) => {
    const { productsId } = req.params;
    const userId = req.user.id;
    
    const product = await Products.findById(productsId);
    if (!product) {
        throw new ExpressError("Product not found", 404);
    }
    
    let cart = await Cart.findOne({ owner: userId });
    if (!cart) {
        cart = await Cart.create({ owner: userId, products: [productsId] });
        product.cart.push({ cart: cart._id, buyer: userId });
        await product.save();
        return res.status(201).json({ message: "Product added to new cart", cart });
    }
    
    if (cart.products.includes(productsId)) {
        throw new ExpressError("Product already in cart", 400);
    }
    
    cart.products.push(productsId);
    await cart.save();
    
    product.cart.push({ cart: cart._id, buyer: userId });
    await product.save();
    
    res.json({ message: "Product added to cart", cart });
}))
//cart details
router.get("/cart-details", verifyToken, wrapAsync(async (req, res) => {
    const cart = await Cart.findOne({ owner: req.user.id }).populate("products");
    if (!cart) {
        return res.json({ products: [] });
    }
    res.json(cart);
}))
//all products
router.get("/", wrapAsync(async (req, res) => {
    const products = await Products.find({});
    res.json(products);
}))
export default router;