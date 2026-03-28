import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { recording_id: string; title: string; excerpt: string }[];
  timestamp: Date;
}

const SUGGESTIONS = [
  'What did I talk about last week?',
  'Summarize my recent meetings',
  'What topics come up most often?',
  'Tell me about my conversations on work',
  'What did I say about my goals?',
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setMessages([{
      id: '0',
      role: 'assistant',
      content: 'Hi! I have access to all your voice recordings and transcriptions. Ask me anything about what you\'ve said, discussed, or remembered.',
      timestamp: new Date(),
    }]);
  }, []);

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.chat(content);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that. Please check your connection.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            messages.length <= 1 ? (
              <View style={styles.suggestions}>
                <Text style={styles.suggestionsTitle}>Try asking:</Text>
                {SUGGESTIONS.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {item.role === 'assistant' && (
                <View style={styles.aiIcon}>
                  <Ionicons name="sparkles" size={14} color="#6C63FF" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>
                  {item.content}
                </Text>
                {item.sources && item.sources.length > 0 && (
                  <View style={styles.sources}>
                    <Text style={styles.sourcesLabel}>Sources:</Text>
                    {item.sources.slice(0, 3).map((s, i) => (
                      <Text key={i} style={styles.sourceItem} numberOfLines={1}>
                        • {s.title}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        />

        {loading && (
          <View style={styles.loadingBar}>
            <ActivityIndicator size="small" color="#6C63FF" />
            <Text style={styles.loadingText}>AI is thinking...</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about your recordings..."
            placeholderTextColor="#555"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  bubble: { flexDirection: 'row', marginBottom: 12, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#6C63FF', borderRadius: 18, padding: 12 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#1a1a2e', borderRadius: 18, padding: 12, gap: 8 },
  aiIcon: { marginRight: 8, marginTop: 2 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: '#e0e0e0' },
  sources: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2a2a4a' },
  sourcesLabel: { color: '#888', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  sourceItem: { color: '#6C63FF', fontSize: 12, marginBottom: 2 },
  loadingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  loadingText: { color: '#888', fontSize: 13 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 10, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  input: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 24, paddingHorizontal: 16,
    paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 100,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  suggestions: { marginTop: 16 },
  suggestionsTitle: { color: '#666', fontSize: 13, marginBottom: 10 },
  suggestionChip: {
    backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a4a',
  },
  suggestionText: { color: '#aaa', fontSize: 13 },
});
