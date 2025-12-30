import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7f6dVud8ScJtsfu9K_RZh4gJqgkIbvqk",
  authDomain: "fir-56c08.firebaseapp.com",
  projectId: "fir-56c08",
  storageBucket: "fir-56c08.firebasestorage.app",
  messagingSenderId: "1044236312500",
  appId: "1:1044236312500:web:9aa914b0b61f7cf1899ce1",
  measurementId: "G-NPQ69E5X69",
};

initializeApp(firebaseConfig);
const auth = getAuth();

const form = document.getElementById("resetForm") || document.querySelector("form");
const messageEl = document.getElementById("formMessage");

let messageTimer;

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

function friendlyAuthError(error) {
  const code = error?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email";
    case "auth/user-not-found":
      return "No account found for this email";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later";
    case "auth/network-request-failed":
      return "Network error. Please check your connection";
    default:
      return "Could not send reset email. Please try again";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.getElementById("email")?.value?.trim();
  if (!email) {
    showMessage("Please enter your email");
    return;
  }

  showMessage("Sending reset email…");

  sendPasswordResetEmail(auth, email)
    .then(() => {
      showMessage("Reset email sent. Please check your inbox.", 7000);
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1500);
    })
    .catch((error) => {
      showMessage(friendlyAuthError(error));
    });
});
