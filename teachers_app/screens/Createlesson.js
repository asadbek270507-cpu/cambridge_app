// screens/CreateLesson.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { firestore, storage } from '../../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export default function CreateLesson({ route }) {
  const { level, category } = route.params;

  const [lessons, setLessons] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [comment, setComment] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState({ image: false, video: false, pdf: false, audio: false });
  const [progress, setProgress] = useState({ image: 0, video: 0, pdf: 0, audio: 0 });

  // Collection memoga qo'yildi — effect qayta ulanib-uzilmasin
  const lessonsCollection = useMemo(
    () => collection(doc(firestore, `${category}Materials`, level), 'lessons'),
    [category, level]
  );

  useEffect(() => {
    const q = query(lessonsCollection, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [lessonsCollection]);

  const resetForm = () => {
    setTitle('');
    setVideoUrl('');
    setPdfUrl('');
    setImageUrl('');
    setAudioUrl('');
    setComment('');
    setEditingId(null);
    setModalVisible(false);
    setProgress({ image: 0, video: 0, pdf: 0, audio: 0 });
    setLoading({ image: false, video: false, pdf: false, audio: false });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Xato', 'Sarlavha majburiy!');
      return;
    }
    if (Object.values(loading).some(Boolean)) {
      Alert.alert('Diqqat', 'Fayl yuklanishi tugaguncha kuting.');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(lessonsCollection, editingId), {
          title,
          videoUrl,
          pdfUrl,
          imageUrl,
          audioUrl,
          comment,
        });
        Alert.alert('Success', 'Dars yangilandi!');
      } else {
        await addDoc(lessonsCollection, {
          title,
          videoUrl,
          pdfUrl,
          imageUrl,
          audioUrl,
          comment,
          createdAt: serverTimestamp(),
        });
        Alert.alert('Success', 'Dars qo‘shildi!');
      }
      resetForm();
    } catch (err) {
      Alert.alert('Xato', err?.message || String(err));
    }
  };

  const handleEdit = (lesson) => {
    setTitle(lesson.title);
    setVideoUrl(lesson.videoUrl || '');
    setPdfUrl(lesson.pdfUrl || '');
    setImageUrl(lesson.imageUrl || '');
    setAudioUrl(lesson.audioUrl || '');
    setComment(lesson.comment || '');
    setEditingId(lesson.id);
    setModalVisible(true);
  };

  const handleDelete = (id) => {
    Alert.alert('Confirm Delete', 'Ishonchingiz komilmi?', [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'O‘chirish',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(lessonsCollection, id));
            Alert.alert('Deleted', 'Dars o‘chirildi');
          } catch (err) {
            Alert.alert('Xato', err?.message || String(err));
          }
        },
      },
    ]);
  };

  /* ---------- FILE PICK + UPLOAD HELPERS ---------- */
  const uriToBlob = async (uri) => {
    const res = await fetch(uri);
    return await res.blob();
  };

  const uploadWithProgress = async ({ file, folder = 'uploads', kind }) => {
    setLoading((s) => ({ ...s, [kind]: true }));
    setProgress((p) => ({ ...p, [kind]: 0 }));

    try {
      const ext = (file.name?.split('.').pop() || '').toLowerCase() || 'bin';
      const ts = Date.now();
      const path = `${folder}/${ts}_${Math.random().toString(36).slice(2)}.${ext}`;

      const storageRef_ = ref(storage, path);
      const blob = await uriToBlob(file.uri);
      const uploadTask = uploadBytesResumable(storageRef_, blob, {
        contentType: file.mime || undefined,
      });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setProgress((p) => ({ ...p, [kind]: pct }));
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const url = await getDownloadURL(storageRef_);
      return url;
    } finally {
      setLoading((s) => ({ ...s, [kind]: false }));
    }
  };

  const pickImageOrVideo = async (mediaTypes) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Ruxsat', 'Galereyaga ruxsat berilmadi');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes, // ImagePicker.MediaTypeOptions.*
      quality: 0.9,
    });
    if (result.canceled) return null;
    const a = result.assets?.[0];
    if (!a) return null;
    return { uri: a.uri, name: a.fileName || 'media', mime: a.mimeType };
  };

  const pickDocument = async (types = ['*/*']) => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: types,
    });
    if (result.canceled) return null;
    const f = result.assets?.[0];
    if (!f) return null;
    return { uri: f.uri, name: f.name, mime: f.mimeType };
  };

  const handlePickUploadImage = async () => {
    try {
      const picked = await pickImageOrVideo(ImagePicker.MediaTypeOptions.Images);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'images', kind: 'image' });
      setImageUrl(url);
    } catch (e) {
      Alert.alert('Xato', e?.message || String(e));
    }
  };
  const handlePickUploadVideo = async () => {
    try {
      const picked = await pickImageOrVideo(ImagePicker.MediaTypeOptions.Videos);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'videos', kind: 'video' });
      setVideoUrl(url);
    } catch (e) {
      Alert.alert('Xato', e?.message || String(e));
    }
  };
  const handlePickUploadPDF = async () => {
    try {
      const picked = await pickDocument(['application/pdf']);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'pdfs', kind: 'pdf' });
      setPdfUrl(url);
    } catch (e) {
      Alert.alert('Xato', e?.message || String(e));
    }
  };
  const handlePickUploadAudio = async () => {
    try {
      const picked = await pickDocument(['audio/*']);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'audios', kind: 'audio' });
      setAudioUrl(url);
    } catch (e) {
      Alert.alert('Xato', e?.message || String(e));
    }
  };
  /* ----------------------------------------------- */

  const MediaButton = ({ icon, tint, label, value, onPress, busy, pct }) => (
    <TouchableOpacity style={[styles.input, styles.mediaBtn]} onPress={onPress} disabled={busy}>
      <View style={styles.mediaBtnTop}>
        <View style={[styles.mediaIconWrap, { backgroundColor: `${tint}1A` }]}>
          <MaterialCommunityIcons name={icon} size={18} color={tint} />
        </View>
        <Text style={[styles.mediaLabel]}>{value ? 'Almashtirish' : label}</Text>
        {busy ? <ActivityIndicator /> : <MaterialCommunityIcons name="cloud-upload" size={18} color={tint} />}
      </View>
      {!!value && <Text style={styles.urlText} numberOfLines={1}>{value}</Text>}
      {(busy || pct > 0) && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: tint }]} />
          <Text style={styles.progressText}>{pct}%</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderLessonCard = (l, i) => {
    const medias = [
      l.imageUrl && { icon: 'image', color: '#0ea5e9' },
      l.videoUrl && { icon: 'play-circle', color: '#22c55e' },
      l.pdfUrl && { icon: 'file-pdf-box', color: '#ef4444' },
      l.audioUrl && { icon: 'waveform', color: '#8b5cf6' },
    ].filter(Boolean);

    return (
      <View key={l.id} style={styles.lessonCard}>
        <View style={styles.lessonCardLeft}>
          <View style={styles.indexBadge}><Text style={styles.indexBadgeTx}>{i + 1}</Text></View>
        </View>

        <View style={styles.lessonCardMid}>
          <Text style={styles.lessonTitle}>{l.title}</Text>
          <View style={styles.mediaRow}>
            {medias.length === 0 ? (
              <Text style={styles.noMediaTx}>No media</Text>
            ) : (
              medias.map((m, idx) => (
                <View key={idx} style={[styles.mediaDot, { backgroundColor: `${m.color}1A` }]}>
                  <MaterialCommunityIcons name={m.icon} size={16} color={m.color} />
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.lessonCardRight}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#2563eb1A' }]}
            onPress={() => handleEdit(l)}>
            <MaterialCommunityIcons name="pencil" size={18} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#ef44441A', marginLeft: 8 }]}
            onPress={() => handleDelete(l.id)}>
            <MaterialCommunityIcons name="trash-can" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header badges (navigator headerga tegmadim) */}
      <View style={styles.headerBadges}>
        <View style={[styles.badge, { borderColor: '#6366F1', backgroundColor: '#EEF2FF' }]}>
          <MaterialCommunityIcons name="layers-triple-outline" size={14} color="#6366F1" />
          <Text style={[styles.badgeTx, { color: '#3730A3' }]} numberOfLines={1}>
            {String(category || '').toUpperCase()}
          </Text>
        </View>
        <View style={[styles.badge, { borderColor: '#0EA5E9', backgroundColor: '#E0F2FE' }]}>
          <MaterialCommunityIcons name="bookmark" size={14} color="#0EA5E9" />
          <Text style={[styles.badgeTx, { color: '#075985' }]} numberOfLines={1}>{level}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {lessons.map((l, i) => renderLessonCard(l, i))}
        {lessons.length === 0 && (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="file-plus" size={40} color="#94A3B8" />
            <Text style={styles.emptyTx}>Hali dars qo‘shilmagan</Text>
            <Text style={styles.emptySubTx}>Quyidagi + tugmasi orqali yangi dars qo‘shing</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => { resetForm(); setModalVisible(true); }}
        activeOpacity={0.9}
      >
        <MaterialCommunityIcons name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={resetForm}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={[styles.headerDot, { backgroundColor: editingId ? '#2563eb' : '#22c55e' }]} />
              <Text style={styles.modalTitle}>
                {editingId ? 'Darsni tahrirlash' : 'Yangi dars'}
              </Text>
              <TouchableOpacity onPress={resetForm} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholderTextColor="#64748B"
            />

            <TextInput
              placeholder="Video (YouTube/Drive link — ixtiyoriy)"
              value={videoUrl}
              onChangeText={setVideoUrl}
              style={styles.input}
              placeholderTextColor="#64748B"
            />

            {/* Media pickers */}
            <MediaButton
              icon="image-multiple"
              tint="#0EA5E9"
              label="Rasm yuklash"
              value={imageUrl}
              onPress={handlePickUploadImage}
              busy={loading.image}
              pct={progress.image}
            />
            <MediaButton
              icon="play-circle"
              tint="#22C55E"
              label="Video yuklash"
              value={videoUrl && !videoUrl.startsWith('http') ? videoUrl : ''} // agar link bo'lsa ko'rsatmaymiz
              onPress={handlePickUploadVideo}
              busy={loading.video}
              pct={progress.video}
            />
            <MediaButton
              icon="file-pdf-box"
              tint="#EF4444"
              label="PDF yuklash"
              value={pdfUrl}
              onPress={handlePickUploadPDF}
              busy={loading.pdf}
              pct={progress.pdf}
            />
            <MediaButton
              icon="waveform"
              tint="#8B5CF6"
              label="Audio yuklash"
              value={audioUrl}
              onPress={handlePickUploadAudio}
              busy={loading.audio}
              pct={progress.audio}
            />

            <TextInput
              placeholder="Comment (ixtiyoriy)"
              value={comment}
              onChangeText={setComment}
              multiline
              style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
              placeholderTextColor="#64748B"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#0EA5E9' }]} onPress={handleSave}>
                <MaterialCommunityIcons name={editingId ? 'content-save-edit' : 'content-save'} size={18} color="#fff" />
                <Text style={styles.actBtnTx}>{editingId ? 'Yangilash' : 'Saqlash'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#EF4444' }]} onPress={resetForm}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#fff" />
                <Text style={styles.actBtnTx}>Bekor qilish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================== STYLES ================== */
const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  /* header chips */
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeTx: { fontSize: 12, fontWeight: '800', maxWidth: 220 },

  /* empty */
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTx: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptySubTx: { fontSize: 13, color: '#64748B' },

  /* lesson card */
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lessonCardLeft: { paddingRight: 8 },
  indexBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  indexBadgeTx: { fontWeight: '800', color: '#0F172A' },
  lessonCardMid: { flex: 1 },
  lessonTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  noMediaTx: { fontSize: 12, color: '#64748B' },
  mediaDot: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  lessonCardRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  /* FAB */
  addButton: {
    position: 'absolute',
    right: 18, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },

  /* modal */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 18 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', flex: 1 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },

  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 15,
    color: '#0F172A',
  },

  mediaBtn: { paddingVertical: 14 },
  mediaBtnTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1, marginLeft: 10 },

  urlText: { fontSize: 12, color: '#334155', marginTop: 6 },

  progressWrap: {
    marginTop: 8,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  progressText: { position: 'absolute', right: 6, top: -18, fontSize: 11, color: '#334155' },

  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actBtnTx: { color: '#fff', fontWeight: '800' },
});
