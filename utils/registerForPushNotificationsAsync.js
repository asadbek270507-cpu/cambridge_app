// utils/registerForPushNotificationsAsync.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

export default async function registerForPushNotificationsAsync() {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

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

    // SDK 54: projectId shu yerdan olinadi
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn('EAS projectId topilmadi. app.json -> extra.eas.projectId kiritilishi kerak.');
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const u = auth.currentUser;
    if (u && token) {
      await setDoc(
        doc(firestore, 'users', u.uid),
        { expoPushToken: token, pushUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    return token;
  } catch (e) {
    console.warn('registerForPushNotificationsAsync error:', e);
    return null;
  }
}
