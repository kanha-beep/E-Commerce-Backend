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
router.post("/new", verifyToken, uploads.single("image"), wrapAsync(async (req, res, next) => {
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);

    const { name, price } = req.body;
    if (!name || !price) return next(new ExpressError("Name and price are required", 400));


    const userId = req.user.id;
    const imgPath = req.file ? req.file.filename : null;

    const product = await Products.create({ name, price, owner: userId, image: imgPath });
    console.log("Product created:", product);
    res.status(201).json(product);
}))
router.patch("/:productsId", uploads.single("image"), wrapAsync(async (req, res, next) => {
    console.log("update image starts")
    const { productsId } = req.params;
    const { name, price } = req.body;
    const userId = req.user.id;
    const imageName = req.file ? req.file.filename : null
    // console.log(imageName, productsId, userId);
    const product = await Products.findById({ _id: productsId, owner: userId })
    // console.log("Product found:", product);
    if (!product) return next(new ExpressError("Product not found", 404));
    // console.log("owner starts")
    // if (product.owner.toString() !== userId) return next(new ExpressError("Unauthorized", 401));
    // console.log("owner done")
    if (name) product.name = name;
    if (price) product.price = price;
    // console.log("fianlly changing image")
    if (req.file) {
        product.image = imageName;
    }
    // console.log("Updated product:", product);
    await product.save();
    res.status(200).json(product);
}))
//add product in cart
router.post("/:productsId/add-cart", verifyToken, wrapAsync(async (req, res, next) => {
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
router.get("/cart-details", verifyToken, wrapAsync(async (req, res) => {
    const cart = await Cart.findOne({ owner: req.user.id }).populate("products");
    if (!cart) {
        return res.json({ products: [] });
    }
    res.json(cart);
}))
router.delete("/cart-details/:id", verifyToken, wrapAsync(async (req, res, next) => {
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
router.get("/:id", wrapAsync(async (req, res) => {
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