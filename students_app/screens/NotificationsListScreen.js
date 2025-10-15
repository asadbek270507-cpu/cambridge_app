// students_app/NotificationsListScreen.js
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
  useLayoutEffect,
} from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firestore } from "../../firebase";
import * as Notifications from "expo-notifications"; // ✅ qo‘shildi
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/** Safe formatter for Firestore Timestamp | Date | number|null */
function fmt(ts) {
  try {
    const d =
      ts?.toDate?.() ??
      (typeof ts === "number"
        ? new Date(ts)
        : ts instanceof Date
        ? ts
        : null);
    if (!d) return "";
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "";
  }
}

const NotificationItem = memo(function NotificationItem({ item, read, onMarkRead }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 1.03,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => onMarkRead(item)}>
      <Animated.View
        style={[
          styles.card,
          read ? styles.cardRead : styles.cardUnread,
          { transform: [{ scale }] },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {!read && <View style={styles.dot} />}
          <Text style={styles.title} numberOfLines={2}>
            {item.title || "Notification"}
          </Text>
        </View>

        {!!item.body && <Text style={styles.body}>{item.body}</Text>}
        <Text style={styles.time}>{fmt(item.createdAt)}</Text>
      </Animated.View>
    </Pressable>
  );
});

export default function NotificationsListScreen() {
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  // Local optimistic read-lar uchun
  const [locallyRead, setLocallyRead] = useState(() => new Set());
  const locallyReadRef = useRef(locallyRead);
  useEffect(() => { locallyReadRef.current = locallyRead; }, [locallyRead]);

  // 🔔 Foreground fallback uchun, birinchi yuklashni va ko‘rilgan id’larni saqlaymiz
  const firstLoadRef = useRef(true);          // ✅ qo‘shildi
  const seenIdsRef = useRef(new Set());       // ✅ qo‘shildi

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUserId(u?.uid ?? null));
    return unsub;
  }, []);

  // Header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ paddingHorizontal: 12 }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} />
        </Pressable>
      ),
      headerTitle: "Notifications",
    });
  }, [navigation]);

  // Stream notifications
  useEffect(() => {
    const qy = query(
      collection(firestore, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qy,
      async (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(docs);

        // 🔔 Foreground fallback: faqat 1-chi yuklashdan keyingi YANGI hujjatlar uchun local push
        if (!firstLoadRef.current && userId) {
          const prev = seenIdsRef.current;
          const newcomers = docs.filter((d) => !prev.has(d.id));
          for (const n of newcomers) {
            // o‘zim yaratgan yoki allaqachon read bo‘lganini o‘tkazib yuboramiz
            if (n?.createdBy === userId) continue;
            if (n?.readBy?.[userId]) continue;

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: n.title || "Notification",
                  body: n.body || "",
                  data: { notificationId: n.id },
                  sound: "default",
                },
                trigger: null, // show now → OS banner
              });
            } catch {}
          }
          newcomers.forEach((n) => prev.add(n.id));
        }

        // birinchi yuklashni yozib qo‘yamiz va barcha id’larni ko‘rildi deb belgilaymiz (fallback filtri uchun)
        if (firstLoadRef.current) {
          firstLoadRef.current = false;
          const all = seenIdsRef.current;
          docs.forEach((d) => all.add(d.id));
        }

        // Serverda men uchun read bo'lganini ko‘rsak, optimistic belgilashni olib tashlaymiz
        if (userId) {
          const currentLocal = locallyReadRef.current;
          const next = new Set(currentLocal);
          let changed = false;
          for (const n of docs) {
            if (n?.readBy?.[userId] && next.has(n.id)) {
              next.delete(n.id);
              changed = true;
            }
          }
          if (changed) setLocallyRead(next);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("notifications stream error:", err?.code || err?.message || String(err));
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const isRead = useCallback(
    (n) => {
      if (!n) return false;
      const server = !!n.read || !!(userId && n?.readBy?.[userId]);
      const local = locallyRead.has(n.id);
      return server || local;
    },
    [userId, locallyRead]
  );

  const markOne = useCallback(
    async (n) => {
      if (!userId || !n?.id) return;
      if (isRead(n)) return;

      // Optimistic
      setLocallyRead((prev) => {
        const s = new Set(prev);
        s.add(n.id);
        return s;
      });

      try {
        await updateDoc(doc(firestore, "notifications", n.id), {
          [`readBy.${userId}`]: serverTimestamp(),
        });
      } catch (e) {
        if (e?.code === "permission-denied") {
          setLocallyRead((prev) => {
            const s = new Set(prev);
            s.delete(n.id);
            return s;
          });
        }
        console.warn("markOne failed:", e?.code || e?.message || String(e));
      }
    },
    [userId, isRead]
  );

  if (!userId || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Yuklanmoqda…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <Text style={styles.empty}>Hozircha bildirishnoma yo‘q 🔔</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              read={isRead(item)}
              onMarkRead={markOne}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          extraData={locallyRead}
          removeClippedSubviews
          initialNumToRender={10}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 24, fontSize: 16, color: "gray" },

  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  cardUnread: { backgroundColor: "#fff7ed" },
  cardRead: { backgroundColor: "#f8fafc" },

  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444", marginRight: 8 },
  title: { fontSize: 16, fontWeight: "700", color: "#111827" },
  body: { fontSize: 14, color: "#374151", marginTop: 4 },
  time: { fontSize: 12, color: "#6b7280", marginTop: 8 },
});
