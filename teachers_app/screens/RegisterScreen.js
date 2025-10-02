// src/screens/RegisterScreen.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { auth, firestore, getSecondaryAuth } from "../../firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

/* ====== Helpers ====== */
const initials = (nameOrEmail = "") => {
  const src = String(nameOrEmail).trim();
  if (!src) return "?";
  const parts = src.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  const a = (parts[0] || "?")[0]?.toUpperCase() || "?";
  const b = (parts[1] || "")[0]?.toUpperCase() || "";
  return a + b;
};

export default function RegisterScreen() {
  /* form */
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /* app */
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState(null); // { id, type: 'reset'|'delete' }
  const unsubListRef = useRef(null);

  const navigation = useNavigation();

  // 🔴 MUHIM: Functions region deploy qilgan joyingiz bilan bir xil bo‘lsin (us-central1)
  const functions = getFunctions(undefined, "us-central1");
  const fnSetRandomPassword = httpsCallable(functions, "admin_setRandomPassword");
  const fnDeleteDeep = httpsCallable(functions, "admin_deleteStudentDeep");

  const canSubmit = useMemo(
    () =>
      !!currentUser &&
      displayName.trim().length > 1 &&
      email.trim().endsWith("@student.com") &&
      password.trim().length >= 6 &&
      !busy,
    [currentUser, displayName, email, password, busy]
  );

  /* auth + list */
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (unsubListRef.current) {
        unsubListRef.current();
        unsubListRef.current = null;
      }

      if (!user) {
        setUsers([]);
        return;
      }

      // Faqat ACTIVE studentlarni olayapmiz — delete qilinganda darrov yo‘qoladi
      const qy = query(
        collection(firestore, "users"),
        where("role", "==", "student"),
        where("teacherId", "==", user.uid),
        where("status", "==", "active")
      );
      unsubListRef.current = onSnapshot(qy, (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(arr);
      });
    });

    return () => {
      unsubAuth();
      if (unsubListRef.current) unsubListRef.current();
    };
  }, []);

  /* create student */
  const handleRegister = async () => {
    if (!canSubmit) {
      Alert.alert("Ma'lumotlar to‘liq emas", "Ism, email va parolni to‘g‘ri kiriting.");
      return;
    }

    setBusy(true);
    try {
      const secondaryAuth = getSecondaryAuth();
      const userCred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password.trim()
      );
      const newUser = userCred.user;

      await setDoc(
        doc(firestore, "users", newUser.uid),
        {
          email: email.trim(),
          role: "student",
          teacherId: currentUser.uid,
          studentAuthUid: newUser.uid,
          status: "active",
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid,
          displayName: displayName.trim(),
          avatar: "",
        },
        { merge: true }
      );

      await ensureDMAndNavigate(newUser.uid, false);

      Alert.alert("OK", "Student yaratildi ✅");
      setDisplayName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
    } catch (e) {
      Alert.alert("Xato", e?.message || "Xatolik yuz berdi.");
    } finally {
      setBusy(false);
    }
  };

  /* create/open DM */
  const ensureDMAndNavigate = async (studentUid, navigateNow = true) => {
    if (!currentUser?.uid || !studentUid) return;

    const teacherUid = currentUser.uid;
    const dmId =
      teacherUid < studentUid
        ? `${teacherUid}_${studentUid}`
        : `${studentUid}_${teacherUid}`;

    await setDoc(
      doc(firestore, "private_chats", dmId),
      {
        participants: [teacherUid, studentUid],
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastSender: null,
        title: null,
      },
      { merge: true }
    );

    if (navigateNow) {
      navigation.navigate("Chat2", {
        dmId,
        peerId: studentUid,
        teacherId: teacherUid,
      });
    }
  };

  /* RESET: avtomatik random parol qo‘yish */
  const handleResetPassword = async (student) => {
    try {
      setRowBusy({ id: student.id, type: "reset" });
      const { data } = await fnSetRandomPassword({ uid: student.id, length: 10 });
      const newPass = data?.password || "";
      if (!newPass) throw new Error("Yangi parol olinmadi");

      await Clipboard.setStringAsync(newPass);
      Alert.alert("Parol yangilandi", `Yangi parol: ${newPass}\n\nParol clipboard’ga nusxalandi.`);
    } catch (e) {
      Alert.alert("Xato", e?.message || "Parolni yangilab bo‘lmadi.");
    } finally {
      setRowBusy(null);
    }
  };

  /* DELETE: Deep delete (Auth + Firestore + DM + guruhlar + attendance) */
  const confirmAndDelete = (student) => {
    if (rowBusy) return;
    Alert.alert(
      "Tasdiqlaysizmi?",
      `${student.email} akkaunti butunlay o‘chiriladi.`,
      [
        { text: "Bekor qilish", style: "cancel" },
        { text: "Ha, o‘chirish", style: "destructive", onPress: () => hardDeleteStudent(student) },
      ]
    );
  };

  const hardDeleteStudent = async (student) => {
    try {
      setRowBusy({ id: student.id, type: "delete" });

      // UI’ni zudlik bilan yangilaymiz (optimistik)
      setUsers((prev) => prev.filter((u) => u.id !== student.id));

      // Deep delete cloud function
      await fnDeleteDeep({ uid: student.id });

      Alert.alert("OK", "Student to‘liq o‘chirildi ✅");
    } catch (e) {
      // Agar xatolik bo‘lsa, ro‘yxatni qayta yuklash uchun shunchaki snapshot kutamiz
      Alert.alert("Xato", e?.message || "O‘chirishda xatolik.");
    } finally {
      setRowBusy(null);
    }
  };

  const renderItem = ({ item }) => {
    const label = item.displayName || item.email;
    const isResetBusy = rowBusy?.id === item.id && rowBusy?.type === "reset";
    const isDeleteBusy = rowBusy?.id === item.id && rowBusy?.type === "delete";

    return (
      <View style={styles.userCard}>
        <View style={styles.userLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTx}>{initials(label)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.displayName ? item.displayName : "Ism kiritilmagan"}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
        </View>

        <View style={styles.userRight}>
          <TouchableOpacity
            onPress={() => ensureDMAndNavigate(item.id, true)}
            style={[styles.iconAction, { backgroundColor: "#0D47A1" }]}
            activeOpacity={0.85}
            disabled={!!rowBusy}
          >
            <MaterialCommunityIcons name="message-text" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleResetPassword(item)}
            style={[styles.iconAction, { backgroundColor: "#F59E0B", marginLeft: 8 }]}
            activeOpacity={0.85}
            disabled={isResetBusy || !!rowBusy}
          >
            {isResetBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="lock-reset" size={18} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => confirmAndDelete(item)}
            style={[styles.iconAction, { backgroundColor: "#EF4444", marginLeft: 8 }]}
            activeOpacity={0.85}
            disabled={isDeleteBusy || !!rowBusy}
          >
            {isDeleteBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="trash-can" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.headerWrap}>
          <View style={[styles.badge, { backgroundColor: "#FDECEC", borderColor: "#8B0000" }]}>
            <MaterialCommunityIcons name="account-school" size={16} color="#8B0000" />
            <Text style={[styles.badgeTx, { color: "#8B0000" }]}>Teacher → Student</Text>
          </View>
          {!!currentUser && (
            <View style={[styles.badge, { backgroundColor: "#E8F0FF", borderColor: "#0D47A1" }]}>
              <MaterialCommunityIcons name="shield-account" size={16} color="#0D47A1" />
              <Text style={[styles.badgeTx, { color: "#0D47A1" }]} numberOfLines={1}>
                {currentUser.email}
              </Text>
            </View>
          )}
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.title}>Yangi student ro‘yxatdan o‘tkazish</Text>
          <Text style={styles.subtitle}>
            Email <Text style={{ fontWeight: "800" }}>@student.com</Text> bilan tugashi shart
          </Text>

          <View style={styles.field}>
            <MaterialCommunityIcons name="account" size={20} color="#8B0000" />
            <TextInput
              placeholder="Student ismi"
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.field}>
            <MaterialCommunityIcons name="email" size={20} color="#8B0000" />
            <TextInput
              placeholder="ali@student.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.field}>
            <MaterialCommunityIcons name="lock" size={20} color="#8B0000" />
            <TextInput
              placeholder="Parol (kamida 6 belgi)"
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { paddingRight: 36 }]}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.eye}
            >
              <MaterialCommunityIcons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, !canSubmit && { opacity: 0.5 }]}
            onPress={handleRegister}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="account-plus" size={18} color="#fff" />
                <Text style={styles.btnTx}>Create account</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Students list */}
        {!!currentUser && (
          <View style={styles.listCard}>
            <Text style={styles.listTitle}>Siz yaratgan studentlar</Text>
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={<Text style={styles.emptyTx}>Hali ro‘yxat bo‘sh</Text>}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ================== STYLES ================== */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F4F6" },
  scroll: { padding: 16, paddingBottom: 32, gap: 16 },

  headerWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeTx: { fontSize: 12, fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#475569", marginTop: 4, marginBottom: 10 },

  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#8B0000",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 10,
    color: "#0F172A",
  },
  eye: { position: "absolute", right: 10 },

  btn: {
    marginTop: 14,
    backgroundColor: "#8B0000",
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnTx: { color: "#fff", fontWeight: "800" },

  listCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  listTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A", marginBottom: 8 },
  emptyTx: { color: "#64748B", textAlign: "center", paddingVertical: 8 },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
  },
  userLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTx: { fontWeight: "800", color: "#0F172A" },
  userName: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  userEmail: { fontSize: 12, color: "#64748B", marginTop: 2 },

  userRight: { flexDirection: "row", alignItems: "center" },
  iconAction: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
