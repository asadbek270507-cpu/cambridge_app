// src/screens/ProfileScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "react-native-paper";
import { signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, firestore, storage } from "../../firebase";
import CustomHeader from "../../components/CustomHeader";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import Cambridge_logo from "../../assets/Cambridge_logo.png";

/** ---------- CONSTANT SIZES (dp) ---------- **/
const RADIUS = 16;
const GAP = 16;
const CARD_PADDING = 20;
const ROW_H = 56;           // stable row height
const ICON = 22;
const AVATAR = 120;

export default function ProfileScreen() {
  const navigation = useNavigation();
  const theme = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  /** ---- Load profile ---- **/
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
          const data = snap.data() || {};
          setName((data.displayName ?? user.displayName ?? "").trim());
          setEmail((data.email ?? user.email ?? "").trim());
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

  /** ---- Pick & upload avatar ---- **/
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

  /** ---- Save display name ---- **/
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

  /** ---- Logout ---- **/
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

  /** ---- Contact developer (Telegram) ---- **/
  const handleContactDeveloper = async () => {
    try {
      const url = "https://t.me/Asadbek_2705";
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Toast.show({ type: "info", text1: "Xabar", text2: "Havolani ochib bo‘lmadi." });
    } catch {
      Toast.show({ type: "error", text1: "Xatolik", text2: "Telegram ochilmadi." });
    }
  };

  const handleGoBack = () => navigation.goBack();

  if (screenLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme?.colors?.primary || "#0D47A1"} />
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
        <CustomHeader
          title="Profile"
          onBackPress={handleGoBack}
          backgroundColor={theme?.colors?.primary || "#0D47A1"}
          titleColor={theme?.colors?.onPrimary || "#fff"}
          iconColor={theme?.colors?.onPrimary || "#fff"}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Profile card */}
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: theme?.colors?.surface || "#fff",
                borderColor: theme?.colors?.outline || "#E5E7EB",
              },
            ]}
          >
            <TouchableOpacity onPress={pickImage} disabled={isUploading} activeOpacity={0.85}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme?.colors?.tertiaryContainer || "#E8DEF8" }]}>
                  <MaterialCommunityIcons
                    name="account"
                    size={60}
                    color={theme?.colors?.onTertiaryContainer || "#21005D"}
                  />
                </View>
              )}
              {isUploading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={{ color: "#fff", marginTop: 6 }} allowFontScaling={false}>Yuklanmoqda...</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text
              style={[styles.name, { color: theme?.colors?.onSurface || "#111" }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {name || "Your Name"}
            </Text>

            {!!email && (
              <Text
                style={{ marginTop: 4, color: theme?.colors?.onSurfaceVariant || "#666", fontSize: 14 }}
                numberOfLines={1}
                ellipsizeMode="middle"
                allowFontScaling={false}
              >
                {email}
              </Text>
            )}
          </View>

          {/* Editable name row */}
          <View style={styles.optionsContainer}>
            <View style={[styles.infoRow, { borderColor: theme?.colors?.outline || "#E5E7EB" }]}>
              <Text style={[styles.infoLabel, { color: theme?.colors?.onSurface || "#111" }]} allowFontScaling={false}>
                Ism
              </Text>

              {editMode ? (
                <TextInput
                  style={[
                    styles.infoInput,
                    {
                      color: theme?.colors?.onSurface || "#111",
                      borderColor: theme?.colors?.primary || "#0D47A1",
                    },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ismingiz"
                  placeholderTextColor={theme?.colors?.onSurfaceVariant || "#666"}
                  numberOfLines={1}
                  allowFontScaling={false}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
              ) : (
                <Text
                  style={[styles.infoValue, { color: theme?.colors?.onSurfaceVariant || "#666" }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                >
                  {name || "Kiritilmagan"}
                </Text>
              )}

              <TouchableOpacity onPress={() => (editMode ? saveProfile() : setEditMode(true))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons
                  name={editMode ? "content-save" : "pencil"}
                  size={ICON}
                  color={theme?.colors?.secondary || "#625B71"}
                />
              </TouchableOpacity>
            </View>

            {/* Contact Developer */}
            <TouchableOpacity
              onPress={handleContactDeveloper}
              activeOpacity={0.85}
              style={[
                styles.listRow,
                {
                  backgroundColor: theme?.colors?.tertiaryContainer || "#E8DEF8",
                  borderColor: theme?.colors?.outline || "#E5E7EB",
                },
              ]}
            >
              <View style={styles.listRowLeft}>
                <View style={styles.listRowIconWrap}>
                  <MaterialCommunityIcons
                    name="telegram"
                    size={20}
                    color={theme?.colors?.onTertiaryContainer || "#21005D"}
                  />
                </View>
                <Text style={[styles.listRowText, { color: theme?.colors?.onTertiaryContainer || "#21005D" }]} allowFontScaling={false}>
                  Contact Developer
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={ICON}
                color={theme?.colors?.onTertiaryContainer || "#21005D"}
              />
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.85}
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
                    size={20}
                    color={theme?.colors?.onErrorContainer || "#410E0B"}
                  />
                </View>
                <Text style={[styles.listRowText, { color: theme?.colors?.onErrorContainer || "#410E0B" }]} allowFontScaling={false}>
                  Logout
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={ICON}
                color={theme?.colors?.onErrorContainer || "#410E0B"}
              />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: "center",
  },

  profileCard: {
    padding: CARD_PADDING,
    borderWidth: 1,
    borderRadius: RADIUS + 8,
    alignItems: "center",
    width: "100%",
    maxWidth: 560,          // barqaror maksimal kenglik — planshetlarda ham chiroyli
    marginBottom: GAP,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: AVATAR / 2,
  },

  name: { fontSize: 20, fontWeight: "700", maxWidth: 560 - CARD_PADDING * 2 },

  optionsContainer: {
    width: "100%",
    maxWidth: 560,
  },

  /** --- Info row (name edit) --- **/
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ROW_H,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "600",
    width: 70,            // barqaror label eni — joylar almashmaydi
  },
  infoValue: {
    fontSize: 16,
    flex: 1,
    textAlign: "right",
    paddingRight: 10,
  },
  infoInput: {
    flex: 1,
    textAlign: "right",
    paddingRight: 10,
    fontSize: 16,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
  },

  /** --- List rows (Contact / Logout) --- **/
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    minHeight: ROW_H,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  listRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  listRowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  listRowText: {
    fontWeight: "700",
    fontSize: 16,
    maxWidth: 280,      // matn uzun bo‘lsa ham qat’iy joy egallaydi
  },

  /** --- Background image --- **/
  bgImage: {
    opacity: 0.08, // subtle
  },
});
