import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../services/api';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordingDetail'>;

interface RecordingDetail {
  id: string;
  title: string;
  duration: number;
  created_at: string;
  status: string;
  file_size: number;
  transcription?: {
    text: string;
    language: string;
    created_at: string;
  };
}

export default function RecordingDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await api.getRecording(id);
        setRecording(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Delete Recording', 'This will permanently delete this recording and its transcription.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteRecording(id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', 'Could not delete recording');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>
  );

  if (!recording) return (
    <View style={styles.center}><Text style={{ color: '#fff' }}>Recording not found</Text></View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color="#888" />
            <Text style={styles.metaText}>{recording.duration ? formatDuration(recording.duration) : '--'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color="#888" />
            <Text style={styles.metaText}>{format(new Date(recording.created_at), 'PPP')}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="server-outline" size={16} color="#888" />
            <Text style={styles.metaText}>{recording.file_size ? `${(recording.file_size / 1024 / 1024).toFixed(1)} MB` : '--'}</Text>
          </View>
          <View style={[styles.metaRow, styles.statusRow]}>
            <Text style={[
              styles.statusBadge,
              { color: recording.status === 'completed' ? '#4CAF50' : '#FF9800' }
            ]}>{recording.status}</Text>
          </View>
        </View>

        {recording.transcription ? (
          <View style={styles.transcriptionCard}>
            <View style={styles.transcriptionHeader}>
              <Ionicons name="document-text" size={20} color="#6C63FF" />
              <Text style={styles.transcriptionTitle}>Transcription</Text>
              {recording.transcription.language && (
                <Text style={styles.language}>{recording.transcription.language.toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.transcriptionText}>{recording.transcription.text}</Text>
          </View>
        ) : (
          <View style={styles.pendingCard}>
            <ActivityIndicator size="small" color="#FF9800" />
            <Text style={styles.pendingText}>
              {recording.status === 'processing' ? 'Transcription in progress...' : 'Transcription pending'}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
          {deleting ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="trash" size={20} color="#fff" />
            <Text style={styles.deleteBtnText}>Delete Recording</Text></>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  metaCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  metaText: { color: '#ccc', fontSize: 14 },
  statusRow: { marginTop: 4 },
  statusBadge: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  transcriptionCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 16 },
  transcriptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  transcriptionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  language: { color: '#6C63FF', fontSize: 12, fontWeight: '700', backgroundColor: '#6C63FF22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  transcriptionText: { color: '#ddd', fontSize: 15, lineHeight: 24 },
  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 16 },
  pendingText: { color: '#FF9800', fontSize: 14 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#e74c3c', borderRadius: 12, padding: 16, gap: 10, marginTop: 8,
  },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
