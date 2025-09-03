import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';
import { useUser } from '../hooks/useUser';
import { addDoc, collection, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const windowWidth = Dimensions.get('window').width;

const categories = [
  { id: 'grammar', name: 'Grammar' },
  { id: 'ielts', name: 'IELTS' },
  { id: 'multilevel', name: 'Multilevel' },
];

const grammarLevels = [
  { level: 'Beginner and Elementary' },
  { level: 'Pre-Intermediate' },
  { level: 'Intermediate' },
  { level: 'Advanced' },
];

const ieltsLevels = [
  { level: 'IELTS LISTENING' },
  { level: 'IELTS READING' },
  { level: 'IELTS SPEAKING' },
  { level: 'IELTS WRITING' },
];

const listeningcategories = [
  { level: 'Listening Part 1' },
  { level: 'Listening Part 2' },
  { level: 'Listening Part 3' },
  { level: 'Listening Part 4' },
];

const readingcategories = [
  { level: 'Reading Passage 1' },
  { level: 'Reading Passage 2' },
  { level: 'Reading Passage 3' },
];

const speakingcategories = [
  { level: 'Speaking Part 1' },
  { level: 'Speaking Part 2' },
  { level: 'Speaking Part 3' },
];

const writingcategories = [
  { level: 'Writing Task 1' },
  { level: 'Writing Task 2' },
];

const multilevel = [
  { level: 'MULTI LEVEL LISTENING' },
  { level: 'MULTI LEVEL READING' },
  { level: 'MULT LEVEL SPEAKING' },
  { level: 'MULTI LEVEL WRITING' },
];

const multilevellisteningcategories = [
  { level: 'Listening Part 1' },
  { level: 'Listening Part 2' },
  { level: 'Listening Part 3' },
  { level: 'Listening Part 4' },
  { level: 'Listening Part 5' },
  { level: 'Listening Part 6' },
];

const multilevelreadingcategories = [
  { level: 'Reading Passage 1' },
  { level: 'Reading Passage 2' },
  { level: 'Reading Passage 3' },
  { level: 'Reading Passage 4' },
  { level: 'Reading Passage 5' },
];

const multilevelspeakingcategories = [
  { level: 'Speaking Part 1' },
  { level: 'Speaking Part 2' },
  { level: 'Speaking Part 3' },
];

const multilevelwritingcategories = [
  { level: 'Writing Task 1' },
  { level: 'Writing Task 2' },
  { level: 'Writing Task 3' },
];

export default function ManageScreen() {
  const navigation = useNavigation();
  const { role } = useUser();

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedSubLevel, setSelectedSubLevel] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [comment, setComment] = useState('');

  const handleAddTopic = async () => {
    if (!topicTitle || !videoUrl) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }

    try {
      let docRef;
      if (selectedSubLevel) {
        docRef = doc(db, 'Createlesson', selectedSubLevel);
      } else if (selectedLevel) {
        docRef = doc(db, 'Createlesson', selectedLevel);
      } else if (selectedCategory) {
        docRef = doc(db, 'Createlesson', selectedCategory);
      } else {
        Alert.alert('Error', 'Invalid selection');
        return;
      }

      const topicsCollectionRef = collection(docRef, '');

      await addDoc(topicsCollectionRef, {
        title: topicTitle,
        url: videoUrl,
        comment: comment || '',
        createdAt: serverTimestamp(),
      });

      Alert.alert('✅ Success', 'Topic added!');
      setModalVisible(false);
      setTopicTitle('');
      setVideoUrl('');
      setComment('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add topic: ' + error.message);
    }
  };

  const renderLastLevel = (levels) =>
    levels.map(({ level }) => (
      <TouchableOpacity
        key={level}
        style={styles.levelButton}
        onPress={() =>
          navigation.navigate('Createlesson', {
            level,
            category: selectedCategory,
            parentLevel: selectedLevel,
          })
        }
      >
        <Text style={styles.levelText}>{level}</Text>
      </TouchableOpacity>
    ));

  const renderSubLevelsWithoutPlus = (subLevels) =>
    subLevels.map(({ level }) => (
      <TouchableOpacity
        key={level}
        style={styles.levelButton}
        onPress={() =>
          navigation.navigate('Createlesson', {
            level,
            category: selectedCategory,
            parentLevel: selectedLevel,
          })
        }
      >
        <Text style={styles.levelText}>{level}</Text>
      </TouchableOpacity>
    ));

  const renderLevels = (levels) =>
    levels.map(({ level }) => (
      <TouchableOpacity
        key={level}
        style={styles.levelButton}
        onPress={() => {
          if (selectedCategory === 'grammar') {
            navigation.navigate('Createlesson', {
              level,
              category: selectedCategory,
            });
          } else {
            setSelectedLevel(level);
            setSelectedSubLevel(null);
          }
        }}
      >
        <Text style={styles.levelText}>{level}</Text>
      </TouchableOpacity>
    ));

  const renderContent = () => {
    if (!selectedCategory) {
      return categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={styles.levelButton}
          onPress={() => {
            setSelectedCategory(cat.id);
            setSelectedLevel(null);
            setSelectedSubLevel(null);
          }}
        >
          <Text style={styles.levelText}>{cat.name}</Text>
        </TouchableOpacity>
      ));
    }

    if (selectedCategory === 'grammar') return renderLevels(grammarLevels);

    if (selectedCategory === 'ielts') {
      if (!selectedLevel) return renderLevels(ieltsLevels);

      switch (selectedLevel) {
        case 'IELTS LISTENING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(listeningcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        case 'IELTS READING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(readingcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        case 'IELTS SPEAKING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(speakingcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        case 'IELTS WRITING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(writingcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        default:
          return null;
      }
    }

    if (selectedCategory === 'multilevel') {
      if (!selectedLevel) return renderLevels(multilevel);

      switch (selectedLevel) {
        case 'MULTI LEVEL LISTENING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(multilevellisteningcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        case 'MULTI LEVEL READING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(multilevelreadingcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        case 'MULT LEVEL SPEAKING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(multilevelspeakingcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        case 'MULTI LEVEL WRITING':
          if (!selectedSubLevel) return renderSubLevelsWithoutPlus(multilevelwritingcategories);
          return renderLastLevel([{ level: selectedSubLevel }]);
        default:
          return null;
      }
    }

    return null;
  };

  const getHeaderTitle = () => {
    if (!selectedCategory) return 'Manage Lessons';
    if (selectedCategory && !selectedLevel) return selectedCategory.toUpperCase();
    if (selectedLevel && !selectedSubLevel) return selectedLevel;
    if (selectedSubLevel) return selectedSubLevel;
    return 'Manage Lessons';
  };

  const handleBack = () => {
    if (selectedSubLevel) setSelectedSubLevel(null);
    else if (selectedLevel) setSelectedLevel(null);
    else if (selectedCategory) setSelectedCategory(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <Appbar.Header style={{ backgroundColor: '#1349c7' }}>
        {(selectedCategory || selectedLevel || selectedSubLevel) ? (
          <Appbar.BackAction color="#fff" onPress={handleBack} />
        ) : null}
        <Appbar.Content title={getHeaderTitle()} titleStyle={{ color: '#fff' }} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.container}>
        {renderContent()}
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              Add Topic to {selectedSubLevel || selectedLevel || selectedCategory}
            </Text>
            <TextInput
              placeholder="Topic Title"
              value={topicTitle}
              onChangeText={setTopicTitle}
              style={styles.input}
            />
            <TextInput
              placeholder="Video URL"
              value={videoUrl}
              onChangeText={setVideoUrl}
              style={styles.input}
            />
            <TextInput
              placeholder="Comment (optional)"
              value={comment}
              onChangeText={setComment}
              style={[styles.input, { height: 60 }]}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddTopic}>
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: windowWidth < 400 ? 12 : 20,
    flexGrow: 1,
  },
  levelButton: {
    backgroundColor: '#ac0606',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 14,
  },
  levelText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveBtn: {
    backgroundColor: '#0ea5e9',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  cancelBtn: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    flex: 1,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});

