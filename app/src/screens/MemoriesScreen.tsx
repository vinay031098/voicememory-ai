import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface Memory {
  id: string;
  content: string;
  metadata: {
    topic: string;
    recordingId: string;
    createdAt: string;
    duration?: number;
  };
  score?: number;
}

interface Stats {
  totalChunks: number;
  topTopics: [string, number][];
}

export default function MemoriesScreen() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<'timeline' | 'search'>('timeline');

  useFocusEffect(
    useCallback(() => {
      loadTimeline();
      loadTopics();
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/memories/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) { /* silent */ }
  };

  const loadTopics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/memories/topics`);
      const data = await res.json();
      setTopics(data.topics || []);
    } catch (e) { /* silent */ }
  };

  const loadTimeline = async (topic?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (topic) params.set('topic', topic);
      const res = await fetch(`${API_BASE}/api/memories/timeline?${params}`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e) { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const searchMemories = async () => {
    if (!query.trim()) return loadTimeline(selectedTopic || undefined);
    setLoading(true);
    setMode('search');
    try {
      const params = new URLSearchParams({ q: query, limit: '20' });
      if (selectedTopic) params.set('topic', selectedTopic);
      const res = await fetch(`${API_BASE}/api/memories/search?${params}`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e) { /* silent */ } finally {
      setLoading(false);
    }
  };

  const handleTopicPress = (topic: string) => {
    const newTopic = selectedTopic === topic ? null : topic;
    setSelectedTopic(newTopic);
    setMode('timeline');
    setQuery('');
    loadTimeline(newTopic || undefined);
  };

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/memories/${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch (e) { /* silent */ }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderMemory = ({ item }: { item: Memory }) => (
    <View style={styles.memoryCard}>
      <View style={styles.memoryHeader}>
        <View style={styles.topicBadge}>
          <Text style={styles.topicBadgeText}>{item.metadata?.topic || 'General'}</Text>
        </View>
        <View style={styles.memoryMeta}>
          <Text style={styles.memoryDate}>
            {item.metadata?.createdAt ? formatDate(item.metadata.createdAt) : ''}
          </Text>
          <TouchableOpacity onPress={() => deleteMemory(item.id)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={14} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.memoryContent} numberOfLines={4}>{item.content}</Text>
      {item.score != null && (
        <Text style={styles.scoreText}>Relevance: {Math.round(item.score * 100)}%</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Memory Bank</Text>
        {stats && (
          <Text style={styles.subtitle}>{stats.totalChunks} memory chunks stored</Text>
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your memories..."
          placeholderTextColor="#4b5563"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={searchMemories}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setMode('timeline'); loadTimeline(selectedTopic || undefined); }}>
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Topic filter chips */}
      {topics.length > 0 && (
        <FlatList
          horizontal
          data={topics}
          keyExtractor={t => t}
          style={styles.topicChips}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selectedTopic === item && styles.chipActive]}
              onPress={() => handleTopicPress(item)}
            >
              <Text style={[styles.chipText, selectedTopic === item && styles.chipTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Mode indicator */}
      <View style={styles.modeBar}>
        <Text style={styles.modeText}>
          {mode === 'search' ? `Search results for "${query}"` : selectedTopic ? `Topic: ${selectedTopic}` : 'All memories (newest first)'}
        </Text>
        <Text style={styles.countText}>{memories.length} items</Text>
      </View>

      {/* Memory list */}
      {loading && memories.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#7c3aed" />
      ) : (
        <FlatList
          data={memories}
          keyExtractor={item => item.id}
          renderItem={renderMemory}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadTimeline(selectedTopic || undefined); }}
              tintColor="#7c3aed"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>No memories yet.{`\n`}Record or upload audio to get started.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, height: 44, color: '#fff', fontSize: 15 },
  topicChips: { maxHeight: 44, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#374151',
  },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 13, color: '#9ca3af' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modeText: { fontSize: 12, color: '#6b7280' },
  countText: { fontSize: 12, color: '#6b7280' },
  list: { padding: 16, gap: 12 },
  memoryCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 10,
  },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  topicBadge: { backgroundColor: '#1e1b4b', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  topicBadgeText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
  memoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memoryDate: { fontSize: 11, color: '#4b5563' },
  deleteBtn: { padding: 2 },
  memoryContent: { fontSize: 14, color: '#d1d5db', lineHeight: 21 },
  scoreText: { fontSize: 11, color: '#7c3aed', marginTop: 6 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: '#4b5563', textAlign: 'center', lineHeight: 24 },
});
