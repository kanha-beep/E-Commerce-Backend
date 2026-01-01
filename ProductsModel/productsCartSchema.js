import mongoose from "mongoose";

const productsCartSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }]
})
const Cart = new mongoose.model("Cart", productsCartSchema);
export default Cart;
