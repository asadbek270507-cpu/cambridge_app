import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

import LoginScreen from './screens/LoginScreen';
import StudentsApp from './students_app/StudentsApp';
import TeachersApp from './teachers_app/TeachersApp';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const userDocRef = doc(firestore, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const fetchedRole = docSnap.data().role;
            setRole(fetchedRole || null);
          } else {
            setRole(null);
          }
        } catch (error) {
          console.error('Error fetching user role:', error.message);
          setRole(null);
        }
      } else {
        setRole(null);
      }

      setLoading(false);
    });

    return unsubscribe; // Cleanup
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
  );
}

