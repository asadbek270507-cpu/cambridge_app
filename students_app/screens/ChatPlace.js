// src/screens/ChatPlace.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  SafeAreaView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { auth, firestore } from "../../firebase";
import Cambridge_logo from "../../assets/Cambridge_logo.png";

// ✅ Sizdagi CustomHeader komponenti
// Agar yo'li boshqacha bo'lsa, shu importni moslang:
import CustomHeader from "../../components/CustomHeader";

import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ChatPlace() {
  const navigation = useNavigation();
  const [me, setMe] = useState(null);
  const [teacherId, setTeacherId] = useState(undefined); // undefined = hali yuklanmagan, null = yo'q

  const [dmLoading, setDmLoading] = useState(true);
  const [groupLoading, setGroupLoading] = useState(true);

  const [dms, setDms] = useState([]);
  const [groups, setGroups] = useState([]);

  /* ========== AUTH ========== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => unsub();
  }, []);

  /* ========== users/{me} -> teacherId ========== */
  useEffect(() => {
    (async () => {
      if (!me?.uid) {
        setTeacherId(null);
        return;
      }
      try {
        const snap = await getDoc(doc(firestore, "users", me.uid));
        setTeacherId(snap.exists() ? snap.data()?.teacherId ?? null : null);
      } catch {
        setTeacherId(null);
      }
    })();
  }, [me?.uid]);

  /* ========== DMs listener (orderBy yo'q: index talab qilmasin) ========== */
  useEffect(() => {
    if (!me?.uid) {
      setDms([]);
      setDmLoading(false);
      return;
    }
    setDmLoading(true);

    const ref = collection(firestore, "private_chats");
    const qRef = query(ref, where("participants", "array-contains", me.uid));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Faqat MENING TEACHERim bilan bo'lgan DM qoldiriladi (teacherId bo'lsa)
        const filtered = teacherId
          ? all.filter((r) => (r.participants || []).includes(teacherId))
          : all;
        setDms(filtered);
        setDmLoading(false);
      },
      () => {
        setDms([]);
        setDmLoading(false);
      }
    );

    return () => unsub();
  }, [me?.uid, teacherId]);

  /* ========== Groups listener (faqat a'zo bo'lganlar) ========== */
  useEffect(() => {
    if (!me?.uid) {
      setGroups([]);
      setGroupLoading(false);
      return;
    }
    setGroupLoading(true);

    const ref = collection(firestore, "groups");
    const qRef = query(ref, where("memberIds", "array-contains", me.uid));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const filtered = teacherId
          ? all.filter((g) => g.createdBy === teacherId)
          : all;
        setGroups(filtered);
        setGroupLoading(false);
      },
      () => {
        setGroups([]);
        setGroupLoading(false);
      }
    );

    return () => unsub();
  }, [me?.uid, teacherId]);

  /* ========== Merge & sort ========== */
  const items = useMemo(() => {
    const dmItems = dms.map((p) => {
      const otherId = (p.participants || []).find((x) => x !== me?.uid);
      const t = p.updatedAt?.toMillis?.() || 0;
      return {
        key: `dm:${p.id}`,
        type: "dm",
        id: p.id,
        title: p.title || "Teacher chat", // xohlasangiz: "Direct chat"
        subtitle: p.lastMessage || "",
        timeMs: t,
        data: { ...p, otherId },
        leftIcon: "account",
      };
    });

    const groupItems = groups.map((g) => {
      const t = g.lastMessageAt?.toMillis?.() || g.createdAt?.toMillis?.() || 0;
      return {
        key: `group:${g.id}`,
        type: "group",
        id: g.id,
        title: g.name || "Group",
        subtitle: g.lastMessage || "",
        timeMs: t,
        data: g,
        leftIcon: "account-group",
      };
    });

    return [...dmItems, ...groupItems].sort((a, b) => b.timeMs - a.timeMs);
  }, [dms, groups, me?.uid]);

  const allLoading = dmLoading || groupLoading || teacherId === undefined;

  const openItem = (it) => {
    if (it.type === "group") {
      // ✅ Chat2 ga navigate (group chat)
      navigation.navigate("ChatScreen", { groupId: it.id, groupName: it.title });
    } else {
      // ✅ Chat2 ga navigate (DM)
      navigation.navigate("ChatScreen", { dmId: it.id, peerId: it.data.otherId });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* ✅ Custom header (prop nomlarini sizdagi komponentga moslang) */}
      <CustomHeader
        title="Chats"
        // onBack={...} // Agar back kerak bo'lsa
        // right={<TouchableOpacity ...><MaterialCommunityIcons name="dots-vertical" size={20} /></TouchableOpacity>}
      />

      <ImageBackground
        source={Cambridge_logo}
        style={styles.screen}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      >
        {allLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#8A0D0D" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.text}>💬 Chatlar hozircha yo‘q.</Text>
            <Text style={styles.subText}>
              Teacher DM yaratsa yoki guruhga qo‘shsa, shu yerda paydo bo‘ladi.
            </Text>
          </View>
        ) : (
          <View style={[styles.container, { paddingHorizontal: 12 }]}>
            <FlatList
              data={items}
              keyExtractor={(it) => it.key}
              contentContainerStyle={{ paddingVertical: 10 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => openItem(item)}>
                  <View style={styles.avatar}>
                    <MaterialCommunityIcons name={item.leftIcon} size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {item.subtitle || "Yangi chat boshlang"}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#6B7280" />
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bgImage: { opacity: 0.08, resizeMode: "contain" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
  },
  container: { flex: 1, backgroundColor: "transparent", paddingTop: 8 },

  text: { fontSize: 18, fontWeight: "700", color: "#8A0D0D" },
  subText: { marginTop: 6, fontSize: 14, color: "#6B7280", textAlign: "center" },

  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8A0D0D",
    marginRight: 12,
  },
  title: { fontSize: 15, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
