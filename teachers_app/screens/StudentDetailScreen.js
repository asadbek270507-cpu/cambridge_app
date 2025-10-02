// src/screens/StudentDetailScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { firestore } from "../../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function StudentDetailScreen({ route, navigation }) {
  const { studentId } = route.params;
  const [student, setStudent] = useState(null);
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    (async () => {
      const ref = doc(firestore, "users", studentId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert("Xato", "Student topilmadi");
        navigation.goBack();
        return;
      }
      const data = snap.data();
      setStudent({ id: snap.id, ...data });
      setFullName(data.fullName || "");
    })();
  }, [studentId]);

  const saveName = async () => {
    try {
      await updateDoc(doc(firestore, "users", studentId), {
        fullName: fullName.trim(),
        updatedAt: new Date(),
      });
      Alert.alert("OK", "Ism saqlandi ✅");
    } catch (e) {
      Alert.alert("Xato", e?.message || "Saqlashda xato");
    }
  };

  const setPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return Alert.alert("Xato", "Parol kamida 6 ta belgi bo‘lsin");
    }
    try {
      const functions = getFunctions();
      const setPassFn = httpsCallable(functions, "adminSetStudentPassword");
      await setPassFn({ studentUid: studentId, newPassword });
      setNewPassword("");
      Alert.alert("OK", "Parol yangilandi ✅");
    } catch (e) {
      Alert.alert("Xato", e?.message || "Parol yangilashda xato");
    }
  };

  if (!student) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Student: {student.email}</Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Talabaning to‘liq ismi"
        style={styles.input}
      />
      <TouchableOpacity style={styles.btn} onPress={saveName}>
        <Text style={styles.btnText}>Save name</Text>
      </TouchableOpacity>

      <View style={{ height: 16 }} />

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 14, color: "#444", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, marginBottom: 10 },
  btn: { backgroundColor: "blue", padding: 12, borderRadius: 10 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "600" },
});
