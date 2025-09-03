import React, { useState } from 'react';
import { View, TextInput, Button, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

export default function NewsScreen() {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission denied', 'Rasm tanlash uchun ruxsat kerak!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.cancelled) {
      setImage(result.uri);
    }
  };

  const uploadNews = async () => {
    if (!text && !image) {
      Alert.alert('Error', 'Iltimos matn yoki rasm kiriting!');
      return;
    }

    let imageUrl = null;

    if (image) {
      try {
        const storage = getStorage(firebaseApp);
        const response = await fetch(image);
        const blob = await response.blob();
        const filename = `news/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.log(err);
        Alert.alert('Xatolik', 'Rasm yuklashda xatolik yuz berdi.');
        return;
      }
    }

    try {
      const db = getFirestore(firebaseApp);
      await addDoc(collection(db, 'news'), {
        text,
        image: imageUrl || null,
        createdAt: new Date(),
      });
      Alert.alert('Success', 'Yangilik yuborildi!');
      setText('');
      setImage(null);
    } catch (err) {
      console.log(err);
      Alert.alert('Xatolik', 'Serverga yuborishda xatolik yuz berdi.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Yangilik matni..."
        value={text}
        onChangeText={setText}
        multiline
      />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      <Button title="Rasm tanlash" onPress={pickImage} />
      <View style={{ height: 10 }} />
      <Button title="Yangilik yuborish" onPress={uploadNews} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 10,
    borderRadius: 10,
  },
});
