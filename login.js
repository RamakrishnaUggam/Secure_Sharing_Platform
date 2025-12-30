// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

const form = document.getElementById("loginForm") || document.querySelector("form");
const messageEl = document.getElementById("formMessage");
const forgotRowEl = document.getElementById("forgotPasswordRow");

let messageTimer;

function setForgotVisible(visible) {
  if (!forgotRowEl) return;
  forgotRowEl.style.display = visible ? "flex" : "none";
}

function clearMessage() {
  if (!messageEl) return;
  messageEl.textContent = "";
  messageEl.classList.remove("is-visible");
}

function showMessage(text, autoHideMs) {
  if (!messageEl) return;
  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = undefined;
  }

  messageEl.textContent = String(text || "");
  if (messageEl.textContent.trim().length > 0) {
    messageEl.classList.add("is-visible");
  } else {
    messageEl.classList.remove("is-visible");
  }

  if (autoHideMs && Number.isFinite(autoHideMs) && autoHideMs > 0) {
    messageTimer = setTimeout(() => {
      clearMessage();
    }, autoHideMs);
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
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid credentials";
    case "auth/invalid-email":
      return "Please enter a valid email";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later";
    case "auth/network-request-failed":
      return "Network error. Please check your connection";
    default:
      return "Login failed. Please try again";
  }
}

// Show a one-time success message after registration.
(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("registered") === "1") {
    showMessage("Account created. Please log in.", 6000);

    // Remove the query flag so refresh/back doesn't keep showing it.
    params.delete("registered");
    const cleaned = params.toString();
    const newUrl = cleaned ? `${window.location.pathname}?${cleaned}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }
})();

setupPasswordToggle("password", "togglePassword");

// Only show "Forgot password" after an invalid-credentials attempt.
setForgotVisible(false);

document.getElementById("email")?.addEventListener("input", () => setForgotVisible(false));
document.getElementById("password")?.addEventListener("input", () => setForgotVisible(false));

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    showMessage("Please enter email and password");
    return;
  }

  showMessage("Signing in…");
  setForgotVisible(false);

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      showMessage("Logged in successfully");
      setTimeout(() => {
        window.location.href = "home.html";
      }, 900);
    })
    .catch((error) => {
      const code = error?.code || "";
      // Firebase commonly returns auth/invalid-login-credentials for wrong password.
      // Show "Forgot password" only when the failure indicates wrong/invalid credentials.
      const shouldShowForgot =
        code === "auth/wrong-password" || code === "auth/invalid-login-credentials";
      setForgotVisible(shouldShowForgot);
      showMessage(friendlyAuthError(error));
    });
});

