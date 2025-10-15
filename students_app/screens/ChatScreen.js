// /screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Image, Modal, Pressable, Alert, Linking, AppState,
  ImageBackground, Dimensions, ActivityIndicator, ActionSheetIOS
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio, Video } from 'expo-av';
import Slider from '@react-native-community/slider';

import {
  collection, query, orderBy, onSnapshot, serverTimestamp,
  doc, updateDoc, deleteDoc, getDoc, setDoc, getDocs, limit, arrayUnion,
  writeBatch, limitToLast
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';

import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

import { auth, firestore, storage } from '../../firebase';
import avatarPlaceholder from '../../assets/avatar-placeholder.jpg';
import Cambridge_logo from '../../assets/Cambridge_logo.png';

let GLOBAL_ACTIVE_SOUND = { id: null, sound: null };
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ----------------- Helpers: open & save ----------------- */
async function openWithChooser(remoteUrl, mimeType) {
  try {
    if (Platform.OS === 'android') {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: remoteUrl, type: mimeType || '*/*',
      });
      return true;
    }
    const can = await Linking.canOpenURL(remoteUrl);
    if (can) { await Linking.openURL(remoteUrl); return true; }
  } catch {}
  return false;
}
async function saveToDevice(remoteUrl, displayName='file', mimeType) {
  try {
    const safe = encodeURIComponent(displayName || 'file');
    const local = `${FileSystem.cacheDirectory}${safe}`;
    const { uri } = await FileSystem.downloadAsync(remoteUrl, local);

    const isMedia = /^(image|video|audio)\//.test(mimeType||'');
    if (isMedia) {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert('Saved','Fayl galereyaga saqlandi.');
        return true;
      }
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Save to device' });
      return true;
    }
  } catch {}
  return false;
}
async function openPdfSmart(url) {
  const ok = await openWithChooser(url, 'application/pdf'); if (ok) return true;
  try {
    const viewer = `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(url)}`;
    await WebBrowser.openBrowserAsync(viewer); return true;
  } catch {}
  return false;
}
const ext = (n='') => (n.split('.').pop()||'').toLowerCase();
const isPdf = (name, mime) => (mime||'').includes('application/pdf') || ext(name)==='pdf';

/* ---------- Name helpers ---------- */
const humanizeEmail = (email='') => {
  const base = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  return base ? base.replace(/\b\w/g, c => c.toUpperCase()) : email;
};
async function getUserDisplayName(uid) {
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    const u = snap.data() || {};
    const name = u.displayName || u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || null;
    if (name && String(name).trim()) return String(name).trim();
    if (u.email) return humanizeEmail(u.email);
  } catch {}
  return 'Direct chat';
}

/* ============================================================ */

export default function ChatScreen({ route }) {
  const groupId = route?.params?.groupId ?? null;
  const dmId    = route?.params?.dmId ?? null;
  const peerId  = route?.params?.peerId ?? null;
  const initialGroupName = route?.params?.groupName ?? (dmId ? 'Direct chat' : 'Chat');

  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  /* -------- Auth -------- */
  const [currentUserId, setCurrentUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => {
    setCurrentUserId(u?.uid ?? null);
    setAuthReady(true);
  }), []);

  // ---- Audio mode once
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {}
    })();
  }, []);

  /* -------- Presence (global + per-group) -------- */
  const hb = useRef(null);
  const ghb = useRef(null);

  const setGlobalPresence = useCallback(async (isOnline) => {
    if (!currentUserId) return;
    try {
      await setDoc(
        doc(firestore, 'users', currentUserId),
        { online: isOnline, lastActive: serverTimestamp() },
        { merge: true }
      );
    } catch {}
  }, [currentUserId]);

  const setGroupPresence = useCallback(async (isOnline) => {
    if (!currentUserId || !groupId) return;
    try {
      await setDoc(
        doc(firestore, `groups/${groupId}/students`, currentUserId),
        { lastActive: serverTimestamp(), online: isOnline },
        { merge: true }
      );
    } catch {}
  }, [currentUserId, groupId]);

  const startHeartbeats = useCallback(() => {
    if (hb.current) clearInterval(hb.current);
    hb.current = setInterval(() => setGlobalPresence(true), 25_000);

    if (groupId) {
      if (ghb.current) clearInterval(ghb.current);
      ghb.current = setInterval(() => setGroupPresence(true), 25_000);
    }
  }, [groupId, setGlobalPresence, setGroupPresence]);

  const stopHeartbeats = useCallback(() => {
    if (hb.current) { clearInterval(hb.current); hb.current = null; }
    if (ghb.current) { clearInterval(ghb.current); ghb.current = null; }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (AppState.currentState?.match?.(/inactive|background/) && next === 'active') {
        await setGlobalPresence(true);
        await setGroupPresence(true);
        startHeartbeats();
      } else if (next?.match?.(/inactive|background/)) {
        await setGroupPresence(false);
        await setGlobalPresence(false);
        stopHeartbeats();
      }
    });

    setGlobalPresence(true);
    setGroupPresence(true);
    startHeartbeats();

    return () => {
      sub.remove();
      stopHeartbeats();
      setGroupPresence(false);
      setGlobalPresence(false);
    };
  }, [currentUserId, groupId, setGlobalPresence, setGroupPresence, startHeartbeats, stopHeartbeats]);

  useFocusEffect(useCallback(() => {
    setGlobalPresence(true);
    setGroupPresence(true);
    startHeartbeats();
    return () => stopHeartbeats();
  }, [startHeartbeats, stopHeartbeats, setGlobalPresence, setGroupPresence]));

  /* -------- Title / members / permission -------- */
  const [title, setTitle] = useState(initialGroupName);
  const [canManage, setCanManage] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(initialGroupName);

  const [members, setMembers] = useState([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersCount, setMembersCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [membersLoading, setMembersLoading] = useState(true);

  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const memberIds = useMemo(() => new Set(members.map(m => m.id)), [members]);

  const [permError, setPermError] = useState(null);

  // ---- Ensure DM participants / Group info
  useEffect(() => {
    if (!authReady || !currentUserId) return;

    // DM header + ensure doc
    (async () => {
      if (dmId && !groupId) {
        try {
          const dRef = doc(firestore, 'private_chats', dmId);
          const dmSnap = await getDoc(dRef);
          if (dmSnap.exists()) {
            const dm = dmSnap.data() || {};
            const otherId = (dm.participants || []).find((x) => x !== currentUserId);
            setTitle(otherId ? await getUserDisplayName(otherId) : 'Direct chat');
          } else {
            const other = peerId || null;
            const parts = other ? [currentUserId, other] : [currentUserId];
            await setDoc(dRef, { participants: parts, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
            if (other) setTitle(await getUserDisplayName(other));
          }
        } catch {
          setTitle('Direct chat');
        }
      }
    })();

    if (!groupId) return;
    const gRef = doc(firestore, 'groups', groupId);
    const unsub = onSnapshot(
      gRef,
      async (snap) => {
        if (snap.exists()) {
          const g = snap.data();
          if (g?.name) setTitle(g.name);
          if (g?.createdBy === currentUserId) setCanManage(true);

          const ids = Array.isArray(g.memberIds) ? g.memberIds : [];
          if (ids.length && !ids.includes(currentUserId)) {
            try { await updateDoc(gRef, { memberIds: arrayUnion(currentUserId) }); } catch {}
          }
        }
      },
      (err) => setPermError(err.message)
    );

    (async () => {
      try {
        const mine = await getDoc(doc(firestore, `groups/${groupId}/students`, currentUserId));
        if (mine.exists() && mine.data()?.isAdmin) setCanManage(true);
      } catch {}
    })();

    return () => unsub();
  }, [authReady, groupId, dmId, currentUserId, peerId]);

  useEffect(() => {
    if (!authReady || !currentUserId || !groupId) return;
    setMembersLoading(true);
    const unsub = onSnapshot(
      collection(firestore, `groups/${groupId}/students`),
      (snap) => {
        const now = Date.now(), ONLINE_MS = 60_000;
        let online = 0;
        const list = snap.docs.map((d) => {
          const u = d.data() || {};
          const last = u.lastActive?.toDate ? u.lastActive.toDate().getTime() : 0;
          const on = !!u.online || (last && now - last <= ONLINE_MS);
          if (on) online += 1;
          return { id: d.id, ...u, online: on };
        });
        setMembers(list);
        setMembersCount(snap.size);
        setOnlineCount(online);
        setMembersLoading(false);
      },
      (err) => { setMembersLoading(false); setPermError(err.message); }
    );
    return () => unsub();
  }, [authReady, groupId, currentUserId]);

  const openCandidates = useCallback(async () => {
    if (!groupId) return;
    try {
      setCandidatesLoading(true);
      const snap = await getDocs(query(collection(firestore, 'users'), limit(100)));
      const arr = [];
      snap.forEach(d => {
        const u = d.data() || {};
        if (d.id !== currentUserId && !memberIds.has(d.id)) arr.push({ id: d.id, ...u });
      });
      setCandidates(arr);
      setCandidatesOpen(true);
    } catch {
      Alert.alert('Xato', 'Nomzodlarni olib bo‘lmadi.');
    } finally {
      setCandidatesLoading(false);
    }
  }, [groupId, currentUserId, memberIds]);

  /* -------- Messages (REALTIME & INSTANT) -------- */
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const flatListRef = useRef(null);
  const prevLenRef = useRef(0);
  const msgsMapRef = useRef(new Map()); // id -> msg

  const MSG_LIMIT = 300;
  const msgPath = useMemo(() => (
    groupId ? `group_chats/${groupId}/messages` :
    dmId    ? `private_chats/${dmId}/messages` :
              `chats`
  ), [groupId, dmId]);

  const clearMessagesStore = () => { msgsMapRef.current = new Map(); setMessages([]); };

  useEffect(() => {
    if (!authReady || !currentUserId) return;
    setLoadingMsgs(true); setPermError(null);
    clearMessagesStore();

    // 🔑 MUHIM: createdAtMs bo‘yicha (client clock) — zudlik bilan ko‘rinadi
    const qRef = query(
      collection(firestore, msgPath),
      orderBy('createdAtMs', 'asc'),
      limitToLast(MSG_LIMIT)
    );

    const unsub = onSnapshot(
      qRef,
      { includeMetadataChanges: true }, // RN stream o'zgarishlarida ham yangilaydi
      (snap) => {
        const map = msgsMapRef.current;

        snap.docChanges().forEach((ch) => {
          const id = ch.doc.id;
          if (ch.type === 'removed') {
            map.delete(id);
            return;
          }
          const data = ch.doc.data({ serverTimestamps: 'estimate' });
          const createdAtMs =
            typeof data?.createdAtMs === 'number'
              ? data.createdAtMs
              : (data?.createdAt?.toMillis?.() ?? 0);

          map.set(id, { id, ...data, createdAtMs });
        });

        // ASC (eski -> yangi). Tie-break id bilan.
        const next = Array.from(map.values()).sort((a,b) => {
          const am = a.createdAtMs ?? 0;
          const bm = b.createdAtMs ?? 0;
          if (am !== bm) return am - bm;
          return a.id.localeCompare(b.id);
        });

        setMessages(next);
        setLoadingMsgs(false);
      },
      (err) => { setPermError(err.message); setLoadingMsgs(false); }
    );

    return () => { unsub && unsub(); clearMessagesStore(); };
  }, [authReady, msgPath, currentUserId]);

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    }
    prevLenRef.current = messages.length;
  }, [messages.length]);

  /* -------- Upload & previews -------- */
  const [inputText, setInputText] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadPct, setUploadPct] = useState(null);

  const uploadWithProgress = async (uri, storagePath, contentType) => {
    const res = await fetch(uri); const blob = await res.blob();
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, blob, contentType ? { contentType } : undefined);
    return await new Promise((resolve, reject) => {
      task.on('state_changed',
        (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => { const url = await getDownloadURL(task.snapshot.ref); setUploadPct(null); resolve(url); }
      );
    });
  };

  const pickImageOrVideo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
    if (!r.canceled && r.assets?.length) {
      const a = r.assets[0];
      setFilePreview({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image', name: (a.fileName || a.uri.split('/').pop() || '').split('?')[0] });
      setImagePreviewOpen(true);
    }
  };

  const pickDocument = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.assets?.length) {
      const f = r.assets[0];
      const mime = f.mimeType || '';
      const isAudio = mime.startsWith('audio/');
      setFilePreview({ uri: f.uri, type: isAudio ? 'audio' : 'file', name: f.name || 'file', mimeType: mime || (isAudio ? 'audio/mpeg' : undefined), size: f.size || null });
      setImagePreviewOpen(true);
    }
  };

  const pathBase = useCallback(() => (groupId ? `groups/${groupId}` : dmId ? `dm/${dmId}` : `misc`), [groupId, dmId]);

  const sendPreview = async () => {
    if (!filePreview) return;
    const ts = Date.now();
    let path = '', url = '';
    if (filePreview.type === 'image') {
      path = `${pathBase()}/images/${ts}.jpg`;
      url = await uploadWithProgress(filePreview.uri, path, 'image/jpeg');
      await sendMessage(url, 'image');
    } else if (filePreview.type === 'video') {
      path = `${pathBase()}/videos/${ts}.mp4`;
      url = await uploadWithProgress(filePreview.uri, path, 'video/mp4');
      await sendMessage(url, 'video');
    } else if (filePreview.type === 'audio') {
      const e = (filePreview.name?.split('.').pop() || 'm4a').toLowerCase();
      const ct = filePreview.mimeType || (e === 'mp3' ? 'audio/mpeg' : 'audio/m4a');
      path = `${pathBase()}/audios/${ts}-${filePreview.name}`;
      url = await uploadWithProgress(filePreview.uri, path, ct);
      await sendMessage(url, 'audio', filePreview.name, { size: filePreview.size, mimeType: ct });
    } else {
      path = `${pathBase()}/files/${ts}-${filePreview.name}`;
      url = await uploadWithProgress(filePreview.uri, path);
      await sendMessage(url, 'file', filePreview.name, { size: filePreview.size, mimeType: filePreview.mimeType });
    }
    setFilePreview(null);
    setImagePreviewOpen(false);
  };

  /* -------- CRUD -------- */
  const [editingId, setEditingId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);

  const safeEditMessage = async (patch) => {
    if (!editingId) return;
    const refPath =
      groupId ? doc(firestore, `group_chats/${groupId}/messages`, editingId)
      : dmId   ? doc(firestore, `private_chats/${dmId}/messages`, editingId)
               : doc(firestore, 'chats', editingId);

    const exists = await getDoc(refPath);
    if (!exists.exists()) {
      setEditingId(null);
      Alert.alert('Diqqat', 'Xabar allaqachon o‘chirilgan yoki mavjud emas.');
      return;
    }
    await updateDoc(refPath, patch);
    setEditingId(null);
  };

  const sendMessage = async (content, type='text', name=null, meta=null) => {
    if (!currentUserId) return Alert.alert('Xato', 'Foydalanuvchi aniqlanmadi.');
    if (type === 'text' && !editingId && !content?.trim()) return;

    let replyTo = null;
    if (replyTarget) {
      let safe = '';
      if (replyTarget.type === 'text') safe = (replyTarget.text || '').slice(0,120);
      else if (replyTarget.type === 'image') safe = '🖼️ Image';
      else if (replyTarget.type === 'video') safe = '🎬 Video';
      else if (replyTarget.type === 'audio') safe = `🎵 Audio: ${replyTarget.name || ''}`.trim();
      else safe = `📎 File: ${replyTarget.name || ''}`.trim();
      replyTo = {
        id: replyTarget.id,
        senderId: replyTarget.senderId || null,
        text: safe,
        senderName: replyTarget.senderName || ''
      };
    }

    const us = await getDoc(doc(firestore, 'users', currentUserId));
    const u = us.data() || {};
    const prettyName =
      (u.displayName && String(u.displayName).trim()) ||
      (u.fullName && String(u.fullName).trim()) ||
      (u.name && String(u.name).trim()) ||
      (u.email ? humanizeEmail(u.email) : null) ||
      'Member';

    const nowMs = Date.now();
    const payload = {
      text: content || '',
      senderId: currentUserId,
      senderName: prettyName,
      avatar: u.avatar || null,
      type,
      name: name || null,
      size: meta?.size ?? null,
      mimeType: meta?.mimeType ?? null,
      replyTo,
      createdAtMs: nowMs,            // 🔑 tartib shu bilan
      createdAt: serverTimestamp(),  // UI ko'rsatish uchun
      timestamp: serverTimestamp(),  // legacy
    };

    try {
      if (editingId) {
        await safeEditMessage({ text: content, type, name, size: payload.size, mimeType: payload.mimeType });
      } else {
        const batch = writeBatch(firestore);
        const coll =
          groupId ? collection(firestore, `group_chats/${groupId}/messages`) :
          dmId    ? collection(firestore, `private_chats/${dmId}/messages`) :
                    collection(firestore, 'chats');

        const newMsgRef = doc(coll);
        batch.set(newMsgRef, payload);

        const lastText = type === 'text' ? payload.text
          : type === 'image' ? '🖼️ Image'
          : type === 'video' ? '🎬 Video'
          : type === 'audio' ? '🎵 Audio'
          : '📎 File';

        if (groupId) {
          batch.update(doc(firestore, 'groups', groupId), {
            lastMessage: lastText, lastMessageAt: serverTimestamp()
          });
        } else if (dmId) {
          batch.set(doc(firestore, 'private_chats', dmId), {
            lastMessage: lastText, lastSender: currentUserId, updatedAt: serverTimestamp()
          }, { merge: true });
        }
        await batch.commit();

        await setGroupPresence(true);
        await setGlobalPresence(true);
      }

      setInputText('');
      setReplyTarget(null);
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      const msg = String(e?.message || e);
      if (/Missing or insufficient permissions/i.test(msg)) {
        Alert.alert('Diqqat','Group chat ga yozish ruxsati yo‘q. Guruhning memberIds ro‘yxatida bo‘lishingiz kerak.');
      } else {
        Alert.alert('Xato', msg);
      }
    }
  };

  const handleSend = useCallback(() => {
    const txt = inputText;
    if (!txt.trim() && !editingId) return;
    setInputText('');
    sendMessage(txt);
  }, [inputText, editingId]);

  const handleDelete = (id) => {
    Alert.alert('O‘chirish', 'Xabarni o‘chirishni tasdiqlang', [
      { text: 'Bekor', style: 'cancel' },
      { text: 'Ha', style: 'destructive', onPress: async () =>
        await deleteDoc(groupId ? doc(firestore, `group_chats/${groupId}/messages`, id)
          : dmId ? doc(firestore, `private_chats/${dmId}/messages`, id)
                 : doc(firestore, 'chats', id)).catch((e)=>Alert.alert('Xato', String(e?.message||e)))
      },
    ]);
  };
  const handleEdit  = (msg) => {
    if (msg.type!=='text') return Alert.alert('Edit','Faqat matn xabarlarini tahrirlash mumkin.');
    setInputText(msg.text);
    setReplyTarget(null);
    setEditingId(msg.id);
  };
  const handleReply = (msg) => {
    setEditingId(null);
    setReplyTarget({ id: msg.id, senderId: msg.senderId, text: msg.text, senderName: msg.senderName, type: msg.type, name: msg.name });
  };

  /* -------- UI helpers -------- */
  const fmt = (ts) => { if (!ts?.toDate) return ''; const d = ts.toDate(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const onListScroll = (e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    setShowScrollDown(!(layoutMeasurement.height + contentOffset.y >= contentSize.height - 60));
  };
  const scrollToBottom = () => flatListRef.current?.scrollToEnd({ animated: true });

  const isAudioMsg = (m) =>
    m?.type === 'audio' ||
    (m?.mimeType && m.mimeType.startsWith('audio/')) ||
    /\.(mp3|m4a|aac|wav|ogg)$/i.test(m?.name || '');

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUserId;
    const avatarSource = item.avatar ? { uri: item.avatar } : avatarPlaceholder;

    return (
      <View style={[styles.msgRow, isMe ? { justifyContent:'flex-end' } : { justifyContent:'flex-start' }]}>
        {!isMe && <Image source={avatarSource} style={styles.avatar} />}

        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <View style={styles.topRow}>
            <Text style={[styles.sender, isMe ? styles.senderMe : styles.senderOther]}>{isMe ? 'Siz' : (item.senderName || 'Member')}</Text>
            <Text style={[styles.time, isMe?{color:'#E5E7EB'}:{color:'#9CA3AF'}]}>{fmt(item.createdAt || item.timestamp)}</Text>
          </View>

          {!!item.replyTo && (
            <View style={styles.replyBox}>
              <Text style={styles.replySender}>{item.replyTo.senderName || 'Reply'}</Text>
              <Text style={styles.replyText} numberOfLines={2}>{item.replyTo.text}</Text>
            </View>
          )}

          {item.type==='text'  && <Text style={[styles.bodyText, isMe && styles.bodyTextMe]}>{item.text}</Text>}

          {item.type==='image' && (
            <TouchableOpacity onPress={() => setModalImage(item.text)}>
              <Image source={{ uri: item.text }} style={styles.imagePreview} />
            </TouchableOpacity>
          )}

          {item.type==='video' && (
            <Video source={{ uri: item.text }} style={styles.videoPreview} useNativeControls resizeMode="contain" />
          )}

          {isAudioMsg(item) && (
            <ChatAudioTile id={item.id} name={item.name || 'Audio'} url={item.text} size={item.size} isMe={isMe} />
          )}

          {!isAudioMsg(item) && item.type==='file' && (
            <FileTile name={item.name||'File'} url={item.text} size={item.size} mimeType={item.mimeType} isMe={isMe} />
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => handleReply(item)}><Text style={styles.replyLink}>Reply</Text></TouchableOpacity>
            {isMe && item.type==='text' ? (
              <View style={{ flexDirection:'row' }}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={{ marginLeft:12 }}>
                  <MaterialCommunityIcons name="pencil" size={16} color="#FDE4E2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft:12 }}>
                  <MaterialCommunityIcons name="delete" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : isMe ? (
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft:12 }}>
                <MaterialCommunityIcons name="delete" size={16} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {isMe && <Image source={avatarSource} style={styles.avatar} />}
      </View>
    );
  };

  /* ----------- RETURN UI ----------- */
  if (!authReady) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop:8 }}>Authenticating…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex:1, backgroundColor:'#F8FAFC' }}
      behavior={Platform.OS==='ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS==='ios' ? headerHeight : 0}
    >
      {/* Header */}
      <View style={{ backgroundColor: 'transparent' }}>
        <View style={styles.groupHeaderCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={{ flex:1 }}
              onPress={() => (groupId ? setMembersOpen(true) : null)}
              activeOpacity={0.85}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            </TouchableOpacity>

            {groupId ? (
              <Text style={styles.membersBadge}>{membersCount} Members</Text>
            ) : null}

            {groupId && canManage && (
              <View style={{ flexDirection:'row', marginLeft:8 }}>
                <TouchableOpacity onPress={() => { setRenameValue(title); setRenameOpen(true); }} style={{ marginLeft:6 }}>
                  <MaterialCommunityIcons name="pencil" size={18} color="#FDE4E2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={openCandidates} style={{ marginLeft:10 }}>
                  <MaterialCommunityIcons name="account-plus" size={20} color="#FDE4E2" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {groupId ? (
          <View style={styles.subHeaderShadowWrap}>
            <View style={styles.subHeaderInner}>
              <View style={styles.onlineDotNew} />
              <Text style={styles.subHeaderText}>
                {onlineCount} {onlineCount === 1 ? 'Person' : 'People'} online now
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={{ flex:1 }}>
        <ImageBackground source={Cambridge_logo} style={styles.bg} imageStyle={styles.bgImage} resizeMode="contain">
          {!!permError && (
            <View style={{ backgroundColor:'#FEE2E2', padding:8 }}>
              <Text style={{ color:'#7F1D1D', fontWeight:'700' }}>Permission error: {String(permError)}</Text>
            </View>
          )}

          {loadingMsgs ? (
            <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator /></View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item)=>String(item.id)}
              contentContainerStyle={{ paddingHorizontal:10, paddingTop:10, paddingBottom:12+insets.bottom }}
              onScroll={onListScroll}
              scrollEventThrottle={32}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS==='ios' ? 'interactive' : 'on-drag' }
              ListEmptyComponent={<View style={{ padding:20, alignItems:'center' }}><Text>Hali xabar yo‘q. Birinchi xabarni yozing.</Text></View>}
              removeClippedSubviews={false}  // 🔑 important: RN rendering/glitches oldini oladi
              initialNumToRender={18}
              windowSize={12}
              maxToRenderPerBatch={14}
            />
          )}

          {showScrollDown && (
            <TouchableOpacity style={styles.scrollBtn} onPress={scrollToBottom}>
              <MaterialCommunityIcons name="arrow-down" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {replyTarget && (
            <View style={styles.replyPreview}>
              <View style={{ flex:1 }}>
                <Text style={styles.replyPreviewLabel}>Replying to {replyTarget.senderName}</Text>
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {replyTarget.type==='text'
                    ? replyTarget.text
                    : replyTarget.type==='image' ? '🖼️ Image'
                    : replyTarget.type==='video' ? '🎬 Video'
                    : replyTarget.type==='audio' ? `🎵 Audio: ${replyTarget.name||''}`
                    : `📎 File: ${replyTarget.name||''}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTarget(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input row */}
          <View style={[styles.inputRow, { paddingBottom: Math.max(10, 10 + insets.bottom/2) }]}>
            <TouchableOpacity onPress={pickImageOrVideo}><MaterialCommunityIcons name="image" size={24} color="#6B7280" /></TouchableOpacity>
            <TouchableOpacity onPress={pickDocument} style={{ marginLeft:10 }}><MaterialCommunityIcons name="paperclip" size={24} color="#6B7280" /></TouchableOpacity>

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message"
              placeholderTextColor="#9CA3AF"
              onFocus={scrollToBottom}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />

            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* Image preview */}
      <Modal visible={!!modalImage} transparent animationType="fade" onRequestClose={() => setModalImage(null)}>
        <Pressable style={styles.modalContainer} onPress={() => setModalImage(null)}>
          <Image source={{ uri: modalImage }} style={styles.fullImage} />
        </Pressable>
      </Modal>

      {/* Attachment preview */}
      <Modal visible={imagePreviewOpen} transparent animationType="slide" onRequestClose={() => setImagePreviewOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setImagePreviewOpen(false)}>
          <Pressable style={styles.previewCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.previewTitle}>Preview</Text>

            {!!filePreview && filePreview.type === 'image' && (
              <Image source={{ uri: filePreview.uri }} style={{ width:'100%', height: Math.min(260, SCREEN_H*0.35), borderRadius:12 }} />
            )}
            {!!filePreview && filePreview.type === 'video' && (
              <Video source={{ uri: filePreview.uri }} style={{ width:'100%', height: Math.min(260, SCREEN_H*0.35), borderRadius:12 }} useNativeControls resizeMode="contain" />
            )}
            {!!filePreview && (filePreview.type==='file' || filePreview.type==='audio') && (
              <FileTile name={filePreview.name} url={filePreview.uri} local size={filePreview.size} mimeType={filePreview.mimeType} />
            )}

            {uploadPct != null && <View style={{ marginTop:10, alignItems:'center' }}><Text style={{ fontWeight:'700' }}>{uploadPct}%</Text></View>}

            <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:14 }}>
              <TouchableOpacity style={[styles.rBtn, { backgroundColor:'#f3f4f6' }]} onPress={() => { setImagePreviewOpen(false); setFilePreview(null); }}>
                <Text style={{ fontWeight:'700', color:'#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rBtn, { backgroundColor:'#0D47A1', marginLeft:8 }]} onPress={sendPreview}>
                <Text style={{ fontWeight:'700', color:'#fff' }}>Send</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRenameOpen(false)}>
          <Pressable style={styles.renameCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.renameTitle}>Guruh nomi</Text>
            <TextInput value={renameValue} onChangeText={setRenameValue} placeholder="Group name" style={styles.renameInput} maxLength={60} autoFocus />
            <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:10 }}>
              <TouchableOpacity style={[styles.rBtn, { backgroundColor:'#f3f4f6' }]} onPress={() => setRenameOpen(false)}>
                <Text style={{ fontWeight:'700', color:'#111827' }}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rBtn, { backgroundColor:'#0D47A1', marginLeft:8 }]}
                onPress={() => {
                  if (!groupId) return;
                  const val = (renameValue||'').trim(); if (!val) return;
                  updateDoc(doc(firestore, 'groups', groupId), { name: val })
                    .then(()=>{ setTitle(val); setRenameOpen(false); })
                    .catch(()=> Alert.alert('Xato','Guruh nomi o‘zgartirilmadi.'));
                }}
              >
                <Text style={{ fontWeight:'700', color:'#fff' }}>Saqlash</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Members */}
      <Modal visible={membersOpen} transparent animationType="slide" onRequestClose={() => setMembersOpen(false)}>
        <Pressable style={styles.membersBackdrop} onPress={() => setMembersOpen(false)}>
          <Pressable style={styles.membersSheet} onPress={(e)=>e.stopPropagation()}>
            <View style={styles.membersHeader}>
              <Text style={styles.membersTitle}>Members</Text>
              <TouchableOpacity onPress={() => setMembersOpen(false)}><MaterialCommunityIcons name="close" size={22} color="#111827" /></TouchableOpacity>
            </View>
            <Text style={styles.membersMeta}>{membersCount} total • {onlineCount} online</Text>

            {membersLoading ? (
              <View style={{ paddingVertical:20, alignItems:'center' }}><ActivityIndicator /></View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(it)=>it.id}
                ItemSeparatorComponent={() => <View style={{ height:8 }} />}
                renderItem={({ item }) => (
                  <View style={styles.memberRow}>
                    <View style={[styles.memberDot, { backgroundColor: item.online ? '#22C55E' : '#9CA3AF' }]} />
                    <Text style={styles.memberName} numberOfLines={1}>{item.name || 'User'} {item.isAdmin ? '• admin' : ''}</Text>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Candidates */}
      <Modal visible={candidatesOpen} transparent animationType="slide" onRequestClose={() => setCandidatesOpen(false)}>
        <Pressable style={styles.membersBackdrop} onPress={() => setCandidatesOpen(false)}>
          <Pressable style={styles.membersSheet} onPress={(e)=>e.stopPropagation()}>
            <View style={styles.membersHeader}>
              <Text style={styles.membersTitle}>Add people</Text>
              <TouchableOpacity onPress={() => setCandidatesOpen(false)}><MaterialCommunityIcons name="close" size={22} color="#111827" /></TouchableOpacity>
            </View>

            {candidatesLoading ? (
              <View style={{ paddingVertical:20, alignItems:'center' }}><ActivityIndicator /></View>
            ) : (
              <FlatList
                data={candidates}
                keyExtractor={(it)=>it.id}
                ItemSeparatorComponent={() => <View style={{ height:8 }} />}
                renderItem={({ item }) => (
                  <View style={styles.candRow}>
                    <Text style={styles.candName} numberOfLines={1}>{item.displayName || item.fullName || item.email || 'User'}</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={async () => {
                      try {
                        await setDoc(doc(firestore, `groups/${groupId}/students`, item.id), {
                          name: item.displayName || item.fullName || item.email || 'User',
                          addedBy: currentUserId, isAdmin:false, joinedAt: serverTimestamp(), lastActive: serverTimestamp(), online: false,
                        }, { merge: true });
                        await updateDoc(doc(firestore, 'groups', groupId), {
                          memberIds: arrayUnion(item.id)
                        });
                        setCandidates(prev => prev.filter(x => x.id !== item.id));
                      } catch {
                        Alert.alert('Xato','Qo‘shib bo‘lmadi (permissions).');
                      }
                    }}>
                      <Text style={styles.addBtnTx}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={<View style={{ paddingVertical:20, alignItems:'center' }}><Text>No candidates</Text></View>}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ===== Utilities ===== */
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B','KB','MB','GB']; let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/* ===== FILE/PDF tile ===== */
function FileTile({ name, url, size=null, mimeType=null, local=false, isMe=false }) {
  const pdf = isPdf(name, mimeType);

  const onTap = async () => {
    if (local) return;
    const ok = pdf ? await openPdfSmart(url) : await openWithChooser(url, mimeType || '*/*');
    if (!ok) Alert.alert('Xatolik', 'Ochish uchun mos ilova topilmadi.');
  };
  const onLong = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Save to device', 'Open', 'Cancel'], cancelButtonIndex: 2 },
        (i) => { if (i===0) saveToDevice(url, name, mimeType || (pdf?'application/pdf':undefined)); else if (i===1) onTap(); }
      );
    } else {
      Alert.alert(name || 'File', undefined, [
        { text: 'Save to device', onPress: () => saveToDevice(url, name, mimeType || (pdf?'application/pdf':undefined)) },
        { text: 'Open', onPress: onTap },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <TouchableOpacity
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={220}
      activeOpacity={0.9}
      style={[
        styles.fileTile,
        isMe ? styles.fileTileMe : styles.fileTileOther
      ]}
    >
      <View style={[styles.fileIconWrap, pdf && { backgroundColor:'#FEE2E2' }]}>
        <MaterialCommunityIcons name={pdf ? 'file-pdf-box' : 'paperclip'} size={20} color={pdf ? '#B91C1C' : '#0D47A1'} />
      </View>

      <View style={{ flex:1 }}>
        <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
        <Text style={styles.fileMeta} numberOfLines={1}>{formatBytes(size) || (mimeType || '').split('/').pop()?.toUpperCase() || 'FILE'}</Text>
      </View>

      {!local && (
        <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" style={{ marginLeft:6 }} />
      )}
    </TouchableOpacity>
  );
}

/* ===== AUDIO tile (expo-av) ===== */
function ChatAudioTile({ id, name, url, size=null, isMe=false }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const [sliderValue, setSliderValue] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubbingRef = useRef(false);

  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (sound) {
            const shouldUnload = GLOBAL_ACTIVE_SOUND.id === id && GLOBAL_ACTIVE_SOUND.sound === sound;
            await sound.unloadAsync();
            if (shouldUnload) GLOBAL_ACTIVE_SOUND = { id: null, sound: null };
          }
        } catch {}
      })();
    };
  }, [sound, id]);

  const ensureLoaded = useCallback(async () => {
    if (sound) return sound;
    setLoading(true);
    const s = new Audio.Sound();
    try {
      await s.loadAsync({ uri: url }, { shouldPlay: false, progressUpdateIntervalMillis: 400 }, false);
      s.setOnPlaybackStatusUpdate((st) => {
        if (!st) return;
        if ('positionMillis' in st) {
          const posMs = st.positionMillis || 0;
          setPosition(posMs);
          if (!scrubbingRef.current) setSliderValue(Math.floor(posMs / 1000));
        }
        if ('durationMillis' in st && st.durationMillis) setDuration(st.durationMillis);
        if (st.isLoaded) {
          setIsPlaying(!!st.isPlaying);
          if (st.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            if (!scrubbingRef.current) setSliderValue(0);
          }
        }
      });
      setSound(s);
      return s;
    } catch (e) {
      Alert.alert('Audio error', String(e?.message || e));
      try { await s.unloadAsync(); } catch {}
      throw e;
    } finally {
      setLoading(false);
    }
  }, [sound, url]);

  const stopGlobalIfOther = async () => {
    try {
      if (GLOBAL_ACTIVE_SOUND.sound && GLOBAL_ACTIVE_SOUND.id !== id) {
        await GLOBAL_ACTIVE_SOUND.sound.stopAsync().catch(()=>{});
        await GLOBAL_ACTIVE_SOUND.sound.unloadAsync().catch(()=>{});
        GLOBAL_ACTIVE_SOUND = { id: null, sound: null };
      }
    } catch {}
  };

  const onPlayPause = async () => {
    try {
      await stopGlobalIfOther();
      const s = await ensureLoaded();
      if (!s) return;
      const status = await s.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await s.pauseAsync();
        setIsPlaying(false);
      } else {
        GLOBAL_ACTIVE_SOUND = { id, sound: s };
        await s.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      Alert.alert('Audio error', String(e?.message || e));
    }
  };

  const onSeek = async (sec) => {
    try {
      const s = await ensureLoaded();
      if (!s) return;
      await s.setPositionAsync(Math.max(0, Math.floor(sec) * 1000));
    } catch {}
  };

  const durationSec = Math.max(1, Math.floor((duration || 0) / 1000));
  const positionSec = Math.floor((position || 0) / 1000);
  const fmt = (ms) => { const total = Math.floor((ms || 0) / 1000); const m = Math.floor(total/60), s = total%60; return `${String(m).padStart(1,'0')}:${String(s).padStart(2,'0')}`; };

  return (
    <View style={[styles.audioTile, isMe ? styles.audioTileMe : styles.audioTileOther]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPlayPause}
        disabled={loading}
        style={[styles.playBtn, { backgroundColor: isPlaying ? '#0EA5E9' : '#0D47A1', opacity: loading ? 0.6 : 1 }]}
      >
        <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
      </TouchableOpacity>

      <View style={styles.audioContent}>
        {!!name && <Text style={styles.fileName} numberOfLines={1}>{name}</Text>}
        <Slider
          style={styles.audioSlider}
          minimumValue={0}
          maximumValue={durationSec}
          value={isScrubbing ? sliderValue : positionSec}
          onSlidingStart={() => { scrubbingRef.current = true; setIsScrubbing(true); }}
          onValueChange={(v) => setSliderValue(v)}
          onSlidingComplete={(sec) => {
            scrubbingRef.current = false;
            setIsScrubbing(false);
            setSliderValue(sec);
            onSeek(sec);
          }}
          minimumTrackTintColor="#0D47A1"
          maximumTrackTintColor="#CBD5E1"
          thumbTintColor="#0D47A1"
        />
        <View style={styles.audioMetaRow}>
          <Text style={styles.fileMeta}>
            {duration
              ? `${fmt((isScrubbing ? sliderValue*1000 : position))} / ${fmt(duration)}`
              : (size ? `${formatBytes(size)} • Audio` : 'Audio')}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* -------------------- STYLES -------------------- */
const RADIUS = 16;
const styles = StyleSheet.create({
  /* Header */
  groupHeaderCard: {
    backgroundColor:'#B91C1C',
    marginHorizontal:12,
    borderTopLeftRadius:22,
    borderTopRightRadius:22,
    borderBottomLeftRadius:28,
    borderBottomRightRadius:28,
    paddingHorizontal:16,
    paddingTop:10,
    paddingBottom:18,
  },
  headerRow:{ flexDirection:'row', alignItems:'center' },
  headerTitle:{ color:'#fff', fontWeight:'800', fontSize:16, maxWidth:SCREEN_W*0.6 },
  membersBadge:{ color:'#FDE4E2', fontSize:12, fontWeight:'700' },

  subHeaderShadowWrap:{
    marginHorizontal:16,
    marginTop:8,
    backgroundColor:'#fff',
    borderRadius:14,
    paddingVertical:8,
    paddingHorizontal:12,
    shadowColor:'#000',
    shadowOpacity:0.12,
    shadowRadius:5,
    shadowOffset:{ width:0, height:3 },
    elevation:6,
  },
  subHeaderInner:{ flexDirection:'row', alignItems:'center' },
  onlineDotNew:{ width:10, height:10, borderRadius:5, backgroundColor:'#22C55E', marginRight:8 },
  subHeaderText:{ color:'#111827', fontSize:13, fontWeight:'800' },

  /* Messages */
  msgRow:{ flexDirection:'row', alignItems:'flex-end', marginVertical:6, paddingHorizontal:6 },
  avatar:{ width:28, height:28, borderRadius:14, backgroundColor:'#e5e7eb' },

  bubble:{ maxWidth:'78%', padding:8, borderRadius:RADIUS, marginHorizontal:8, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:3, shadowOffset:{ width:0, height:1 }, elevation:1 },
  bubbleOther:{ backgroundColor:'#F3F4F6', borderTopLeftRadius:6 },
  bubbleMe:{ backgroundColor:'#3B82F6', borderTopRightRadius:6 },

  topRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:2 },
  sender:{ fontWeight:'700', fontSize:11 },
  senderOther:{ color:'#111827' },
  senderMe:{ color:'#E5E7EB' },
  time:{ fontSize:10 },

  replyBox:{ borderLeftWidth:3, borderLeftColor:'#C084FC', backgroundColor:'rgba(192,132,252,0.12)', padding:6, borderRadius:8, marginBottom:6 },
  replySender:{ fontSize:11, fontWeight:'700', color:'#6D28D9' },
  replyText:{ fontSize:11, color:'#374151', marginTop:2 },

  bodyText:{ fontSize:14, lineHeight:20, color:'#111827' },
  bodyTextMe:{ color:'#F8FAFC' },

  replyLink:{ fontSize:11, color:'#2563EB' },
  actionRow:{ marginTop:6, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },

  imagePreview:{ width:SCREEN_W*0.6, height:SCREEN_W*0.6, borderRadius:12, marginTop:4, maxWidth:320, maxHeight:320 },
  videoPreview:{ width:SCREEN_W*0.65, height:SCREEN_W*0.42, borderRadius:12, marginTop:4, maxWidth:360, maxHeight:230 },

  /* FILE tile */
  fileTile:{
    flexDirection:'row', alignItems:'center', borderRadius:14, paddingHorizontal:10, paddingVertical:8, marginTop:4,
    minHeight:52, maxWidth: SCREEN_W * 0.78, minWidth: 180, alignSelf:'flex-start',
    shadowColor:'#000', shadowOpacity:0.06, shadowRadius:3, shadowOffset:{ width:0, height:1 }, elevation:1
  },
  fileTileOther:{ backgroundColor:'#EEF2FF' },
  fileTileMe:{ backgroundColor:'#DDEAFE', alignSelf:'flex-end' },

  fileIconWrap:{ width:28, height:28, borderRadius:8, backgroundColor:'#E0EAFF', alignItems:'center', justifyContent:'center', marginRight:10 },
  fileName:{ fontSize:13, color:'#0F172A', fontWeight:'700' },
  fileMeta:{ fontSize:11, color:'#475569', marginTop:2 },

  /* AUDIO tile */
  audioTile:{
    flexDirection:'row', alignItems:'center', borderRadius:14, paddingHorizontal:10, paddingVertical:8, marginTop:4,
    minHeight:50, maxWidth: SCREEN_W * 0.78, minWidth: 180,
    shadowColor:'#000', shadowOpacity:0.06, shadowRadius:3, shadowOffset:{ width:0, height:1 }, elevation:1
  },
  audioTileOther:{ alignSelf:'flex-start', backgroundColor:'#E6F6FF' },
  audioTileMe:{ alignSelf:'flex-end', backgroundColor:'#DDEAFE' },
  playBtn:{ width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center', marginRight:10 },

  audioContent:{ flex:1, minWidth:120 },
  audioSlider:{ width:'100%', height:28, marginTop:2 },
  audioMetaRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:2 },

  /* Input */
  inputRow:{ flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingTop:8, borderTopWidth:1, borderColor:'#E5E7EB', backgroundColor:'#fff' },
  input:{ flex:1, borderRadius:22, borderWidth:1, borderColor:'#E5E7EB', marginHorizontal:10, paddingHorizontal:15, paddingVertical:Platform.OS==='ios'?10:8, color:'#111827', backgroundColor:'#F9FAFB' },
  sendButton:{ backgroundColor:'#B91C1C', paddingVertical:10, paddingHorizontal:12, borderRadius:20, justifyContent:'center' },

  replyPreview:{ marginHorizontal:10, marginBottom:6, backgroundColor:'#F3F4F6', borderLeftWidth:4, borderLeftColor:'#2563EB', borderRadius:12, padding:8, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  replyPreviewLabel:{ fontSize:12, color:'#374151', fontWeight:'700' },
  replyPreviewText:{ fontSize:12, color:'#6B7280', marginTop:2 },

  /* Modals */
  modalContainer:{ backgroundColor:'rgba(0,0,0,0.9)', flex:1, justifyContent:'center', alignItems:'center' },
  fullImage:{ width:'100%', height:'100%', resizeMode:'contain' },

  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'center', alignItems:'center', padding:16 },
  previewCard:{ width:'100%', maxWidth:480, backgroundColor:'#fff', borderRadius:16, padding:16 },
  previewTitle:{ fontSize:16, fontWeight:'800', color:'#111827', marginBottom:10 },

  renameCard:{ width:'100%', maxWidth:420, backgroundColor:'#fff', borderRadius:16, padding:16 },
  renameTitle:{ fontSize:16, fontWeight:'800', color:'#111827' },
  renameInput:{ marginTop:10, borderWidth:1, borderColor:'#D1D5DB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff' },
  rBtn:{ paddingVertical:10, paddingHorizontal:16, borderRadius:10 },

  /* Members/Candidates */
  membersBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'flex-end' },
  membersSheet:{ maxHeight:'70%', backgroundColor:'#fff', borderTopLeftRadius:18, borderTopRightRadius:18, padding:14 },
  membersHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  membersTitle:{ fontSize:16, fontWeight:'800', color:'#111827' },
  membersMeta:{ marginTop:2, color:'#6B7280', marginBottom:10 },
  memberRow:{ backgroundColor:'#F9FAFB', padding:12, borderRadius:10, flexDirection:'row', alignItems:'center' },
  memberDot:{ width:10, height:10, borderRadius:5, marginRight:10 },
  memberName:{ fontSize:14, color:'#111827', flex:1 },

  candRow:{ backgroundColor:'#F9FAFB', padding:12, borderRadius:10, flexDirection:'row', alignItems:'center' },
  candName:{ fontSize:14, color:'#111827', flex:1 },
  addBtn:{ backgroundColor:'#0D47A1', paddingVertical:8, paddingHorizontal:12, borderRadius:10 },
  addBtnTx:{ color:'#fff', fontWeight:'700' },

  /* BG + scroll button */
  bg:{ flex:1 },
  bgImage:{ opacity:0.12, resizeMode:'contain' },
  scrollBtn:{ position:'absolute', right:16, bottom:86, backgroundColor:'#B91C1C', width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', elevation:4 },
});
