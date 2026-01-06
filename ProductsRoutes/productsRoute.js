import express from "express";
//api/products
const router = express.Router();
import Products from "../ProductsModel/productsSchema.js";
import Cart from "../ProductsModel/productsCartSchema.js"
import Review from "../ProductsModel/ReviewsSchema.js"
import wrapAsync from "../middlewares/WrapAsync.js";
import uploads from "../middlewares/multer.js"
import ExpressError from "../middlewares/ExpressError.js"
import cloudinary from "../config/cloudinary.js"
import { verifyToken } from "../middlewares/auth.js";
import User from "../ProductsModel/productsUserSchema.js";
// get reveiws
router.get("/:id/review", wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const product = await Products.findById(id).populate({ path: "reviews", populate: { path: "owner", select: "username" } })
    if (!product) return next(new ExpressError("Product not found", 404))
    const reviews = product.reviews;
    // console.log("all reuivew: ", reviews)
    res.status(200).json(product.reviews);
}))
// post reveiws
router.post("/:productsId/review", verifyToken, wrapAsync(async (req, res, next) => {
    const { productsId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    if (!userId) return next(new ExpressError("Please Login in first.", 401))
    const product = await Products.findById(productsId);
    if (!product) return next(new ExpressError("Product not found", 404));
    const review = await Review.create({ owner: userId, ratings: rating, comment: comment, product: productsId });
    // console.log("review created: ", review)
    product.reviews.push(review);
    await product.save();
    res.status(201).json({ message: "Review added" });
}))
router.patch("/:productsId/review/:reviewId",
    verifyToken,
    wrapAsync(async (req, res, next) => {
        const { productsId, reviewId } = req.params;
        // console.log("got peutc id and reveiw id: ", productsId, reviewId)
        const { comment, rating } = req.body;
        // console.log("got new comment and ratngs: ", comment, rating)
        const review = await Review.findById(reviewId);
        if (!review) return next(new ExpressError("Review not found", 404));

        // console.log("Review owner:", review.owner.toString());
        // // console.log("Current user:", req.user.id);

        if (review.owner.toString() !== req.user.id.toString()) {
            return next(new ExpressError("Unauthorized", 401));
        }

        // console.log("review update start")
        review.comment = comment;
        review.ratings = rating; // Note: using 'ratings' to match schema
        await review.save();

        res.status(200).json({ message: "Review updated", review });
    })
);

// delete reviews
router.delete("/:productsId/review/:reviewId", verifyToken, wrapAsync(async (req, res, next) => {
    const { productsId, reviewId } = req.params;
    const userId = req.user.id;
    const product = await Products.findById(productsId);
    if (!product) return next(new ExpressError("Product not found", 404));
    const review = await Review.findById(reviewId);
    if (!review) return next(new ExpressError("Review not found", 404));
    if (userId.toString() !== review?.owner?._id?.toString()) return next(new ExpressError("Not owner", 401));
    await Products.updateOne({ _id: productsId }, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.status(200).json({ message: "Review deleted" });
}))
//cart details
router.get("/cart-details", verifyToken, wrapAsync(async (req, res, next) => {
    console.log("cart starts")
    const cart = await Cart.findOne({ owner: req.user.id }).populate("products.product");
    console.log("cart: ", cart)
    if (!cart) return next(res.json({ products: [] }))
    const items = cart.products
        .filter(p => p.product) // 🔥 remove null products
        .map(p => ({
            id: p.product._id,
            name: p.product.name,
            price: p.product.price,
            quantity: p.quantity,
            image: p.product.image,
        }));

    console.log("ietms: ", items)
    res.json(items);
}))
//add product in cart
router.post("/:productsId/add-cart", verifyToken, wrapAsync(async (req, res, next) => {

    console.log("add starts")
    const { productsId } = req.params;
    const userId = req.user.id;

    const product = await Products.findById(productsId);
    if (!product) {
        console.log("Product not found");
        return next(new ExpressError("Product not found", 404));
    }

    let cart = await Cart.findOne({ owner: userId });
    if (!cart) {
        cart = await Cart.create({ owner: userId, products: [{ product: productsId, quantity: 1 }] });
        // product.cart.push({ cart: cart._id, buyer: userId });
        // await product.save();
        const populatedCart = await cart.populate("products.product");

        return res.status(201).json({
            message: "Product added to new cart",
            cart: populatedCart,
        });
    }
    console.log("Existing cart found with", cart.products.length, "products");
    // check if product already exists
    const item = cart.products.find(
        (p) => p.product.toString() === productsId
    );
    if (item) {
        item.quantity += 1; // increase quantity
    } else {
        cart.products.push({ product: productsId, quantity: 1 });
    }
    await cart.save();
    res.json({ message: "Product added to cart", cart });
}))
router.patch("/cart/:productId",
    verifyToken,
    wrapAsync(async (req, res, next) => {
        const { productId } = req.params;
        const { quantity } = req.body;

        if (quantity < 1) {
            return next(new ExpressError("Quantity must be at least 1", 400));
        }

        const cart = await Cart.findOne({ owner: req.user.id });
        if (!cart) return next(new ExpressError("Cart not found", 404));

        const item = cart.products.find(
            (p) => p.product.toString() === productId
        );

        if (!item) {
            return next(new ExpressError("Product not in cart", 404));
        }

        item.quantity = quantity;
        await cart.save();

        res.json(cart);
    })
);

// delete cart
router.delete("/cart/:productId",
    verifyToken,
    wrapAsync(async (req, res, next) => {
        const { productId } = req.params;

        const cart = await Cart.findOneAndUpdate(
            { owner: req.user.id },
            { $pull: { products: { product: productId } } },
            { new: true }
        );

        if (!cart) return next(new ExpressError("Cart not found", 404));

        res.json(cart);
    })
);

router.post("/new", verifyToken, uploads.single("image"), wrapAsync(async (req, res, next) => {
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    console.log("▶ Content-Type:", req.headers["content-type"]);
    console.log("▶ req.file exists:", !!req.file);
    console.log("▶ req.file:", req.file);
    console.log("▶ req.body:", req.body);
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
        // console.log("1")
        // const b64 = Buffer.from(req.file.buffer).toString("base64");
        // console.log("2")
        // const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        // console.log("3")
        try {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: "products" },
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
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
    wrapAsync(async (req, res, next) => {
        const { productsId } = req.params;
        const { name, price } = req.body;
        const userId = req.user.id;
        console.log("▶ Content-Type:", req.headers["content-type"]);
        console.log("▶ req.file exists:", !!req.file);
        console.log("▶ req.file:", req.file);
        console.log("▶ req.body:", req.body);

        const product = await Products.findById(productsId);
        if (!product) return next(new ExpressError("Product not found", 404));
        if (userId.toString() !== product.owner.toString())
            return next(new ExpressError("Not owner", 401));

        if (name) product.name = name;
        if (price) product.price = price;
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: "products" },
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });

            product.image = result.secure_url;
        }

        // if (req.file) {
        //     const b64 = req.file.buffer.toString("base64");
        //     const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        //     const result = await cloudinary.uploader.upload(dataURI, {
        //         folder: "products",
        //     });
        //     product.image = result.secure_url;
        // }
        await product.save();
        res.status(200).json(product);
    })
);
router.delete("/:productsId", verifyToken, wrapAsync(async (req, res, next) => {
    const { productsId } = req.params;
    const userId = req.user.id;
    const product = await Products.findById(productsId);
    if (!product) return next(new ExpressError("Product not found", 404));
    if (userId?.toString() !== product?.owner?.toString()) return next(new ExpressError("Not owner", 401));
    await Products.findByIdAndDelete(productsId);
    res.status(200).json({ message: "Product deleted" });
}))



//one products
router.get("/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const product = await Products.findById(id);
    // console.log("single product: ", product)
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