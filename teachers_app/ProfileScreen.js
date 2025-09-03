// src/screens/ProfileScreen.js

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Linking,
  Platform,
  ActivityIndicator,
  ImageBackground,          // ✅ BACKGROUND IMAGE
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "react-native-paper";
import { signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, firestore, storage } from "../firebase";
// import CustomHeader from "../components/CustomHeader"; // ❌ olib tashlandi
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";

// ⬇️ Cambridge fon rasmini import qiling (yo‘lni loyihangizga moslang)
import Cambridge_logo from "../assets/Cambridge_logo.png"; // <-- kerak bo‘lsa '../../assets/...' qiling

// Ekran o'lchamlarini olish
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Moslashuv
const scale = SCREEN_WIDTH / 375;
const normalize = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
const RFValue = (fontSize) => {
  const standardScreenHeight = 680;
  const heightPercent = (fontSize * 100) / standardScreenHeight;
  const newSize = (heightPercent * SCREEN_HEIGHT) / 100;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export default function ProfileScreen() {
  const navigation = useNavigation();
  const theme = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Foydalanuvchi holatini tinglash va profilni yuklash
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setName("");
          setEmail("");
          setAvatarUri(null);
          setScreenLoading(false);
          return;
        }

        const userRef = doc(firestore, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          setName(data.displayName ?? user.displayName ?? "");
          setEmail(data.email ?? user.email ?? "");
          setAvatarUri(data.avatar ?? user.photoURL ?? null);

          // online flag
          await updateDoc(userRef, { online: true, updatedAt: serverTimestamp() }).catch(() => {});
        } else {
          // Birinchi kirishda hujjat yaratish
          const payload = {
            email: user.email ?? "",
            displayName: user.displayName ?? "",
            avatar: user.photoURL ?? null,
            online: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, payload, { merge: true });
          setName(payload.displayName);
          setEmail(payload.email);
          setAvatarUri(payload.avatar);
        }
      } catch (e) {
        console.error("Profilni yuklashda xatolik:", e);
        Toast.show({ type: "error", text1: "Xatolik", text2: "Profil ma'lumotlari yuklanmadi." });
      } finally {
        setScreenLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Rasmni tanlash va yuklash
  const pickImage = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Toast.show({ type: "info", text1: "Ruxsat kerak", text2: "Rasmga kirish uchun ruxsat bering." });
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (result.canceled || !auth.currentUser) return;

      setIsUploading(true);

      const localUri = result.assets?.[0]?.uri;
      if (!localUri) throw new Error("Rasm URI topilmadi");

      const response = await fetch(localUri);
      const blob = await response.blob();

      const imageRef = ref(storage, `avatars/${auth.currentUser.uid}.jpg`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);

      // Firestore’ga yozish
      const userRef = doc(firestore, "users", auth.currentUser.uid);
      await updateDoc(userRef, { avatar: downloadURL, updatedAt: serverTimestamp() }).catch(async () => {
        await setDoc(userRef, { avatar: downloadURL, updatedAt: serverTimestamp() }, { merge: true });
      });

      // Auth profile
      await updateProfile(auth.currentUser, { photoURL: downloadURL }).catch(() => {});

      setAvatarUri(downloadURL);
      Toast.show({ type: "success", text1: "Muvaffaqiyatli", text2: "Profil rasmi yangilandi." });
    } catch (e) {
      console.error("Rasm yuklashda xatolik:", e);
      Toast.show({ type: "error", text1: "Xatolik", text2: "Rasm yuklab bo'lmadi." });
    } finally {
      setIsUploading(false);
    }
  };

  // Ismni saqlash
  const saveProfile = async () => {
    if (!auth.currentUser) return;
    try {
      setIsUploading(true);

      const userRef = doc(firestore, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        displayName: name?.trim() ?? "",
        updatedAt: serverTimestamp(),
      }).catch(async () => {
        await setDoc(
          userRef,
          { displayName: name?.trim() ?? "", updatedAt: serverTimestamp() },
          { merge: true }
        );
      });

      await updateProfile(auth.currentUser, { displayName: name?.trim() ?? "" }).catch(() => {});

      Toast.show({ type: "success", text1: "Saqlandi", text2: "Ism muvaffaqiyatli yangilandi." });
      setEditMode(false);
    } catch (e) {
      console.error("Profilni saqlashda xatolik:", e);
      Toast.show({ type: "error", text1: "Xatolik", text2: "Ma'lumotlarni saqlab bo'lmadi." });
    } finally {
      setIsUploading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      const u = auth.currentUser;
      if (u) {
        await updateDoc(doc(firestore, "users", u.uid), { online: false, updatedAt: serverTimestamp() }).catch(() => {});
      }
      await signOut(auth);

      navigation.reset({
        index: 0,
        routes: [{ name: "LoginScreen" }],
      });
    } catch (e) {
      console.error("Tizimdan chiqishda xatolik:", e);
      Toast.show({ type: "error", text1: "Xatolik", text2: "Chiqishda muammo yuz berdi." });
    }
  };

  const handleGoBack = () => navigation.goBack();
  const handleContactDeveloper = () => Linking.openURL("https://t.me/Asadbek_2705");

  if (screenLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme?.colors?.primary || "#6200EE"} />
      </View>
    );
  }

  return (
    // ✅ BACKGROUND IMAGE bilan umumiy o‘rama
    <ImageBackground
      source={Cambridge_logo}
      style={{ flex: 1 }}
      imageStyle={styles.bgImage} // shaffoflik va resize
    >
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        {/* ✅ Yangi header (o‘rtada PROFILE) */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme?.colors?.primary || "#6200EE",
              shadowColor: "#000",
            },
          ]}
        >
          <TouchableOpacity onPress={handleGoBack} style={styles.headerIconLeft} activeOpacity={0.8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme?.colors?.onPrimary || "#fff"} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme?.colors?.onPrimary || "#fff" }]}>
            PROFILE
          </Text>

          {/* dekorativ “bo‘sh” zona yoki sozlamalar uchun future icon */}
          <View style={styles.headerIconRight} />
        </View>

        {/* CONTEXT */}
        <View style={styles.contentContainer}>
          <View
            style={[
              styles.profileCard,
              { backgroundColor: theme?.colors?.surface || "#fff", borderColor: theme?.colors?.outline || "#ddd" },
            ]}
          >
            <TouchableOpacity onPress={pickImage} disabled={isUploading} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme?.colors?.tertiaryContainer || "#E8DEF8" }]}>
                  <MaterialCommunityIcons
                    name="account"
                    size={normalize(60)}
                    color={theme?.colors?.onTertiaryContainer || "#21005D"}
                  />
                </View>
              )}
              {isUploading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={{ color: "#fff", marginTop: 6 }}>Yuklanmoqda...</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.name, { color: theme?.colors?.onSurface || "#111" }]}>{name || "Your Name"}</Text>

            {!!email && (
              <Text style={{ marginTop: 4, color: theme?.colors?.onSurfaceVariant || "#666", fontSize: RFValue(14) }}>
                {email}
              </Text>
            )}
          </View>

          <View style={styles.optionsContainer}>
            {/* Ism satri */}
            <View style={[styles.infoRow, { borderColor: theme?.colors?.outline || "#ddd" }]}>
              <Text style={[styles.infoLabel, { color: theme?.colors?.onSurface || "#111" }]}>Ism</Text>

              {editMode ? (
                <TextInput
                  style={[
                    styles.infoInput,
                    {
                      color: theme?.colors?.onSurface || "#111",
                      borderColor: theme?.colors?.primary || "#6200EE",
                      borderWidth: 1,
                    },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ismingiz"
                  placeholderTextColor={theme?.colors?.onSurfaceVariant || "#666"}
                />
              ) : (
                <Text style={[styles.infoValue, { color: theme?.colors?.onSurfaceVariant || "#666" }]}>
                  {name || "Kiritilmagan"}
                </Text>
              )}

              <TouchableOpacity onPress={() => (editMode ? saveProfile() : setEditMode(true))}>
                <MaterialCommunityIcons
                  name={editMode ? "content-save" : "pencil"}
                  size={RFValue(20)}
                  color={theme?.colors?.secondary || "#625B71"}
                />
              </TouchableOpacity>
            </View>

            {/* Takliflar */}
            <TouchableOpacity
              onPress={handleContactDeveloper}
              style={[styles.button, { backgroundColor: theme?.colors?.tertiaryContainer || "#E8DEF8" }]}
            >
              <Text style={[styles.buttonText, { color: theme?.colors?.onTertiaryContainer || "#21005D" }]}>
                Taklif va kamchiliklar uchun
              </Text>
              <MaterialCommunityIcons
                name="telegram"
                size={RFValue(18)}
                color={theme?.colors?.onTertiaryContainer || "#21005D"}
              />
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              style={[
                styles.button,
                {
                  backgroundColor: theme?.colors?.errorContainer || "#F9DEDC",
                  borderColor: theme?.colors?.error || "#B3261E",
                  borderWidth: normalize(1),
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: theme?.colors?.onErrorContainer || "#410E0B" }]}>Logout</Text>
              <MaterialCommunityIcons name="logout" size={RFValue(18)} color={theme?.colors?.onErrorContainer || "#410E0B"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // ✅ Yangi header
  header: {
    height: 64,
    paddingHorizontal: 16,
    paddingTop: Platform.select({ ios: 10, android: 8, default: 8 }),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 6,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  headerTitle: {
    fontSize: RFValue(18),
    fontWeight: "800",
    letterSpacing: 2,
  },
  headerIconLeft: {
    position: "absolute",
    left: 16,
    height: "100%",
    justifyContent: "center",
  },
  headerIconRight: {
    position: "absolute",
    right: 16,
    height: "100%",
    width: 24, // balans uchun
  },

  contentContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: normalize(20),
    paddingHorizontal: normalize(20),
  },
  profileCard: {
    padding: normalize(20),
    borderWidth: normalize(1),
    borderRadius: normalize(24),
    alignItems: "center",
    width: "100%",
    marginBottom: normalize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: normalize(120),
    height: normalize(120),
    borderRadius: normalize(60),
    marginBottom: normalize(12),
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: normalize(60),
  },
  name: { fontSize: RFValue(20), fontWeight: "600" },
  optionsContainer: {
    width: "100%",
    paddingHorizontal: normalize(10),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: normalize(10),
    paddingVertical: normalize(15),
    borderBottomWidth: normalize(1),
  },
  infoLabel: {
    fontSize: RFValue(16),
    fontWeight: "500",
    minWidth: normalize(60),
  },
  infoValue: {
    fontSize: RFValue(16),
    flex: 1,
    textAlign: "right",
    paddingRight: normalize(10),
  },
  infoInput: {
    flex: 1,
    textAlign: "right",
    paddingRight: normalize(10),
    fontSize: RFValue(16),
    paddingVertical: normalize(5),
    borderRadius: normalize(8),
  },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: normalize(15),
    paddingHorizontal: normalize(20),
    borderRadius: normalize(12),
    marginTop: normalize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontWeight: "600",
    fontSize: RFValue(16),
    marginRight: normalize(10),
  },
  // ✅ Fon rasmi uslubi
  bgImage: {
    opacity: 0.08,
    resizeMode: "cover",
  },
});
