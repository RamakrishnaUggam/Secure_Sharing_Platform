import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7f6dVud8ScJtsfu9K_RZh4gJqgkIbvqk",
  authDomain: "fir-56c08.firebaseapp.com",
  projectId: "fir-56c08",
  storageBucket: "fir-56c08.firebasestorage.app",
  messagingSenderId: "1044236312500",
  appId: "1:1044236312500:web:9aa914b0b61f7cf1899ce1",
  measurementId: "G-NPQ69E5X69"
};

// Avoid double-initializing if another module already initialized Firebase.
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}

const auth = getAuth();

(async () => {
  try {
    await signOut(auth);
  } catch (e) {
    // If signOut fails, still send user to login.
    console.error(e);
  } finally {
    // Replace history so Back doesn't re-open protected pages.
    window.location.replace("index.html");
  }
})();
