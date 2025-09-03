// screens/CreateLesson.js
import React, { useState, useEffect } from 'react';
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

  // upload progress states
  const [loading, setLoading] = useState({
    image: false,
    video: false,
    pdf: false,
    audio: false,
  });
  const [progress, setProgress] = useState({
    image: 0,
    video: 0,
    pdf: 0,
    audio: 0,
  });

  const lessonsCollection = collection(
    doc(firestore, `${category}Materials`, level),
    'lessons'
  );

  useEffect(() => {
    const q = query(lessonsCollection, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setLessons(data);
    });
    return () => unsubscribe();
  }, []);

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
    if (!title) {
      Alert.alert('Xato', 'Sarlavha majburiy!');
      return;
    }
    // Yuklanayotgan bo'lsa, saqlashni bloklash
    const anyLoading = Object.values(loading).some(Boolean);
    if (anyLoading) {
      Alert.alert('Diqqat', 'Fayl yuklanishi tugaguncha kuting.');
      return;
    }

    try {
      if (editingId) {
        const docRef = doc(lessonsCollection, editingId);
        await updateDoc(docRef, {
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
      Alert.alert('Xato', err.message);
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
            Alert.alert('Xato', err.message);
          }
        },
      },
    ]);
  };

  // ---------- FILE PICK + UPLOAD HELPERS ----------
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

      const storageRef = ref(storage, path);
      const blob = await uriToBlob(file.uri);
      const uploadTask = uploadBytesResumable(storageRef, blob, {
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

      const url = await getDownloadURL(storageRef);
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
      mediaTypes,
      quality: 0.9,
    });
    if (result.canceled) return null;
    const asset = result.assets?.[0];
    if (!asset) return null;
    return {
      uri: asset.uri,
      name: asset.fileName || 'media',
      mime: asset.mimeType,
    };
  };

  const pickDocument = async (types = ['*/*']) => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: types,
    });
    if (result.canceled) return null;
    const file = result.assets?.[0];
    if (!file) return null;
    return {
      uri: file.uri,
      name: file.name,
      mime: file.mimeType,
    };
  };

  const handlePickUploadImage = async () => {
    try {
      const picked = await pickImageOrVideo(ImagePicker.MediaTypeOptions.Images);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'images', kind: 'image' });
      setImageUrl(url);
    } catch (e) {
      Alert.alert('Xato', e.message);
    }
  };

  const handlePickUploadVideo = async () => {
    try {
      const picked = await pickImageOrVideo(ImagePicker.MediaTypeOptions.Videos);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'videos', kind: 'video' });
      setVideoUrl(url);
    } catch (e) {
      Alert.alert('Xato', e.message);
    }
  };

  const handlePickUploadPDF = async () => {
    try {
      const picked = await pickDocument(['application/pdf']);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'pdfs', kind: 'pdf' });
      setPdfUrl(url);
    } catch (e) {
      Alert.alert('Xato', e.message);
    }
  };

  const handlePickUploadAudio = async () => {
    try {
      const picked = await pickDocument(['audio/*']);
      if (!picked) return;
      const url = await uploadWithProgress({ file: picked, folder: 'audios', kind: 'audio' });
      setAudioUrl(url);
    } catch (e) {
      Alert.alert('Xato', e.message);
    }
  };
  // -----------------------------------------------

  const MediaButton = ({ label, value, onPress, busy, pct }) => (
    <TouchableOpacity style={[styles.input, styles.mediaBtn]} onPress={onPress} disabled={busy}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '600' }}>
          {value ? 'Almashtirish' : label}
        </Text>
        {busy ? <ActivityIndicator /> : null}
      </View>
      {!!value && <Text style={styles.urlText} numberOfLines={1}>{value}</Text>}
      {busy || pct > 0 ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${pct}%` }]} />
          <Text style={styles.progressText}>{pct}%</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {lessons.map(
          ({ id, title, videoUrl, pdfUrl, imageUrl, audioUrl, comment }, index) => (
            <View key={id} style={styles.lessonBox}>
              <Text style={styles.lessonIndex}>{index + 1}.</Text>
              <View style={styles.lessonContent}>
                <Text style={styles.lessonTitle}>{title}</Text>
                {/* Istasangiz link preview yoki iconlar qo'shishingiz mumkin */}
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  handleEdit({ id, title, videoUrl, pdfUrl, imageUrl, audioUrl, comment })
                }
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setModalVisible(true);
        }}
      >
        <Text style={styles.addText}>＋</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingId ? `Darsni tahrirlash (${level})` : `Yangi dars qo‘shish (${level})`}
            </Text>

            <TextInput
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />

        <TextInput placeholder="Video" value={videoUrl} onChangeText={setVideoUrl} style={styles.input} />
        

            {/* MEDIA: bosilganda tanlash + storage ga yuklash */}
            <MediaButton
              label="Rasm yuklash"
              value={imageUrl}
              onPress={handlePickUploadImage}
              busy={loading.image}
              pct={progress.image}
            />
            <MediaButton
              label="Video yuklash"
              value={videoUrl}
              onPress={handlePickUploadVideo}
              busy={loading.video}
              pct={progress.video}
            />
            <MediaButton
              label="PDF yuklash"
              value={pdfUrl}
              onPress={handlePickUploadPDF}
              busy={loading.pdf}
              pct={progress.pdf}
            />
            <MediaButton
              label="Audio yuklash"
              value={audioUrl}
              onPress={handlePickUploadAudio}
              busy={loading.audio}
              pct={progress.audio}
            />

            <TextInput
              placeholder="Comment"
              value={comment}
              onChangeText={setComment}
              multiline
              style={[styles.input, { height: 120 }]}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.btnText}>
                  {editingId ? 'Yangilash' : 'Saqlash'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.btnText}>Bekor qilish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 100 },
  lessonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  lessonIndex: { fontSize: 18, fontWeight: '700', marginRight: 12, width: 24, textAlign: 'center' },
  lessonContent: { flex: 1 },
  lessonTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4, color: '#111' },
  editButton: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 12 },
  editButtonText: { color: '#fff', fontWeight: '600' },
  deleteButton: { backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 12 },
  deleteButtonText: { color: '#fff', fontWeight: '600' },
  addButton: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#22c55e', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  addText: { fontSize: 32, color: '#fff', fontWeight: 'bold', marginTop: -2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  saveBtn: { backgroundColor: '#0ea5e9', padding: 12, borderRadius: 8, flex: 1, marginRight: 8 },
  cancelBtn: { backgroundColor: '#ef4444', padding: 12, borderRadius: 8, flex: 1 },
  btnText: { color: '#fff', fontWeight: '600', textAlign: 'center' },

  mediaBtn: { paddingVertical: 14 },
  urlText: { fontSize: 12, color: '#334155', marginTop: 6 },
  progressWrap: {
    marginTop: 8,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#0ea5e9',
  },
  progressText: {
    position: 'absolute',
    right: 6,
    top: -18,
    fontSize: 11,
    color: '#334155',
  },
});
