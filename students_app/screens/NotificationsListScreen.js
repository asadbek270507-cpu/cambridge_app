// src/screens/NotificationsListScreen.js
import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { firestore } from "../../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

// --- Bitta item: bosilganda sal kattalashadi, boshqa sahifaga o'tmaydi
const NotificationItem = memo(function NotificationItem({ item }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1.03,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [scale]);

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ""}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

export default function NotificationsListScreen() {
  const navigation = useNavigation();

  // Header: back + title (Stack.Navigator ichida ishlaydi)
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} />
        </Pressable>
      ),
      headerTitle: "Notifications",
    });
  }, [navigation]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(firestore, "notifications"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setNotifications(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="blue" />
        <Text>Yuklanmoqda...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <Text style={styles.empty}>Hozircha xabar yo‘q 🔔</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <NotificationItem item={item} />}
          contentContainerStyle={{ paddingTop: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBack: { paddingHorizontal: 12 },

  container: { flex: 1, padding: 15, backgroundColor: "#fff" },
  card: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 5 },
  body: { fontSize: 14, marginBottom: 5 },
  time: { fontSize: 12, color: "gray" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 20, fontSize: 16, color: "gray" },
});
