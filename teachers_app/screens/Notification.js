import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { firestore } from "../../firebase";

// ---------- Notifications helper (Expo Go'da xatoni oldini oladi)
async function getNotificationsModule() {
  const isExpoGo = Constants.appOwnership === "expo"; // Expo Go bo'lsa remote push yo'q
  try {
    if (isExpoGo) return null; // Expo Go: local notif to'g'ri ishlaydi, dinamik import qilsak ham bo'ladi
    // Dev/prod build: to'liq modul
    const Notifications = await import("expo-notifications");
    return Notifications;
  } catch {
    // Paket o'rnatilmagan bo'lsa ham app yiqilmasin
    return null;
  }
}

export default function NotificationScreen() {
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("📢 Yangi Xabar");
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const notificationsRef = useRef(null);

  // Init notifications handler (agar modul mavjud bo'lsa)
  useEffect(() => {
    (async () => {
      const N = await getNotificationsModule();
      notificationsRef.current = N;

      if (N?.setNotificationHandler) {
        N.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      }
    })();
  }, []);

  // Firestore stream: notifications ro'yxati
  useEffect(() => {
    const q = query(
      collection(firestore, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setItems(arr);
    });
    return unsub;
  }, []);

  const resetEditor = () => {
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
  };

  const sendNotification = async () => {
    if (!message.trim()) {
      Alert.alert("Xatolik", "Iltimos, xabar kiriting!");
      return;
    }
    try {
      // 1) Local notification (agar modul bor bo'lsa)
      const N = notificationsRef.current;
      if (N?.scheduleNotificationAsync) {
        await N.scheduleNotificationAsync({
          content: {
            title: title || "📢 Yangi Xabar",
            body: message,
            data: { source: "teacher", type: "local" },
          },
          trigger: null, // darhol
        });
      }

      // 2) Firestore ga yozish
      await addDoc(collection(firestore, "notifications"), {
        title: title || "📢 Yangi Xabar",
        body: message,
        createdAt: serverTimestamp(),
        read: false,
      });

      setMessage("");
      Alert.alert("✅ Success", "Sent message!");
    } catch (error) {
      console.error("sendNotification error:", error);
      Alert.alert("❌ Xato", "Xabar jo'natilmadi!");
    }
  };

  const toggleRead = async (item) => {
    try {
      await updateDoc(doc(firestore, "notifications", item.id), {
        read: !item.read,
      });
    } catch (e) {
      console.error("toggleRead error:", e);
      Alert.alert("Xato", "Holatni yangilab bo'lmadi");
    }
  };

  const removeItem = async (item) => {
    try {
      await deleteDoc(doc(firestore, "notifications", item.id));
    } catch (e) {
      console.error("removeItem error:", e);
      Alert.alert("Xato", "O'chirib bo'lmadi");
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title ?? "");
    setEditBody(item.body ?? "");
  };

  const saveEdit = async () => {
    try {
      await updateDoc(doc(firestore, "notifications", editingId), {
        title: editTitle,
        body: editBody,
      });
      resetEditor();
    } catch (e) {
      console.error("saveEdit error:", e);
      Alert.alert("Xato", "Saqlab bo'lmadi");
    }
  };

  const renderItem = ({ item }) => {
    const isEditing = editingId === item.id;
    return (
      <View style={[styles.card, item.read ? styles.cardRead : styles.cardUnread]}>
        {isEditing ? (
          <>
            <Text style={styles.label}>Sarlavha</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Sarlavha..."
            />
            <Text style={styles.label}>Matn</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={editBody}
              onChangeText={setEditBody}
              placeholder="Matn..."
              multiline
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveEdit}>
                <Text style={styles.btnText}>Saqlash</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={resetEditor}>
                <Text style={styles.btnGhostText}>Bekor qilish</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <View style={styles.row}>
            
              <TouchableOpacity
                style={[styles.btn, styles.btnWarning]}
                onPress={() => startEdit(item)}
              >
                <Text style={styles.btnText}>Tahrirlash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger]}
                onPress={() =>
                  Alert.alert("O‘chirish", "Haqiqatan o‘chirasizmi?", [
                    { text: "Yo‘q" },
                    { text: "Ha", style: "destructive", onPress: () => removeItem(item) },
                  ])
                }
              >
                <Text style={styles.btnText}>O‘chirish</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Yangi xabar formasi */}
      <Text style={styles.heading}>Notification yuborish</Text>
      <TextInput
        style={styles.input}
        placeholder="Sarlavha..."
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, { minHeight: 60 }]}
        placeholder="Xabar matni..."
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <Button title="Yuborish" onPress={sendNotification} />

      {/* Ro'yxat */}
      <Text style={[styles.heading, { marginTop: 18 }]}>Yuborilgan notifications</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: "#0f172a" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardUnread: { backgroundColor: "#fff7ed" }, // biroz sariq fon
  cardRead: { backgroundColor: "#f8fafc" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 },
  cardBody: { color: "#374151", marginBottom: 10 },
  row: { flexDirection: "row", gap: 8 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  btnPrimary: { backgroundColor: "#0f172a" },
  btnWarning: { backgroundColor: "#f59e0b" },
  btnDanger: { backgroundColor: "#dc2626" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#9ca3af" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnGhostText: { color: "#374151", fontWeight: "700" },
  label: { fontWeight: "700", marginBottom: 4, color: "#111827" },
});
