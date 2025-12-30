// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendEmailVerification, signOut, reload } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

function getContinueUrl() {
  try {
    const origin = window.location?.origin;
    if (!origin || origin === "null") return null;
    return `${origin}/index.html?verified=1`;
  } catch {
    return null;
  }
}

function shouldThrottleVerificationSend(uid) {
  if (!uid) return false;
  try {
    const key = `verifyEmailSentAt:${uid}`;
    const last = Number(localStorage.getItem(key) || "0");
    const now = Date.now();
    if (!Number.isFinite(last) || last <= 0) return false;
    // Avoid spamming: allow one send per 2 minutes per user.
    return now - last < 2 * 60 * 1000;
  } catch {
    return false;
  }
}

function markVerificationEmailSent(uid) {
  try {
    if (!uid) return;
    localStorage.setItem(`verifyEmailSentAt:${uid}`, String(Date.now()));
  } catch {
    // ignore
  }
}

async function sendVerificationEmailBestEffort(user) {
  if (!user) throw new Error("Missing user");

  const continueUrl = getContinueUrl();
  try {
    const actionCodeSettings = continueUrl ? { url: continueUrl } : undefined;
    await sendEmailVerification(user, actionCodeSettings);
    return;
  } catch (e) {
    const code = String(e?.code || "");
    if (code === "auth/invalid-continue-uri" || code === "auth/unauthorized-continue-uri") {
      await sendEmailVerification(user);
      return;
    }
    throw e;
  }
}

// Show a one-time success message after registration.
(() => {
  const params = new URLSearchParams(window.location.search);
  const registered = params.get("registered") === "1";
  const verify = params.get("verify") === "1";
  const verified = params.get("verified") === "1";

  if (verified) {
    showMessage("Email verified. You can log in now.", 7000);
  } else if (registered && verify) {
    showMessage("Account created. Please verify your email (check Inbox/Spam), then log in.", 9000);
  } else if (verify) {
    showMessage("Please verify your email, then log in.", 8000);
  } else if (registered) {
    showMessage("Account created. Please log in.", 6000);
  }

  if (registered || verify || verified) {

    // Remove the query flag so refresh/back doesn't keep showing it.
    params.delete("registered");
    params.delete("verify");
    params.delete("verified");
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
    .then(async () => {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user");

      // Ensure we have fresh emailVerified state.
      try {
        await reload(user);
      } catch {
        // ignore
      }

      if (!user.emailVerified) {
        // Optionally send verification email again (throttled).
        try {
          if (!shouldThrottleVerificationSend(user.uid)) {
            await sendVerificationEmailBestEffort(user);
            markVerificationEmailSent(user.uid);
          }
        } catch (e) {
          // ignore (we'll still block access), but show a helpful hint.
          const code = String(e?.code || "");
          const hint = code ? ` (Firebase: ${code})` : "";
          showMessage(`Email not verified.${hint} Please verify and then log in.`, 9000);
        }

        try {
          await signOut(auth);
        } catch {
          // ignore
        }

        showMessage("Email not verified. We sent a verification link (if not recently sent). Check Inbox/Spam, verify, then log in.");
        return;
      }

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

