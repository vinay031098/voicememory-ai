import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

interface Topic {
  topic: string;
  count: number;
  recordings: string[];
  summary?: string;
}

const COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

export default function TopicsScreen() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const data = await api.getTopics();
        setTopics(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, []);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={topics}
        keyExtractor={(item) => item.topic}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Topic Clusters</Text>
            <Text style={styles.headerSubtitle}>{topics.length} topics found across your recordings</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="layers-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>No topics yet</Text>
            <Text style={styles.emptySubtext}>Record and transcribe audio to discover topics</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const color = COLORS[index % COLORS.length];
          const isExpanded = expanded === item.topic;
          return (
            <TouchableOpacity
              style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}
              onPress={() => setExpanded(isExpanded ? null : item.topic)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.topicIcon, { backgroundColor: color + '22' }]}>
                  <Ionicons name="pricetag" size={18} color={color} />
                </View>
                <View style={styles.topicInfo}>
                  <Text style={styles.topicName}>{item.topic}</Text>
                  <Text style={styles.topicCount}>{item.count} recording{item.count !== 1 ? 's' : ''}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20} color="#555"
                />
              </View>
              {isExpanded && item.summary && (
                <View style={styles.summary}>
                  <Text style={styles.summaryText}>{item.summary}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  header: { padding: 20, paddingBottom: 8 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: 13, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#aaa', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  card: {
    backgroundColor: '#1a1a2e', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  topicIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  topicInfo: { flex: 1 },
  topicName: { color: '#fff', fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  topicCount: { color: '#888', fontSize: 13, marginTop: 2 },
  summary: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a2a4a' },
  summaryText: { color: '#bbb', fontSize: 14, lineHeight: 20 },
});
