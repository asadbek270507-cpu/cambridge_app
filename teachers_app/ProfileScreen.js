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
  Platform,
  ActivityIndicator,
  ImageBackground,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, firestore, storage } from "../firebase";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import Cambridge_logo from "../assets/Cambridge_logo.png";

/* ---- Responsive helpers ---- */
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
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
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  /* ---- Load profile ---- */
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

          // best-effort online flag
          updateDoc(userRef, { online: true, updatedAt: serverTimestamp() }).catch(() => {});
        } else {
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

  /* ---- Pick & upload avatar ---- */
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

      const userRef = doc(firestore, "users", auth.currentUser.uid);
      await updateDoc(userRef, { avatar: downloadURL, updatedAt: serverTimestamp() }).catch(async () => {
        await setDoc(userRef, { avatar: downloadURL, updatedAt: serverTimestamp() }, { merge: true });
      });

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

  /* ---- Save display name ---- */
  const saveProfile = async () => {
    if (!auth.currentUser) return;
    try {
      setIsUploading(true);
      const cleanName = (name || "").trim();

      const userRef = doc(firestore, "users", auth.currentUser.uid);
      await updateDoc(userRef, { displayName: cleanName, updatedAt: serverTimestamp() }).catch(async () => {
        await setDoc(userRef, { displayName: cleanName, updatedAt: serverTimestamp() }, { merge: true });
      });

      await updateProfile(auth.currentUser, { displayName: cleanName }).catch(() => {});

      Toast.show({ type: "success", text1: "Saqlandi", text2: "Ism muvaffaqiyatli yangilandi." });
      setEditMode(false);
    } catch (e) {
      console.error("Profilni saqlashda xatolik:", e);
      Toast.show({ type: "error", text1: "Xatolik", text2: "Ma'lumotlarni saqlab bo'lmadi." });
    } finally {
      setIsUploading(false);
    }
  };

  /* ---- Logout ---- */
  const handleLogout = async () => {
    try {
      const u = auth.currentUser;
      if (u) {
        updateDoc(doc(firestore, "users", u.uid), { online: false, updatedAt: serverTimestamp() }).catch(() => {});
      }
      await signOut(auth);
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } catch (e) {
      console.error("Tizimdan chiqishda xatolik:", e);
      Toast.show({ type: "error", text1: "Xatolik", text2: "Chiqishda muammo yuz berdi." });
    }
  };

  if (screenLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme?.colors?.primary || "#6200EE"} />
      </View>
    );
  }

  return (
    <ImageBackground
      source={Cambridge_logo}
      style={{ flex: 1 }}
      imageStyle={styles.bgImage}
      resizeMode="contain"
    >
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        {/* 🔹 Top header with title */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + normalize(6),
              borderColor: theme?.colors?.outline || "#ddd",
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: theme?.colors?.onSurface || "#111" }]}>
            Profile
          </Text>
        </View>

        <View style={styles.contentContainer}>
          {/* Profile card */}
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

            <Text style={[styles.name, { color: theme?.colors?.onSurface || "#111" }]}>
              {name || "Your Name"}
            </Text>

            {!!email && (
              <Text style={{ marginTop: 4, color: theme?.colors?.onSurfaceVariant || "#666", fontSize: RFValue(14) }}>
                {email}
              </Text>
            )}
          </View>

          {/* Editable name row */}
          <View style={styles.optionsContainer}>
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

            {/* Contact Developer */}
            <TouchableOpacity
              onPress={() => {
                const url = "https://t.me/Asadbek_2705";
                Linking.openURL(url).catch(() =>
                  Toast.show({ type: "error", text1: "Xatolik", text2: "Telegram ochilmadi." })
                );
              }}
              activeOpacity={0.8}
              style={[
                styles.listRow,
                {
                  backgroundColor: theme?.colors?.tertiaryContainer || "#E8DEF8",
                  borderColor: theme?.colors?.outline || "#ddd",
                },
              ]}
            >
              <View style={styles.listRowLeft}>
                <View style={styles.listRowIconWrap}>
                  <MaterialCommunityIcons
                    name="telegram"
                    size={RFValue(20)}
                    color={theme?.colors?.onTertiaryContainer || "#21005D"}
                  />
                </View>
                <Text style={[styles.listRowText, { color: theme?.colors?.onTertiaryContainer || "#21005D" }]}>
                  Contact Developer
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={RFValue(22)}
                color={theme?.colors?.onTertiaryContainer || "#21005D"}
              />
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.8}
              style={[
                styles.listRow,
                {
                  backgroundColor: theme?.colors?.errorContainer || "#F9DEDC",
                  borderColor: theme?.colors?.error || "#B3261E",
                },
              ]}
            >
              <View style={styles.listRowLeft}>
                <View style={[styles.listRowIconWrap, { backgroundColor: "transparent" }]}>
                  <MaterialCommunityIcons
                    name="logout"
                    size={RFValue(20)}
                    color={theme?.colors?.onErrorContainer || "#410E0B"}
                  />
                </View>
                <Text style={[styles.listRowText, { color: theme?.colors?.onErrorContainer || "#410E0B" }]}>
                  Logout
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={RFValue(22)}
                color={theme?.colors?.onErrorContainer || "#410E0B"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* 🔹 Header */
  header: {
    paddingHorizontal: normalize(16),
    paddingBottom: normalize(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: RFValue(20),
    fontWeight: "700",
  },

  contentContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: normalize(16),
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

  /* --- Info row (name edit) --- */
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

  /* --- List rows (Contact / Logout) --- */
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalize(14),
    paddingHorizontal: normalize(14),
    borderRadius: normalize(12),
    marginTop: normalize(16),
    borderWidth: normalize(1),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  listRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(10),
  },
  listRowIconWrap: {
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(6),
    justifyContent: "center",
    alignItems: "center",
  },
  listRowText: {
    fontWeight: "600",
    fontSize: RFValue(16),
  },

  /* --- Background image --- */
  bgImage: {
    opacity: 0.08,
  },
});
