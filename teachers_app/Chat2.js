// src/screens/Chat2.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Image, Modal, Pressable, Alert, Linking, AppState,
  ImageBackground, Dimensions, ActivityIndicator, ActionSheetIOS, PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as WebBrowser from 'expo-web-browser';
import Slider from '@react-native-community/slider';

import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, updateDoc, deleteDoc, getDoc, setDoc, where, arrayUnion, increment, limit,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';

import { auth, firestore, storage } from '../firebase';
import avatarPlaceholder from '../assets/avatar-placeholder.jpg';
import Cambridge_logo from '../assets/Cambridge_logo.png';
import { Video, Audio } from 'expo-av'; 

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// single active audio (globally stop other tile when new one plays)
let GLOBAL_ACTIVE_SOUND = { id: null, sound: null };

/* ----------------- Helpers ----------------- */
const ext = (n='') => (n.split('.').pop()||'').toLowerCase();
const isPdf = (name, mime) => (mime||'').includes('application/pdf') || ext(name)==='pdf';
const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  const units = ['B','KB','MB','GB']; let i=0, v=bytes;
  while (v >= 1024 && i < units.length-1) { v/=1024; i++; }
  return `${v.toFixed(v>=10||i===0?0:1)} ${units[i]}`;
};
const ONLINE_WINDOW = 60_000;
const isOnlineNow = (onlineFlag, lastActive) => {
  const last = lastActive?.toDate ? lastActive.toDate().getTime() : (typeof lastActive === 'number' ? lastActive : 0);
  return !!onlineFlag || (last && Date.now() - last <= ONLINE_WINDOW);
};

// --- normalize names: never allow literal "User" ---
const normalizeName = (name) => {
  if (!name) return null;
  const s = String(name).trim();
  if (!s || /^user$/i.test(s)) return null;
  return s;
};

const nameFromUserDoc = (u={}) => normalizeName(
  u.displayName ||
  u.fullName ||
  u.name ||
  [u.firstName, u.lastName].filter(Boolean).join(' ')
);

const emailToNiceName = (email='') => {
  const base = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  return base ? base.replace(/\b\w/g, c => c.toUpperCase()) : email || null;
};

async function openWithChooser(remoteUrl, mimeType) {
  try {
    if (Platform.OS === 'android') {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: remoteUrl, type: mimeType || '*/*' });
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
      if (perm.status === 'granted') { await MediaLibrary.saveToLibraryAsync(uri); Alert.alert('Saved','Fayl galereyaga saqlandi.'); return true; }
    }
    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType, dialogTitle:'Save to device' }); return true; }
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
async function getUserDisplayName(uid) {
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    const u = snap.data() || {};
    const n = nameFromUserDoc(u);
    if (n) return n;
    if (u.email) return emailToNiceName(u.email);
  } catch {}
  return 'Direct chat';
}

/* Resolve display name for **current sender** (when creating a message) */
const resolveDisplayName = (uDoc = {}, authUser = null) => {
  const fromDoc = nameFromUserDoc(uDoc);
  const fromAuth = normalizeName(authUser?.displayName);
  const fromEmail = emailToNiceName(uDoc.email || authUser?.email || '');
  return fromDoc || fromAuth || fromEmail || 'Member';
};

/* ---- Interruption constants (fallbacks) ---- */
const IOS_INT_DO_NOT_MIX = Audio?.INTERRUPTION_MODE_IOS_DO_NOT_MIX ?? 1;
const AND_INT_DO_NOT_MIX = Audio?.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX ?? 1;

/* ---- Audio mode helpers ---- */
const setPlaybackAudioMode = async () => {
  const opts = Platform.select({
    ios: { allowsRecordingIOS:false, playsInSilentModeIOS:true, interruptionModeIOS:IOS_INT_DO_NOT_MIX, staysActiveInBackground:false },
    android: { allowsRecordingIOS:false, interruptionModeAndroid:AND_INT_DO_NOT_MIX, shouldDuckAndroid:true, playThroughEarpieceAndroid:false, staysActiveInBackground:false },
    default: {},
  });
  await Audio.setAudioModeAsync(opts);
};
const setRecordingAudioMode = async () => {
  const opts = Platform.select({
    ios: { allowsRecordingIOS:true, playsInSilentModeIOS:true, interruptionModeIOS:IOS_INT_DO_NOT_MIX, staysActiveInBackground:false },
    android: { allowsRecordingIOS:true, interruptionModeAndroid:AND_INT_DO_NOT_MIX, shouldDuckAndroid:true, playThroughEarpieceAndroid:false, staysActiveInBackground:false },
    default: {},
  });
  await Audio.setAudioModeAsync(opts);
};

/* ---- Mic permission ---- */
const ensureMicPermission = async () => {
  try {
    const cur = await Audio.getPermissionsAsync?.();
    if (cur?.granted) return true;
    const req = await Audio.requestPermissionsAsync?.();
    if (req?.granted) return true;

    if (req?.canAskAgain === false) {
      Alert.alert('Mikrofon bloklangan', 'Sozlamalardan mikrofon ruxsatini yoqing.', [
        { text: 'Sozlamalarni ochish', onPress: () => Linking.openSettings() },
        { text: 'Bekor', style: 'cancel' }
      ]);
    } else {
      Alert.alert('Ruxsat berilmadi', 'Mikrofonga ruxsat bermasangiz, ovoz yozib bo‘lmaydi.');
    }
  } catch (e) { Alert.alert('Xato', 'Ruxsatni olishda muammo: ' + String(e?.message || e)); }
  return false;
};

/* ===================== MAIN ===================== */
export default function ChatScreen({ route, navigation }) {
  const groupId = route?.params?.groupId ?? null;
  const dmId    = route?.params?.dmId ?? null;
  const initialGroupName = route?.params?.groupName ?? (dmId ? 'Direct chat' : 'Chat');

  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  /* -------- Auth -------- */
  const [currentUserId, setCurrentUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => { setCurrentUserId(u?.uid ?? null); setAuthReady(true); }), []);

  // current user role (to show "add person" to teacher/admin only)
  const [myRole, setMyRole] = useState(null);
  useEffect(() => {
    if (!currentUserId) return;
    const unsub = onSnapshot(doc(firestore, 'users', currentUserId), (s)=>{
      setMyRole(s.data()?.role || null);
    });
    return () => unsub && unsub();
  }, [currentUserId]);

  /* -------- Users cache (FIX for "User" name) -------- */
  const [usersCache, setUsersCache] = useState({}); // { uid: { name, email, avatar } }
  const mergeUsersCache = useCallback((up) => {
    setUsersCache(prev => ({ ...prev, ...up }));
  }, []);

  // helper: best name for a uid (ignores literal "User")
  const nameForUid = useCallback((uid, fallbackName=null) => {
    if (!uid) return normalizeName(fallbackName) || 'Member';
    const cached = usersCache[uid];
    const n = normalizeName(cached?.name);
    const fb = normalizeName(fallbackName);
    if (n) return n;
    if (fb) return fb;
    if (cached?.email) return emailToNiceName(cached.email) || 'Member';
    return 'Member';
  }, [usersCache]);

  const avatarForUid = useCallback((uid, fallbackUrl=null) => {
    return (usersCache[uid]?.avatar || fallbackUrl || null);
  }, [usersCache]);

  /* -------- Audio playback -------- */
  useEffect(() => { (async () => { try { await setPlaybackAudioMode(); } catch {} })(); }, []);

  /* -------- Presence -------- */
  const hb = useRef(null);
  const setPresence = useCallback(async (isOnline) => {
    if (!currentUserId) return;
    try {
      await setDoc(doc(firestore, 'users', currentUserId), { online: isOnline, lastActive: serverTimestamp() }, { merge: true });
      if (groupId) {
        await setDoc(doc(firestore, `groups/${groupId}/students`, currentUserId), { online: isOnline, lastActive: serverTimestamp() }, { merge: true });
      }
    } catch {}
  }, [currentUserId, groupId]);

  useEffect(() => {
    const startHB = () => { if (hb.current) clearInterval(hb.current); hb.current = setInterval(()=>setPresence(true), 25_000); };
    const stopHB  = () => { if (hb.current) { clearInterval(hb.current); hb.current = null; } };

    const sub = AppState.addEventListener('change', async (next) => {
      if (AppState.currentState?.match?.(/inactive|background/) && next === 'active') { await setPresence(true); startHB(); }
      else if (next?.match?.(/inactive|background/)) { await setPresence(false); stopHB(); }
    });

    setPresence(true); startHB();
    return () => { sub.remove(); stopHB(); setPresence(false); };
  }, [setPresence]);

  useFocusEffect(useCallback(() => {
    setPresence(true);
    const t = setInterval(()=>setPresence(true),25_000);
    return ()=>clearInterval(t);
  }, [setPresence]));

  /* -------- Title / members -------- */
  const [title, setTitle] = useState(initialGroupName);
  const [membersCount, setMembersCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [membersLoading, setMembersLoading] = useState(true);
  const [permError, setPermError] = useState(null);

  // whole members snapshot for modal + cache fill
  const [members, setMembers] = useState([]);
  const [groupMemberIds, setGroupMemberIds] = useState([]);

  useEffect(() => {
    if (!authReady || !currentUserId) return;

    if (dmId && !groupId) {
      (async () => {
        try {
          const dmSnap = await getDoc(doc(firestore, 'private_chats', dmId));
          const dm = dmSnap.data() || {};
          const otherId = (dm.participants || []).find((x) => x !== currentUserId);

          // fill users cache for both participants (DM fix)
          const ids = (dm.participants || []).filter(Boolean);
          const up = {};
          await Promise.all(ids.map(async (id) => {
            const ds = await getDoc(doc(firestore, 'users', id));
            const u = ds.data() || {};
            up[id] = {
              name: nameFromUserDoc(u),
              email: u.email || null,
              avatar: u.avatar || null
            };
          }));
          if (Object.keys(up).length) mergeUsersCache(up);

          setTitle(otherId ? nameForUid(otherId, await getUserDisplayName(otherId)) : 'Direct chat');
        } catch { setTitle('Direct chat'); }
      })();
      return;
    }

    if (!groupId) return;
    const gRef = doc(firestore, 'groups', groupId);
    const unsub = onSnapshot(gRef, (snap) => {
      if (snap.exists()) {
        const g = snap.data();
        if (g?.name) setTitle(g.name);
        setGroupMemberIds(Array.isArray(g?.memberIds) ? g.memberIds : []);
      }
    }, (err) => setPermError(err.message));
    return () => unsub();
  }, [authReady, groupId, dmId, currentUserId, mergeUsersCache, nameForUid]);

  useEffect(() => {
    if (!authReady || !currentUserId || !groupId) return;
    setMembersLoading(true);
    const unsub = onSnapshot(
      collection(firestore, `groups/${groupId}/students`),
      async (snap) => {
        const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        // fill users cache from group members (ignore literal "User")
        const up = {};
        rows.forEach(r => {
          const safeName = normalizeName(r.name);
          up[r.id] = {
            name: safeName,
            email: r.email || null,
            avatar: r.avatar || null
          };
        });
        if (Object.keys(up).length) mergeUsersCache(up);

        setMembers(rows.map(r => ({
          id: r.id,
          name: normalizeName(r.name) || emailToNiceName(r.email || '') || 'Member',
          avatar: r.avatar || null,
          online: isOnlineNow(r.online, r.lastActive),
          lastActive: r.lastActive || null,
          email: r.email || null,
        })));
        const online = rows.reduce((acc, r) => acc + (isOnlineNow(r.online, r.lastActive) ? 1 : 0), 0);
        setMembersCount(snap.size);
        setOnlineCount(online);
        setMembersLoading(false);
      },
      (err) => { setMembersLoading(false); setPermError(err.message); }
    );
    return () => unsub();
  }, [authReady, groupId, currentUserId, mergeUsersCache]);

  /* -------- Messages (stabilized incremental) -------- */
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const flatListRef = useRef(null);
  const msgsMapRef = useRef(new Map()); // id -> msg

  const clearMessagesStore = () => { msgsMapRef.current = new Map(); setMessages([]); };

  useEffect(() => {
    if (!authReady || !currentUserId) return;
    setLoadingMsgs(true); setPermError(null);
    clearMessagesStore();

    let qRef;
    if (groupId) qRef = query(
      collection(firestore, `group_chats/${groupId}/messages`),
      orderBy('createdAtMs','desc'),
      limit(300)
    );
    else if (dmId) qRef = query(
      collection(firestore, `private_chats/${dmId}/messages`),
      orderBy('createdAtMs','desc'),
      limit(300)
    );
    else qRef = query(
      collection(firestore, 'chats'),
      orderBy('createdAtMs','desc'),
      limit(300)
    );

    const unsub = onSnapshot(qRef,
      (snap) => {
        const map = msgsMapRef.current;

        // apply only changes (no full array replace) → less flicker
        snap.docChanges().forEach((ch) => {
          const id = ch.doc.id;
          if (ch.type === 'removed') {
            map.delete(id);
            return;
          }
          const data = ch.doc.data({ serverTimestamps: 'estimate' });
          // normalize createdAtMs if missing (for very old msgs)
          const createdAtMs = typeof data.createdAtMs === 'number'
            ? data.createdAtMs
            : (data.createdAt?.toMillis?.() ?? 0);
          map.set(id, { id, ...data, createdAtMs });
        });

        // stable sorting: createdAtMs desc → tie-break by id
        const next = Array.from(map.values()).sort((a,b) => {
          const am = a.createdAtMs ?? (a.createdAt?.toMillis?.() ?? 0);
          const bm = b.createdAtMs ?? (b.createdAt?.toMillis?.() ?? 0);
          if (bm !== am) return bm - am;
          // tie-break with id to keep order stable between updates
          return b.id.localeCompare(a.id);
        });

        setMessages(next);
        setLoadingMsgs(false);
      },
      (err) => { setPermError(err.message); setLoadingMsgs(false); }
    );
    return () => { unsub(); clearMessagesStore(); };
  }, [authReady, groupId, dmId, currentUserId]);

  const scrollToBottom = () => flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  const [showScrollDown, setShowScrollDown] = useState(false);
  const onListScroll = (e) => setShowScrollDown((e.nativeEvent?.contentOffset?.y || 0) > 120);

  /* -------- Upload & previews -------- */
  const [inputText, setInputText] = useState('');
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
      setFilePreview({ uri:a.uri, type:a.type==='video'?'video':'image', name:(a.fileName || a.uri.split('/').pop() || '').split('?')[0] });
      setImagePreviewOpen(true);
    }
  };
  const pickDocument = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.assets?.length) {
      const f = r.assets[0];
      const mime = f.mimeType || '';
      const isAudio = mime.startsWith('audio/');
      setFilePreview({ uri:f.uri, type:isAudio?'audio':'file', name:f.name || 'file', size:f.size || null, mimeType:mime || (isAudio?'audio/mpeg':undefined) });
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

  const sendMessage = async (content, type='text', name=null, meta=null) => {
    if (!currentUserId) return Alert.alert('Xato', 'Foydalanuvchi aniqlanmadi.');
    if (type === 'text' && !editingId && !content?.trim()) return;

    let replyTo = null;
    if (replyTarget) {
      // safe preview + robust sender name
      let safe = '';
      if (replyTarget.type === 'text') safe = (replyTarget.text || '').slice(0,120);
      else if (replyTarget.type === 'image') safe = '🖼️ Image';
      else if (replyTarget.type === 'video') safe = '🎬 Video';
      else if (replyTarget.type === 'audio') safe = `🎵 Audio: ${replyTarget.name || ''}`.trim();
      else safe = `📎 File: ${replyTarget.name || ''}`.trim();

      const replySender = nameForUid(replyTarget.senderId, replyTarget.senderName);
      replyTo = { id: replyTarget.id, senderId: replyTarget.senderId || null, text: safe, senderName: replySender };
    }

    const us = await getDoc(doc(firestore, 'users', currentUserId));
    const u = us.data() || {};

    const nowMs = Date.now(); // 🔑 barqaror tartib uchun
    const payload = {
      text: content || '',
      senderId: currentUserId,
      senderName: resolveDisplayName(u, auth.currentUser), // never "User"
      avatar: u.avatar || auth.currentUser?.photoURL || null,
      type, name: name || null,
      size: meta?.size ?? null, mimeType: meta?.mimeType ?? null,
      replyTo,
      createdAtMs: nowMs,                 // <—— sort uchun
      createdAt: serverTimestamp(),       // UI-da ko‘rsatish uchun
      timestamp: serverTimestamp(),
    };

    if (editingId) {
      await updateDoc(
        groupId ? doc(firestore, `group_chats/${groupId}/messages`, editingId)
        : dmId   ? doc(firestore, `private_chats/${dmId}/messages`, editingId)
                 : doc(firestore, 'chats', editingId),
        { text: content, type, name, size: payload.size, mimeType: payload.mimeType }
      );
      setEditingId(null);
    } else {
      const coll = groupId
        ? collection(firestore, `group_chats/${groupId}/messages`)
        : dmId
        ? collection(firestore, `private_chats/${dmId}/messages`)
        : collection(firestore, 'chats');

      await addDoc(coll, payload);

      const lastText = type === 'text' ? payload.text
        : type === 'image' ? '🖼️ Image'
        : type === 'video' ? '🎬 Video'
        : type === 'audio' ? '🎵 Audio'
        : '📎 File';

      if (groupId) {
        await updateDoc(doc(firestore, 'groups', groupId), { lastMessage: lastText, lastMessageAt: serverTimestamp() }).catch(()=>{});
      } else if (dmId) {
        await setDoc(doc(firestore, 'private_chats', dmId), { lastMessage: lastText, lastSender: currentUserId, updatedAt: serverTimestamp() }, { merge: true }).catch(()=>{});
      }
      await setPresence(true);
    }

    setInputText('');
    setReplyTarget(null);
  };

  const handleDelete = (id) => {
    Alert.alert('O‘chirish', 'Xabarni o‘chirishni tasdiqlang', [
      { text: 'Bekor', style: 'cancel' },
      { text: 'Ha', style: 'destructive', onPress: async () =>
        await deleteDoc(groupId ? doc(firestore, `group_chats/${groupId}/messages`, id)
          : dmId ? doc(firestore, `private_chats/${dmId}/messages`, id)
                 : doc(firestore, 'chats', id))
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
    setReplyTarget({
      id: msg.id,
      senderId: msg.senderId,
      text: msg.text,
      senderName: msg.senderName,
      type: msg.type,
      name: msg.name
    });
  };

  /* -------- Voice: hold to record -------- */
  const [recording, setRecording] = useState(null);
  const [recActive, setRecActive] = useState(false);
  const [recCanceled, setRecCanceled] = useState(false);
  const [recSecs, setRecSecs] = useState(0);

  const recTimerRef   = useRef(null);
  const recStartX     = useRef(0);

  const stateRef      = useRef('idle');  // 'idle'|'starting'|'recording'|'stopping'
  const wantStopRef   = useRef(false);
  const wantCancelRef = useRef(false);

  const startTimer = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = setInterval(() => setRecSecs((s)=>s+1), 1000);
  };
  const stopTimer = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
  };

  const cleanupToIdle = async () => {
    try { if (recording) await recording.stopAndUnloadAsync(); } catch {}
    setRecording(null);
    setRecActive(false);
    setRecSecs(0);
    setRecCanceled(false);
    wantStopRef.current = false;
    wantCancelRef.current = false;
    stateRef.current = 'idle';
    stopTimer();
    try { await setPlaybackAudioMode(); } catch {}
  };

  const beginRecording = async () => {
    try {
      if (stateRef.current !== 'idle') return;
      stateRef.current = 'starting';

      if (Platform.OS === 'web') { Alert.alert('Cheklov', 'Webda ovoz yozish qo‘llanmaydi.'); stateRef.current='idle'; return; }
      const ok = await ensureMicPermission(); if (!ok) { stateRef.current='idle'; return; }

      await setRecordingAudioMode();
      try { if (recording) await recording.stopAndUnloadAsync(); } catch {}

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();

      setRecording(rec);
      setRecActive(true);
      setRecCanceled(false);
      setRecSecs(0);
      startTimer();

      stateRef.current = 'recording';

      if (wantStopRef.current) {
        if (wantCancelRef.current) await cancelRecording();
        else await finishRecordingAndSend();
      }
    } catch (e) {
      await cleanupToIdle();
      Alert.alert('Mic', 'Mikrofonni yoqib bo‘lmadi: ' + String(e?.message || e));
    }
  };

  const cancelRecording = async () => {
    if (stateRef.current === 'idle') return;
    stateRef.current = 'stopping';
    try { if (recording) await recording.stopAndUnloadAsync(); } catch {}
    await cleanupToIdle();
  };

  const finishRecordingAndSend = async () => {
    if (stateRef.current === 'starting') { wantStopRef.current = true; return; }
    if (stateRef.current !== 'recording' || !recording) return;

    stateRef.current = 'stopping';
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      stopTimer();
      setRecActive(false);
      setRecording(null);

      if (!uri || recCanceled || recSecs < 1) { await cleanupToIdle(); return; }

      const e = (ext(uri) || 'm4a');
      const ct = e === '3gp' || e === '3gpp' ? 'audio/3gpp' : e === 'amr' ? 'audio/amr' : 'audio/m4a';
      const ts = Date.now();
      const path = `${pathBase()}/audios/${ts}.m4a`;

      const url = await uploadWithProgress(uri, path, ct);
      await sendMessage(url, 'audio', 'voice.m4a', { mimeType: ct });
    } catch {}
    await cleanupToIdle();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current !== 'idle',
      onMoveShouldSetPanResponder: () => stateRef.current !== 'idle',
      onPanResponderGrant: (_, g) => { recStartX.current = g.moveX; },
      onPanResponderMove: (_, g) => {
        const dx = g.moveX - recStartX.current;
        const cancel = dx < -60;
        wantCancelRef.current = cancel;
        setRecCanceled(cancel);
      },
      onPanResponderRelease: async () => {
        if (stateRef.current === 'starting') { wantStopRef.current = true; return; }
        if (wantCancelRef.current) await cancelRecording();
        else await finishRecordingAndSend();
      },
    })
  ).current;

  const onMicPressIn  = () => { wantStopRef.current = false; wantCancelRef.current = false; beginRecording(); };
  const onMicPressOut = async () => {
    if (stateRef.current === 'starting') { wantStopRef.current = true; return; }
    if (stateRef.current === 'recording') {
      if (wantCancelRef.current || recCanceled) await cancelRecording();
      else await finishRecordingAndSend();
    }
  };

  /* ====== ADD PEOPLE (teacher roster) + MEMBERS modal ====== */
  const [addOpen, setAddOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const [roster, setRoster] = useState([]); // teacher students
  const [searchAdd, setSearchAdd] = useState('');
  const [pickedIds, setPickedIds] = useState([]);

  // teacher roster stream
  useEffect(() => {
    if (!groupId || !currentUserId) return;
    const qStu = query(
      collection(firestore, 'users'),
      where('role', '==', 'student'),
      where('teacherId', '==', currentUserId)
    );
    const unsub = onSnapshot(qStu, (snap) => {
      const arr = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setRoster(arr);
    });
    return () => unsub();
  }, [groupId, currentUserId]);

  const filteredRoster = useMemo(() => {
    const q = searchAdd.trim().toLowerCase();
    const inGroup = new Set(groupMemberIds || []);
    return roster
      .map(r => {
        const safeName = nameFromUserDoc(r) || emailToNiceName(r.email || '') || 'Student';
        return {
          id: r.id,
          name: safeName,
          email: r.email || '',
          avatar: r.avatar || null,
          online: isOnlineNow(r.online, r.lastActive),
          inGroup: inGroup.has(r.id),
        };
      })
      .filter(r =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.email && r.email.toLowerCase().includes(q))
      )
      .sort((a,b)=> Number(b.online)-Number(a.online));
  }, [roster, searchAdd, groupMemberIds]);

  const togglePick = (id) =>
    setPickedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addSelectedToGroup = async () => {
    const toAdd = pickedIds.filter(id => !(groupMemberIds || []).includes(id));
    if (toAdd.length === 0) { setAddOpen(false); setPickedIds([]); return; }
    try {
      await updateDoc(doc(firestore, 'groups', groupId), {
        memberIds: arrayUnion(...toAdd),
        membersCount: increment(toAdd.length),
      }).catch(()=>{});

      await Promise.all(
        toAdd.map(async (uid) => {
          const u = roster.find(r => r.id === uid) || {};
          await setDoc(doc(firestore, `groups/${groupId}/students`, uid), {
            name: nameFromUserDoc(u) || emailToNiceName(u.email || '') || 'Student',
            email: u.email || null,
            avatar: u.avatar || null,
            online: isOnlineNow(u.online, u.lastActive),
            lastActive: serverTimestamp(),
            addedAt: serverTimestamp(),
          }, { merge: true });
        })
      );

      setAddOpen(false);
      setPickedIds([]);
      setSearchAdd('');
      Alert.alert('OK', 'Tanlangan o‘quvchilar guruhga qo‘shildi.');
    } catch (e) {
      Alert.alert('Xato', e?.message || 'Qo‘shib bo‘lmadi');
    }
  };

  const ensureDMAndNavigate = async (peerId) => {
    if (!peerId || !currentUserId) return;
    const a = currentUserId, b = peerId;
    const dm = a < b ? `${a}_${b}` : `${b}_${a}`;
    try {
      await setDoc(doc(firestore, 'private_chats', dm), {
        participants: [a, b],
        updatedAt: serverTimestamp(),
        lastMessage: null,
        lastSender: null,
      }, { merge: true });
    } catch {}
    navigation.navigate('Chat2', { dmId: dm, peerId: peerId, teacherId: currentUserId });
  };

  /* -------- Item renderer -------- */
  const isAudioMsg = (m) =>
    m?.type === 'audio' ||
    (m?.mimeType && String(m.mimeType).startsWith('audio/')) ||
    /\.(mp3|m4a|aac|wav|ogg|3gp|amr)$/i.test(m?.name || '');

  const fmtTime = (ts) => { if (!ts?.toDate) return ''; const d = ts.toDate(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUserId;

    // 🔧 name + avatar with robust fallbacks (avoid literal "User")
    const displayName = isMe ? 'Siz' : nameForUid(item.senderId, item.senderName);
    const avatarUrl = avatarForUid(item.senderId, item.avatar);
    const avatarSource = avatarUrl ? { uri: avatarUrl } : avatarPlaceholder;

    const replyName = !!item.replyTo
      ? (normalizeName(item.replyTo.senderName) || nameForUid(item.replyTo.senderId, item.replyTo.senderName))
      : null;

    return (
      <View style={[styles.msgRow, isMe ? { justifyContent:'flex-end' } : { justifyContent:'flex-start' }]}>
        {!isMe && <Image source={avatarSource} style={styles.avatar} />}

        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <View style={styles.topRow}>
            <Text style={[styles.sender, isMe ? styles.senderMe : styles.senderOther]}>{displayName}</Text>
            <Text style={[styles.time, isMe?{color:'#E5E7EB'}:{color:'#9CA3AF'}]}>{fmtTime(item.createdAt || item.timestamp)}</Text>
          </View>

          {!!item.replyTo && (
            <View style={styles.replyBox}>
              <Text style={styles.replySender}>{replyName || 'Reply'}</Text>
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

          {isAudioMsg(item) ? (
            <ChatAudioTile id={item.id} name={item.name || 'Audio'} url={item.text} size={item.size} isMe={isMe} />
          ) : item.type==='file' ? (
            <FileTile name={item.name||'File'} url={item.text} size={item.size} mimeType={item.mimeType} isMe={isMe} />
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => handleReply(item)}><Text style={styles.replyLink}>Reply</Text></TouchableOpacity>
            {isMe && (
              <View style={{ flexDirection:'row' }}>
                {item.type==='text' && (
                  <TouchableOpacity onPress={() => handleEdit(item)} style={{ marginLeft:12 }}>
                    <MaterialCommunityIcons name="pencil" size={16} color="#FDE4E2" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft:12 }}>
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

  /* ----------- RETURN UI ----------- */
  if (!authReady) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop:8 }}>Authenticating…</Text>
      </View>
    );
  }

  const canAddPeople = !!groupId && (myRole === 'teacher' || myRole === 'admin');

  return (
    <KeyboardAvoidingView
      style={{ flex:1, backgroundColor:'#F8FAFC' }}
      behavior={Platform.OS==='ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS==='ios' ? headerHeight : 0}
    >
      {/* Header */}
      <View style={styles.groupHeaderCard}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={{ paddingRight:8, paddingVertical:2 }}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>

          {!!groupId && (
            <TouchableOpacity onPress={() => setMembersOpen(true)} style={styles.membersPill}>
              <MaterialCommunityIcons name="account-group" size={16} color="#FDE4E2" />
              <Text style={styles.membersPillTx}>{membersCount}</Text>
            </TouchableOpacity>
          )}

          {canAddPeople && (
            <TouchableOpacity onPress={() => setAddOpen(true)} style={{ marginLeft:8 }}>
              <MaterialCommunityIcons name="account-plus" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!!groupId && (
        <View style={styles.subHeaderShadowWrap}>
          <View style={styles.subHeaderInner}>
            <View style={styles.onlineDotNew} />
            <Text style={styles.subHeaderText}>
              {membersLoading ? 'Loading members…' : `${onlineCount} online now`}
            </Text>
          </View>
        </View>
      )}

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
              inverted
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              contentContainerStyle={{ paddingHorizontal:10, paddingTop:10, paddingBottom:12 + insets.bottom }}
              onScroll={onListScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS==='ios' ? 'interactive' : 'on-drag'}
              ListEmptyComponent={<View style={{ padding:20, alignItems:'center' }}><Text>Hali xabar yo‘q. Birinchi xabarni yozing.</Text></View>}
              removeClippedSubviews={false}
              initialNumToRender={20}
              windowSize={12}
              maxToRenderPerBatch={16}
            />
          )}

          {showScrollDown && (
            <TouchableOpacity style={styles.scrollBtn} onPress={scrollToBottom}>
              <MaterialCommunityIcons name="arrow-down" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Recording HUD */}
          {stateRef.current !== 'idle' && recActive && (
            <View style={[styles.recordHud, (recCanceled||wantCancelRef.current) && styles.recordHudCanceled]}>
              <MaterialCommunityIcons name="microphone" size={18} color="#fff" />
              <Text style={styles.recordHudText}>
                {(recCanceled||wantCancelRef.current) ? 'Cancel' :
                  `Recording ${String(Math.floor(recSecs/60)).padStart(1,'0')}:${String(recSecs%60).padStart(2,'0')} • slide left to cancel`}
              </Text>
            </View>
          )}

          {/* Reply draft chip */}
          {replyTarget && (
            <View style={styles.replyDraftBar}>
              <View style={styles.replyDraftStrip} />
              <View style={{ flex:1 }}>
                <Text style={styles.replyDraftName}>
                  {nameForUid(replyTarget.senderId, replyTarget.senderName)}
                </Text>
                <Text style={styles.replyDraftText} numberOfLines={1}>
                  {replyTarget.type === 'text'
                    ? (replyTarget.text || '')
                    : replyTarget.type === 'image' ? '🖼️ Image'
                    : replyTarget.type === 'video' ? '🎬 Video'
                    : replyTarget.type === 'audio' ? `🎵 Audio: ${replyTarget.name||''}`
                    : `📎 File: ${replyTarget.name||''}`
                  }
                </Text>
              </View>
              <TouchableOpacity onPress={()=>setReplyTarget(null)} style={{ padding:6 }}>
                <MaterialCommunityIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input row */}
          <View style={[styles.inputRow, { paddingBottom: Math.max(10, 10 + insets.bottom/2) }]} >
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
              onSubmitEditing={() => sendMessage(inputText)}
            />

            {/* Mic: hold to record + slide to cancel */}
            <View {...panResponder.panHandlers}>
              <TouchableOpacity
                onPressIn={onMicPressIn}
                onPressOut={onMicPressOut}
                activeOpacity={0.9}
                style={[styles.sendButton, { backgroundColor: recActive ? '#EF4444' : '#9CA3AF', marginRight: 8 }]}
              >
                <MaterialCommunityIcons name="microphone" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => sendMessage(inputText)} style={styles.sendButton}>
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* Full image modal */}
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

      {/* ADD PEOPLE MODAL (teacher roster) */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Guruhga odam qo‘shish</Text>

            <View style={[styles.searchRow, { marginTop: 10 }]}>
              <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
              <TextInput
                placeholder="Students izlash..."
                value={searchAdd}
                onChangeText={setSearchAdd}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>

            <View style={{ marginTop: 12, maxHeight: 360 }}>
              {filteredRoster.length === 0 ? (
                <Text style={{ color: '#6B7280' }}>Ro‘yxat bo‘sh.</Text>
              ) : (
                <FlatList
                  data={filteredRoster}
                  keyExtractor={(it) => it.id}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  renderItem={({ item }) => {
                    const picked = pickedIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        onPress={() => !item.inGroup && togglePick(item.id)}
                        activeOpacity={item.inGroup ? 1 : 0.8}
                        style={styles.pickRow}
                      >
                        <View style={[styles.dot, { backgroundColor: item.online ? '#22C55E' : '#9CA3AF' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{item.name}</Text>
                          {!!item.email && <Text style={{ color: '#6B7280', marginTop: 2, fontSize: 12 }}>{item.email}</Text>}
                        </View>

                        {item.inGroup ? (
                          <View style={styles.inGroupChip}><Text style={styles.inGroupTx}>In group</Text></View>
                        ) : (
                          <MaterialCommunityIcons
                            name={picked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                            size={22}
                            color={picked ? "#0D47A1" : "#9CA3AF"}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setAddOpen(false)}>
                <Text style={styles.modalCancelText}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalCreate,
                  (pickedIds.length === 0) && { opacity: 0.6 },
                  { marginLeft: 10 }
                ]}
                onPress={addSelectedToGroup}
                disabled={pickedIds.length === 0}
              >
                <Text style={styles.modalCreateText}>
                  Qo‘shish{pickedIds.length ? ` • ${pickedIds.length}` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MEMBERS MODAL */}
      <Modal visible={membersOpen} transparent animationType="fade" onRequestClose={() => setMembersOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Guruh a’zolari</Text>

            <View style={{ marginTop: 8, maxHeight: 420 }}>
              {members.length === 0 ? (
                <Text style={{ color: '#6B7280' }}>A’zolar topilmadi.</Text>
              ) : (
                <FlatList
                  data={[...members].sort((a,b)=> Number(b.online)-Number(a.online))}
                  keyExtractor={(it) => it.id}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        if (item.id !== currentUserId) ensureDMAndNavigate(item.id);
                      }}
                      style={styles.memberRow}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.dot, { backgroundColor: item.online ? '#22C55E' : '#9CA3AF' }]} />
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color:'#0F172A' }} numberOfLines={1}>
                          {item.name || 'Member'}
                        </Text>
                        {!!item.email && <Text style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{item.email}</Text>}
                      </View>
                      <MaterialCommunityIcons name="message-reply-text" size={18} color="#0D47A1" />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>

            <View style={{ alignItems:'flex-end', marginTop: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor:'#f3f4f6' }]} onPress={()=>setMembersOpen(false)}>
                <Text style={{ fontWeight:'700', color:'#111827' }}>Yopish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ===== FILE tile ===== */
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
    <TouchableOpacity onPress={onTap} onLongPress={onLong} delayLongPress={220} activeOpacity={0.9}
      style={[styles.fileTile, isMe ? styles.fileTileMe : styles.fileTileOther]}>
      <View style={[styles.fileIconWrap, pdf && { backgroundColor:'#FEE2E2' }]}>
        <MaterialCommunityIcons name={pdf ? 'file-pdf-box' : 'paperclip'} size={20} color={pdf ? '#B91C1C' : '#0D47A1'} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
        <Text style={styles.fileMeta} numberOfLines={1}>{formatBytes(size) || (mimeType || '').split('/').pop()?.toUpperCase() || 'FILE'}</Text>
      </View>
      {!local && <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" style={{ marginLeft:6 }} />}
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
        if ('positionMillis' in st) setPosition(st.positionMillis || 0);
        if ('durationMillis' in st && st.durationMillis) setDuration(st.durationMillis);
        if (st.isLoaded) {
          setIsPlaying(!!st.isPlaying);
          if (st.didJustFinish) { setIsPlaying(false); setPosition(0); }
        }
      });
      setSound(s);
      return s;
    } catch (e) {
      Alert.alert('Audio error', String(e?.message || e));
      try { await s.unloadAsync(); } catch {}
      throw e;
    } finally { setLoading(false); }
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
        await s.pauseAsync(); setIsPlaying(false);
      } else {
        GLOBAL_ACTIVE_SOUND = { id, sound: s };
        await s.playAsync(); setIsPlaying(true);
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
  const fmt = (ms) => { const total = Math.floor((ms||0)/1000); const m=Math.floor(total/60), s=total%60; return `${m}:${String(s).padStart(2,'0')}`; };

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
          value={positionSec}
          onSlidingComplete={onSeek}
          minimumTrackTintColor="#0D47A1"
          maximumTrackTintColor="#CBD5E1"
          thumbTintColor="#0D47A1"
        />
        <View style={styles.audioMetaRow}>
          <Text style={styles.fileMeta}>
            {duration ? `${fmt(position)} / ${fmt(duration)}` : (size ? `${formatBytes(size)} • Audio` : 'Audio')}
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
    marginTop:8
  },
  headerRow:{ flexDirection:'row', alignItems:'center' },
  headerTitle:{ color:'#fff', fontWeight:'800', fontSize:16, maxWidth:SCREEN_W*0.46, flex:1 },

  membersPill:{
    flexDirection:'row', alignItems:'center',
    backgroundColor:'#B91C1C', borderWidth:1, borderColor:'#FDE4E2',
    paddingHorizontal:8, paddingVertical:4, borderRadius:999
  },
  membersPillTx:{ color:'#FDE4E2', fontWeight:'800', marginLeft:6, fontSize:12 },

  subHeaderShadowWrap:{
    marginHorizontal:16, marginTop:8, backgroundColor:'#fff', borderRadius:14,
    paddingVertical:8, paddingHorizontal:12,
    shadowColor:'#000', shadowOpacity:0.12, shadowRadius:5, shadowOffset:{ width:0, height:3 }, elevation:6,
  },
  subHeaderInner:{ flexDirection:'row', alignItems:'center' },
  onlineDotNew:{ width:10, height:10, borderRadius:5, backgroundColor:'#22C55E', marginRight:8 },
  subHeaderText:{ color:'#111827', fontSize:13, fontWeight:'800' },

  /* Messages */
  msgRow:{ flexDirection:'row', alignItems:'flex-end', marginVertical:6, paddingHorizontal:6 },
  avatar:{ width:28, height:28, borderRadius:14, backgroundColor:'#e5e7eb' },

  bubble:{ maxWidth:'78%', padding:8, borderRadius:RADIUS, marginHorizontal:8,
    shadowColor:'#000', shadowOpacity:0.06, shadowRadius:3, shadowOffset:{ width:0, height:1 }, elevation:1 },
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
  audioTileMe:{ alignSelf:'end', backgroundColor:'#DDEAFE' },
  playBtn:{ width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center', marginRight:10 },

  audioContent:{ flex:1, minWidth:120 },
  audioSlider:{ width:'100%', height:28, marginTop:2 },
  audioMetaRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:2 },

  /* Input */
  replyDraftBar:{
    marginHorizontal:10, marginTop:6,
    backgroundColor:'#F1F5F9',
    borderLeftWidth:3, borderLeftColor:'#0D47A1',
    borderRadius:12, paddingHorizontal:10, paddingVertical:8,
    flexDirection:'row', alignItems:'center'
  },
  replyDraftStrip:{ width:0, height:0 },
  replyDraftName:{ fontWeight:'800', color:'#0F172A', fontSize:12 },
  replyDraftText:{ color:'#475569', fontSize:12, marginTop:2 },

  inputRow:{ flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingTop:8, borderTopWidth:1, borderColor:'#E5E7EB', backgroundColor:'#fff' },
  input:{ flex:1, borderRadius:22, borderWidth:1, borderColor:'#E5E7EB', marginHorizontal:10, paddingHorizontal:15, paddingVertical:Platform.OS==='ios'?10:8, color:'#111827', backgroundColor:'#F9FAFB' },
  sendButton:{ backgroundColor:'#B91C1C', paddingVertical:10, paddingHorizontal:12, borderRadius:20, justifyContent:'center' },

  /* Recording HUD */
  recordHud:{ position:'absolute', left:14, right:14, bottom:88, backgroundColor:'#0D47A1', borderRadius:12, paddingVertical:8, paddingHorizontal:12, flexDirection:'row', alignItems:'center' },
  recordHudCanceled:{ backgroundColor:'#EF4444' },
  recordHudText:{ color:'#fff', fontWeight:'700', marginLeft:8 },

  /* Modals shared */
  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'center', alignItems:'center', padding:16 },
  modalCard:{ width:'100%', maxWidth:520, backgroundColor:'#fff', borderRadius:16, padding:16 },
  modalTitle:{ fontSize:18, fontWeight:'800', color:'#111827' },
  searchRow:{
    flexDirection:'row', alignItems:'center',
    backgroundColor:'#fff', borderRadius:10, paddingHorizontal:10, paddingVertical:8,
    borderWidth:1, borderColor:'#E5E7EB',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalCancel: { backgroundColor: '#f3f4f6' },
  modalCreate: { backgroundColor: '#0D47A1' },
  modalCancelText: { color: '#111827', fontWeight: '700' },
  modalCreateText: { color: '#fff', fontWeight: '700' },

  // rows for add/members
  pickRow:{
    backgroundColor:'#F9FAFB', borderRadius:10, padding:12,
    flexDirection:'row', alignItems:'center', gap:10
  },
  memberRow:{
    backgroundColor:'#F9FAFB', borderRadius:10, padding:12,
    flexDirection:'row', alignItems:'center', gap:10
  },
  dot:{ width:10, height:10, borderRadius:5 },

  inGroupChip:{ backgroundColor:'#EEF2FF', paddingHorizontal:10, paddingVertical:4, borderRadius:999 },
  inGroupTx:{ color:'#0F172A', fontWeight:'800', fontSize:12 },

  /* Full image modal */
  modalContainer:{ backgroundColor:'rgba(0,0,0,0.9)', flex:1, justifyContent:'center', alignItems:'center' },
  fullImage:{ width:'100%', height:'100%', resizeMode:'contain' },

  /* Preview card */
  previewCard:{ width:'100%', maxWidth:480, backgroundColor:'#fff', borderRadius:16, padding:16 },
  previewTitle:{ fontSize:16, fontWeight:'800', color:'#111827', marginBottom:10 },
  rBtn:{ paddingVertical:10, paddingHorizontal:16, borderRadius:10 },

  /* BG + scroll button */
  bg:{ flex:1, justifyContent:'flex-end' },
  bgImage:{ opacity:0.12, resizeMode:'contain' },
  scrollBtn:{ position:'absolute', right:16, bottom:86, backgroundColor:'#B91C1C', width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', elevation:4 },
});
