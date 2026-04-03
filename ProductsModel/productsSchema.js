import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
  },
  { _id: false }
);

const specificationSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const productsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    section: {
      type: String,
      default: "other",
      trim: true,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },
    bulletPoints: [
      {
        type: String,
        trim: true,
      },
    ],
    specifications: [specificationSchema],
    media: [mediaSchema],
    sellerNote: {
      type: String,
      default: "",
      trim: true,
    },
    returnPolicy: {
      type: String,
      default: "7-day replacement",
      trim: true,
    },
    deliveryInfo: {
      type: String,
      default: "Standard delivery available",
      trim: true,
    },
    sourceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityRequest",
      default: null,
    },
    isCommunityDemandProduct: {
      type: Boolean,
      default: false,
    },
    productionStatus: {
      type: String,
      default: "live",
    },
    cart: [
      {
        cart: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Cart",
        },
        buyer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productsSchema);
export default Product;
