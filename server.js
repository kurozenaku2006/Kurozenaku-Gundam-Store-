require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const admin = require("firebase-admin");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

admin.initializeApp({
 credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const db = admin.firestore();

const razorpay = new Razorpay({
 key_id: process.env.RAZORPAY_KEY,
 key_secret: process.env.RAZORPAY_SECRET
});

async function verifyUser(req,res,next){
 try{
  const token = req.headers.authorization?.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  req.user = decoded;
  next();
 }catch{
  res.status(401).send("Unauthorized");
 }
}

app.post("/create-order", verifyUser, async (req,res)=>{
 const {productId} = req.body;

 const doc = await db.collection("products").doc(productId).get();
 const p = doc.data();

 const order = await razorpay.orders.create({
  amount: p.price * 100,
  currency:"INR"
 });

 await db.collection("orders").doc(order.id).set({
  userId:req.user.uid,
  productId,
  productName:p.name,
  totalPrice:p.price,
  type: p.preorder ? "PREORDER" : "NORMAL",
  status:"PENDING",
  deliveryDate:p.deliveryDate || null
 });

 res.json(order);
});

app.post("/verify", verifyUser, async (req,res)=>{
 const {order_id,payment_id,signature} = req.body;

 const expected = crypto.createHmac("sha256",process.env.RAZORPAY_SECRET)
  .update(order_id + "|" + payment_id)
  .digest("hex");

 if(expected !== signature){
  return res.status(400).send("Invalid signature");
 }

 await db.collection("orders").doc(order_id).update({
  status:"PAID"
 });

 res.send({success:true});
});

app.get("/orders", verifyUser, async (req,res)=>{
 const snap = await db.collection("orders")
  .where("userId","==",req.user.uid)
  .get();

 res.json(snap.docs.map(d=>({
  id:d.id,
  ...d.data()
 })));
});

app.listen(5000, ()=>console.log("Server running"));
