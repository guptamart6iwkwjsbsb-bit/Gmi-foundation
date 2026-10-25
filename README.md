
# GMI Foundation

Firebase-powered cosmetics storefront.

## Setup
1. Enable Email/Password in Firebase Authentication.
2. Create a Firestore Database.
3. Publish firestore.rules.
4. Host index.html, style.css, and app.js on HTTPS.
5. Create your own account and set the role field to admin in
   Firestore's users/{uid} document.

## Collections
- products: name, price, stock, imageUrl, description, active
- users: email, role
- orders: userId, items, total, address, status

Use real product information and verify your Firestore rules before
accepting orders or payments.
