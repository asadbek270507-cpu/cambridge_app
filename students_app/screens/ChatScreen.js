// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Image, Modal, Pressable, Alert, Linking, AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { firestore, auth, storage } from '../../firebase';
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, updateDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Video } from 'expo-av';
import CustomHeader from '../../components/CustomHeader';
import avatarPlaceholder from '../../assets/avatar-placeholder.jpg';
import { ImageBackground } from 'react-native';
import Cambridge_logo from '../../assets/Cambridge_logo.png';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // reply preview
  const [replyTarget, setReplyTarget] = useState(null); // {id, text, senderName}

  const [membersCount, setMembersCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const flatListRef = useRef(null);
  const appState = useRef(AppState.currentState);

  const currentUserId = auth.currentUser?.uid || null;

  // ---------- Presence (online) ----------
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
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        await setPresence(true);
        startHeartbeat();
      } else if (nextState.match(/inactive|background/)) {
        await setPresence(false);
        stopHeartbeat();
      }
      appState.current = nextState;
    });
    // first mount
    setPresence(true);
    startHeartbeat();
    return () => {
      sub.remove();
      stopHeartbeat();
      setPresence(false);
    };
  }, [currentUserId]);

  // Screen focus
  useFocusEffect(
    useCallback(() => {
      setPresence(true);
      startHeartbeat();
      return () => {
        stopHeartbeat();
      };
    }, [])
  );

  // ---------- Real-time messages ----------
  useEffect(() => {
    const q = query(collection(firestore, 'chats'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });
    return () => unsub();
  }, []);

  // ---------- Real-time members & online count ----------
  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const now = Date.now();
      const ONLINE_WINDOW_MS = 60_000; // 60s
      let online = 0;

      snapshot.forEach((d) => {
        const u = d.data() || {};
        const last = u.lastActive?.toDate ? u.lastActive.toDate().getTime() : 0;
        if (u.isOnline || (last && now - last <= ONLINE_WINDOW_MS)) online += 1;
      });

      setMembersCount(snapshot.size);
      setOnlineCount(online);
    });
    return () => unsub();
  }, []);

  // ---------- Upload media ----------
  const uploadMedia = async (uri, type) => {
    const res = await fetch(uri);
    const blob = await res.blob();
    const filename = `${type}s/${Date.now()}`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  // ---------- Send message (text/media/file) ----------
  const sendMessage = async (content, type = 'text', name = null) => {
    if (!currentUserId) {
      Alert.alert('Xato', 'Foydalanuvchi aniqlanmadi. Qayta kiring.');
      return;
    }
    if (type === 'text' && !editingId && !content?.trim()) return;

    const userSnap = await getDoc(doc(firestore, 'users', currentUserId));
    const userData = userSnap.data() || {};

    if (editingId) {
      await updateDoc(doc(firestore, 'chats', editingId), {
        text: content,
        type,
        name,
      });
      setEditingId(null);
    } else {
      await addDoc(collection(firestore, 'chats'), {
        text: content || '',
        senderId: currentUserId,
        senderName: userData.displayName || 'User',
        avatar: userData.avatar || null,
        type,
        name: name || null,
        replyTo: replyTarget
          ? {
              id: replyTarget.id,
              text: replyTarget.text?.slice(0, 120) || '',
              senderName: replyTarget.senderName || '',
            }
          : null,
        timestamp: serverTimestamp(),
      });
    }
    setInputText('');
    setReplyTarget(null);
  };

  // ---------- Pick image/video ----------
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const t = asset.type === 'video' ? 'video' : 'image';
      const url = await uploadMedia(asset.uri, t);
      sendMessage(url, t);
    }
  };

  // ---------- Pick file ----------
  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.assets && result.assets.length > 0) {
      const file = result.assets[0];
      const url = await uploadMedia(file.uri, 'file');
      sendMessage(url, 'file', file.name);
    }
  };

  // ---------- Delete & Edit ----------
  const handleDelete = (id) => {
    Alert.alert('O‘chirish', 'Xabarni o‘chirilsinmi?', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Ha', style: 'destructive', onPress: async () => await deleteDoc(doc(firestore, 'chats', id)) },
    ]);
  };

  const handleEdit = (msg) => {
    setInputText(msg.text);
    setReplyTarget(null);
    setEditingId(msg.id);
  };

  const handleReply = (msg) => {
    setEditingId(null);
    setReplyTarget({ id: msg.id, text: msg.text, senderName: msg.senderName });
  };

  // ---------- UI helpers ----------
  const formatTime = (ts) => {
    if (!ts?.toDate) return '';
    const d = ts.toDate();
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const onListScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    setShowScrollDown(y > 100);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // ---------- Render message ----------
  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUserId;

    const avatarSource = item.avatar ? { uri: item.avatar } : avatarPlaceholder;

    return (
      <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
        {!isMe && <Image source={avatarSource} style={styles.avatar} />}

        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {/* Sender + time */}
          <View style={styles.topRow}>
            <Text style={[styles.sender, isMe ? styles.senderMe : styles.senderOther]}>
              {isMe ? 'Siz' : item.senderName}
            </Text>
            <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
          </View>

          {/* Reply preview */}
          {item.replyTo ? (
            <View style={styles.replyBox}>
              <Text style={styles.replySender}>{item.replyTo.senderName}</Text>
              <Text style={styles.replyText} numberOfLines={2}>{item.replyTo.text}</Text>
            </View>
          ) : null}

          {/* Body */}
          {item.type === 'text' && <Text style={styles.bodyText}>{item.text}</Text>}

          {item.type === 'image' && (
            <TouchableOpacity onPress={() => { setModalImage(item.text); setModalVisible(true); }}>
              <Image source={{ uri: item.text }} style={styles.imagePreview} />
            </TouchableOpacity>
          )}

          {item.type === 'video' && (
            <Video source={{ uri: item.text }} style={styles.videoPreview} useNativeControls resizeMode="contain" />
          )}

          {item.type === 'file' && (
            <TouchableOpacity onPress={() => Linking.openURL(item.text).catch(() => alert('Faylni ochib bo‘lmadi'))}>
              <Text style={styles.fileLink}>📎 {item.name || 'Fayl'}</Text>
            </TouchableOpacity>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => handleReply(item)}>
              <Text style={styles.replyLink}>Javob yozish</Text>
            </TouchableOpacity>
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
      <CustomHeader groupName="Cambridge Innovation School" members={membersCount} online={onlineCount} />

      {/* Group pill */}
      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>Booster Group</Text>
        <Text style={styles.groupMembers}>{membersCount} Members</Text>
        <View style={styles.onlinePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{onlineCount} people online now</Text>
        </View>
      </View>

      {/* >>> CHAT BACKGROUND (Cambridge_logo) <<< */}
      <View style={{ flex: 1 }}>
        <ImageBackground source={Cambridge_logo} style={styles.bg} imageStyle={styles.bgImage}>
          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => String(item.id)}
            inverted
            contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
            onScroll={onListScroll}
            scrollEventThrottle={16}
          />

          {/* Scroll to bottom */}
          {showScrollDown && (
            <TouchableOpacity style={styles.scrollBtn} onPress={scrollToBottom}>
              <MaterialCommunityIcons name="arrow-down" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Reply preview (input ustida) */}
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

          {/* Input row */}
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
      {/* >>> CHAT BACKGROUND END <<< */}

      {/* Image modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalContainer} onPress={() => setModalVisible(false)}>
          <Image source={{ uri: modalImage }} style={styles.fullImage} />
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* -------------------- STYLES -------------------- */
const RADIUS = 16;

const styles = StyleSheet.create({
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
  groupTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  groupMembers: { color: '#fde4e2', marginTop: 2, fontSize: 12 },
  onlinePill: {
    marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, flexDirection: 'row', alignItems: 'center',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
  onlineText: { color: '#111827', fontSize: 12, fontWeight: '600' },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6, paddingHorizontal: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb' },

  bubble: {
    maxWidth: '74%',
    padding: 10,
    borderRadius: RADIUS,
    marginHorizontal: 8,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleOther: { backgroundColor: '#F3F4F6', borderTopLeftRadius: 4 },
  bubbleMe: { backgroundColor: '#3B82F6', borderTopRightRadius: 4 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sender: { fontWeight: '700', fontSize: 12 },
  senderOther: { color: '#111827' },
  senderMe: { color: '#E5E7EB' },
  time: { fontSize: 10, color: '#9CA3AF', marginLeft: 8 },

  replyBox: {
    borderLeftWidth: 3, borderLeftColor: '#C084FC',
    backgroundColor: 'rgba(192,132,252,0.1)',
    padding: 6, borderRadius: 8, marginBottom: 6,
  },
  replySender: { fontSize: 11, fontWeight: '700', color: '#6D28D9' },
  replyText: { fontSize: 11, color: '#374151', marginTop: 2 },

  bodyText: { fontSize: 14, lineHeight: 20, color: '#111827' },
  replyLink: { fontSize: 11, color: '#2563EB' },

  actionRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  imagePreview: { width: 180, height: 180, borderRadius: 10, marginTop: 4 },
  videoPreview: { width: 220, height: 160, borderRadius: 10, marginTop: 4 },
  fileLink: { color: '#1E90FF', textDecorationLine: 'underline', marginTop: 4, fontWeight: '600' },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderTopWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  input: {
    flex: 1, borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB',
    marginHorizontal: 10, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 6, color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  sendButton: {
    backgroundColor: '#B91C1C', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center',
  },

  // Reply preview pill
  replyPreview: {
    marginHorizontal: 10, marginBottom: 6, backgroundColor: '#F3F4F6',
    borderLeftWidth: 4, borderLeftColor: '#2563EB', borderRadius: 12, padding: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  replyPreviewLabel: { fontSize: 12, color: '#374151', fontWeight: '700' },
  replyPreviewText: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Modal
  modalContainer: { backgroundColor: 'rgba(0,0,0,0.9)', flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%', resizeMode: 'contain' },

  // Scroll to bottom
  scrollBtn: {
    position: 'absolute', right: 16, bottom: 86, backgroundColor: '#B91C1C',
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },

  // >>> Background styles <<<
  bg: { flex: 1, justifyContent: 'flex-end' },
  bgImage: { opacity: 0.12, resizeMode: 'cover' },
});
