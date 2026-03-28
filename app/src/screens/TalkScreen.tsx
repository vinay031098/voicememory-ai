import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUri?: string;
  timestamp: Date;
}

export default function TalkScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hi! I am your Voice Memory AI. Ask me anything about your past recordings. What would you like to know?',
      timestamp: new Date(),
    },
  ]);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync();
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopAndProcess = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsProcessing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;

      // Upload to Talk API
      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/api/talk/voice`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await response.json();

      // Add user message
      const userMsg: Message = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: data.transcription || 'Voice message',
        timestamp: new Date(),
      };

      // Add assistant message
      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        audioUri: data.audioUrl,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);

      // Auto-play the TTS response
      if (data.audioUrl) {
        await playAudio(`${API_BASE}${data.audioUrl}`);
      }
    } catch (err) {
      console.error('Talk processing error:', err);
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const playAudio = async (url: string) => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const handleMicPress = () => {
    if (isRecording) stopAndProcess();
    else startRecording();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Talk to Your Memories</Text>
        <Text style={styles.headerSubtitle}>Ask anything about your recordings</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View
            key={msg.id}
            style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}
          >
            {msg.role === 'assistant' && (
              <View style={styles.aiIcon}>
                <Ionicons name="sparkles" size={14} color="#7c3aed" />
              </View>
            )}
            <Text style={[styles.bubbleText, msg.role === 'user' && styles.userText]}>
              {msg.content}
            </Text>
            {msg.audioUri && (
              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => playAudio(`${API_BASE}${msg.audioUri}`)}
              >
                <Ionicons name="play-circle" size={20} color="#7c3aed" />
                <Text style={styles.playText}>Play Response</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {isProcessing && (
          <View style={[styles.bubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color="#7c3aed" />
            <Text style={styles.processingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.controls}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={handleMicPress}
            disabled={isProcessing}
          >
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={36}
              color="white"
            />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.micLabel}>
          {isProcessing ? 'Processing...' : isRecording ? 'Tap to stop' : 'Tap to speak'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  aiBubble: {
    backgroundColor: '#1a1a2e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    flexDirection: 'column',
  },
  userBubble: {
    backgroundColor: '#7c3aed',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiIcon: { marginBottom: 4 },
  bubbleText: { fontSize: 15, color: '#e5e7eb', lineHeight: 22 },
  userText: { color: '#fff' },
  playBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  playText: { fontSize: 13, color: '#7c3aed' },
  processingText: { fontSize: 14, color: '#9ca3af', marginLeft: 8 },
  controls: { padding: 24, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  micButtonActive: { backgroundColor: '#dc2626' },
  micLabel: { marginTop: 12, fontSize: 14, color: '#9ca3af' },
});
