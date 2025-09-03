// TeachersApp.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { SafeAreaView, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Screens
import HomeScreen from '../teachers_app/HomeScreen';
import ChatScreen from '../teachers_app/ChatScreen';
import ProfileScreen from '../teachers_app/ProfileScreen';
import ManageScreen from '../teachers_app/ManageScreen';
import Createlesson from './screens/Createlesson'
import Notification from './screens/Notification';
import News from './screens/News'
import RegisterScreen from './screens/RegisterScreen';
import StudentDetailScreen from './screens/StudentDetailScreen';
import TeacherAvailabilityScreen  from './screens/TeacherAvailabilityScreen ';
import LoginScreen from '../screens/LoginScreen';
import Chat2 from './Chat2'


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
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarIcon: ({ color, size }) => {
          let iconName;
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        <Stack.Navigator initialRouteName="Main">
          <Stack.Screen name="Main" component={BottomTabs} options={{ headerShown: false }} />
          <Stack.Screen name="ManageScreen" component={ManageScreen}  />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="HomeScreen"  component={HomeScreen} />
          <Stack.Screen name='Createlesson' component={Createlesson}    />
          <Stack.Screen name='Notification' component={Notification}  />
          <Stack.Screen name='News' component={News}  />
          <Stack.Screen name='RegisterScreen' component={RegisterScreen} />
          <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
          <Stack.Screen name="TeacherAvailabilityScreen " component={TeacherAvailabilityScreen } />
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
          <Stack.Screen name='Chat2' component={Chat2} />

        </Stack.Navigator>
      </SafeAreaView>
    </PaperProvider>
  );
}

// Folder structure you should have:
// screens/HomeScreen.js -> Dashboard + Online/Offline students status
// screens/ChatScreen.js -> Chat interface (basic messaging)
// screens/MaterialsScreen.js -> Upload materials, List of files
// screens/ProfileScreen.js -> Teacher profile info & settings

// For chat & online status: You'll need websockets or real-time DB (like Firebase Realtime DB or Firestore)
// For file upload: You can simulate local state, or hook up to backend/storage later

// Each screen will have its own internal components/folders to scale.
// Example: screens/ChatScreen/components/MessageBubble.js
// Example: screens/MaterialsScreen/components/MaterialItem.js
