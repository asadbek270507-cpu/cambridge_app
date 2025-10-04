// utils/registerForPushNotificationsAsync.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

/**
 * Student foydalanuvchiga Expo push token olish va Firestore'ga (agar o'zgargan bo'lsa) yozish.
 * Admin/Teacher uchun token yozilmaydi.
 * @returns {Promise<string|null>} expoPushToken yoki null
 */
export default async function registerForPushNotificationsAsync() {
  try {
    // 1) Real qurilma sharti
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    // 2) Android kanal (idempotent)
    if (Platform.OS === 'android') {
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
    }

    // 3) Notifikatsiya ruxsati
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push permission not granted');
      return null;
    }

    // 4) Auth tekshirish
    const u = auth.currentUser;
    if (!u) return null;

    // 5) Foydalanuvchi rolini aniqlash (faqat studentlarga token yozamiz)
    const userRef = doc(firestore, 'users', u.uid);
    const snap = await getDoc(userRef);
    const roleFromDb = snap.exists() ? snap.data()?.role : null;
    const roleGuessFromEmail = u.email?.toLowerCase().endsWith('@student.com') ? 'student' : null;
    const role = roleFromDb || roleGuessFromEmail;

    if (role !== 'student') {
      // Admin yoki Teacher bo‘lsa — token saqlamaymiz
      return null;
    }

    // 6) EAS projectId (Expo SDK 51+ talab qiladi)
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;

    if (!projectId) {
      console.warn('EAS projectId topilmadi. app.config.js -> extra.eas.projectId kerak.');
      return null;
    }

    // 7) Expo push tokenni olish
    const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenObj?.data || tokenObj;
    if (!expoPushToken) return null;

    // 8) Firestore'ga faqat TOKEN O'ZGARGANDA yozamiz
    const prevToken = snap.exists() ? snap.data()?.expoPushToken : null;
    if (prevToken !== expoPushToken) {
      await setDoc(
        userRef,
        {
          expoPushToken,
          platform: Platform.OS,
          pushTokenUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return expoPushToken;
  } catch (e) {
    console.warn('registerForPushNotificationsAsync error:', e?.message || String(e));
    return null;
  }
}
