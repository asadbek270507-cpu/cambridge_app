import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, firestore } from "./firebase";

import LoginScreen from "./screens/LoginScreen";
import StudentsApp from "./students_app/StudentsApp";
import TeachersApp from "./teachers_app/TeachersApp";

// Navigation ref
export const navRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();

// --- Push registration
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

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;
    if (!projectId) return null;

    const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenObj?.data || tokenObj;

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
    console.log("✅ Expo Push Token:", expoPushToken);
    return expoPushToken;
  } catch (err) {
    console.warn("Push registration failed:", err?.message || err);
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [roleReady, setRoleReady] = useState(false);

  // --- Android channel
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      }).catch((e) => console.warn(e?.message || e));
    }
  }, []);

  // --- Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (!currentUser) {
        setRole(null);
        setRoleReady(true);
        return;
      }

      setRoleReady(false);
      try {
        const snap = await getDoc(doc(firestore, "users", currentUser.uid));
        let r = snap.exists() ? snap.data()?.role : null;

        // fallback by email
        if (!r && currentUser.email) {
          const em = currentUser.email.toLowerCase();
          if (em.endsWith("@teacher.com")) r = "teacher";
          else if (em.endsWith("@student.com")) r = "student";
        }

        setRole(r);
      } catch {
        setRole(null);
      } finally {
        setRoleReady(true);
      }
    });

    return unsub;
  }, []);

  // --- Save push token
  useEffect(() => {
    if (user?.uid) registerForPushAndSaveToken(user.uid);
  }, [user?.uid]);

  // --- Notification tapped handler
  const handleNotificationResponse = (response) => {
    if (!response || !navRef.isReady()) return;

    const data = response.notification?.request?.content?.data || {};
    const screen = data.screen;
    const params = data.params || undefined;

    if (role === "student") {
      navRef.navigate("StudentsApp", { screen: screen || "NotificationsListScreen", params });
    } else if (role === "teacher") {
      navRef.navigate("TeachersApp", { screen: screen || undefined, params });
    } else {
      navRef.navigate("Login");
    }
  };

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) handleNotificationResponse(last);
    })();

    return () => sub.remove();
  }, [role]);

  if (!authReady || !roleReady) {
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
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user || !role ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : role === "teacher" ? (
              <Stack.Screen name="TeachersApp" component={TeachersApp} />
            ) : (
              <Stack.Screen name="StudentsApp" component={StudentsApp} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
