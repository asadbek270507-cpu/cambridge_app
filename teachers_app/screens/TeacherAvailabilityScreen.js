import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import dayjs from "dayjs";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../../firebase"; // loyihangizdagi yo'l
// Agar auth ishlatayotgan bo'lsangiz teacherId ni auth'dan oling yoki route orqali yuboring.

///////////////////////
// Uzbek locale
LocaleConfig.locales.uz = {
  monthNames: [
    "Yanvar","Fevral","Mart","Aprel","May","Iyun",
    "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"
  ],
  monthNamesShort: [
    "Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"
  ],
  dayNames: ["Yakshanba","Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba"],
  dayNamesShort: ["Yak","Du","Se","Cho","Pa","Ju","Sha"],
  today: "Bugun"
};
LocaleConfig.defaultLocale = "uz";
///////////////////////

export default function TeacherAvailabilityScreen({ route }) {
  // route?.params?.teacherId ni kutamiz; bo'lmasa "demo-teacher" qilib qo'yamiz
  const teacherId = route?.params?.teacherId || "demo-teacher";

  const [selectedDates, setSelectedDates] = useState(() => new Set()); // "YYYY-MM-DD" lar to'plami

  const toggleDate = useCallback((dateString) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateString)) next.delete(dateString);
      else next.add(dateString);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelectedDates(new Set()), []);

  const markedDates = useMemo(() => {
    // Calendar uchun belgilash (multi-select)
    const out = {};
    selectedDates.forEach((d) => {
      out[d] = {
        selected: true,
        selectedColor: "#2563eb", // Tailwind 'blue-600' ga o'xshash
        selectedTextColor: "#ffffff",
      };
    });
    // Bugunni highlight qilsak ham bo'ladi (ixtiyoriy)
    const today = dayjs().format("YYYY-MM-DD");
    if (!out[today]) {
      out[today] = {
        ...(out[today] || {}),
        today: true,
      };
    }
    return out;
  }, [selectedDates]);

  const onDayPress = useCallback((day) => {
    // day.dateString -> "YYYY-MM-DD"
    // O'tmish kunlarni bloklash (ixtiyoriy):
    if (dayjs(day.dateString).isBefore(dayjs().startOf("day"))) {
      Alert.alert("Eslatma", "O‘tgan sanani tanlab bo‘lmaydi.");
      return;
    }
    toggleDate(day.dateString);
  }, [toggleDate]);

  const handleSave = useCallback(async () => {
    try {
      const datesArr = Array.from(selectedDates).sort();
      if (datesArr.length === 0) {
        Alert.alert("Eslatma", "Hech bo‘lmaganda bitta sana tanlang.");
        return;
      }
      // Firestore: teacher_availability/{teacherId}
      const ref = doc(firestore, "teacher_availability", teacherId);
      await setDoc(
        ref,
        {
          teacherId,
          dates: datesArr, // ["2025-09-05", "2025-09-12", ...]
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      Alert.alert("Saqlandi", "Tanlangan sanalar muvaffaqiyatli saqlandi.");
    } catch (e) {
      console.error(e);
      Alert.alert("Xatolik", "Saqlashda muammo yuz berdi. Ruxsatlarni tekshiring.");
    }
  }, [selectedDates, teacherId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>O‘qituvchi uchun taqvim</Text>

      <Calendar
        onDayPress={onDayPress}
        markedDates={markedDates}
        enableSwipeMonths
        firstDay={1} // hafta dushanbadan
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
        // Ixtiyoriy: o'tgan sanalarni disable qilish
        minDate={dayjs().format("YYYY-MM-DD")}
      />

      <View style={styles.footer}>
        <Text style={styles.count}>
          Tanlangan: <Text style={styles.countNum}>{selectedDates.size}</Text> ta sana
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={clearAll}>
            <Text style={[styles.btnText, styles.btnGhostText]}>Tozalash</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleSave}>
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Saqlash</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ————— Styles —————
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
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
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  btnGhost: {
    backgroundColor: "#f3f4f6",
  },
  btnGhostText: { color: "#111827", fontWeight: "700" },
  btnPrimary: {
    backgroundColor: "#2563eb",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
  btnText: { fontSize: 14 },
});
