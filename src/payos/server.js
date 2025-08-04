const express = require("express");
const cors = require("cors");
const PayOS = require("@payos/node");
const jwt = require("jsonwebtoken");
const axios = require("axios");
require("dotenv").config();

// ==== Khai báo app ====
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ==== Cấu hình PayOS ====
const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

// ==== Lưu tạm userId theo orderCode ====
const orderUserMap = new Map();

// ==== Tạo payment link ====
app.post("/create-payment-link", async (req, res) => {
  try {
    const { amount, message } = req.body;
    const authHeader = req.headers.authorization;
    const orderCode = Math.floor(Math.random() * 1000000000);
    let userId = null;

    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.split(" ")[1];
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      userId = decoded.id;
      orderUserMap.set(orderCode.toString(), userId);
    }

    //console.log( "Creating payment link with orderCode:", orderCode, "and userId:", userId);

    const paymentLink = await payOS.createPaymentLink({
      orderCode,
      amount,
      description: message || "Ủng hộ trang web",
      returnUrl: "http://localhost:5173/donation/success",
      cancelUrl: "http://localhost:5173/donation/cancel",
    });

    

    return res.status(200).json({ url: paymentLink.checkoutUrl });
  } catch (error) {
    console.error("Create payment link error:", error.message);
    res.status(400).json({ message: "Failed to create payment link" });
  }
});

// ==== Webhook xử lý thanh toán từ PayOS ====
app.post("/webhook", async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !data.amount) {
      return res.status(400).json({ message: "Invalid webhook data" });
    }

    const userId = orderUserMap.get(data.orderCode.toString()) || null;

    await axios.post("http://localhost:9999/donations/save-donation", {
      donor: userId,
      amount: data.amount,
      message: data.description || "",
    });

    res.status(200).json({ message: "Webhook received and forwarded" });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.sendStatus(400);
  }
});

// ==== Kết Nối server ====
app.listen(3030, () => {
  console.log("Server is running on port 3030");
});

