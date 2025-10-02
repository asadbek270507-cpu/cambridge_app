// students_app/StudentsApp.js
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { StatusBar, LogBox, UIManager, Platform, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import registerForPushNotificationsAsync from '../utils/registerForPushNotificationsAsync';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import MultiLevelScreen from './Multilevel/LevelScreen';
import ListeningScreen from './IELTS/ListeningScreen';
import IeltsScreen from './IELTS/IeltsScreen';
import ReadingScreen from './IELTS/ReadingScreen';
import WritingScreen from './IELTS/WritingScreen';
import SpeakingScreen from './IELTS/SpeakingScreen';
import ListeningLevel from './Multilevel/ListeningLevel';
import ReadingLevel from './Multilevel/ReadingLevel';
import SpeakingLevel from './Multilevel/SpeakingLevel';
import GrammarScreen from './Grammar/GrammarScreen';
import LessonsScreen from './screens/LessonsScreen';
import MaterialsLevel from './Multilevel/MaterialsLevel';
import GrammarMaterials from './Grammar/GrammarMaterials';
import LessonMaterials from './Grammar/LessonMaterials';
import WritingLevel from './Multilevel/WritingLevel';
import LessonMaterialsScreen from './IELTS/LessonMaterialsScreen';
import ChatPlace from './screens/ChatPlace';
import NotificationsListScreen from './screens/NotificationsListScreen';
import ChatScreen from './screens/ChatScreen';

// 🔊 Har doim tepada ko‘rinadigan mini-player (navigator ustiga qo‘yiladi)
import GlobalAudioPlayer from '../components/GlobalAudioPlayer';

/* ------------------ Top-level tweaks (warnings/compat) ------------------ */
LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.',
]);

// Eski LayoutAnimation API faqat eski arxitektura uchun yoqiladi:
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !globalThis?.nativeFabricUIManager
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
/* ----------------------------------------------------------------------- */

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#8B0000',
    background: '#F3F4F6',
    text: '#1E1E1E',
    onPrimary: '#FFFFFF',
  },
};

function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#8A0D0D',
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarIcon: ({ color, size }) => {
          let iconName = 'home';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Lessons') iconName = 'book-open-page-variant';
          else if (route.name === 'Chat') iconName = 'chat';
          else if (route.name === 'Profile') iconName = 'account';
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Lessons" component={LessonsScreen} />
      <Tab.Screen name="Chat" component={ChatPlace} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function StudentsApp() {
  // ✅ Foydalanuvchi login bo‘lganda push tokenni olish (screen EMAS!)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) registerForPushNotificationsAsync();
    });
    return unsub;
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          edges={['top', 'left', 'right']}
        >
          {/* Root konteynerni relative qilib, overlay komponentlar uchun zIndex/absolute ishlasin */}
          <View style={{ flex: 1, position: 'relative' }}>
            <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

            {/* 🔊 Telegram-uslubidagi global mini-player
                - absolute/top:8 bilan navigator ustida turadi
                - pointerEvents default (playerning o‘zi bosiladi, qolgan joylar orqali tagidagi UI ishlaydi) */}
            <GlobalAudioPlayer />

            <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main" component={BottomTabs} />

              {/* Header kerak bo'lmagan ekranlar */}
              <Stack.Screen name="LoginScreen" component={LoginScreen} />
              <Stack.Screen name="MultiLevel" component={MultiLevelScreen} />
              <Stack.Screen name="ListeningScreen" component={ListeningScreen} />
              <Stack.Screen name="ReadingScreen" component={ReadingScreen} />
              <Stack.Screen name="WritingScreen" component={WritingScreen} />
              <Stack.Screen name="SpeakingScreen" component={SpeakingScreen} />
              <Stack.Screen name="ListeningLevel" component={ListeningLevel} />
              <Stack.Screen name="ReadingLevel" component={ReadingLevel} />
              <Stack.Screen name="SpeakingLevel" component={SpeakingLevel} />
              <Stack.Screen name="GrammarScreen" component={GrammarScreen} />
              <Stack.Screen name="IeltsScreen" component={IeltsScreen} />
              <Stack.Screen name="MaterialsLevel" component={MaterialsLevel} />
              <Stack.Screen name="GrammarMaterials" component={GrammarMaterials} />
              <Stack.Screen name="LessonMaterials" component={LessonMaterials} />
              <Stack.Screen name="WritingLevel" component={WritingLevel} />
              <Stack.Screen name="LessonMaterialsScreen" component={LessonMaterialsScreen} />

              {/* Shu ikkitasida header ko'rinsin */}
              <Stack.Screen
                name="ChatScreen"
                component={ChatScreen}
                options={{
                  headerShown: true,
                  title: 'Chat',
                  headerStyle: { backgroundColor: '#fff' },
                  headerTintColor: '#111',
                }}
              />
              <Stack.Screen
                name="NotificationsListScreen"
                component={NotificationsListScreen}
                options={{
                  headerShown: true,
                  title: 'Notifications',
                  headerStyle: { backgroundColor: '#fff' },
                  headerTintColor: '#111',
                }}
              />
            </Stack.Navigator>
          </View>
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
