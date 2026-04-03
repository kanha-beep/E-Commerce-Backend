import mongoose from "mongoose";

const voteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  { _id: false }
);

const communityRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    desiredPrice: {
      type: Number,
      min: 1,
      default: 999,
    },
    image: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    votes: [voteSchema],
    threshold: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["open", "assigned", "listed"],
      default: "open",
    },
    assignedProducer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    producerMessage: {
      type: String,
      default: "",
      trim: true,
    },
    producerUpdatedAt: {
      type: Date,
      default: null,
    },
    linkedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const CommunityRequest = mongoose.model("CommunityRequest", communityRequestSchema);
export default CommunityRequest;
