// StudentsApp.js
import React from 'react';
// NavigationContainer endi bu yerda kerak emas, asosiy App.js da mavjud
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { SafeAreaView, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
          let iconName;
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
  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <Stack.Navigator initialRouteName="Main">
  {/* faqat Tabs uchun headerShown: false */}
  <Stack.Screen
    name="Main"
    component={BottomTabs}
    options={{ headerShown: false }}
  />

  {/* boshqa ekranlarda default header chiqadi */}
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

  {/* Notifications ekrani — arrow + Notifications yozuvi chiqadi */}
  <Stack.Screen
    name="NotificationsListScreen"
    component={NotificationsListScreen}
    options={{ title: "Notifications" }}
  />
</Stack.Navigator>

      </SafeAreaView>
    </PaperProvider>
  );
}
