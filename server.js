require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const admin = require("firebase-admin");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= FIREBASE ================= */

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )
});

const db = admin.firestore();

/* ================= RAZORPAY ================= */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

/* ================= AUTH MIDDLEWARE ================= */

async function verifyUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).send("No token");
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).send("Unauthorized");
  }
}

/* ================= CREATE ORDER ================= */

app.post("/create-order", verifyUser, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).send("Missing productId");
    }

    const doc = await db.collection("products").doc(productId).get();

    if (!doc.exists) {
      return res.status(404).send("Product not found");
    }

    const p = doc.data();

    if (!p.price) {
      return res.status(400).send("Invalid product price");
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: p.price * 100, // paise
      currency: "INR"
    });

    // Save order in Firestore
    await db.collection("orders").doc(order.id).set({
      userId: req.user.uid,
      productId,
      productName: p.name,
      totalPrice: p.price,
      status: "PENDING",
      createdAt: new Date()
    });

    res.json(order);

  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).send("Server error");
  }
});

/* ================= VERIFY PAYMENT ================= */

app.post("/verify", verifyUser, async (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    // Validate input
    if (!order_id || !payment_id || !signature) {
      return res.status(400).send("Missing payment data");
    }

    // Generate expected signature
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest("hex");

    // Verify signature
    if (expected !== signature) {
      return res.status(400).send("Invalid signature");
    }

    // Update order status
    await db.collection("orders").doc(order_id).update({
      status: "PAID",
      paymentId: payment_id
    });

    res.send({ success: true });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).send("Server error");
  }
});

/* ================= GET USER ORDERS ================= */

app.get("/orders", verifyUser, async (req, res) => {
  try {
    const snap = await db.collection("orders")
      .where("userId", "==", req.user.uid)
      .get();

    const orders = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    res.json(orders);

  } catch (err) {
    console.error("Orders error:", err);
    res.status(500).send("Server error");
  }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
