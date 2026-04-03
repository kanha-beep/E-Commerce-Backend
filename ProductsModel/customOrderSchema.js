import mongoose from "mongoose";

const previewSchema = new mongoose.Schema(
  {
    baseColor: { type: String, default: "#f8fafc" },
    accentColor: { type: String, default: "#0f172a" },
    tagText: { type: String, default: "Original Tag" },
    printText: { type: String, default: "Custom Drop" },
    printSize: { type: Number, default: 100 },
    rotation: { type: Number, default: 0 },
  },
  { _id: false }
);

const customOrderSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    producer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    improvementNote: {
      type: String,
      required: true,
      trim: true,
    },
    extraCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    preview: {
      type: previewSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "in-production", "shipped", "rejected"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    gatewayOrderId: {
      type: String,
      default: "",
    },
    gatewayPaymentId: {
      type: String,
      default: "",
    },
    paymentSignature: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const CustomOrder = mongoose.model("CustomOrder", customOrderSchema);
export default CustomOrder;
