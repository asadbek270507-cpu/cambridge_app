// screens/LoginScreen.js
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
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // 👈 eye/eye-off

import { signInWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, firestore } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as Animatable from 'react-native-animatable';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 👈 ko‘rsat/yashir
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Input Error', 'Please enter email and password');
      return;
    }

    let determinedRole = null;
    if (trimmedEmail.endsWith('@teacher.com')) {
      determinedRole = 'teacher';
    } else if (trimmedEmail.endsWith('@student.com')) {
      determinedRole = 'student';
    } else {
      Alert.alert('Login Failed', 'Email must end with @student.com');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword
      );
      const user = userCredential.user;

      await setDoc(
        doc(firestore, 'users', user.uid),
        {
          email: user.email,
          role: determinedRole,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      await AsyncStorage.setItem('userRole', determinedRole);
    } catch (error) {
      let errorMessage = 'An unknown error occurred.';
      if (error?.code === 'auth/user-not-found') {
        errorMessage = 'User not found. Please check your email or register.';
      } else if (error?.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error?.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      } else if (error?.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (typeof error?.message === 'string') {
        errorMessage = error.message;
      }
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  const keyboardOffset = Platform.select({
    ios: 80,
    android: (StatusBar.currentHeight || 0) + 24,
    default: 0,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animatable.View animation="fadeInDown" duration={1200} style={styles.logoContainer}>
              <Image
                source={require('../assets/Cambridge_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Cambridge Innovation{"\n"}School</Text>
              <Text style={styles.signin}>Sign in</Text>
            </Animatable.View>

            <Animatable.View animation="fadeInUp" delay={300} duration={1000} style={styles.formContainer}>
              <TextInput
                placeholder="Login"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                placeholderTextColor="#8B0000"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                editable={!loading}
              />

              {/* 👇 Parol + ko‘z tugmasi */}
              <View style={styles.passwordWrap}>
                <TextInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  placeholderTextColor="#8B0000"
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color="#8B0000"
                  />
                </TouchableOpacity>
              </View>

              <Animatable.View animation="zoomIn" delay={1000} duration={3000}>
                <TouchableOpacity
                  style={[styles.button, loading && { opacity: 0.5 }]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>
              </Animatable.View>
            </Animatable.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  flex: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'center',
  },

  logoContainer: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 120, height: 120, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#000', textAlign: 'center' },
  signin: { fontSize: 16, fontWeight: '500', color: '#8B0000', marginTop: 6 },

  formContainer: { width: '100%', alignSelf: 'center', maxWidth: 480 },

  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#8B0000',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: '#8B0000',
    fontSize: 15,
    backgroundColor: '#FFF',
  },

  // 👇 Parol uchun
  passwordWrap: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#8B0000',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    color: '#8B0000',
    fontSize: 15,
  },
  eyeBtn: {
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  button: {
    width: '100%',
    backgroundColor: '#8B0000',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
    elevation: 1,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
