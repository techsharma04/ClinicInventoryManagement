// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDanzYFLarVwJB96SJ_SqJDTpUmFg8smdk",
  authDomain: "clinicinventorymanagemen-8bea8.firebaseapp.com",
  projectId: "clinicinventorymanagemen-8bea8",
  storageBucket: "clinicinventorymanagemen-8bea8.firebasestorage.app",
  messagingSenderId: "855689338068",
  appId: "1:855689338068:web:278e06e87cb52ad739af41"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
