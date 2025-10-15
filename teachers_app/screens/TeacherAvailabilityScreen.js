// src/screens/TeacherAvailabilityScreen.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar, LocaleConfig } from "react-native-calendars";
import dayjs from "dayjs";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firestore } from "../../firebase";
import {
  doc, onSnapshot, setDoc, serverTimestamp, getDoc
} from "firebase/firestore";

/* ---------- Uzbek locale ---------- */
LocaleConfig.locales.uz = {
  monthNames: ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"],
  monthNamesShort: ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"],
  dayNames: ["Yakshanba","Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba"],
  dayNamesShort: ["Yak","Du","Se","Cho","Pa","Ju","Sha"],
  today: "Bugun",
};
LocaleConfig.defaultLocale = "uz";
/* ---------------------------------- */

export default function TeacherAvailabilityScreen() {
  const navigation = useNavigation();

  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // DB’dan kelgan mavjud sanalar
  const [storedDates, setStoredDates] = useState(new Set());
  // UI’da tanlanayotgan sanalar
  const [selectedDates, setSelectedDates] = useState(new Set());

  // auth
  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), []);

  // header (faqat back)
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingHorizontal: 12 }} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>
      ),
      headerTitle: "TeacherAvailabilityScreen",
    });
  }, [navigation]);

  // mavjud availability’ni o‘qib kelish
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const ref = doc(firestore, "teacher_availability", uid);
    const unsub = onSnapshot(ref, snap => {
      const data = snap.data();
      const arr = Array.isArray(data?.dates) ? data.dates : [];
      const s = new Set(arr);
      setStoredDates(s);
      setSelectedDates(s); // UI’ni DB bilan sinxron boshlab beramiz
      setLoading(false);
    }, _err => {
      // agar doc umuman bo‘lmasa, bir marta tekshirib olib loading’ni tushiramiz
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const minDate = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const markedDates = useMemo(() => {
    const out = {};
    selectedDates.forEach(d => {
      out[d] = { selected: true, selectedColor: "#2563eb", selectedTextColor: "#ffffff" };
    });
    const today = dayjs().format("YYYY-MM-DD");
    if (!out[today]) out[today] = { ...(out[today] || {}), today: true };
    return out;
  }, [selectedDates]);

  const toggleDate = useCallback((dateString) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateString)) next.delete(dateString);
      else next.add(dateString);
      return next;
    });
  }, []);

  const onDayPress = useCallback((day) => {
    const ds = day.dateString; // "YYYY-MM-DD"
    if (dayjs(ds).isBefore(dayjs().startOf("day"))) {
      Alert.alert("Eslatma", "O‘tgan sanani tanlab bo‘lmaydi.");
      return;
    }
    toggleDate(ds);
  }, [toggleDate]);

  const clearAll = useCallback(() => setSelectedDates(new Set()), []);
  const isDirty = useMemo(() => {
    if (storedDates.size !== selectedDates.size) return true;
    for (const d of selectedDates) if (!storedDates.has(d)) return true;
    return false;
  }, [storedDates, selectedDates]);

  const handleSave = useCallback(async () => {
    if (!uid) {
      Alert.alert("Xatolik", "Avval tizimga kiring (teacher).");
      return;
    }
    const datesArr = Array.from(selectedDates).sort();
    if (datesArr.length === 0) {
      Alert.alert("Eslatma", "Hech bo‘lmaganda bitta sana tanlang.");
      return;
    }
    setSaving(true);
    try {
      const ref = doc(firestore, "teacher_availability", uid); // doc id = uid
      await setDoc(ref, {
        teacherId: uid,
        dates: datesArr,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setStoredDates(new Set(datesArr));
      Alert.alert("Saqlandi", "Tanlangan sanalar muvaffaqiyatli saqlandi.");
    } catch (e) {
      console.warn(e);
      Alert.alert("Xatolik", "Saqlashda muammo yuz berdi. Ruxsatlarni tekshiring.");
    } finally {
      setSaving(false);
    }
  }, [uid, selectedDates]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Yuklanmoqda…</Text>
      </View>
    );
  }

  if (!uid) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 16 }}>Kirish talab qilinadi.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>O‘qituvchi uchun taqvim</Text>

      <Calendar
        onDayPress={onDayPress}
        markedDates={markedDates}
        enableSwipeMonths
        firstDay={1}
        minDate={minDate}
        style={styles.calendar}
        theme={{
          textSectionTitleColor: "#6b7280",
          monthTextColor: "#111827",
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 12,
          arrowColor: "#111827",
          todayTextColor: "#111827",
        }}
      />

      <View style={styles.footer}>
        <Text style={styles.count}>
          Tanlangan: <Text style={styles.countNum}>{selectedDates.size}</Text> ta sana
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={clearAll} disabled={saving}>
            <Text style={[styles.btnText, styles.btnGhostText]}>Tozalash</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, (!isDirty || saving) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={!isDirty || saving}
          >
            <Text style={[styles.btnText, styles.btnPrimaryText]}>{saving ? "Saqlanmoqda..." : "Saqlash"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
  calendar: {
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  footer: { marginTop: 12 },
  count: { fontSize: 14, color: "#374151", marginBottom: 8 },
  countNum: { fontWeight: "700" },
  buttons: { flexDirection: "row", gap: 12 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  btnGhost: { backgroundColor: "#f3f4f6" },
  btnGhostText: { color: "#111827", fontWeight: "700" },
  btnPrimary: { backgroundColor: "#2563eb" },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
  btnText: { fontSize: 14 },
});
