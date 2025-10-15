// /screens/ChatScreen.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, Image
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { auth, firestore } from "../firebase";
import Cambridge_logo from "../assets/Cambridge_logo.png";

import {
  collection, onSnapshot, query, where, orderBy, getDoc, doc,
  addDoc, writeBatch, serverTimestamp, updateDoc, deleteDoc, getDocs,
  limit as qLimit, arrayRemove, deleteField
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ---------- Helper: pinned-first sort ---------- */
const sortChats = (arr) =>
  [...arr].sort(
    (a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (b._sort - a._sort)
  );

export default function ChatScreen() {
  const navigation = useNavigation();

  /* ========== AUTH ========== */
  const [teacherId, setTeacherId] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setTeacherId(u?.uid ?? null));
    return unsub;
  }, []);

  /* ========== STATE ========== */
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);        // unified list: groups + dms
  const [roster, setRoster] = useState([]);      // students of teacher
  const [openCreate, setOpenCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [pickedIds, setPickedIds] = useState([]);

  const [menuFor, setMenuFor] = useState(null); // {type, id, title, ...}
  const [actionLoading, setActionLoading] = useState(false);

  // unread map: boolean (dot ko‘rsatish uchun)
  const [unreadMap, setUnreadMap] = useState({}); // {`${type}:${id}`: true|false}
  // mute map (indikator uchun)
  const [muteMap, setMuteMap] = useState({});   // {`${type}:${id}`: boolean}

  // pinned preview (listda)
  const [pinMap, setPinMap] = useState({});     // {`${type}:${id}`: {id,text,by,at}}

  // DM peers cache
  const peerCacheRef = useRef({}); // { uid: {displayName, avatar, email} }

  // Oxirgi xabar sender cache (group uchun lastSender yo‘q bo‘lsa — 1 marta tekshiramiz)
  const lastSenderCacheRef = useRef({}); // { key: { senderId, timeMs } }

  const filteredRoster = useMemo(
    () => roster.filter(s =>
      (s.displayName || s.fullName || s.email || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    ),
    [roster, search]
  );
  const togglePick = (id) =>
    setPickedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /* ========== HEADER ========== */
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

  /* ========== ROSTER (teacher students) ========== */
  useEffect(() => {
    if (!teacherId) return;
    const col = collection(firestore, "users");

    const qOrdered = query(
      col,
      where("role", "==", "student"),
      where("teacherId", "==", teacherId),
      orderBy("displayName", "asc")
    );

    let unsub = onSnapshot(
      qOrdered,
      (snap) => setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {
        const qPlain = query(
          col,
          where("role", "==", "student"),
          where("teacherId", "==", teacherId)
        );
        unsub = onSnapshot(qPlain, (snap) =>
          setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      }
    );
    return () => unsub && unsub();
  }, [teacherId]);

  /* ========== LISTEN GROUPS + DMS (yengil) ========== */
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

    // Unread boolean hisoblash (qattiq snapshotlar yo‘q)
    const computeUnreadFlags = async (groups, dms) => {
      const nextUnread = { ...unreadMap };
      const cache = lastSenderCacheRef.current;

      // Groups
      for (const g of groups) {
        const key = `group:${g.id}`;
        const readAtMs = g.readBy?.[teacherId]?.toMillis?.() || 0;
        const lastMs = g.lastMessageAt?.toMillis?.() || 0;

        let unread = false;
        if (lastMs > readAtMs) {
          if (g.lastSender) {
            unread = g.lastSender !== teacherId;
          } else {
            // lastSender yo‘q → faqat 1 marta oxirgi xabarni tekshiramiz (lightweight)
            const cached = cache[key];
            if (cached && cached.timeMs === lastMs) {
              unread = cached.senderId && cached.senderId !== teacherId;
            } else {
              try {
                const msgsCol = collection(firestore, `group_chats/${g.id}/messages`);
                const q1 = query(msgsCol, orderBy("createdAt", "desc"), qLimit(1));
                const snap = await getDocs(q1);
                const m = snap.docs[0]?.data?.() || null;
                const senderId = m?.senderId || null;
                cache[key] = { senderId, timeMs: lastMs };
                unread = senderId && senderId !== teacherId;
              } catch {
                // Agar o‘qiy olmasak, default: unread=false
                unread = false;
              }
            }
          }
        }
        nextUnread[key] = !!unread;
      }

      // DMs
      for (const p of dms) {
        const key = `dm:${p.id}`;
        const readAtMs = p.readBy?.[teacherId]?.toMillis?.() || 0;
        const lastMs = p.updatedAt?.toMillis?.() || 0;
        const lastSender = p.lastSender || null;
        const unread = lastMs > readAtMs && lastSender && lastSender !== teacherId;
        nextUnread[key] = !!unread;
      }

      setUnreadMap(nextUnread);
      lastSenderCacheRef.current = cache;
    };

    const mergeAndSet = () => {
      const g = groupsData.map(g => {
        const key = `group:${g.id}`;
        setMuteMap(prev => ({ ...prev, [key]: Array.isArray(g.mutedBy) ? g.mutedBy.includes(teacherId) : false }));
        if (g.pinnedMessage) setPinMap(prev => ({ ...prev, [key]: g.pinnedMessage }));

        return {
          _sort: (g.lastMessageAt?.toMillis?.() || g.createdAt?.toMillis?.() || 0),
          type: "group",
          id: g.id,
          title: g.name || "Group",
          subtitle: g.lastMessage || "",
          time: g.lastMessageAt || g.createdAt || null,
          data: g,
          pinned: !!g.pinnedMessage,
        };
      });

      const d = dmsData.map(p => {
        const otherId = (p.participants || []).find(x => x !== teacherId) || null;
        const peer = otherId ? peerCacheRef.current[otherId] : null;

        const key = `dm:${p.id}`;
        setMuteMap(prev => ({ ...prev, [key]: Array.isArray(p.mutedBy) ? p.mutedBy.includes(teacherId) : false }));
        if (p.pinnedMessage) setPinMap(prev => ({ ...prev, [key]: p.pinnedMessage }));

        return {
          _sort: p.updatedAt?.toMillis?.() || 0,
          type: "dm",
          id: p.id,
          title: peer?.displayName || p.title || "Direct chat",
          subtitle: p.lastMessage || "",
          time: p.updatedAt || null,
          data: { ...p, otherId },
          pinned: !!p.pinnedMessage,
        };
      });

      const merged = sortChats([...g, ...d]);
      setItems(merged);
      setLoading(false);

      // Unread booleanlarni hisobla (lightweight)
      computeUnreadFlags(groupsData, dmsData);
    };

    // Groups
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

    // DMs
    unsubDMs = onSnapshot(
      qDMs,
      async (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        dmsData = rows;

        rows.forEach(async (r) => {
          const otherId = (r.participants || []).find(x => x !== teacherId);
          if (otherId && !peerCacheRef.current[otherId]) {
            try {
              const s = await getDoc(doc(firestore, "users", otherId));
              if (s.exists()) {
                const data = s.data() || {};
                peerCacheRef.current[otherId] = {
                  displayName: data.displayName || data.fullName || data.email || "User",
                  avatar: data.avatar || null,
                  email: data.email || null
                };
                mergeAndSet();
              }
            } catch {}
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
  }, [teacherId]); // eslint-disable-line

  /* ========== CREATE GROUP ========== */
  const createGroup = async () => {
    const name = groupName.trim();
    if (!teacherId) return;
    if (!name) return Alert.alert("Diqqat", "Guruh nomini kiriting.");
    if (pickedIds.length === 0) return Alert.alert("Diqqat", "Kamida bitta o‘quvchi tanlang.");

    try {
      const gRef = await addDoc(collection(firestore, "groups"), {
        name,
        createdBy: teacherId,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: null,
        // ✅ agar Chat2 da lastSender ham update qilinsa, group unread aniqroq bo‘ladi
        memberIds: [teacherId, ...pickedIds],
        membersCount: pickedIds.length + 1,
        readBy: { [teacherId]: serverTimestamp() },
        mutedBy: [],
        pinnedMessage: null,
      });

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
          name: st?.displayName || st?.fullName || st?.email || "Student",
          avatar: st?.avatar || null,
          isAdmin: false,
          online: false,
          addedAt: serverTimestamp(),
        });
      });

      // group_chats meta
      batch.set(doc(firestore, `group_chats/${gRef.id}`), {
        createdAt: serverTimestamp(),
        lastMessageAt: null,
      }, { merge: true });

      await batch.commit();

      setGroupName("");
      setPickedIds([]);
      setSearch("");
      setOpenCreate(false);
    } catch (e) {
      console.error("createGroup error", e);
      Alert.alert("Xatolik", "Guruh yaratilmadi.");
    }
  };

  /* ========== OPEN CHAT (va read marker) ========== */
  const openItem = async (it) => {
    try {
      if (it.type === "group") {
        await updateDoc(doc(firestore, "groups", it.id), {
          [`readBy.${teacherId}`]: serverTimestamp(),
        });
        // UX: dot'ni darhol olib tashlaymiz
        setUnreadMap((m) => ({ ...m, [`group:${it.id}`]: false }));
        navigation.navigate("Chat2", {
          groupId: it.id,
          groupName: it.title,
          teacherId,
          scrollToMessageId: pinMap[`group:${it.id}`]?.id || null,
        });
      } else {
        await updateDoc(doc(firestore, "private_chats", it.id), {
          [`readBy.${teacherId}`]: serverTimestamp(),
        });
        setUnreadMap((m) => ({ ...m, [`dm:${it.id}`]: false }));
        navigation.navigate("Chat2", {
          dmId: it.id,
          peerId: it.data.otherId,
          teacherId,
          scrollToMessageId: pinMap[`dm:${it.id}`]?.id || null,
        });
      }
    } catch {}
  };

  /* ========== 3 DOT MENU: PIN / DELETE ========== */
  const togglePin = async () => {
    if (!menuFor) return;
    setActionLoading(true);
    try {
      const key = `${menuFor.type}:${menuFor.id}`;
      const ref =
        menuFor.type === "group"
          ? doc(firestore, "groups", menuFor.id)
          : doc(firestore, "private_chats", menuFor.id);

      const currentlyPinned = !!pinMap[key];

      if (currentlyPinned) {
        await updateDoc(ref, { pinnedMessage: deleteField() });
        setPinMap((m) => {
          const cp = { ...m };
          delete cp[key];
          return cp;
        });
        setItems(prev => sortChats(prev.map(it => (
          it.type === menuFor.type && it.id === menuFor.id ? { ...it, pinned: false } : it
        ))));
      } else {
        const text = menuFor.subtitle || "Pinned message";
        const pinned = { id: null, text, by: teacherId, at: serverTimestamp() };
        await updateDoc(ref, { pinnedMessage: pinned });
        setPinMap((m) => ({ ...m, [key]: { id: null, text } }));
        setItems(prev => sortChats(prev.map(it => (
          it.type === menuFor.type && it.id === menuFor.id ? { ...it, pinned: true } : it
        ))));
      }
    } catch (e) {
      Alert.alert("Xato", "Pin/Unpin bajarilmadi.");
    } finally {
      setActionLoading(false);
      setMenuFor(null);
    }
  };

  const deleteChat = async () => {
    if (!menuFor) return;
    Alert.alert(
      "O‘chirish",
      menuFor.type === "group"
        ? "Guruhni butunlay o‘chirmoqchimisiz?"
        : "DM chatni o‘chirmoqchimisiz?",
      [
        { text: "Bekor", style: "cancel" },
        {
          text: "Ha", style: "destructive",
          onPress: async () => {
            try {
              if (menuFor.type === "group") {
                const gRef = doc(firestore, "groups", menuFor.id);
                const createdBy = menuFor?.data?.createdBy;
                if (createdBy && createdBy !== teacherId) {
                  await updateDoc(gRef, { memberIds: arrayRemove(teacherId) }).catch(()=>{});
                } else {
                  const delAll = async (subPath) => {
                    const q = await getDocs(collection(firestore, subPath));
                    await Promise.all(q.docs.map((d) => deleteDoc(d.ref)));
                  };
                  await delAll(`groups/${menuFor.id}/students`);
                  await delAll(`groups/${menuFor.id}/reads`);
                  await delAll(`groups/${menuFor.id}/mutes`);
                  const msgs = await getDocs(collection(firestore, `group_chats/${menuFor.id}/messages`));
                  await Promise.all(msgs.docs.map((d) => deleteDoc(d.ref)));
                  await deleteDoc(doc(firestore, "group_chats", menuFor.id)).catch(()=>{});
                  await deleteDoc(gRef).catch(()=>{});
                }
              } else {
                const base = `private_chats/${menuFor.id}`;
                const msgs = await getDocs(collection(firestore, `${base}/messages`));
                await Promise.all(msgs.docs.map((d) => deleteDoc(d.ref)));
                await deleteDoc(doc(firestore, base)).catch(()=>{});
              }
            } catch (e) {
              Alert.alert("Xato", "O‘chirib bo‘lmadi.");
            } finally {
              setMenuFor(null);
            }
          }
        }
      ]
    );
  };

  /* ========== RENDER ========== */
  const renderItem = ({ item }) => {
    const key = `${item.type}:${item.id}`;
    const unread = !!unreadMap[key];
    const muted = !!muteMap[key];
    const pinned = pinMap[key];

    return (
      <View style={[styles.row, unread && styles.rowUnread]}>
        <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center" }} onPress={() => openItem(item)}>
          <View style={[styles.avatar, unread && styles.avatarUnread]}>
            <MaterialCommunityIcons name={item.type === "group" ? "account-group" : "account"} size={20} color="#fff" />
          </View>

          <View style={styles.centerCol}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>{item.title}</Text>
              {unread && <View style={styles.dot} />}
              {muted && <MaterialCommunityIcons name="bell-off" size={16} color="#9CA3AF" style={{ marginLeft: 6 }} />}
            </View>

            {pinned ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <MaterialCommunityIcons name="pin" size={14} color="#0D47A1" />
                <Text style={[styles.subtitle, { marginLeft: 4, fontStyle: "italic" }]} numberOfLines={1}>
                  {pinned.text || "Pinned message"}
                </Text>
              </View>
            ) : (
              <Text style={[styles.subtitle, unread && styles.subtitleUnread]} numberOfLines={1}>
                {item.subtitle || "Start new chat"}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.rightCol}>
          <Text style={[styles.time, unread && styles.timeUnread]}>
            {item.time?.toDate ? formatTime(item.time.toDate()) : ""}
          </Text>
          {/* ❌ Raqamli badge o‘rniga hech narsa qo‘ymadik (dot tepa chapda bor) */}
        </View>

        {/* 3 nuqta */}
        <TouchableOpacity style={styles.moreBtn} onPress={() => setMenuFor(item)}>
          <MaterialCommunityIcons name="dots-vertical" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* MARKAZDAGI FON LOGO */}
      <View style={styles.bgContainer} pointerEvents="none">
        <Image source={Cambridge_logo} style={styles.bgImage} />
      </View>

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
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ padding: 12 }}
        />
      )}

      {/* CREATE GROUP MODAL */}
      <CreateGroupModal
        visible={openCreate}
        onClose={() => setOpenCreate(false)}
        groupName={groupName}
        setGroupName={setGroupName}
        search={search}
        setSearch={setSearch}
        roster={filteredRoster}
        pickedIds={pickedIds}
        togglePick={togglePick}
        onCreate={createGroup}
      />

      {/* 3 DOT MENU: Pin/Unpin va Delete */}
      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{menuFor?.title || "Chat"}</Text>

            <TouchableOpacity style={styles.menuItem} onPress={togglePin} disabled={actionLoading}>
              <MaterialCommunityIcons
                name={pinMap[`${menuFor?.type}:${menuFor?.id}`] ? "pin-off" : "pin"}
                size={18}
                color="#0D47A1"
              />
              <Text style={[styles.menuItemTx, { color: "#0D47A1" }]}>
                {pinMap[`${menuFor?.type}:${menuFor?.id}`] ? "Unpin" : "Pin"}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />

            <TouchableOpacity style={styles.menuItem} onPress={deleteChat} disabled={actionLoading}>
              <MaterialCommunityIcons name="delete-outline" size={18} color="#B91C1C" />
              <Text style={[styles.menuItemTx, { color: "#B91C1C" }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#f3f4f6", alignSelf: "flex-end", marginTop: 8 }]}
              onPress={() => setMenuFor(null)}
            >
              <Text style={{ fontWeight: "700", color: "#111827" }}>Yopish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ====== CREATE GROUP MODAL (component) ====== */
function CreateGroupModal({
  visible, onClose, groupName, setGroupName,
  search, setSearch, roster, pickedIds, togglePick, onCreate
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
                data={roster}
                keyExtractor={(it) => it.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => {
                  const picked = pickedIds.includes(item.id);
                  const name = item.displayName || item.fullName || item.email || "Student";
                  return (
                    <TouchableOpacity style={styles.pickItem} onPress={() => togglePick(item.id)}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600" }}>{name}</Text>
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
            <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={onClose}>
              <Text style={styles.modalCancelText}>Bekor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                styles.modalCreate,
                (!groupName.trim() || pickedIds.length === 0) && { opacity: 0.6 },
                { marginLeft: 10 }
              ]}
              onPress={onCreate}
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
  );
}

/* ====== HELPERS / STYLES ====== */
function pad(n){return n.toString().padStart(2,"0")}
function formatTime(d){
  const hh = pad(d.getHours()); const mm = pad(d.getMinutes());
  const today = new Date(); const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `${hh}:${mm}` : `${d.getMonth()+1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },

  // MARKAZDAGI FON
  bgContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  bgImage: {
    width: "70%",
    height: "70%",
    resizeMode: "contain",
    opacity: 0.08,
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "transparent", paddingHorizontal: 16 },
  empty: { color: "#8A0D0D", fontSize: 16, textAlign: "center" },

  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    marginBottom: 8
  },
  rowUnread: {
    backgroundColor: "#EAF2FF",
    borderWidth: 1,
    borderColor: "#C7DBFF",
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "#8A0D0D", marginRight: 12,
  },
  avatarUnread: { backgroundColor: "#0D47A1" },

  centerCol: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: "#111827" },
  titleUnread: { color: "#0D47A1" },
  subtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  subtitleUnread: { color: "#0B3B91" },

  rightCol: { alignItems: "flex-end", marginLeft: 8 },
  time: { fontSize: 11, color: "#9CA3AF" },
  timeUnread: { color: "#0B3B91", fontWeight: "700" },

  moreBtn: { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 4 },

  // blue dot for unread
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#0D47A1", marginLeft: 6
  },

  // create modal
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
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalCancel: { backgroundColor: "#f3f4f6" },
  modalCreate: { backgroundColor: "#0D47A1" },
  modalCancelText: { color: "#111827", fontWeight: "700" },
  modalCreateText: { color: "#fff", fontWeight: "700" },

  // 3-dot menu
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center", padding: 16 },
  menuCard: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 16, padding: 14 },
  menuTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  menuItemTx: { marginLeft: 10, color: "#111827", fontWeight: "700" },
});
