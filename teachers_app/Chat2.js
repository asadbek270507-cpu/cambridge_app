// src/screens/Chat2.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Image, Modal, Pressable, Alert, Linking, AppState,
  ImageBackground, Dimensions, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { firestore, auth, storage } from '../firebase';
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, updateDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Video } from 'expo-av';
import avatarPlaceholder from '../assets/avatar-placeholder.jpg';
import Cambridge_logo from '../assets/Cambridge_logo.png';

const { width: SCREEN_W } = Dimensions.get('window');

export default function ChatScreen({ route, navigation }) {
  const groupIdParam = route?.params?.groupId ?? null;
  const initialGroupName = route?.params?.groupName ?? 'Chat';

  const [groupId] = useState(groupIdParam);
  const [groupName, setGroupName] = useState(initialGroupName);

  const currentUserId = auth.currentUser?.uid || null;
  const [canRename, setCanRename] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(initialGroupName);

  const [members, setMembers] = useState([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersCount, setMembersCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [membersLoading, setMembersLoading] = useState(true);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const flatListRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // Presence
  const heartbeatRef = useRef(null);
  const setPresence = async (isOnline) => {
    if (!currentUserId) return;
    try {
      await updateDoc(doc(firestore, 'users', currentUserId), {
        isOnline,
        lastActive: serverTimestamp(),
      });
    } catch {}
  };
  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => setPresence(true), 30_000);
  };
  const stopHeartbeat = () => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  };
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        await setPresence(true); startHeartbeat();
      } else if (next.match(/inactive|background/)) {
        await setPresence(false); stopHeartbeat();
      }
      appState.current = next;
    });
    setPresence(true); startHeartbeat();
    return () => { sub.remove(); stopHeartbeat(); setPresence(false); };
  }, [currentUserId]);
  useFocusEffect(useCallback(() => { setPresence(true); startHeartbeat(); return () => stopHeartbeat(); }, []));

  // Group meta & permission
  useEffect(() => {
    if (!groupId) return;
    const gRef = doc(firestore, 'groups', groupId);
    const unsub = onSnapshot(gRef, (snap) => {
      if (snap.exists()) {
        const g = snap.data();
        if (g?.name) setGroupName(g.name);
        if (g?.createdBy === currentUserId) setCanRename(true);
      }
    });
    (async () => {
      try {
        const m = await getDoc(doc(firestore, `groups/${groupId}/students`, currentUserId));
        if (m.exists() && m.data()?.isAdmin) setCanRename(true);
      } catch {}
    })();
    return () => unsub();
  }, [groupId, currentUserId]);

  // Members
  useEffect(() => {
    if (!groupId) return;
    setMembersLoading(true);
    const unsub = onSnapshot(
      collection(firestore, `groups/${groupId}/students`),
      (snap) => {
        const now = Date.now();
        const ONLINE_MS = 60_000;
        let online = 0;
        const list = snap.docs.map((d) => {
          const u = d.data() || {};
          const last = u.lastActive?.toDate ? u.lastActive.toDate().getTime() : 0;
          const on = u.online || (last && now - last <= ONLINE_MS);
          if (on) online += 1;
          return { id: d.id, ...u, online: on };
        });
        setMembers(list);
        setMembersCount(snap.size);
        setOnlineCount(online);
        setMembersLoading(false);
      },
      () => setMembersLoading(false)
    );
    return () => unsub();
  }, [groupId]);

  // Messages
  useEffect(() => {
    const qRef = groupId
      ? query(collection(firestore, `group_chats/${groupId}/messages`), orderBy('createdAt', 'asc'))
      : query(collection(firestore, 'chats'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(qRef, (s) => setMessages(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [groupId]);
  useEffect(() => { const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60); return () => clearTimeout(t); }, [messages.length]);

  // Upload helpers
  const uploadMedia = async (uri, type) => {
    const res = await fetch(uri); const blob = await res.blob();
    const filename = `${type}s/${Date.now()}`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  // Send
  const sendMessage = async (content, type='text', name=null) => {
    if (!currentUserId) return Alert.alert('Xato', 'Foydalanuvchi aniqlanmadi. Qayta kiring.');
    if (type==='text' && !editingId && !content?.trim()) return;

    const us = await getDoc(doc(firestore, 'users', currentUserId));
    const u = us.data() || {};
    const payload = {
      text: content || '',
      senderId: currentUserId,
      senderName: u.displayName || 'User',
      avatar: u.avatar || null,
      type, name: name || null,
      replyTo: replyTarget ? { id: replyTarget.id, text: replyTarget.text?.slice(0,120) || '', senderName: replyTarget.senderName || '' } : null,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(),
    };

    if (editingId) {
      await updateDoc(groupId ? doc(firestore, `group_chats/${groupId}/messages`, editingId) : doc(firestore, 'chats', editingId), { text: content, type, name });
      setEditingId(null);
    } else {
      const coll = groupId ? collection(firestore, `group_chats/${groupId}/messages`) : collection(firestore, 'chats');
      await addDoc(coll, payload);
      if (groupId) {
        await updateDoc(doc(firestore, 'groups', groupId), {
          lastMessage: type==='text' ? payload.text : (type==='image' ? '🖼️ Image' : type==='video' ? '🎬 Video' : '📎 File'),
          lastMessageAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
    setInputText(''); setReplyTarget(null);
    requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
  };

  // Pickers
  const handlePickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
    if (!r.canceled && r.assets?.length) {
      const a = r.assets[0]; const t = a.type==='video' ? 'video' : 'image';
      const url = await uploadMedia(a.uri, t); sendMessage(url, t);
    }
  };
  const handlePickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.assets?.length) {
      const f = r.assets[0]; const url = await uploadMedia(f.uri, 'file'); sendMessage(url, 'file', f.name);
    }
  };

  // CRUD
  const handleDelete = (id) => {
    Alert.alert('O‘chirish', 'Xabarni o‘chirilsinmi?', [
      { text: 'Bekor', style: 'cancel' },
      { text: 'Ha', style: 'destructive', onPress: async () => await deleteDoc(groupId ? doc(firestore, `group_chats/${groupId}/messages`, id) : doc(firestore, 'chats', id)) },
    ]);
  };
  const handleEdit = (msg) => { setInputText(msg.text); setReplyTarget(null); setEditingId(msg.id); };
  const handleReply = (msg) => { setEditingId(null); setReplyTarget({ id: msg.id, text: msg.text, senderName: msg.senderName }); };

  // Rename
  const doRename = async () => {
    const val = (renameValue || '').trim(); if (!val || !groupId) return;
    try { await updateDoc(doc(firestore, 'groups', groupId), { name: val }); setGroupName(val); setRenameOpen(false); }
    catch { Alert.alert('Xatolik', 'Guruh nomi o‘zgartirilmadi.'); }
  };

  // UI helpers
  const formatTime = (ts) => { if (!ts?.toDate) return ''; const d = ts.toDate(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const onListScroll = (e) => setShowScrollDown(e.nativeEvent.contentOffset.y < -40);
  const scrollToBottom = () => flatListRef.current?.scrollToEnd({ animated: true });

  // Render one message
  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUserId;
    const avatarSource = item.avatar ? { uri: item.avatar } : avatarPlaceholder;
    return (
      <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
        {!isMe && <Image source={avatarSource} style={styles.avatar} />}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <View style={styles.topRow}>
            <Text style={[styles.sender, isMe ? styles.senderMe : styles.senderOther]}>{isMe ? 'Siz' : item.senderName}</Text>
            <Text style={styles.time}>{formatTime(item.createdAt || item.timestamp)}</Text>
          </View>
          {item.replyTo ? (
            <View style={styles.replyBox}>
              <Text style={styles.replySender}>{item.replyTo.senderName}</Text>
              <Text style={styles.replyText} numberOfLines={2}>{item.replyTo.text}</Text>
            </View>
          ) : null}
          {item.type==='text' && <Text style={styles.bodyText}>{item.text}</Text>}
          {item.type==='image' && (
            <TouchableOpacity onPress={() => { setModalImage(item.text); setModalVisible(true); }}>
              <Image source={{ uri: item.text }} style={styles.imagePreview} />
            </TouchableOpacity>
          )}
          {item.type==='video' && <Video source={{ uri: item.text }} style={styles.videoPreview} useNativeControls resizeMode="contain" />}
          {item.type==='file' && (
            <TouchableOpacity onPress={() => Linking.openURL(item.text).catch(() => alert('Faylni ochib bo‘lmadi'))}>
              <Text style={styles.fileLink}>📎 {item.name || 'Fayl'}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => handleReply(item)}><Text style={styles.replyLink}>Javob yozish</Text></TouchableOpacity>
            {isMe && (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={{ marginLeft: 12 }}>
                  <MaterialCommunityIcons name="pencil" size={16} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft: 12 }}>
                  <MaterialCommunityIcons name="delete" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {isMe && <Image source={avatarSource} style={styles.avatar} />}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F8FAFC' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* ===== Group header pill (BACK ← + NAME) ===== */}
      <View style={styles.groupCard}>
        <View style={styles.groupHeaderRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>

          {/* nomini bosilsa -> members */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMembersOpen(true)} activeOpacity={0.85}>
            <Text style={styles.groupTitle} numberOfLines={1}>{groupName}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.memberCount}>{membersCount} Members</Text>
            {canRename && (
              <TouchableOpacity onPress={() => { setRenameValue(groupName); setRenameOpen(true); }} style={{ marginLeft: 10 }}>
                <MaterialCommunityIcons name="pencil" size={18} color="#FDE4E2" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.onlinePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{onlineCount} people online now</Text>
        </View>
      </View>

      {/* >>> BACKGROUND + CHAT <<< */}
      <View style={{ flex: 1 }}>
        <ImageBackground source={Cambridge_logo} style={styles.bg} imageStyle={styles.bgImage}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 12, paddingBottom: 12 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onScroll={onListScroll}
            scrollEventThrottle={16}
          />

          {showScrollDown && (
            <TouchableOpacity style={styles.scrollBtn} onPress={scrollToBottom}>
              <MaterialCommunityIcons name="arrow-down" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {replyTarget && (
            <View style={styles.replyPreview}>
              <View style={{ flex: 1 }}>
                <Text style={styles.replyPreviewLabel}>Replying to {replyTarget.senderName}</Text>
                <Text style={styles.replyPreviewText} numberOfLines={1}>{replyTarget.text}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTarget(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputRow}>
            <TouchableOpacity onPress={handlePickImage}>
              <MaterialCommunityIcons name="image" size={24} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickFile} style={{ marginLeft: 10 }}>
              <MaterialCommunityIcons name="paperclip" size={24} color="#6B7280" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message"
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity onPress={() => sendMessage(inputText)} style={styles.sendButton}>
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* Image modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalContainer} onPress={() => setModalVisible(false)}>
          <Image source={{ uri: modalImage }} style={styles.fullImage} />
        </Pressable>
      </Modal>

      {/* Rename modal */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRenameOpen(false)}>
          <Pressable style={styles.renameCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.renameTitle}>Guruh nomi</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Group name"
              style={styles.renameInput}
              maxLength={60}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity style={[styles.rBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => setRenameOpen(false)}>
                <Text style={{ fontWeight: '700', color: '#111827' }}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rBtn, { backgroundColor: '#0D47A1', marginLeft: 8 }]} onPress={doRename}>
                <Text style={{ fontWeight: '700', color: '#fff' }}>Saqlash</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Members modal */}
      <Modal visible={membersOpen} transparent animationType="slide" onRequestClose={() => setMembersOpen(false)}>
        <Pressable style={styles.membersBackdrop} onPress={() => setMembersOpen(false)}>
          <Pressable style={styles.membersSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.membersHeader}>
              <Text style={styles.membersTitle}>Members</Text>
              <TouchableOpacity onPress={() => setMembersOpen(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <Text style={styles.membersMeta}>{membersCount} total • {onlineCount} online</Text>

            {membersLoading ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(it) => it.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => (
                  <View style={styles.memberRow}>
                    <View style={[styles.memberDot, { backgroundColor: item.online ? '#22C55E' : '#9CA3AF' }]} />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {item.name || 'User'} {item.isAdmin ? '• admin' : ''}
                    </Text>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* -------------------- STYLES -------------------- */
const RADIUS = 16;

const styles = StyleSheet.create({
  // Group pill + back
  groupCard: {
    marginTop: 8,
    backgroundColor: '#B91C1C',
    marginHorizontal: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { paddingRight: 8, paddingVertical: 2 },
  groupTitle: { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, maxWidth: SCREEN_W - 180 },
  memberCount: { color: '#FDE4E2', fontSize: 12, fontWeight: '700' },

  onlinePill: {
    marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, flexDirection: 'row', alignItems: 'center',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
  onlineText: { color: '#111827', fontSize: 12, fontWeight: '600' },

  // Chat bubbles
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6, paddingHorizontal: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb' },
  bubble: {
    maxWidth: '78%', padding: 10, borderRadius: RADIUS, marginHorizontal: 8,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  bubbleOther: { backgroundColor: '#F3F4F6', borderTopLeftRadius: 4 },
  bubbleMe: { backgroundColor: '#3B82F6', borderTopRightRadius: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sender: { fontWeight: '700', fontSize: 12 },
  senderOther: { color: '#111827' },
  senderMe: { color: '#E5E7EB' },
  time: { fontSize: 10, color: '#9CA3AF', marginLeft: 8 },

  replyBox: { borderLeftWidth: 3, borderLeftColor: '#C084FC', backgroundColor: 'rgba(192,132,252,0.1)', padding: 6, borderRadius: 8, marginBottom: 6 },
  replySender: { fontSize: 11, fontWeight: '700', color: '#6D28D9' },
  replyText: { fontSize: 11, color: '#374151', marginTop: 2 },

  bodyText: { fontSize: 14, lineHeight: 20, color: '#111827' },
  replyLink: { fontSize: 11, color: '#2563EB' },
  actionRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  imagePreview: { width: 180, height: 180, borderRadius: 10, marginTop: 4 },
  videoPreview: { width: 220, height: 160, borderRadius: 10, marginTop: 4 },
  fileLink: { color: '#1E90FF', textDecorationLine: 'underline', marginTop: 4, fontWeight: '600' },

  // Input
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  input: {
    flex: 1, borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB',
    marginHorizontal: 10, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 6, color: '#111827', backgroundColor: '#F9FAFB',
  },
  sendButton: { backgroundColor: '#B91C1C', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center' },

  // Reply preview pill
  replyPreview: {
    marginHorizontal: 10, marginBottom: 6, backgroundColor: '#F3F4F6',
    borderLeftWidth: 4, borderLeftColor: '#2563EB', borderRadius: 12, padding: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  replyPreviewLabel: { fontSize: 12, color: '#374151', fontWeight: '700' },
  replyPreviewText: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Modals
  modalContainer: { backgroundColor: 'rgba(0,0,0,0.9)', flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  renameCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  renameTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  renameInput: { marginTop: 10, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  rBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },

  // Members sheet
  membersBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  membersSheet: { maxHeight: '70%', backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14 },
  membersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  membersTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  membersMeta: { marginTop: 2, color: '#6B7280', marginBottom: 10 },
  memberRow: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberDot: { width: 10, height: 10, borderRadius: 5 },
  memberName: { fontSize: 14, color: '#111827', flex: 1 },

  // Background
  bg: { flex: 1, justifyContent: 'flex-end' },
  bgImage: { opacity: 0.12, resizeMode: 'cover' },

  // Scroll-to-bottom
  scrollBtn: { position: 'absolute', right: 16, bottom: 86, backgroundColor: '#B91C1C', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
