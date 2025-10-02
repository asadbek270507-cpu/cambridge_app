import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore, auth } from '../../firebase';

export default function AttendanceStatsScreen({ route }) {
  const [group, setGroup] = useState(route.params?.group || '1'); // UI yo‘q, lekin qiymat ishlatiladi
  const [dateStr, setDateStr] = useState(route.params?.dateStr || new Date().toISOString().slice(0,10));
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({ present:0, absent:0 });

  const load = async () => {
    try {
      const teacherUid = auth.currentUser?.uid;
      if (!teacherUid) return;

      const col = collection(firestore, 'attendance', group, dateStr);
      const q = query(col, where('teacherUid', '==', teacherUid));
      const snap = await getDocs(q);

      const arr = [];
      let present = 0, absent = 0;
      snap.forEach(docu => {
        const d = docu.data();
        arr.push({ id: docu.id, ...d });
        if (d.present) present++; else absent++;
      });

      arr.sort((a,b) => String(a.savedAt || '').localeCompare(String(b.savedAt || '')));
      setItems(arr);
      setTotals({ present, absent });
    } catch (e) {
      console.error('STATS LOAD ERROR:', e);
    }
  };

  useEffect(() => { load(); }, [group, dateStr]);

  const renderItem = ({item, index}) => (
    <View style={styles.item}>
      <View style={styles.numberBadge}><Text style={styles.numberText}>{index + 1}</Text></View>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={[styles.badge, item.present ? styles.badgePresent : styles.badgeAbsent]}>
        {item.present ? 'Bor' : 'Yo‘q'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendance Statistika</Text>

      {/* ⛔️ Guruh pilllari olib tashlandi; faqat sana filtri qoldi */}
      <View style={styles.filters}>
        <View>
          <Text style={styles.label}>Sana:</Text>
          <TextInput value={dateStr} onChangeText={setDateStr} style={styles.input}/>
        </View>
      </View>

      <View style={styles.summary}>
        <Text style={styles.sumText}>Bor: {totals.present}</Text>
        <Text style={styles.sumText}>Yo‘q: {totals.absent}</Text>
        <Text style={styles.sumText}>Jami: {totals.present + totals.absent}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={i=>i.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{textAlign:'center', color:'#666'}}>Ma’lumot topilmadi</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#F3F4F6', padding:16, paddingTop:24 },
  header:{ fontSize:20, fontWeight:'700', color:'#8B0000', marginBottom:12, textAlign:'center' },
  filters:{ flexDirection:'row', justifyContent:'flex-start', alignItems:'center', marginBottom:12 },
  label:{ fontWeight:'600', color:'#333', marginBottom:6 },
  input:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#ddd', borderRadius:8, paddingHorizontal:12, paddingVertical:8, minWidth:130 },

  summary:{ flexDirection:'row', gap:16, marginBottom:10, justifyContent:'center' },
  sumText:{ fontWeight:'700', color:'#111' },

  item:{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#fff', borderRadius:10, padding:12, marginBottom:8, borderWidth:1, borderColor:'#eee' },
  numberBadge:{ width:28, height:28, borderRadius:14, alignItems:'center', justifyContent:'center', backgroundColor:'#E5E7EB' },
  numberText:{ fontWeight:'800', color:'#111' },
  name:{ flex:1, fontSize:16, fontWeight:'700', color:'#111' },

  badge:{ paddingHorizontal:12, paddingVertical:6, borderRadius:14, color:'#fff', fontWeight:'700', overflow:'hidden' },
  badgePresent:{ backgroundColor:'#10B981' },
  badgeAbsent:{ backgroundColor:'#EF4444' },
});
