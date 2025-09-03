// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// --- Sizning config'ingiz ---
export const firebaseConfig = {
  apiKey: "AIzaSyB9ThIDs4hNy_IUTHmIwGPYjhbS-rbmGYM",
  authDomain: "cambridge-school-e4a8f.firebaseapp.com",
  databaseURL:
    "https://cambridge-school-e4a8f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cambridge-school-e4a8f",
  storageBucket: "cambridge-school-e4a8f.firebasestorage.app",
  messagingSenderId: "586644599616",
  appId: "1:586644599616:web:ef120c3f3448ca65a180a5",
  measurementId: "G-L6QFTR85TC",
};

// --- App ---
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// --- Default Auth (RN persistence bilan) ---
let _auth;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Fast Refresh / qayta init bo'lsa:
  _auth = getAuth(app);
}
export const auth = _auth;

// --- Firestore/Storage ---
export const firestore = getFirestore(app);
export const storage = getStorage(app);

// --- Secondary Auth: student yaratishda teacher sessiyasini saqlash ---
let _secondaryAuth = null;
export const getSecondaryAuth = () => {
  if (_secondaryAuth) return _secondaryAuth;

  const secondaryApp =
    getApps().find((a) => a.name === "Secondary") ||
    initializeApp(firebaseConfig, "Secondary");

  try {
    _secondaryAuth = initializeAuth(secondaryApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    _secondaryAuth = getAuth(secondaryApp);
  }
  return _secondaryAuth;
};
