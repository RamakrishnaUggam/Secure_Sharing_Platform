// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

function getContinueUrl() {
  try {
    const origin = window.location?.origin;
    if (!origin || origin === "null") return null;
    return `${origin}/index.html?verified=1`;
  } catch {
    return null;
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

async function sendVerificationEmailBestEffort(user) {
  if (!user) throw new Error("Missing user");

  const continueUrl = getContinueUrl();
  try {
    const actionCodeSettings = continueUrl ? { url: continueUrl } : undefined;
    await sendEmailVerification(user, actionCodeSettings);
    return;
  } catch (e) {
    const code = String(e?.code || "");

    // If the continue URL is not in Firebase "Authorized domains",
    // Firebase throws auth/invalid-continue-uri or auth/unauthorized-continue-uri.
    // Retry without actionCodeSettings so Firebase uses its default handler.
    if (code === "auth/invalid-continue-uri" || code === "auth/unauthorized-continue-uri") {
      await sendEmailVerification(user);
      return;
    }

    throw e;
  }
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
  const name = document.getElementById("name")?.value?.trim();
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
  .then(async (userCredential) => {
    // Signed up 
    const user = userCredential.user;

    if (name) {
      try {
        await updateProfile(user, { displayName: name });
      } catch (e) {
        // Non-blocking: account is created even if profile update fails.
        console.warn(e);
      }
    }

    try {
      await sendVerificationEmailBestEffort(user);
      markVerificationEmailSent(user.uid);
    } catch (e) {
      console.warn(e);
      const code = String(e?.code || "");
      const hint = code ? ` (Firebase: ${code})` : "";
      showMessage(`Account created, but we couldn't send a verification email.${hint} Please check your Firebase Auth settings and try again.`);
      return;
    }

    // Force verification before allowing access.
    try {
      await signOut(auth);
    } catch {
      // ignore
    }

    showMessage("Verification email sent. Please check Inbox/Spam, verify your email, then log in.");
    window.location.href = "index.html?registered=1&verify=1";
  })
  .catch((error) => {
    showMessage(friendlyAuthError(error));
  });
})

