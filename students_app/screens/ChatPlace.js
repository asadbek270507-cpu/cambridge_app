// src/screens/ChatPlace.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground, // ✅ BACKGROUND
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, firestore } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// ✅ Cambridge fon rasmi (yo‘lni loyihangizga moslang)
import Cambridge_logo from "../../assets/Cambridge_logo.png";

export default function ChatPlaceholder({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid || null;
    if (!uid) {
      setLoading(false);
      setGroups([]);
      return;
    }

    // Faqat shu teacher yaratgan guruhlar
    const qRef = query(
      collection(firestore, "groups"),
      where("createdBy", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGroups(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, []);

  const openGroup = (g) => {
    navigation.navigate("ChatScreen", {
      groupId: g.id,
      groupName: g.name,
      teacherId: auth.currentUser?.uid || null,
    });
  };

  return (
    // ✅ BACKGROUND IMAGE
    <ImageBackground source={Cambridge_logo} style={styles.screen} imageStyle={styles.bgImage}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8A0D0D" />
        </View>
      ) : !groups.length ? (
        <View style={styles.container}>
          <Text style={styles.text}>💬 Not available chats.</Text>
        </View>
      ) : (
        <View style={[styles.container, { paddingHorizontal: 12 }]}>
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 10 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.groupItem} onPress={() => openGroup(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{item.name}</Text>
                  {item.lastMessage ? (
                    <Text numberOfLines={1} style={styles.lastMsg}>
                      {item.lastMessage}
                    </Text>
                  ) : (
                    <Text style={styles.lastMsgEmpty}>Yangi chat boshlang</Text>
                  )}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#6B7280" />
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // EKRAN va FON
  screen: { flex: 1 },
  bgImage: {
    opacity: 0.08, // fon shaffofligi
    resizeMode: "cover",
  },

  // KONTENT
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "transparent" },
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "transparent" },

  text: { fontSize: 20, fontWeight: "600", color: "#8A0D0D" },
  subText: { fontSize: 16, color: "#555", marginTop: 8 },

  groupItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  groupName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  lastMsg: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  lastMsgEmpty: { fontSize: 12, color: "#9CA3AF", marginTop: 4, fontStyle: "italic" },
});
