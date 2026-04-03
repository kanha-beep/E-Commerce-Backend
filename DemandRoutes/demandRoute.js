import express from "express";
import CommunityRequest from "../ProductsModel/communityRequestSchema.js";
import Products from "../ProductsModel/productsSchema.js";
import User from "../ProductsModel/productsUserSchema.js";
import { verifyToken } from "../middlewares/auth.js";
import ExpressError from "../middlewares/ExpressError.js";
import wrapAsync from "../middlewares/WrapAsync.js";

const router = express.Router();
const COMMUNITY_PRODUCER_EMAIL = "community.producer@amazon.local";
const COMMUNITY_PRODUCER_USERNAME = "Community Producer";

function serializeRequest(request, currentUserId) {
  const likes = request.votes.filter((vote) => vote.value === 1).length;
  const dislikes = request.votes.filter((vote) => vote.value === -1).length;
  const currentUserVote =
    request.votes.find((vote) => vote.user.toString() === currentUserId?.toString())?.value || 0;

  return {
    _id: request._id,
    title: request.title,
    category: request.category,
    description: request.description,
    desiredPrice: request.desiredPrice,
    image: request.image,
    threshold: request.threshold,
    status: request.status,
    likes,
    dislikes,
    score: likes - dislikes,
    voteCount: request.votes.length,
    linkedProduct: request.linkedProduct,
    createdAt: request.createdAt,
    createdBy: request.createdBy,
    currentUserVote,
    assignedProducer: request.assignedProducer,
    producerMessage: request.producerMessage,
    producerUpdatedAt: request.producerUpdatedAt,
  };
}

async function ensureCommunityProducer() {
  let producer = await User.findOne({ email: COMMUNITY_PRODUCER_EMAIL });
  if (producer) return producer;

  producer = await User.create({
    username: COMMUNITY_PRODUCER_USERNAME,
    email: COMMUNITY_PRODUCER_EMAIL,
    password: "community-producer-2026",
    roles: "seller",
  });

  return producer;
}

async function findRelevantProducer(request) {
  const categoryPattern = new RegExp(`^${request.category}$`, "i");
  const matchingProduct = await Products.findOne({ category: categoryPattern })
    .sort({ createdAt: -1 })
    .populate("owner", "username email roles");

  if (matchingProduct?.owner?._id) return matchingProduct.owner;
  return ensureCommunityProducer();
}

async function assignProducerIfThresholdReached(request) {
  const likes = request.votes.filter((vote) => vote.value === 1).length;
  if (likes < request.threshold || request.assignedProducer) return request;

  const producer = await findRelevantProducer(request);
  request.assignedProducer = producer._id;
  request.status = "assigned";
  request.producerMessage = `${producer.username} has been assigned to review and produce this request.`;
  request.producerUpdatedAt = new Date();
  await request.save();
  return request;
}

router.get("/", wrapAsync(async (req, res) => {
  const requests = await CommunityRequest.find({})
    .populate("createdBy", "username")
    .populate("assignedProducer", "username email")
    .populate("linkedProduct", "name price")
    .sort({ createdAt: -1 });

  res.json(
    requests.map((request) =>
      serializeRequest(request, req.user?.id)
    )
  );
}));

router.post("/", verifyToken, wrapAsync(async (req, res, next) => {
  const { title, category, description, desiredPrice, image } = req.body;

  if (!title || !category || !description) {
    return next(new ExpressError("Title, category, and description are required", 400));
  }

  const request = await CommunityRequest.create({
    title,
    category,
    description,
    desiredPrice: Number(desiredPrice) || 999,
    image: image || "",
    createdBy: req.user.id,
  });

  const populated = await CommunityRequest.findById(request._id).populate("createdBy", "username");
  res.status(201).json(serializeRequest(populated, req.user.id));
}));

router.post("/:requestId/vote", verifyToken, wrapAsync(async (req, res, next) => {
  const { requestId } = req.params;
  const value = Number(req.body.value);

  if (![1, -1].includes(value)) {
    return next(new ExpressError("Vote value must be 1 or -1", 400));
  }

  const request = await CommunityRequest.findById(requestId)
    .populate("createdBy", "username")
    .populate("assignedProducer", "username email")
    .populate("linkedProduct", "name price");
  if (!request) return next(new ExpressError("Community request not found", 404));

  const existingVote = request.votes.find(
    (vote) => vote.user.toString() === req.user.id.toString()
  );

  if (!existingVote) {
    request.votes.push({ user: req.user.id, value });
  } else if (existingVote.value === value) {
    request.votes = request.votes.filter(
      (vote) => vote.user.toString() !== req.user.id.toString()
    );
  } else {
    existingVote.value = value;
  }

  const likes = request.votes.filter((vote) => vote.value === 1).length;
  if (likes < request.threshold && !request.linkedProduct) {
    request.status = "open";
    request.assignedProducer = null;
    request.producerMessage = "";
    request.producerUpdatedAt = null;
  }

  await request.save();
  await assignProducerIfThresholdReached(request);

  const refreshed = await CommunityRequest.findById(request._id)
    .populate("createdBy", "username")
    .populate("assignedProducer", "username email")
    .populate("linkedProduct", "name price");

  res.json(serializeRequest(refreshed, req.user.id));
}));

router.post("/:requestId/publish", verifyToken, wrapAsync(async (req, res, next) => {
  const { requestId } = req.params;
  const { producerMessage } = req.body;

  const request = await CommunityRequest.findById(requestId)
    .populate("createdBy", "username")
    .populate("assignedProducer", "username email")
    .populate("linkedProduct", "name price");

  if (!request) return next(new ExpressError("Community request not found", 404));
  if (!request.assignedProducer) {
    return next(new ExpressError("No producer has been assigned yet", 400));
  }
  if (request.assignedProducer._id.toString() !== req.user.id.toString()) {
    return next(new ExpressError("Only the assigned producer can publish this request", 403));
  }
  if (request.linkedProduct) {
    return next(new ExpressError("This request has already been published", 400));
  }

  const product = await Products.create({
    name: request.title,
    price: request.desiredPrice || 999,
    owner: request.assignedProducer._id,
    image: request.image || "",
    category: request.category,
    description: request.description,
    isCommunityDemandProduct: true,
    productionStatus: "listed",
    sourceRequest: request._id,
  });

  request.status = "listed";
  request.linkedProduct = product._id;
  request.producerMessage =
    producerMessage?.trim() || `${request.assignedProducer.username} made the product and posted it to the community.`;
  request.producerUpdatedAt = new Date();
  await request.save();

  const refreshed = await CommunityRequest.findById(request._id)
    .populate("createdBy", "username")
    .populate("assignedProducer", "username email")
    .populate("linkedProduct", "name price");

  res.json(serializeRequest(refreshed, req.user.id));
}));

export default router;
