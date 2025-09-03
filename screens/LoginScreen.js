import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, firestore } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Input Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const user = userCredential.user;

      let determinedRole = null;
      if (trimmedEmail.endsWith('@teacher.com')) {
        determinedRole = 'teacher';
      } else if (trimmedEmail.endsWith('@student.com')) {
        determinedRole = 'student';
      } else {
        Alert.alert('Login Failed', 'Email must end with @student.com or @teacher.com');
        setLoading(false);
        return;
      }

      await setDoc(doc(firestore, 'users', user.uid), {
        email: user.email,
        role: determinedRole,
        createdAt: new Date(),
      }, { merge: true });

      await AsyncStorage.setItem('userRole', determinedRole);

      // Navigator endi App.js conditional rendering orqali ishlaydi
    } catch (error) {
      let errorMessage = "An unknown error occurred.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found. Please check your email or register.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        errorMessage = error.message;
      }
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.outerContainer}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/Cambridge_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Cambridge Innovation{"\n"}School</Text>
            <Text style={styles.signin}>Sign in</Text>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              placeholder="Login"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholderTextColor="#8B0000"
              autoCapitalize="none"
              editable={!loading}
            />

            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              placeholderTextColor="#8B0000"
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.5 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 120, height: 120, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#000', textAlign: 'center' },
  signin: { fontSize: 16, fontWeight: '500', color: '#8B0000', marginTop: 6 },
  formContainer: { width: '100%' },
  input: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: '#8B0000',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: '#8B0000',
    fontSize: 14,
  },
  button: {
    width: '100%',
    backgroundColor: '#8B0000',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '500', fontSize: 15 },
});
