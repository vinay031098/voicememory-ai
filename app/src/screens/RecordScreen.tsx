import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Alert, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

export default function RecordScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Audio.requestPermissionsAsync();
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => { pulseAnim.stopAnimation(); pulseAnim.setValue(1); };

  const startRecording = async () => {
    try {
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      startPulse();
    } catch (e) {
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    if (isPaused) {
      await recording.startAsync();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      startPulse();
    } else {
      await recording.pauseAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      stopPulse();
    }
    setIsPaused(!isPaused);
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      stopPulse();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);
      if (uri) await uploadRecording(uri);
    } catch (e) {
      Alert.alert('Error', 'Could not stop recording');
    }
  };

  const uploadRecording = async (uri: string) => {
    setUploading(true);
    try {
      const fileName = `recording_${Date.now()}.m4a`;
      const recTitle = title.trim() || `Recording ${new Date().toLocaleDateString()}`;
      await api.uploadRecording(uri, fileName, recTitle);
      Alert.alert('Success', 'Recording saved! Transcription in progress...');
      setTitle('');
      setDuration(0);
    } catch (e) {
      Alert.alert('Upload Failed', 'Could not save recording');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
      : `${m}:${sec.toString().padStart(2,'0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.hint}>{isRecording ? (isPaused ? 'Paused' : 'Recording...') : 'Ready to Record'}</Text>

        <View style={styles.timerContainer}>
          <Text style={styles.timer}>{formatDuration(duration)}</Text>
        </View>

        <Animated.View style={[styles.micRing, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.micButton, isRecording && styles.micButtonActive]}>
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={48} color="#fff" />
          </View>
        </Animated.View>

        {!isRecording && (
          <TextInput
            style={styles.input}
            placeholder="Recording title (optional)"
            placeholderTextColor="#555"
            value={title}
            onChangeText={setTitle}
          />
        )}

        <View style={styles.controls}>
          {!isRecording ? (
            <TouchableOpacity style={styles.startBtn} onPress={startRecording} disabled={uploading}>
              <Ionicons name="mic" size={28} color="#fff" />
              <Text style={styles.btnText}>{uploading ? 'Saving...' : 'Start Recording'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.activeControls}>
              <TouchableOpacity style={styles.pauseBtn} onPress={pauseRecording}>
                <Ionicons name={isPaused ? 'play' : 'pause'} size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Ionicons name="stop" size={28} color="#fff" />
                <Text style={styles.btnText}>Stop & Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { color: '#888', fontSize: 16, marginBottom: 16 },
  timerContainer: { marginBottom: 40 },
  timer: { color: '#fff', fontSize: 56, fontWeight: '200', fontVariant: ['tabular-nums'] },
  micRing: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#6C63FF22', justifyContent: 'center', alignItems: 'center', marginBottom: 40,
  },
  micButton: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center',
  },
  micButtonActive: { backgroundColor: '#e74c3c' },
  input: {
    width: '100%', backgroundColor: '#1a1a2e', borderRadius: 12,
    padding: 16, color: '#fff', fontSize: 16, marginBottom: 24,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  controls: { width: '100%' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6C63FF', borderRadius: 16, padding: 18, gap: 12,
  },
  activeControls: { flexDirection: 'row', gap: 16 },
  pauseBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF9800', borderRadius: 16, padding: 18,
  },
  stopBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#e74c3c', borderRadius: 16, padding: 18, gap: 12,
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
