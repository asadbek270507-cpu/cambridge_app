import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore, auth } from '../../firebase';

// groups massivini ishlatmaymiz, lekin qolishi mumkin
const groups = ['1','2','3','4'];

export default function AttendanceScreen({ navigation }) {
  const [group, setGroup] = useState('1'); // default 1
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0,10));
  const [studentName, setStudentName] = useState('');
  const [students, setStudents] = useState([]); // {id, name, present}

  const addStudent = () => {
    const trimmed = studentName.trim();
    if (!trimmed) return;
    const id = trimmed.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
    setStudents(prev => [...prev, { id, name: trimmed, present: true }]); // append (pastga)
    setStudentName('');
  };

  const togglePresent = (id) => {
    setStudents(prev => prev.map(s => (s.id === id ? { ...s, present: !s.present } : s)));
  };

  const saveAll = async () => {
    try {
      if (!dateStr || !group) return Alert.alert('Xato','Sana va guruh tanlang');
      const teacherUid = auth.currentUser?.uid;
      if (!teacherUid) return Alert.alert('Xato','Kirish (login) qiling');
      if (students.length === 0) return Alert.alert('Eslatma','Avval o‘quvchi qo‘shing');

      // teachers/{uid} — rulesga mos maydon bilan
      await setDoc(
        doc(firestore, 'teachers', teacherUid),
        { updatedAt: serverTimestamp() },
        { merge: true }
      );

      // attendance/{group}/{date}/{studentId}
      const writes = students.map((s) => {
        const ref = doc(firestore, 'attendance', group, dateStr, s.id);
        return setDoc(ref, {
          name: s.name,
          present: s.present,
          group,
          date: dateStr,
          savedAt: new Date().toISOString(),
          teacherUid,
          studentId: s.id,
        }, { merge: false });
      });

      await Promise.all(writes);
      Alert.alert('OK', 'Davomat saqlandi');
    } catch (e) {
      console.error('SAVE ERROR:', e);
      Alert.alert('Xato', 'Saqlashda muammo yuz berdi');
    }
  };

  const renderStudent = ({ item, index }) => (
    <View style={styles.studentItem}>
      <View style={styles.numberBadge}><Text style={styles.numberText}>{index + 1}</Text></View>
      <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
      <TouchableOpacity
        style={[styles.sticker, item.present ? styles.present : styles.absent]}
        onPress={() => togglePresent(item.id)}
      >
        <Icon name={item.present ? 'sticker-check' : 'sticker-remove'} size={20} color="#fff" />
        <Text style={styles.stickerText}>{item.present ? 'Bor' : 'Yo‘q'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendance (Absent)</Text>

      {/* ⛔️ Guruh pilllari olib tashlandi */}

      <View style={styles.field}>
        <Text style={styles.label}>Sana (YYYY-MM-DD):</Text>
        <TextInput value={dateStr} onChangeText={setDateStr} placeholder="YYYY-MM-DD" style={styles.input} />
      </View>

      <View style={styles.fieldRow}>
        <TextInput
          value={studentName}
          onChangeText={setStudentName}
          placeholder="Ism Familiya"
          style={[styles.input, { flex: 1 }]}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addStudent}>
          <Icon name="account-plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={renderStudent}
        ListEmptyComponent={<Text style={{ textAlign:'center', color:'#666' }}>O‘quvchi qo‘shing</Text>}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={saveAll}>
          <Icon name="content-save" size={20} color="#fff" />
          <Text style={styles.saveText}>Saqlash</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statsBtn}
          onPress={() => navigation.navigate('AttendanceStatsScreen', { group, dateStr })}
        >
          <Icon name="chart-bar" size={20} color="#8B0000" />
          <Text style={styles.statsText}>Statistika</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#F3F4F6', padding:16, paddingTop:24 },
  header:{ fontSize:20, fontWeight:'700', color:'#8B0000', marginBottom:12, textAlign:'center' },
  // row — endi ishlatilmaydi
  row:{ flexDirection:'row', gap:8, marginBottom:12, justifyContent:'center', flexWrap:'wrap' },
  groupPill:{ paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:'#fff', borderWidth:1, borderColor:'#ddd' },
  groupPillActive:{ backgroundColor:'#8B0000' },
  groupText:{ color:'#333', fontWeight:'600' },
  groupTextActive:{ color:'#fff' },
  field:{ marginBottom:12 },
  fieldRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  label:{ marginBottom:6, color:'#333', fontWeight:'600' },
  input:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#ddd', borderRadius:8, paddingHorizontal:12, paddingVertical:10 },
  addBtn:{ backgroundColor:'#8B0000', borderRadius:8, padding:12 },
  studentItem:{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#fff', borderRadius:10, padding:12, marginBottom:8, borderWidth:1, borderColor:'#eee' },
  numberBadge:{ width:28, height:28, borderRadius:14, alignItems:'center', justifyContent:'center', backgroundColor:'#E5E7EB' },
  numberText:{ fontWeight:'800', color:'#111' },
  studentName:{ flex:1, fontSize:16, color:'#111', fontWeight:'700' },
  sticker:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:20 },
  present:{ backgroundColor:'#10B981' },
  absent:{ backgroundColor:'#EF4444' },
  stickerText:{ color:'#fff', fontWeight:'700' },
  footer:{ position:'absolute', left:16, right:16, bottom:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  saveBtn:{ backgroundColor:'#8B0000', paddingHorizontal:16, paddingVertical:12, borderRadius:10, flexDirection:'row', gap:8, alignItems:'center' },
  saveText:{ color:'#fff', fontWeight:'700' },
  statsBtn:{ backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:12, borderRadius:10, flexDirection:'row', gap:8, alignItems:'center', borderWidth:1, borderColor:'#8B0000' },
  statsText:{ color:'#8B0000', fontWeight:'700' },
});
