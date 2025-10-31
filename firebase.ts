import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = { 
  apiKey : "AIzaSyBv-fCE1zGvZcMq2r0fPm6WNCY9g7sz0nM" , 
  authDomain : "dtltsl.firebaseapp.com" , 
  projectId : "dtltsl" , 
  storageBucket : "dtltsl.firebasestorage.app" , 
  messagingSenderId : "254821251307" , 
  appId : "1:254821251307:web:66be828f143709bc8926ae" , 
  measurementId : "G-H8QWZGRWHZ" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth instance to be used in other parts of the app
export const auth = getAuth(app);
// Export firestore instance
export const db = getFirestore(app);