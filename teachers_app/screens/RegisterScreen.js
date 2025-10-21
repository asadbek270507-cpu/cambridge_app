// src/screens/RegisterScreen.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Alert, ActivityIndicator, ScrollView, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { auth, firestore, getSecondaryAuth } from "../../firebase";
import { onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection, query, where, onSnapshot,
  doc, setDoc, serverTimestamp
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

/* ------------------ Responsive helpers ------------------ */
const BASE_WIDTH = 360;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function useScale() {
  const { width, fontScale } = useWindowDimensions();
  const scale = clamp(width / BASE_WIDTH, 0.95, 1.05);
  const ms = (v) => Math.round(v * scale);
  const mfs = (v) => Math.round((v * scale) / Math.min(fontScale || 1, 1.1));
  return { ms, mfs };
}

/* ------------------ Helpers ------------------ */
const initials = (s = "") => {
  const src = String(s).trim();
  if (!src) return "?";
  const parts = src.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  const a = (parts[0] || "?")[0]?.toUpperCase() || "?";
  const b = (parts[1] || "")[0]?.toUpperCase() || "";
  return a + b;
};
const pretty = (e) => e?.message || e?.code || "Xatolik";

// ✅ DM ID ni har doim bitta tartibda yasaymiz
const dmIdFor = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/* ======================================================== */
export default function RegisterScreen() {
  const { ms, mfs } = useScale();

  /* form */
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /* app */
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);
  const unsubListRef = useRef(null);

  const navigation = useNavigation();

  // ✅ All callables -> asia-southeast1 (teacher_createStudentDoc shu yerda)
  const functions = getFunctions(undefined, "us-central1");
  const fnCreateStudentDoc = httpsCallable(functions, "teacher_createStudentDoc");
  const fnSetRandomPassword = httpsCallable(functions, "admin_setRandomPassword");
  const fnDeleteDeep = httpsCallable(functions, "admin_deleteStudentDeep");

  const canSubmit = useMemo(
    () =>
      !!currentUser &&
      displayName.trim().length > 1 &&
      email.trim().toLowerCase().endsWith("@student.com") &&
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

      const qy = query(
        collection(firestore, "users"),
        where("role", "==", "student"),
        where("teacherId", "==", user.uid),
        where("status", "==", "active")
      );

      unsubListRef.current = onSnapshot(
        qy,
        (snap) => {
          const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setUsers(arr);
        },
        (err) => console.warn("users snapshot error:", err?.message || err)
      );
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
      // 1) Auth'da student user ochamiz (secondary auth bilan)
      const secondaryAuth = getSecondaryAuth();
      const userCred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim().toLowerCase(),
        password.trim()
      );
      const newUser = userCred.user;

      // 2) Firestore profil + DM ni **Cloud Function** orqali yozamiz
      await fnCreateStudentDoc({
        studentUid: newUser.uid,
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        teacherId: currentUser.uid, // ixtiyoriy, CF o‘zi ham auth.uid qiladi
      });

      Alert.alert("OK", "Student yaratildi ✅");
      setDisplayName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
    } catch (e) {
      const msg = pretty(e);
      Alert.alert("Xato", msg);
    } finally {
      setBusy(false);
    }
  };

  /* RESET: random parol */
  const handleResetPassword = async (student) => {
    try {
      setRowBusy({ id: student.id, type: "reset" });
      const { data } = await fnSetRandomPassword({ uid: student.id, length: 10 });
      const newPass = data?.password || "";
      if (!newPass) throw new Error("Yangi parol olinmadi");

      await Clipboard.setStringAsync(newPass);
      Alert.alert("Parol yangilandi", `Yangi parol: ${newPass}\n\n(Clipboard'ga nusxalandi)`);
    } catch (e) {
      Alert.alert("Xato", pretty(e));
    } finally {
      setRowBusy(null);
    }
  };

  /* DELETE: Deep delete */
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
      setUsers((prev) => prev.filter((u) => u.id !== student.id)); // optimistik
      await fnDeleteDeep({ uid: student.id });
      Alert.alert("OK", "Student to‘liq o‘chirildi ✅");
    } catch (e) {
      Alert.alert("Xato", pretty(e));
    } finally {
      setRowBusy(null);
    }
  };

  // ✅ Chat2 ga doim bir xil dmId bilan ochamiz (shu bilan “eski xabarlar” aralashishi yo‘qoladi)
  const openChat = async (studentId) => {
    try {
      const teacherId = auth.currentUser?.uid;
      if (!teacherId) return;

      const dmId = dmIdFor(teacherId, studentId);
      // DM hujjatini mavjud bo‘lmasa yaratib qo‘yamiz (merge)
      await setDoc(
        doc(firestore, "private_chats", dmId),
        {
          participants: [teacherId, studentId],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: null,
          lastSender: null,
          title: null,
        },
        { merge: true }
      );

      // Chat2 ni aniq paramlar bilan ochamiz
      navigation.navigate("Chat2", {
        dmId,
        peerId: studentId,
        teacherId,
      });
    } catch (e) {
      Alert.alert("Xato", pretty(e));
    }
  };

  const renderItem = ({ item }) => {
    const label = item.displayName || item.email;
    const isResetBusy = rowBusy?.id === item.id && rowBusy?.type === "reset";
    const isDeleteBusy = rowBusy?.id === item.id && rowBusy?.type === "delete";

    return (
      <View style={[styles.userCard, { padding: ms(10), borderRadius: ms(12) }]}>
        <View style={styles.userLeft}>
          <View style={[styles.avatar, { width: ms(36), height: ms(36), borderRadius: ms(18) }]}>
            <Text style={[styles.avatarTx, { fontSize: mfs(12) }]} allowFontScaling={false}>
              {initials(label)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { fontSize: mfs(14) }]} numberOfLines={1} allowFontScaling={false}>
              {item.displayName ? item.displayName : "Ism kiritilmagan"}
            </Text>
            <Text style={[styles.userEmail, { fontSize: mfs(12) }]} numberOfLines={1} allowFontScaling={false}>
              {item.email}
            </Text>
          </View>
        </View>

        <View style={styles.userRight}>
          <TouchableOpacity
            onPress={() => openChat(item.id)}
            style={[styles.iconAction, { backgroundColor: "#0D47A1", paddingVertical: ms(8), paddingHorizontal: ms(10), borderRadius: ms(8) }]}
            activeOpacity={0.85}
            disabled={!!rowBusy}
          >
            <MaterialCommunityIcons name="message-text" size={mfs(18)} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleResetPassword(item)}
            style={[styles.iconAction, { backgroundColor: "#F59E0B", marginLeft: ms(8), paddingVertical: ms(8), paddingHorizontal: ms(10), borderRadius: ms(8) }]}
            activeOpacity={0.85}
            disabled={isResetBusy || !!rowBusy}
          >
            {isResetBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="lock-reset" size={mfs(18)} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => confirmAndDelete(item)}
            style={[styles.iconAction, { backgroundColor: "#EF4444", marginLeft: ms(8), paddingVertical: ms(8), paddingHorizontal: ms(10), borderRadius: ms(8) }]}
            activeOpacity={0.85}
            disabled={isDeleteBusy || !!rowBusy}
          >
            {isDeleteBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="trash-can" size={mfs(18)} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.scroll, { padding: ms(16), paddingBottom: ms(32) }]} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={[styles.headerWrap, { gap: ms(8) }]}>
          <View style={[styles.badge, { backgroundColor: "#FDECEC", borderColor: "#8B0000", borderRadius: 999, paddingHorizontal: ms(10), paddingVertical: ms(6) }]}>
            <MaterialCommunityIcons name="account-school" size={mfs(16)} color="#8B0000" />
            <Text style={[styles.badgeTx, { fontSize: mfs(12) }]} allowFontScaling={false}>Teacher → Student</Text>
          </View>
          {!!currentUser && (
            <View style={[styles.badge, { backgroundColor: "#E8F0FF", borderColor: "#0D47A1", borderRadius: 999, paddingHorizontal: ms(10), paddingVertical: ms(6) }]}>
              <MaterialCommunityIcons name="shield-account" size={mfs(16)} color="#0D47A1" />
              <Text style={[styles.badgeTx, { fontSize: mfs(12) }]} numberOfLines={1} allowFontScaling={false}>
                {currentUser.email}
              </Text>
            </View>
          )}
        </View>

        {/* Form */}
        <View style={[styles.card, { borderRadius: ms(14), padding: ms(16) }]}>
          <Text style={[styles.title, { fontSize: mfs(18) }]} allowFontScaling={false}>
            Yangi student ro‘yxatdan o‘tkazish
          </Text>
          <Text style={[styles.subtitle, { fontSize: mfs(13), marginTop: ms(4), marginBottom: ms(10) }]} allowFontScaling={false}>
            Email <Text style={{ fontWeight: "800" }}>@student.com</Text> bilan tugashi shart
          </Text>

          <View style={[styles.field, { borderRadius: ms(10), paddingHorizontal: ms(10), marginTop: ms(10), borderWidth: 1 }]}>
            <MaterialCommunityIcons name="account" size={mfs(20)} color="#8B0000" />
            <TextInput
              placeholder="Student ismi"
              value={displayName}
              onChangeText={setDisplayName}
              style={[styles.input, { height: ms(44), paddingHorizontal: ms(10), fontSize: mfs(14) }]}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={[styles.field, { borderRadius: ms(10), paddingHorizontal: ms(10), marginTop: ms(10), borderWidth: 1 }]}>
            <MaterialCommunityIcons name="email" size={mfs(20)} color="#8B0000" />
            <TextInput
              placeholder="ali@student.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={[styles.input, { height: ms(44), paddingHorizontal: ms(10), fontSize: mfs(14) }]}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={[styles.field, { borderRadius: ms(10), paddingHorizontal: ms(10), marginTop: ms(10), borderWidth: 1 }]}>
            <MaterialCommunityIcons name="lock" size={mfs(20)} color="#8B0000" />
            <TextInput
              placeholder="Parol (kamida 6 belgi)"
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { height: ms(44), paddingRight: ms(36), paddingHorizontal: ms(10), fontSize: mfs(14) }]}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ position: "absolute", right: ms(10) }}
            >
              <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={mfs(20)} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.btn,
              { height: ms(46), borderRadius: ms(10), marginTop: ms(14), gap: ms(8) },
              !canSubmit && { opacity: 0.5 },
            ]}
            onPress={handleRegister}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="account-plus" size={mfs(18)} color="#fff" />
                <Text style={[styles.btnTx, { fontSize: mfs(14) }]} allowFontScaling={false}>Create account</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Students list */}
        {!!currentUser && (
          <View style={[styles.listCard, { borderRadius: ms(14), padding: ms(12) }]}>
            <Text style={[styles.listTitle, { fontSize: mfs(16), marginBottom: ms(8) }]} allowFontScaling={false}>
              Siz yaratgan studentlar
            </Text>
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={{ height: ms(8) }} />}
              ListEmptyComponent={
                <Text style={[styles.emptyTx, { fontSize: mfs(12), paddingVertical: ms(8) }]} allowFontScaling={false}>
                  Hali ro‘yxat bo‘sh
                </Text>
              }
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
  scroll: { gap: 16 },

  headerWrap: { flexDirection: "row", alignItems: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1 },
  badgeTx: { fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontWeight: "900", color: "#0F172A" },
  subtitle: { color: "#475569" },

  field: { flexDirection: "row", alignItems: "center", borderColor: "#8B0000", backgroundColor: "#fff" },
  input: { flex: 1, color: "#0F172A" },

  btn: { backgroundColor: "#8B0000", alignItems: "center", justifyContent: "center", flexDirection: "row" },
  btnTx: { color: "#fff", fontWeight: "800" },

  listCard: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  listTitle: { fontWeight: "900", color: "#0F172A" },
  emptyTx: { color: "#64748B", textAlign: "center" },

  userCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC" },
  userLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: "#E2E8F0" },
  avatarTx: { fontWeight: "800", color: "#0F172A" },
  userName: { fontWeight: "800", color: "#0F172A" },
  userEmail: { color: "#64748B", marginTop: 2 },

  userRight: { flexDirection: "row", alignItems: "center" },
  iconAction: { alignItems: "center", justifyContent: "center" },
});
