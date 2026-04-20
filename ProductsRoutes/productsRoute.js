import express from "express";
import cloudinary from "../config/cloudinary.js";
import CommunityRequest from "../ProductsModel/communityRequestSchema.js";
import CustomOrder from "../ProductsModel/customOrderSchema.js";
import Order from "../ProductsModel/orderSchema.js";
import Review from "../ProductsModel/ReviewsSchema.js";
import Cart from "../ProductsModel/productsCartSchema.js";
import Products from "../ProductsModel/productsSchema.js";
import User from "../ProductsModel/productsUserSchema.js";
import { verifyToken } from "../middlewares/auth.js";
import ExpressError from "../middlewares/ExpressError.js";
import uploads from "../middlewares/multer.js";
import wrapAsync from "../middlewares/WrapAsync.js";
import {
  ensureRazorpayConfigured,
  getRazorpayInstance,
  verifyRazorpaySignature,
} from "../utils/razorpay.js";

const router = express.Router();

const sellerDashboardPopulate = {
  path: "items.product",
  populate: { path: "owner", select: "username email" },
};

function splitLines(value = "") {
  return String(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonArray(value, fallback = []) {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function uploadFileToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "products",
        resource_type: "auto",
      },
      (error, uploaded) => {
        if (error) reject(error);
        else resolve(uploaded);
      }
    );

    stream.end(file.buffer);
  });
}

async function uploadProductMedia(files = []) {
  if (!files.length) return [];

  const uploaded = await Promise.all(
    files.map(async (file) => {
      const result = await uploadFileToCloudinary(file);
      const mimeType = file.mimetype || "";
      const kind = mimeType.startsWith("video/") ? "video" : "image";

      return {
        url: result.secure_url,
        kind,
      };
    })
  );

  return uploaded;
}

function getNormalizedListingPayload(body) {
  const section = (body.section || "other").trim().toLowerCase();
  const bulletPoints = splitLines(body.bulletPoints);
  const specifications = parseJsonArray(body.specifications).filter(
    (item) => item?.label && item?.value
  );
  const existingMedia = parseJsonArray(body.existingMedia).filter((item) => item?.url);

  return {
    name: String(body.name || "").trim(),
    price: Number(body.price),
    quantity: Number(body.quantity),
    section,
    category: String(body.category || "").trim(),
    brand: String(body.brand || "").trim(),
    shortDescription: String(body.shortDescription || "").trim(),
    description: String(body.description || "").trim(),
    bulletPoints,
    specifications,
    sellerNote: String(body.sellerNote || "").trim(),
    returnPolicy: String(body.returnPolicy || "").trim(),
    deliveryInfo: String(body.deliveryInfo || "").trim(),
    existingMedia,
  };
}

function getReviewResponse(review) {
  return {
    _id: review._id,
    owner: review.owner,
    product: review.product,
    comment: review.comment,
    rating: review.ratings,
    ratings: review.ratings,
    replies: Array.isArray(review.replies)
      ? review.replies.map((reply) => ({
          _id: reply._id,
          owner: reply.owner,
          comment: reply.comment,
          createdAt: reply.createdAt,
        }))
      : [],
    createdAt: review.createdAt,
  };
}

router.get("/seller/dashboard", verifyToken, wrapAsync(async (req, res) => {
  const sellerId = req.user.id;
  const products = await Products.find({ owner: sellerId }).sort({ createdAt: -1 });
  const orders = await Order.find({})
    .populate(sellerDashboardPopulate)
    .populate("buyer", "username email")
    .sort({ createdAt: -1 });
  const customOrders = await CustomOrder.find({ producer: sellerId })
    .populate("buyer", "username email")
    .populate("product", "name image")
    .sort({ createdAt: -1 });

  const sellerOrders = orders
    .map((order) => {
      const items = order.items.filter(
        (item) => item.product?.owner?._id?.toString() === sellerId.toString()
      );

      if (!items.length) return null;

      return {
        _id: order._id,
        buyer: order.buyer,
        amount: items.reduce(
          (sum, item) => sum + Number(item.priceAtPurchase || 0) * Number(item.quantity || 0),
          0
        ),
        itemCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        items: items.map((item) => ({
          productId: item.product?._id,
          name: item.product?.name,
          image: item.product?.image,
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
        })),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      };
    })
    .filter(Boolean);

  const totalInventory = products.reduce(
    (sum, product) => sum + Number(product.quantity || 0),
    0
  );
  const pendingOrders = sellerOrders.filter((order) => order.status !== "shipped").length;

  res.json({
    seller: req.user,
    summary: {
      productsListed: products.length,
      totalInventory,
      pendingOrders,
      customOrderRequests: customOrders.filter((order) => order.status === "pending").length,
    },
    products,
    orders: sellerOrders.slice(0, 10),
    customOrders: customOrders.slice(0, 10),
  });
}));

router.get("/:id/review", wrapAsync(async (req, res, next) => {
  const { id } = req.params;
  const product = await Products.findById(id).populate({
    path: "reviews",
    populate: [
      { path: "owner", select: "username" },
      { path: "replies.owner", select: "username" },
    ],
    options: { sort: { createdAt: -1 } },
  });

  if (!product) return next(new ExpressError("Product not found", 404));

  res.status(200).json(product.reviews.map(getReviewResponse));
}));

router.post("/:productsId/review", verifyToken, wrapAsync(async (req, res, next) => {
  const { productsId } = req.params;
  const comment = String(req.body.comment || "").trim();
  const { rating } = req.body;
  const userId = req.user.id;

  if (!userId) return next(new ExpressError("Please Login in first.", 401));

  const product = await Products.findById(productsId);
  if (!product) return next(new ExpressError("Product not found", 404));

  const parsedRating = Number(rating);
  if (!comment || parsedRating < 1 || parsedRating > 5) {
    return next(new ExpressError("Valid comment and rating are required", 400));
  }

  const existingReview = await Review.findOne({ owner: userId, product: productsId });
  if (existingReview) {
    existingReview.comment = comment;
    existingReview.ratings = parsedRating;
    await existingReview.save();
    return res.status(200).json({ message: "Review updated" });
  }

  const review = await Review.create({
    owner: userId,
    ratings: parsedRating,
    comment,
    product: productsId,
  });

  product.reviews.push(review._id);
  await product.save();
  res.status(201).json({ message: "Review added" });
}));

router.post("/:productsId/review/:reviewId/replies", verifyToken, wrapAsync(async (req, res, next) => {
  const { productsId, reviewId } = req.params;
  const comment = String(req.body.comment || "").trim();

  if (!comment) {
    return next(new ExpressError("Reply comment is required", 400));
  }

  const product = await Products.findById(productsId);
  if (!product) return next(new ExpressError("Product not found", 404));

  const review = await Review.findById(reviewId);
  if (!review || review.product.toString() !== productsId.toString()) {
    return next(new ExpressError("Review not found", 404));
  }

  review.replies.push({
    owner: req.user.id,
    comment,
  });
  await review.save();

  const populatedReview = await Review.findById(reviewId)
    .populate("owner", "username")
    .populate("replies.owner", "username");

  res.status(201).json(getReviewResponse(populatedReview));
}));

router.patch("/:productsId/review/:reviewId", verifyToken, wrapAsync(async (req, res, next) => {
  const { reviewId } = req.params;
  const { comment, rating } = req.body;

  const review = await Review.findById(reviewId);
  if (!review) return next(new ExpressError("Review not found", 404));

  if (review.owner.toString() !== req.user.id.toString()) {
    return next(new ExpressError("Unauthorized", 401));
  }

  const parsedRating = Number(rating);
  if (!comment || parsedRating < 1 || parsedRating > 5) {
    return next(new ExpressError("Valid comment and rating are required", 400));
  }

  review.comment = comment;
  review.ratings = parsedRating;
  await review.save();

  res.status(200).json({ message: "Review updated", review });
}));

router.delete("/:productsId/review/:reviewId", verifyToken, wrapAsync(async (req, res, next) => {
  const { productsId, reviewId } = req.params;
  const userId = req.user.id;
  const product = await Products.findById(productsId);

  if (!product) return next(new ExpressError("Product not found", 404));

  const review = await Review.findById(reviewId);
  if (!review) return next(new ExpressError("Review not found", 404));

  if (userId.toString() !== review.owner.toString()) {
    return next(new ExpressError("Not owner", 401));
  }

  await Products.updateOne({ _id: productsId }, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  res.status(200).json({ message: "Review deleted" });
}));

router.get("/cart-details", verifyToken, wrapAsync(async (req, res) => {
  const cart = await Cart.findOne({ owner: req.user.id }).populate("products.product");
  if (!cart) return res.json([]);

  const items = cart.products
    .filter((entry) => entry.product)
    .map((entry) => ({
      id: entry.product._id,
      name: entry.product.name,
      price: entry.product.price,
      quantity: entry.quantity,
      image: entry.product.image,
      availableQuantity: entry.product.quantity,
      section: entry.product.section,
    }));

  res.json(items);
}));

router.post("/:productsId/add-cart", verifyToken, wrapAsync(async (req, res, next) => {
  const { productsId } = req.params;
  const userId = req.user.id;

  const product = await Products.findById(productsId);
  if (!product) return next(new ExpressError("Product not found", 404));
  if (Number(product.quantity || 0) < 1) {
    return next(new ExpressError("This item is currently out of stock", 400));
  }

  let cart = await Cart.findOne({ owner: userId });
  if (!cart) {
    cart = await Cart.create({
      owner: userId,
      products: [{ product: productsId, quantity: 1 }],
    });

    return res.status(201).json({
      message: "Product added to new cart",
      cart: await cart.populate("products.product"),
    });
  }

  const item = cart.products.find((entry) => entry.product.toString() === productsId);
  if (item) {
    if (item.quantity >= Number(product.quantity || 0)) {
      return next(new ExpressError("Cannot add more than available stock", 400));
    }
    item.quantity += 1;
  } else {
    cart.products.push({ product: productsId, quantity: 1 });
  }

  await cart.save();
  res.json({ message: "Product added to cart", cart });
}));

router.get("/:productsId/custom-orders", verifyToken, wrapAsync(async (req, res, next) => {
  const { productsId } = req.params;
  const product = await Products.findById(productsId).populate("owner", "username");
  if (!product) return next(new ExpressError("Product not found", 404));

  const isOwner = product.owner._id.toString() === req.user.id.toString();
  const query = isOwner
    ? { product: productsId }
    : { product: productsId, buyer: req.user.id };

  const orders = await CustomOrder.find(query)
    .populate("buyer", "username email")
    .populate("producer", "username email")
    .sort({ createdAt: -1 });

  res.json(orders);
}));

router.post("/:productsId/custom-orders", verifyToken, wrapAsync(async (req, res, next) => {
  const { productsId } = req.params;
  const {
    improvementNote,
    extraCharge,
    preview,
  } = req.body;

  const product = await Products.findById(productsId).populate("owner", "username email");
  if (!product) return next(new ExpressError("Product not found", 404));
  if (product.owner._id.toString() === req.user.id.toString()) {
    return next(new ExpressError("You cannot create a custom order for your own product", 400));
  }

  const parsedCharge = Number(extraCharge);
  if (!improvementNote || Number.isNaN(parsedCharge) || parsedCharge < 0) {
    return next(new ExpressError("Improvement note and valid extra charge are required", 400));
  }

  const order = await CustomOrder.create({
    product: product._id,
    buyer: req.user.id,
    producer: product.owner._id,
    improvementNote,
    extraCharge: parsedCharge,
    totalPrice: Number(product.price || 0) + parsedCharge,
    preview,
  });

  const populatedOrder = await CustomOrder.findById(order._id)
    .populate("buyer", "username email")
    .populate("producer", "username email");

  res.status(201).json(populatedOrder);
}));

router.patch("/custom-orders/:customOrderId/status", verifyToken, wrapAsync(async (req, res, next) => {
  const { customOrderId } = req.params;
  const { status } = req.body;
  const allowedStatuses = ["pending", "accepted", "in-production", "shipped", "rejected"];

  if (!allowedStatuses.includes(status)) {
    return next(new ExpressError("Invalid custom order status", 400));
  }

  const customOrder = await CustomOrder.findById(customOrderId)
    .populate("producer", "username email")
    .populate("buyer", "username email");

  if (!customOrder) return next(new ExpressError("Custom order not found", 404));
  if (customOrder.producer._id.toString() !== req.user.id.toString()) {
    return next(new ExpressError("Only the producer can update this order", 403));
  }

  customOrder.status = status;
  await customOrder.save();

  res.json(customOrder);
}));

router.post("/custom-orders/:customOrderId/payment-order", verifyToken, wrapAsync(async (req, res, next) => {
  try {
    ensureRazorpayConfigured();
  } catch (error) {
    return next(new ExpressError(error.message, 500));
  }

  const { customOrderId } = req.params;
  const customOrder = await CustomOrder.findById(customOrderId)
    .populate("buyer", "username email")
    .populate("product", "name");

  if (!customOrder) return next(new ExpressError("Custom order not found", 404));
  if (customOrder.buyer._id.toString() !== req.user.id.toString()) {
    return next(new ExpressError("Only the buyer can pay for this custom order", 403));
  }
  if (!["accepted", "in-production"].includes(customOrder.status)) {
    return next(new ExpressError("Custom order is not ready for payment yet", 400));
  }
  if (customOrder.paymentStatus === "paid") {
    return next(new ExpressError("Custom order is already paid", 400));
  }

  const razorpay = getRazorpayInstance();
  const gatewayOrder = await razorpay.orders.create({
    amount: Math.round(Number(customOrder.totalPrice) * 100),
    currency: "INR",
    receipt: `custom_${customOrder._id}_${Date.now()}`,
  });

  customOrder.gatewayOrderId = gatewayOrder.id;
  await customOrder.save();

  res.json({
    customOrderId: customOrder._id,
    gatewayOrderId: gatewayOrder.id,
    amount: gatewayOrder.amount,
    currency: gatewayOrder.currency,
    key: process.env.RAZORPAY_KEY_ID,
    name: "Amazon Modern",
    description: `Custom order for ${customOrder.product?.name || "product"}`,
  });
}));

router.post("/custom-orders/:customOrderId/payment-verify", verifyToken, wrapAsync(async (req, res, next) => {
  const { customOrderId } = req.params;
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const customOrder = await CustomOrder.findById(customOrderId).populate("buyer", "username");
  if (!customOrder) return next(new ExpressError("Custom order not found", 404));
  if (customOrder.buyer._id.toString() !== req.user.id.toString()) {
    return next(new ExpressError("Only the buyer can verify this payment", 403));
  }
  if (!customOrder.gatewayOrderId || customOrder.gatewayOrderId !== razorpay_order_id) {
    customOrder.paymentStatus = "failed";
    await customOrder.save();
    return next(new ExpressError("Payment order does not match this custom order", 400));
  }

  const valid = verifyRazorpaySignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!valid) {
    customOrder.paymentStatus = "failed";
    await customOrder.save();
    return next(new ExpressError("Invalid payment signature", 400));
  }

  customOrder.gatewayPaymentId = razorpay_payment_id;
  customOrder.paymentSignature = razorpay_signature;
  customOrder.paymentStatus = "paid";
  await customOrder.save();

  res.json({ success: true, message: "Custom order payment verified." });
}));

router.patch("/cart/:productId", verifyToken, wrapAsync(async (req, res, next) => {
  const { productId } = req.params;
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return next(new ExpressError("Quantity must be at least 1", 400));
  }

  const cart = await Cart.findOne({ owner: req.user.id });
  if (!cart) return next(new ExpressError("Cart not found", 404));

  const item = cart.products.find((entry) => entry.product.toString() === productId);
  if (!item) return next(new ExpressError("Product not in cart", 404));

  const product = await Products.findById(productId);
  if (!product) return next(new ExpressError("Product not found", 404));
  if (quantity > Number(product.quantity || 0)) {
    return next(new ExpressError("Requested quantity exceeds available stock", 400));
  }

  item.quantity = quantity;
  await cart.save();

  res.json(cart);
}));

router.post("/checkout/cart-order", verifyToken, wrapAsync(async (req, res, next) => {
  try {
    ensureRazorpayConfigured();
  } catch (error) {
    return next(new ExpressError(error.message, 500));
  }

  const cart = await Cart.findOne({ owner: req.user.id }).populate("products.product");
  if (!cart || !cart.products.length) {
    return next(new ExpressError("Cart is empty", 400));
  }

  const items = cart.products
    .filter((entry) => entry.product)
    .map((entry) => ({
      product: entry.product._id,
      quantity: entry.quantity,
      priceAtPurchase: Number(entry.product.price || 0),
    }));

  const outOfStockItem = items.find(
    (item, index) => Number(cart.products[index]?.product?.quantity || 0) < Number(item.quantity || 0)
  );
  if (outOfStockItem) {
    return next(new ExpressError("One or more items no longer have enough stock", 400));
  }

  const amount = items.reduce(
    (sum, item) => sum + Number(item.priceAtPurchase) * Number(item.quantity),
    0
  );

  const razorpay = getRazorpayInstance();
  const gatewayOrder = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: `cart_${req.user.id}_${Date.now()}`,
  });

  const order = await Order.create({
    buyer: req.user.id,
    items,
    amount,
    gatewayOrderId: gatewayOrder.id,
  });

  res.status(201).json({
    orderId: order._id,
    gatewayOrderId: gatewayOrder.id,
    amount: gatewayOrder.amount,
    currency: gatewayOrder.currency,
    key: process.env.RAZORPAY_KEY_ID,
    name: "Amazon Modern",
    description: "Cart checkout",
  });
}));

router.post("/checkout/cart-verify", verifyToken, wrapAsync(async (req, res, next) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const order = await Order.findById(orderId).populate("items.product");
  if (!order) return next(new ExpressError("Order not found", 404));
  if (order.buyer.toString() !== req.user.id.toString()) {
    return next(new ExpressError("Unauthorized order access", 403));
  }
  if (!order.gatewayOrderId || order.gatewayOrderId !== razorpay_order_id) {
    order.paymentStatus = "failed";
    order.status = "failed";
    await order.save();
    return next(new ExpressError("Payment order does not match this checkout", 400));
  }

  const valid = verifyRazorpaySignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!valid) {
    order.paymentStatus = "failed";
    order.status = "failed";
    await order.save();
    return next(new ExpressError("Invalid payment signature", 400));
  }

  for (const item of order.items) {
    if (!item.product) {
      order.paymentStatus = "failed";
      order.status = "failed";
      await order.save();
      return next(new ExpressError("A product in this order no longer exists", 400));
    }

    if (Number(item.product.quantity || 0) < Number(item.quantity || 0)) {
      order.paymentStatus = "failed";
      order.status = "failed";
      await order.save();
      return next(new ExpressError(`Insufficient stock for ${item.product.name}`, 400));
    }
  }

  for (const item of order.items) {
    item.product.quantity = Number(item.product.quantity || 0) - Number(item.quantity || 0);
    if (item.product.quantity < 0) item.product.quantity = 0;
    if (item.product.quantity === 0) {
      item.product.productionStatus = "out-of-stock";
    }
    await item.product.save();
  }

  order.gatewayPaymentId = razorpay_payment_id;
  order.paymentSignature = razorpay_signature;
  order.paymentStatus = "paid";
  order.status = "paid";
  await order.save();

  await Cart.findOneAndUpdate(
    { owner: req.user.id },
    { $set: { products: [] } },
    { new: true }
  );

  res.json({ success: true, message: "Payment verified and order placed." });
}));

router.delete("/cart/:productId", verifyToken, wrapAsync(async (req, res, next) => {
  const { productId } = req.params;

  const cart = await Cart.findOneAndUpdate(
    { owner: req.user.id },
    { $pull: { products: { product: productId } } },
    { new: true }
  );

  if (!cart) return next(new ExpressError("Cart not found", 404));
  res.json(cart);
}));

router.post("/new", verifyToken, uploads.array("media", 10), wrapAsync(async (req, res, next) => {
  const userId = req.user.id;
  const payload = getNormalizedListingPayload(req.body);

  if (!payload.name || Number.isNaN(payload.price) || payload.price <= 0) {
    return next(new ExpressError("Valid product name and price are required", 400));
  }

  if (Number.isNaN(payload.quantity) || payload.quantity < 1) {
    return next(new ExpressError("Quantity must be at least 1", 400));
  }

  const user = await User.findById(userId);
  user.roles = "seller";
  await user.save();

  let uploadedMedia = [];
  if (req.files?.length) {
    try {
      uploadedMedia = await uploadProductMedia(req.files);
    } catch (error) {
      return next(new ExpressError(`Error uploading media: ${error.message}`, 500));
    }
  }

  const product = await Products.create({
    name: payload.name,
    price: payload.price,
    quantity: payload.quantity,
    owner: userId,
    image: uploadedMedia.find((item) => item.kind === "image")?.url || "",
    media: uploadedMedia,
    section: payload.section,
    category: payload.category,
    brand: payload.brand,
    shortDescription: payload.shortDescription,
    description: payload.description,
    bulletPoints: payload.bulletPoints,
    specifications: payload.specifications,
    sellerNote: payload.sellerNote,
    returnPolicy: payload.returnPolicy || "7-day replacement",
    deliveryInfo: payload.deliveryInfo || "Standard delivery available",
  });

  res.status(201).json(product);
}));

router.patch("/:productsId", verifyToken, uploads.array("media", 10), wrapAsync(async (req, res, next) => {
  const { productsId } = req.params;
  const userId = req.user.id;
  const payload = getNormalizedListingPayload(req.body);

  const product = await Products.findById(productsId);
  if (!product) return next(new ExpressError("Product not found", 404));
  if (userId.toString() !== product.owner.toString()) {
    return next(new ExpressError("Not owner", 401));
  }

  if (payload.name) product.name = payload.name;
  if (!Number.isNaN(payload.price) && payload.price > 0) product.price = payload.price;
  if (!Number.isNaN(payload.quantity) && payload.quantity >= 1) product.quantity = payload.quantity;

  product.section = payload.section || product.section;
  product.category = payload.category;
  product.brand = payload.brand;
  product.shortDescription = payload.shortDescription;
  product.description = payload.description;
  product.bulletPoints = payload.bulletPoints;
  product.specifications = payload.specifications;
  product.sellerNote = payload.sellerNote;
  product.returnPolicy = payload.returnPolicy || product.returnPolicy;
  product.deliveryInfo = payload.deliveryInfo || product.deliveryInfo;

  let uploadedMedia = [];
  if (req.files?.length) {
    try {
      uploadedMedia = await uploadProductMedia(req.files);
    } catch (error) {
      return next(new ExpressError(`Error uploading media: ${error.message}`, 500));
    }
  }

  product.media = [...payload.existingMedia, ...uploadedMedia];
  product.image =
    product.media.find((item) => item.kind === "image")?.url ||
    "";

  await product.save();
  res.status(200).json(product);
}));

router.delete("/:productsId", verifyToken, wrapAsync(async (req, res, next) => {
  const { productsId } = req.params;
  const userId = req.user.id;
  const product = await Products.findById(productsId);

  if (!product) return next(new ExpressError("Product not found", 404));
  if (userId.toString() !== product.owner.toString()) {
    return next(new ExpressError("Not owner", 401));
  }

  await Review.deleteMany({ product: productsId });
  await CustomOrder.deleteMany({ product: productsId });
  await Cart.updateMany({}, { $pull: { products: { product: product._id } } });
  await Products.findByIdAndDelete(productsId);

  await CommunityRequest.updateMany(
    { linkedProduct: productsId },
    {
      $set: {
        linkedProduct: null,
        status: "assigned",
        producerUpdatedAt: new Date(),
      },
    }
  );

  res.status(200).json({ message: "Product deleted" });
}));

router.get("/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Products.findById(id).populate("owner", "username email roles");

  if (!product) {
    throw new ExpressError("Product not found", 404);
  }

  res.json(product);
}));

router.get("/", wrapAsync(async (req, res) => {
  const section = req.query.section ? String(req.query.section).trim().toLowerCase() : "";
  const search = String(req.query.search || "").trim();
  const query = {};

  if (section && section !== "all") {
    query.section = section;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const products = await Products.find(query)
    .populate("owner", "username")
    .sort({ createdAt: -1 });
  res.json(products);
}));

export default router;
