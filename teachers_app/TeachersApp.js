// TeachersApp.js
import React from 'react';
import { StatusBar, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Screens
import HomeScreen from '../teachers_app/HomeScreen';
import ChatScreen from '../teachers_app/ChatScreen';
import ProfileScreen from '../teachers_app/ProfileScreen';
import ManageScreen from '../teachers_app/ManageScreen';
import RegisterScreen from './screens/RegisterScreen';
import StudentDetailScreen from './screens/StudentDetailScreen';
import TeacherAvailabilityScreen from './screens/TeacherAvailabilityScreen';
import LoginScreen from '../screens/LoginScreen';
import Chat2 from './Chat2';
import CreateLesson from './screens/Createlesson';
import AttendanceScreen from './screens/AttendanceScreen';
import AttendanceStatsScreen from './screens/AttendanceStatsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0D47A1',
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
        tabBarActiveTintColor: '#0D47A1',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarIcon: ({ color, size }) => {
          let iconName = 'circle';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Profile') iconName = 'account';
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function TeachersApp() {
  return (
    <PaperProvider theme={theme}>
      {/* Use SafeAreaView from react-native-safe-area-context to remove the deprecation warning */}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <StatusBar
          barStyle={Platform.OS === 'ios' ? 'dark-content' : 'default'}
          backgroundColor={theme.colors.background}
        />
        <Stack.Navigator initialRouteName="Main">
          <Stack.Screen name="Main" component={BottomTabs} options={{ headerShown: false }} />

          {/* Core screens */}
          <Stack.Screen name="ManageScreen" component={ManageScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="HomeScreen" component={HomeScreen} />
          <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
          <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />

          {/* ✅ FIX: remove trailing space in the route name */}
          <Stack.Screen
            name="TeacherAvailabilityScreen"
            component={TeacherAvailabilityScreen}
          />

          <Stack.Screen name="LoginScreen" component={LoginScreen} />
          <Stack.Screen name="Chat2" component={Chat2} />
          <Stack.Screen name="CreateLesson" component={CreateLesson} />

          {/* Attendance */}
          <Stack.Screen name="AttendanceScreen" component={AttendanceScreen} />
          <Stack.Screen name="AttendanceStatsScreen" component={AttendanceStatsScreen} />
        </Stack.Navigator>
      </SafeAreaView>
    </PaperProvider>
  );
}
