import mongoose from "mongoose"
import Cart from "./ProductsModel/productsCartSchema.js";
import "dotenv/config";

const MONGO_URI = process.env.MONGO_URI;
console.log("url: ", MONGO_URI)
const mongooseConnect = async () => {
    try{
await mongoose.connect(MONGO_URI);
    await Cart.deleteMany({});
    console.log("Cart cleared");
    } catch(e){
        console.log("Error clearing cart: ", e?.message)
    }
    
}