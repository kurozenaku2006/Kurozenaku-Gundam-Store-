// ==============================
// 🛒 CART STATE
// ==============================
window.cart = [];
window.total = 0;

// ==============================
// ➕ ADD TO CART
// ==============================
function addToCart(product) {
  window.cart.push(product);
  calculateTotal();
  console.log("Cart:", window.cart);
}

// ==============================
// 💰 CALCULATE TOTAL
// ==============================
function calculateTotal() {
  window.total = window.cart.reduce((sum, item) => sum + item.price, 0);
  console.log("Total:", window.total);
}

// ==============================
// ❌ REMOVE FROM CART
// ==============================
function removeFromCart(index) {
  window.cart.splice(index, 1);
  calculateTotal();
}

// ==============================
// 💳 CHECKOUT (RAZORPAY)
// ==============================
async function checkout() {
  try {
    const user = firebase.auth().currentUser;

    if (!user) {
      alert("Please login first");
      return;
    }

    const token = await user.getIdToken();

    if (window.cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    // ==============================
    // 1️⃣ CREATE ORDER
    // ==============================
    const orderRes = await fetch("http://localhost:5000/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        amount: window.total,
        items: window.cart
      })
    });

    const order = await orderRes.json();

    if (!order.id) {
      throw new Error("Order creation failed");
    }

    // ==============================
    // 2️⃣ OPEN RAZORPAY POPUP
    // ==============================
    const options = {
      key: "rzp_test_SenYF5dCaOG8Ab", // 🔥 REPLACE THIS
      amount: order.amount,
      currency: "INR",
      name: "Kurozenaku Gundam Store",
      description: "Gundam Purchase",
      order_id: order.id,

      handler: async function (response) {
        try {
          // ==============================
          // 3️⃣ VERIFY PAYMENT
          // ==============================
          const verifyRes = await fetch("http://localhost:5000/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + token
            },
            body: JSON.stringify(response)
          });

          const result = await verifyRes.json();

          if (result.success) {
            alert("Payment Successful!");

            // 🧹 Clear cart
            window.cart = [];
            window.total = 0;
          } else {
            alert("Payment verification failed");
          }

        } catch (err) {
          console.error("Verify error:", err);
          alert("Verification failed");
        }
      },

      theme: {
        color: "#111827"
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error("Checkout error:", err);
    alert("Checkout failed");
  }
}
