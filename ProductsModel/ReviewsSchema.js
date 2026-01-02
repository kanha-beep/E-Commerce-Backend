import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
    comment: String,
    ratings: Number
})
const Review = new mongoose.model("Review", ReviewSchema)
export default Review;