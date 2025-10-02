// src/screens/CalendarView.js  (yoki .jsx)
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { auth, firestore } from '../firebase'; // yo'lingizga moslang

const COLORS = {
  accent: '#8B0000', // deep red
  soft:   '#FDE2E2', // soft red fill
};

export default function CalendarView() {
  const [uid, setUid] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [marked, setMarked] = useState({});
  const [loading, setLoading] = useState(true);

  // 1) Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid || null);
    });
    return unsub;
  }, []);

  // 2) Student -> teacherId ni kuzatish
  useEffect(() => {
    // login almashtirilsa eski holatni tozalab yuboramiz
    setTeacherId(null);
    setMarked({});
    if (!uid) { setLoading(false); return; }

    setLoading(true);
    const unsubUser = onSnapshot(
      doc(firestore, 'users', uid),
      (snap) => {
        const data = snap.data() || {};
        setTeacherId(data?.teacherId || null);
        setLoading(false);
      },
      () => { setTeacherId(null); setLoading(false); }
    );
    return () => unsubUser();
  }, [uid]);

  // 3) Faqat o‘z teacher’ining availability’sini o‘qish
  useEffect(() => {
    setMarked({});
    if (!teacherId) return;

    const unsubAvail = onSnapshot(
      doc(firestore, 'teacher_availability', teacherId),
      (snap) => {
        const dates = (snap.exists() && Array.isArray(snap.data().dates)) ? snap.data().dates : [];
        const next = {};
        dates.forEach((day) => {
          if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
            next[day] = {
              selected: true,
              selectedColor: COLORS.soft,
              selectedTextColor: COLORS.accent,
              disableTouchEvent: true,
            };
          }
        });
        setMarked(next);
      },
      (err) => {
        console.warn('availability stream error:', err?.message || String(err));
        setMarked({});
      }
    );
    return () => unsubAvail();
  }, [teacherId]);

  // UI states
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Yuklanmoqda…</Text>
      </View>
    );
  }
  if (!uid) {
    return (
      <View style={styles.center}>
        <Text>Avval tizimga kiring.</Text>
      </View>
    );
  }
  if (!teacherId) {
    return (
      <View style={styles.center}>
        <Text>Teacher biriktirilmagan.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} key={teacherId}>
      <Calendar
        markedDates={marked}
        enableSwipeMonths
        firstDay={1}
        theme={{
          selectedDayBackgroundColor: COLORS.soft,
          selectedDayTextColor: COLORS.accent,
          todayTextColor: COLORS.accent,
          arrowColor: COLORS.accent,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '90%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    padding: 10,
    elevation: 3,
    alignSelf: 'center',
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
});
