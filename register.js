// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD7f6dVud8ScJtsfu9K_RZh4gJqgkIbvqk",
  authDomain: "fir-56c08.firebaseapp.com",
  projectId: "fir-56c08",
  storageBucket: "fir-56c08.firebasestorage.app",
  messagingSenderId: "1044236312500",
  appId: "1:1044236312500:web:9aa914b0b61f7cf1899ce1",
  measurementId: "G-NPQ69E5X69"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();

const register = document.getElementById("register");
const messageEl = document.getElementById("formMessage");

function showMessage(text) {
  if (!messageEl) return;
  messageEl.textContent = String(text || "");
  if (messageEl.textContent.trim().length > 0) {
    messageEl.classList.add("is-visible");
  } else {
    messageEl.classList.remove("is-visible");
  }
}

function setupPasswordToggle(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if (!input || !button) return;

  button.addEventListener("click", () => {
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    button.textContent = willShow ? "Hide" : "View";
  });
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Email already in use";
    case "auth/invalid-email":
      return "Please enter a valid email";
    case "auth/weak-password":
      return "Password should be at least 6 characters";
    case "auth/network-request-failed":
      return "Network error. Please check your connection";
    default:
      return "Registration failed. Please try again";
  }
}

setupPasswordToggle("password", "togglePassword");

register.addEventListener("click", function(event) {
    event.preventDefault()
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm")?.value;

    if (!email || !password) {
      showMessage("Please enter email and password");
      return;
    }

    if (confirm !== undefined && confirm !== password) {
      showMessage("Passwords do not match");
      return;
    }

showMessage("Creating account…");

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed up 
    const user = userCredential.user;
    showMessage("Account registered successfully. Redirecting…");
    window.location.href = "index.html?registered=1";
  })
  .catch((error) => {
    showMessage(friendlyAuthError(error));
  });
})

