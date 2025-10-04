import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from './firebase';

import LoginScreen from './screens/LoginScreen';
import StudentsApp from './students_app/StudentsApp';
import TeachersApp from './teachers_app/TeachersApp';

// ❗ Eslatma: service ro'yxatdan o'tkazish index.js da. Bu faylda QILMAYMIZ.
// import TrackPlayer from 'react-native-track-player';
// TrackPlayer.registerPlaybackService(() => require('./trackPlayerService').default);

/* ---- Notifications handler ---- */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushAndSaveToken(uid) {
  try {
    if (!Device.isDevice || !uid) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // ✅ Project ID: EAS dan o'qiymiz, bo'lmasa token so'ramaymiz
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;

    if (!projectId) {
      console.warn('No EAS projectId found for push token; skipping getExpoPushTokenAsync');
      return null;
    }

    const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenObj?.data || tokenObj;

    if (expoPushToken) {
      await setDoc(
        doc(firestore, 'users', uid),
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
    console.warn('Push registration failed:', err?.message || err);
    return null;
  }
}

const Stack = createNativeStackNavigator();
export const navRef = createNavigationContainerRef();

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  const [authReady, setAuthReady] = useState(false);
  const [roleReady, setRoleReady] = useState(false);

  // Android notification channel
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          lightColor: '#FF231F7C',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      }
    })();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (!currentUser) {
        setRole(null);
        setRoleReady(true);
        return;
      }

      setRoleReady(false);
      try {
        const snap = await getDoc(doc(firestore, 'users', currentUser.uid));
        let r = null;

        if (snap.exists()) {
          r = snap.data()?.role || null;
        }

        if (!r && currentUser.email) {
          const em = currentUser.email.toLowerCase();
          if (em.endsWith('@teacher.com')) r = 'teacher';
          else if (em.endsWith('@student.com')) r = 'student';
        }

        setRole(r);
      } catch (e) {
        console.error('Error fetching user role:', e?.message || e);
        setRole(null);
      } finally {
        setRoleReady(true);
      }
    });

    return unsubscribe;
  }, []);

  // Push tokenni saqlash — user tayyor bo'lgach
  useEffect(() => {
    if (user?.uid) registerForPushAndSaveToken(user.uid);
  }, [user?.uid]);

  // Notificationga bosilganda deep-link navigatsiya
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (!navRef.isReady()) return;
      if (role === 'student') {
        navRef.navigate('StudentsApp', { screen: 'NotificationsListScreen' });
      } else if (role === 'teacher') {
        navRef.navigate('TeachersApp');
      } else {
        navRef.navigate('Login');
      }
    });
    return () => sub.remove();
  }, [role]);

  const loading = !authReady || !roleReady;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
            ) : role === 'teacher' ? (
              <Stack.Screen name="TeachersApp" component={TeachersApp} />
            ) : role === 'student' ? (
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
