// utils/registerForPushNotificationsAsync.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

/**
 * Expo push token qaytaradi va Firestore’ga yozadi.
 * @param {object} opts
 * @param {boolean} opts.onlyStudents  true bo‘lsa, faqat studentlarga yozadi (default: false)
 */
export default async function registerForPushNotificationsAsync(opts = {}) {
  const { onlyStudents = false } = opts;

  try {
    // Faqat real qurilmada push ishlaydi
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    // ANDROID: channel (Oreo+)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      } catch (e) {
        console.warn('Channel create failed:', e?.message || String(e));
      }
    }

    // Runtime permission (Android 13+ va iOS)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push permission not granted');
      return null;
    }

    // User tekshirish
    const u = auth.currentUser;
    if (!u) {
      console.warn('No currentUser — cannot save push token');
      // Baribir tokenni qaytaramiz (foydalanuvchi keyin login qilishi mumkin)
    }

    // EAS Project ID (Expo Push token olish uchun majburiy)
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;

    if (!projectId) {
      console.warn('EAS projectId topilmadi. app.config.js -> extra.eas.projectId kerak.');
      return null;
    }

    // Expo Push Token
    const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenObj?.data || tokenObj;
    if (!expoPushToken) {
      console.warn('Failed to get Expo push token');
      return null;
    }

    console.log('✅ Expo Push Token:', expoPushToken);

    // (ixtiyoriy) Role tekshirish — agar onlyStudents true bo‘lsa:
    let canWrite = true;
    if (onlyStudents && u) {
      try {
        const snap = await getDoc(doc(firestore, 'users', u.uid));
        const role =
          (snap.exists() && snap.data()?.role) ||
          (u.email?.toLowerCase().endsWith('@student.com') ? 'student' : null);
        if (role !== 'student') {
          canWrite = false;
        }
      } catch {
        canWrite = false;
      }
    }

    // Firestore’ga yozish (hamma rol uchun default yozamiz)
    if (u && canWrite) {
      try {
        await setDoc(
          doc(firestore, 'users', u.uid),
          {
            expoPushToken,
            platform: Platform.OS,
            pushTokenUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Failed to save token to Firestore:', e?.message || String(e));
      }
    }

    return expoPushToken;
  } catch (e) {
    console.warn('registerForPushNotificationsAsync error:', e?.message || String(e));
    return null;
  }
}
