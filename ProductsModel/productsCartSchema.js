import mongoose from "mongoose";

const productsCartSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    products: [
        {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"
        },
        quantity: Number
    }
]
})
const Cart = new mongoose.model("Cart", productsCartSchema);
export default Cart;