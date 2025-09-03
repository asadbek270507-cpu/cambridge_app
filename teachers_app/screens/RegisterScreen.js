// src/screens/RegisterScreen.js
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { auth, firestore, getSecondaryAuth } from "../../firebase";
import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";

// NEW:
import { getFunctions, httpsCallable } from "firebase/functions";
import { useNavigation } from "@react-navigation/native";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const unsubListRef = useRef(null);

  const navigation = useNavigation();
  const functions = getFunctions(); // default app
  const deleteStudentFn = httpsCallable(functions, "deleteStudentAccount"); // callable

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (unsubListRef.current) { unsubListRef.current(); unsubListRef.current = null; }

      if (!user) { setUsers([]); return; }

      const q = query(
        collection(firestore, "users"),
        where("role", "==", "student"),
        where("teacherId", "==", user.uid),
        where("status", "==", "active")
      );
      unsubListRef.current = onSnapshot(q, (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(arr);
      });
    });

    return () => {
      unsubAuth();
      if (unsubListRef.current) unsubListRef.current();
    };
  }, []);

  const handleRegister = async () => {
    if (!currentUser) return Alert.alert("Xato", "Teacher login qilmagan");
    if (!email || !password) return Alert.alert("Xato", "Login va parol kerak");
    if (!email.endsWith("@student.com")) return Alert.alert("Xato", "Faqat @student.com bilan tugasin");
    if (password.length < 6) return Alert.alert("Xato", "Parol kamida 6 ta belgi");

    try {
      const secondaryAuth = getSecondaryAuth();
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
      const newUser = userCred.user;

      await setDoc(doc(firestore, "users", newUser.uid), {
        email: email.trim(),
        role: "student",
        teacherId: currentUser.uid,
        studentAuthUid: newUser.uid,
        status: "active",
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        fullName: "", // detail ekranda to'ldirasiz
      });

      Alert.alert("OK", "Student yaratildi ✅");
      setEmail(""); setPassword("");
    } catch (e) {
      Alert.alert("Xato", e?.message || "Xatolik");
    }
  };

  // ⛔️ delete icon bosilganda — ogohlantirish + Cloud Function
  const confirmAndDelete = (student) => {
    Alert.alert(
      "Tasdiqlaysizmi?",
      `${student.email} akkauntini o‘chirasiz. Authentication’dan ham o‘chadi!`,
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Ha, o‘chirish",
          style: "destructive",
          onPress: async () => {
            try {
              // 1) Auth: Admin SDK (cloud function) orqali o'chirish + 2) doc'ni soft-delete
              await deleteStudentFn({ studentUid: student.id });
              // onSnapshot ro'yxatdan avtomatik tushadi (status=deleted endi ko‘rinmaydi)
              Alert.alert("OK", "Student o‘chirildi ✅");
            } catch (e) {
              Alert.alert("Xato", e?.message || "O‘chirishda xato");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register (Teacher → Student)</Text>

      <TextInput
        placeholder="ali@student.com"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Parol"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        style={styles.input}
      />

      <TouchableOpacity style={styles.btn} onPress={handleRegister}>
        <Text style={styles.btnText}>Create account</Text>
      </TouchableOpacity>

      {!!currentUser && (
        <>
          <Text style={styles.subtitle}>Siz yaratgan studentlar:</Text>
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <View style={styles.userItem}>
                {/* ITEMGA BOSGANDA DETAILGA O'TISH */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => navigation.navigate("StudentDetail", { studentId: item.id })}
                >
                  <Text style={{ fontWeight: "600" }}>{item.email}</Text>
                  <Text style={{ color: "#666", marginTop: 2 }}>
                    {item.fullName ? item.fullName : "Ism kiritilmagan"}
                  </Text>
                </TouchableOpacity>

                {/* DELETE ICON */}
                <TouchableOpacity onPress={() => confirmAndDelete(item)}>
                  <Text style={styles.delete}>❌</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, marginBottom: 10, borderRadius: 10 },
  btn: { backgroundColor: "blue", padding: 14, borderRadius: 10, marginBottom: 20 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  subtitle: { fontSize: 18, fontWeight: "600", marginVertical: 10 },
  userItem: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 10 },
  delete: { color: "red", fontSize: 18, paddingHorizontal: 8 },
});
