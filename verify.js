import crypto from "crypto";

app.post("/verify-payment", (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    } = req.body;

    // 1️⃣ Create body string
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    // 2️⃣ Generate expected signature
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    // 3️⃣ Compare signatures
    if (expectedSignature === razorpay_signature) {
        // ✅ Payment verified
        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
        });
    } else {
        // ❌ Invalid payment
        return res.status(400).json({
            success: false,
            message: "Invalid payment signature",
        });
    }
});
