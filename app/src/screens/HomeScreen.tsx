import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../services/api';
import { format } from 'date-fns';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Recording {
  id: string;
  title: string;
  duration: number;
  created_at: string;
  status: string;
  file_size: number;
}

export default function HomeScreen() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<NavProp>();

  const fetchRecordings = async () => {
    try {
      const data = await api.getRecordings();
      setRecordings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRecordings(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchRecordings(); };

  const statusColor = (s: string) =>
    s === 'completed' ? '#4CAF50' : s === 'processing' ? '#FF9800' : '#9E9E9E';

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="mic-off-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>No recordings yet</Text>
            <Text style={styles.emptySubtext}>Start recording or upload a voice file</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('RecordingDetail', { id: item.id, title: item.title })}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="musical-note" size={24} color="#6C63FF" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.duration ? formatDuration(item.duration) : '--'} • {format(new Date(item.created_at), 'MMM d, yyyy')}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '33' }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#aaa', fontSize: 18, marginTop: 16, fontWeight: '600' },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e',
    marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#6C63FF22',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  cardContent: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardMeta: { color: '#888', fontSize: 13, marginBottom: 6 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
});
