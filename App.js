// App.js — ENTRY sifatida ishlaydi (Expo App.js-ni avtomatik o'qiydi)

// 1) Har doim eng tepada:
import 'react-native-gesture-handler';
import 'react-native-reanimated';

// 2) Dev Client/Hermes’da ba’zan global.require bo‘lmaydi.
// Metro runtime esa __r orqali bo‘ladi — shuni polyfill qilamiz:
if (process.env.NODE_ENV !== 'production' && !globalThis.require && globalThis.__r) {
  globalThis.require = globalThis.__r;
}

import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, firestore } from "./firebase";

import LoginScreen from "./screens/LoginScreen";
import StudentsApp from "./students_app/StudentsApp";
import TeachersApp from "./teachers_app/TeachersApp";

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Track Player: background service registratsiyasi (MUHIM)
// (Fast Refresh paytida 2 marta registratsiya bo‘lib ketmasligi uchun guard)
import TrackPlayer from "react-native-track-player";
if (!globalThis.__TRACK_SERVICE_REGISTERED__) {
  try {
    // Eslatma: fayl ildizda bo‘lishi kerak: ./trackPlayerService.js
    TrackPlayer.registerPlaybackService(() => require("./trackPlayerService"));
    globalThis.__TRACK_SERVICE_REGISTERED__ = true;
  } catch (e) {
    // Hushyorlik uchun log (dev rejimida bo‘lishi mumkin)
    console.warn("TrackPlayer service registration warning:", e?.message || e);
  }
}
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

/* ------------------ Notifications: global handler ------------------ */
// Ilova foreground bo‘lsa ham banner ko‘rsatish:
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ---- Helper: ruxsat so‘rash + Expo token olish + Firestore’ga yozish ---- */
async function registerForPushAndSaveToken(uid) {
  try {
    if (!Device.isDevice || !uid) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    // Expo Go ham ishlaydi
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();

    if (expoPushToken) {
      await setDoc(
        doc(firestore, "users", uid),
        {
          expoPushToken,
          platform: Platform.OS,
          pushTokenUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return expoPushToken;
  } catch (err) {
    console.warn("Push registration failed:", err?.message || err);
    return null;
  }
}

const Stack = createNativeStackNavigator();
export const navRef = createNavigationContainerRef();

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Android: heads-up banner uchun kanal
  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: "default",
          lightColor: "#FF231F7C",
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      }
    })();
  }, []);

  // Auth + role olish
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const snap = await getDoc(doc(firestore, "users", currentUser.uid));
          setRole(snap.exists() ? snap.data().role || null : null);
        } catch (e) {
          console.error("Error fetching user role:", e?.message || e);
          setRole(null);
        }
      } else {
        setRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Login bo‘lganda token yozish
  useEffect(() => {
    if (user?.uid) {
      registerForPushAndSaveToken(user.uid);
    }
  }, [user?.uid]);

  // Notification’ni bosganda navigatsiya qilish
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (!navRef.isReady()) return;
      if (role === "student") {
        navRef.navigate("StudentsApp", { screen: "NotificationsListScreen" });
      } else if (role === "teacher") {
        navRef.navigate("TeachersApp");
      } else {
        navRef.navigate("Login");
      }
    });
    return () => sub.remove();
  }, [role]);

  const initialRouteName = useMemo(() => {
    if (!user || !role) return "Login";
    return role === "teacher" ? "TeachersApp" : role === "student" ? "StudentsApp" : "Login";
  }, [user, role]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
            {!user || !role ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : role === "teacher" ? (
              <Stack.Screen name="TeachersApp" component={TeachersApp} />
            ) : role === "student" ? (
              <Stack.Screen name="StudentsApp" component={StudentsApp} />
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
