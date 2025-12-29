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
register.addEventListener("click", function(event) {
    event.preventDefault()
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm")?.value;

    if (confirm !== undefined && confirm !== password) {
      alert("Passwords do not match");
      return;
    }

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed up 
    const user = userCredential.user;
    alert("Account Registered Successfully");
    window.location.href = "index.html";
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    alert(errorMessage);
  });
})

