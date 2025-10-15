// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firestore (RN/Expo uchun barqaror init)
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  setLogLevel,
} from "firebase/firestore";

import { getStorage } from "firebase/storage";

// --- Sizning config'ingiz ---
export const firebaseConfig = {
  apiKey: "AIzaSyDfpMnWWELYZoB43Sh7JTmKvZGPKjwMtZI",
  authDomain: "cambridge-34d8b.firebaseapp.com",
  databaseURL:
    "https://cambridge-34d8b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cambridge-34d8b",
  storageBucket: "cambridge-34d8b.firebasestorage.app", // agar rasmiy bucket bo'lsa odatda ...appspot.com bo'ladi
  messagingSenderId: "930140582475",
  appId: "1:930140582475:web:7ab7b8193b19631405d3ce",
  measurementId: "G-EGCMBVY8PL",
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

// --- Firestore (RN/Expo fix) ---
let _firestore;
try {
  _firestore = initializeFirestore(app, {
    // Mahalliy kechlash — offline/online barqarorligi uchun
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager(),
    }),

    // 🔑 RN/Expo’da WebChannel muammolarini chetlab o‘tish:
    experimentalForceLongPolling: true,   // streamingni to'liq o'chirib, long-pollingga majburlaydi
    experimentalAutoDetectLongPolling: false,
    useFetchStreams: false,
    longPollingOptions: { timeoutSeconds: 10 }, // ixtiyoriy: tezroq retry
  });
} catch (e) {
  // Allaqachon init qilingan bo'lsa
  _firestore = getFirestore(app);
}
export const firestore = _firestore;

// Konsol shovqinini kamaytirish (ixtiyoriy)
try {
  setLogLevel(__DEV__ ? "warn" : "error");
} catch {}

// --- Storage ---
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

export default app;
