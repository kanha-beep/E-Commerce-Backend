import mongoose from "mongoose";

const productsSchema = new mongoose.Schema({
    name: String,
    price: String,
    quantity: String,
    owner: String,
    image: String,
    cart: [{
        cart: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Cart"
        },
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    }],
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review"
    }]
})
const Product = new mongoose.model("Product", productsSchema)
export default Product;