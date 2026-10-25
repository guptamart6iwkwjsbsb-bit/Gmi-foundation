
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs,
  doc, getDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWetR67SisPPJOTUILWPlOxudhXdysrbg",
  authDomain: "gmi-foundation.firebaseapp.com",
  projectId: "gmi-foundation",
  storageBucket: "gmi-foundation.firebasestorage.app",
  messagingSenderId: "481868068539",
  appId: "1:481868068539:web:98360aace6f55697921b9e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let isAdmin = false;
let products = [];
let cart = [];

const $ = id => document.getElementById(id);
const rupees = n => Number(n || 0).toLocaleString("en-IN");
const safe = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])
);

async function signup() {
  try {
    const credential = await createUserWithEmailAndPassword(
      auth, $("email").value.trim(), $("password").value
    );
    await addDoc(collection(db, "users_pending"), {
      uid: credential.user.uid,
      email: credential.user.email,
      createdAt: serverTimestamp()
    });
    $("message").textContent = "Account created. You are signed in.";
  } catch (e) {
    $("message").textContent = e.message;
  }
}

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(
      auth, $("email").value.trim(), $("password").value
    );
    $("message").textContent = "Login successful.";
  } catch (e) {
    $("message").textContent = e.message;
  }
});

async function logout() {
  await signOut(auth);
}
window.logout = logout;

onAuthStateChanged(auth, async user => {
  currentUser = user;
  $("logoutBtn").hidden = !user;
  isAdmin = false;
  $("admin").hidden = true;

  if (user) {
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      isAdmin = profile.exists() && profile.data().role === "admin";
      $("admin").hidden = !isAdmin;
      if (isAdmin) await loadAdminOrders();
    } catch (e) {
      $("message").textContent = "Profile error: " + e.message;
    }
  }
});

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    products = snapshot.docs.map(d => ({id:d.id, ...d.data()}));
    renderProducts();
    renderAdminProducts();
  } catch (e) {
    $("productList").textContent =
      "Products load नहीं हुए। Firebase Firestore और Rules जाँचें: " + e.message;
  }
}

function renderProducts() {
  const term = $("search").value.toLowerCase();
  const shown = products.filter(p =>
    (p.name || "").toLowerCase().includes(term)
  );

  $("productList").innerHTML = shown.length ? shown.map(p => `
    <article class="card">
      ${p.imageUrl ? `<img src="${safe(p.imageUrl)}" alt="${safe(p.name)}">` : ""}
      <h3>${safe(p.name)}</h3>
      <p>${safe(p.description || "")}</p>
      <b>₹${rupees(p.price)}</b>
      <p>Stock: ${Number(p.stock || 0)}</p>
      <button onclick="addToCart('${p.id}')"
        ${Number(p.stock || 0) < 1 ? "disabled" : ""}>Add to Cart</button>
    </article>`).join("") : "<p>No products yet. Admin can add products.</p>";
}
window.renderProducts = renderProducts;

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const item = cart.find(x => x.id === id);
  if ((item?.qty || 0) + 1 > Number(p.stock || 0)) {
    alert("Stock available नहीं है।");
    return;
  }
  if (item) item.qty++;
  else cart.push({id, name:p.name, price:Number(p.price), qty:1});
  $("cartCount").textContent = cart.reduce((n,x)=>n+x.qty,0);
}
window.addToCart = addToCart;

function showCart() {
  $("cart").hidden = false;
  $("cartItems").innerHTML = cart.map(x =>
    `<p>${safe(x.name)} × ${x.qty} — ₹${rupees(x.price*x.qty)}</p>`
  ).join("") || "Cart खाली है।";
  $("total").textContent = rupees(cart.reduce((n,x)=>n+x.price*x.qty,0));
  $("cart").scrollIntoView({behavior:"smooth"});
}
window.showCart = showCart;

$("productForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!isAdmin) return alert("Admin access required.");
  try {
    await addDoc(collection(db, "products"), {
      name:$("pName").value.trim(),
      price:Number($("pPrice").value),
      stock:Number($("pStock").value),
      imageUrl:$("pImage").value.trim(),
      description:$("pDescription").value.trim(),
      active:true,
      createdAt:serverTimestamp()
    });
    $("productForm").reset();
    await loadProducts();
  } catch (e) {
    alert(e.message);
  }
});

function renderAdminProducts() {
  if (!isAdmin) return;
  $("adminProducts").innerHTML = products.map(p => `
    <div class="card">
      <b>${safe(p.name)}</b> — ₹${rupees(p.price)}
      <p>Stock: ${Number(p.stock || 0)}</p>
      <button onclick="removeProduct('${p.id}')">Delete</button>
    </div>`).join("") || "No products.";
}

async function removeProduct(id) {
  if (!isAdmin || !confirm("Delete this product?")) return;
  try {
    await deleteDoc(doc(db, "products", id));
    await loadProducts();
  } catch(e) { alert(e.message); }
}
window.removeProduct = removeProduct;

async function placeOrder() {
  if (!currentUser) {
    $("message").textContent = "पहले login करें।";
    $("account").scrollIntoView({behavior:"smooth"});
    return;
  }
  if (!cart.length) return alert("Cart खाली है।");
  const address = $("address").value.trim();
  if (address.length < 8) return alert("पूरा delivery address लिखें।");

  const items = cart.map(x => ({...x}));
  const total = items.reduce((n,x)=>n+x.price*x.qty,0);
  try {
    const orderRef = doc(collection(db, "orders"));
    await runTransaction(db, async tx => {
      const refs = items.map(x => doc(db, "products", x.id));
      const snapshots = [];
      for (const ref of refs) snapshots.push(await tx.get(ref));
      snapshots.forEach((s,i) => {
        if (!s.exists() || Number(s.data().stock || 0) < items[i].qty)
          throw new Error("Stock कम है: " + items[i].name);
      });
      snapshots.forEach((s,i) => tx.update(refs[i], {
        stock:Number(s.data().stock || 0) - items[i].qty
      }));
      tx.set(orderRef, {
        userId:currentUser.uid,
        email:currentUser.email,
        items,total,address,status:"Placed",
        createdAt:serverTimestamp()
      });
    });
    cart = [];
    $("cartCount").textContent = "0";
    $("cartItems").textContent = "Order placed: " + orderRef.id;
    await loadProducts();
    if (isAdmin) await loadAdminOrders();
  } catch(e) {
    alert("Order failed: " + e.message);
  }
}
window.placeOrder = placeOrder;

async function loadAdminOrders() {
  if (!isAdmin) return;
  try {
    const snapshot = await getDocs(collection(db, "orders"));
    $("adminOrders").innerHTML = snapshot.docs.map(d => {
      const o=d.data();
      return `<div class="card"><b>Order ${safe(d.id)}</b>
      <p>${safe(o.email)} — ₹${rupees(o.total)}</p>
      <p>${safe(o.address)}</p>
      <p>Status: ${safe(o.status)}</p></div>`;
    }).join("") || "No orders yet.";
  } catch(e) {
    $("adminOrders").textContent = e.message;
  }
}

loadProducts();
        
