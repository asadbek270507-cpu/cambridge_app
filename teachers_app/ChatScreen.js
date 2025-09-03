// src/screens/TeacherChatScreen.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, ImageBackground, Modal, TextInput, Alert
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, firestore } from "../firebase";
import {
  collection, onSnapshot, query, where, orderBy, getDoc, doc,
  addDoc, writeBatch, setDoc, serverTimestamp
} from "firebase/firestore";
import Cambridge_logo from "../assets/Cambridge_logo.png";

export default function TeacherInboxScreen({ navigation }) {
  const teacherId = auth.currentUser?.uid || null;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // [{type:'group'|'dm', ...}]

  // --- Create group modal state ---
  const [openCreate, setOpenCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [roster, setRoster] = useState([]); // teacher yaratgan studentlar
  const [search, setSearch] = useState("");
  const [pickedIds, setPickedIds] = useState([]);

  const filteredRoster = useMemo(
    () => roster.filter(s => (s.displayName || "").toLowerCase().includes(search.toLowerCase())),
    [roster, search]
  );
  const togglePick = (id) =>
    setPickedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // DM taraf “qarshi tomonni” ism/avatari uchun oddiy cache
  const peerCacheRef = useRef({}); // { userId: {displayName, avatar}}

  // Header: title + plus (modal)
  useEffect(() => {
    navigation?.setOptions?.({
      headerTitle: "Chats",
      headerRight: () => (
        <TouchableOpacity style={{ paddingRight: 12 }} onPress={() => setOpenCreate(true)}>
          <MaterialCommunityIcons name="plus" size={22} color="#8A0D0D" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Roster — teacher yaratgan students (index kerak bo'lsa fallback)
  useEffect(() => {
    if (!teacherId) return;
    const col = collection(firestore, "users");
    const qOrdered = query(
      col,
      where("role", "==", "student"),
      where("createdBy", "==", teacherId),
      orderBy("displayName", "asc")
    );
    let unsub = onSnapshot(
      qOrdered,
      snap => setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      // fallback: orderBy'siz
      () => {
        const qPlain = query(col, where("role", "==", "student"), where("createdBy", "==", teacherId));
        unsub = onSnapshot(qPlain, snap => setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    );
    return () => unsub && unsub();
  }, [teacherId]);

  // Guruhlar + DMlarni tinglash va birlashtirish
  useEffect(() => {
    if (!teacherId) { setItems([]); setLoading(false); return; }

    const groupsRef = collection(firestore, "groups");
    const dmsRef = collection(firestore, "private_chats");

    const qGroups = query(
      groupsRef,
      where("memberIds", "array-contains", teacherId),
      orderBy("lastMessageAt", "desc")
    );
    const qDMs = query(
      dmsRef,
      where("participants", "array-contains", teacherId),
      orderBy("updatedAt", "desc")
    );

    let groupsData = [];
    let dmsData = [];
    let unsubGroups, unsubDMs;

    const mergeAndSet = () => {
      const g = groupsData.map(g => ({
        _sort: (g.lastMessageAt?.toMillis?.() || g.createdAt?.toMillis?.() || 0),
        type: "group",
        id: g.id,
        title: g.name || "Group",
        subtitle: g.lastMessage || "",
        time: g.lastMessageAt || g.createdAt || null,
        leftIcon: "account-group",
        data: g,
      }));

      const d = dmsData.map(p => {
        const otherId = (p.participants || []).find(x => x !== teacherId) || null;
        const peer = otherId ? peerCacheRef.current[otherId] : null;
        return {
          _sort: p.updatedAt?.toMillis?.() || 0,
          type: "dm",
          id: p.id,
          title: peer?.displayName || p.title || "Direct chat",
          subtitle: p.lastMessage || "",
          time: p.updatedAt || null,
          leftIcon: "account",
          data: { ...p, otherId },
        };
      });

      setItems([...g, ...d].sort((a, b) => b._sort - a._sort));
      setLoading(false);
    };

    // Groups (fallback bilan)
    unsubGroups = onSnapshot(
      qGroups,
      (snap) => {
        groupsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        mergeAndSet();
      },
      () => {
        const qPlain = query(groupsRef, where("memberIds", "array-contains", teacherId));
        unsubGroups = onSnapshot(qPlain, (snap) => {
          groupsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          mergeAndSet();
        });
      }
    );

    // DMs (fallback bilan)
    unsubDMs = onSnapshot(
      qDMs,
      async (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        dmsData = rows;
        // peer cache
        rows.forEach(async (r) => {
          const otherId = (r.participants || []).find(x => x !== teacherId);
          if (otherId && !peerCacheRef.current[otherId]) {
            const s = await getDoc(doc(firestore, "users", otherId)).catch(() => null);
            if (s?.exists()) {
              peerCacheRef.current[otherId] = {
                displayName: s.data().displayName || "User",
                avatar: s.data().avatar || null,
              };
              mergeAndSet();
            }
          }
        });
        mergeAndSet();
      },
      () => {
        const qPlain = query(dmsRef, where("participants", "array-contains", teacherId));
        unsubDMs = onSnapshot(qPlain, (snap) => {
          dmsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          mergeAndSet();
        });
      }
    );

    return () => {
      unsubGroups && unsubGroups();
      unsubDMs && unsubDMs();
    };
  }, [teacherId]);

  // Create group (modal → create)
  const createGroup = async () => {
    const name = groupName.trim();
    if (!teacherId) return;
    if (!name) return Alert.alert("Diqqat", "Guruh nomini kiriting.");
    if (pickedIds.length === 0) return Alert.alert("Diqqat", "Kamida bitta o‘quvchi tanlang.");

    try {
      // 1) group doc
      const gRef = await addDoc(collection(firestore, "groups"), {
        name,
        createdBy: teacherId,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: null,
        memberIds: [teacherId, ...pickedIds],
        membersCount: pickedIds.length + 1,
      });

      // 2) subcollection: students + meta
      const batch = writeBatch(firestore);

      // teacher admin
      batch.set(doc(firestore, `groups/${gRef.id}/students`, teacherId), {
        name: "Teacher",
        isAdmin: true,
        online: false,
        addedAt: serverTimestamp(),
      });

      pickedIds.forEach((sid) => {
        const st = roster.find(r => r.id === sid);
        batch.set(doc(firestore, `groups/${gRef.id}/students`, sid), {
          name: st?.displayName || "Student",
          avatar: st?.avatar || null,
          isAdmin: false,
          online: false,
          addedAt: serverTimestamp(),
        });
      });

      // optional: group_chats meta
      batch.set(doc(firestore, `group_chats/${gRef.id}`), {
        createdAt: serverTimestamp(),
        lastMessageAt: null,
      }, { merge: true });

      await batch.commit();

      // form reset + modal close
      setGroupName("");
      setPickedIds([]);
      setSearch("");
      setOpenCreate(false);
      // Telegramdek: avtomatik navigate QILMAYMIZ — ro‘yxatda darhol ko‘rinadi
    } catch (e) {
      console.error("createGroup error", e);
      Alert.alert("Xatolik", "Guruh yaratilmadi.");
    }
  };

  const openItem = (it) => {
    if (it.type === "group") {
      navigation.navigate("Chat2", {
        groupId: it.id,
        groupName: it.title,
        teacherId,
      });
    } else {
      navigation.navigate("Chat2", {
        dmId: it.id,
        peerId: it.data.otherId,
        teacherId,
      });
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => openItem(item)}>
      <View style={styles.avatar}>
        <MaterialCommunityIcons name={item.leftIcon} size={20} color="#fff" />
      </View>
      <View style={styles.centerCol}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.subtitle || "Yangi chat boshlang"}
        </Text>
      </View>
      <View style={styles.rightCol}>
        <Text style={styles.time}>
          {item.time?.toDate ? formatTime(item.time.toDate()) : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ImageBackground source={Cambridge_logo} style={styles.screen} imageStyle={styles.bgImage}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8A0D0D" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Hozircha chat yo‘q. O‘ng yuqoridagi “+” orqali guruh yarating.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.type}:${it.id}`}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 12 }}
        />
      )}

      {/* CREATE GROUP MODAL */}
      <Modal visible={openCreate} transparent animationType="fade" onRequestClose={() => setOpenCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yangi guruh</Text>

            <TextInput
              placeholder="Guruh nomi"
              value={groupName}
              onChangeText={setGroupName}
              style={[styles.input, { width: "100%", marginTop: 10 }]}
              maxLength={60}
              autoFocus
            />

            <View style={[styles.searchRow, { marginTop: 10 }]}>
              <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
              <TextInput
                placeholder="Students izlash..."
                value={search}
                onChangeText={setSearch}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>

            <View style={{ marginTop: 10, maxHeight: 340 }}>
              {roster.length === 0 ? (
                <Text style={{ color: "#6B7280" }}>
                  Roster bo‘sh. Avval o‘quvchilar uchun akkaunt yarating.
                </Text>
              ) : (
                <FlatList
                  data={filteredRoster}
                  keyExtractor={(it) => it.id}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  renderItem={({ item }) => {
                    const picked = pickedIds.includes(item.id);
                    return (
                      <TouchableOpacity style={styles.pickItem} onPress={() => togglePick(item.id)}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "600" }}>
                            {item.displayName || "Student"}
                          </Text>
                          {item.email ? (
                            <Text style={{ color: "#6B7280", marginTop: 2, fontSize: 12 }}>{item.email}</Text>
                          ) : null}
                        </View>
                        <MaterialCommunityIcons
                          name={picked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                          size={22}
                          color={picked ? "#0D47A1" : "#9CA3AF"}
                        />
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setOpenCreate(false)}>
                <Text style={styles.modalCancelText}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCreate, (!groupName.trim() || pickedIds.length === 0) && { opacity: 0.6 }]}
                onPress={createGroup}
                disabled={!groupName.trim() || pickedIds.length === 0}
              >
                <Text style={styles.modalCreateText}>
                  Yaratish{pickedIds.length ? ` • ${pickedIds.length}` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

function pad(n){return n.toString().padStart(2,"0")}
function formatTime(d){
  const hh = pad(d.getHours()); const mm = pad(d.getMinutes());
  const today = new Date(); const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `${hh}:${mm}` : `${d.getMonth()+1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bgImage: { opacity: 0.06, resizeMode: "cover" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "transparent", paddingHorizontal: 16 },
  empty: { color: "#8A0D0D", fontSize: 16, textAlign: "center" },

  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "#8A0D0D", marginRight: 12,
  },
  centerCol: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  rightCol: { alignItems: "flex-end", marginLeft: 8 },
  time: { fontSize: 11, color: "#9CA3AF" },

  // modal
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center", alignItems: "center", padding: 16,
  },
  modalCard: { width: "100%", maxWidth: 520, backgroundColor: "#fff", borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },

  input: {
    borderWidth: 1, borderColor: "#D1D5DB", paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: "#fff",
  },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  pickItem: {
    backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },

  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalCancel: { backgroundColor: "#f3f4f6" },
  modalCreate: { backgroundColor: "#0D47A1" },
  modalCancelText: { color: "#111827", fontWeight: "700" },
  modalCreateText: { color: "#fff", fontWeight: "700" },
});
