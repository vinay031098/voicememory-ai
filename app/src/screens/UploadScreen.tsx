import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

const SUPPORTED_FORMATS = [
  { ext: 'MP3', icon: 'musical-notes' },
  { ext: 'WAV', icon: 'radio' },
  { ext: 'M4A', icon: 'mic' },
  { ext: 'AAC', icon: 'volume-high' },
  { ext: 'OGG', icon: 'headset' },
  { ext: 'FLAC', icon: 'disc' },
  { ext: 'MP4', icon: 'videocam' },
  { ext: 'MOV', icon: 'film' },
  { ext: 'WEBM', icon: 'globe' },
];

export default function UploadScreen() {
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; size?: number; mimeType?: string } | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/*', 'video/mp4', 'video/quicktime',
          'video/webm', 'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({ name: file.name, uri: file.uri, size: file.size, mimeType: file.mimeType });
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick file');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(0);
    try {
      const recTitle = title.trim() || selectedFile.name;
      await api.uploadRecording(selectedFile.uri, selectedFile.name, recTitle);
      Alert.alert('Success!', 'File uploaded. AI transcription started!');
      setSelectedFile(null);
      setTitle('');
    } catch (e) {
      Alert.alert('Upload Failed', 'Please check your connection and try again');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="cloud-upload" size={48} color="#6C63FF" />
          <Text style={styles.headerTitle}>Upload Voice File</Text>
          <Text style={styles.headerSubtitle}>Any audio or video format supported</Text>
        </View>

        <View style={styles.formatsContainer}>
          <Text style={styles.formatsTitle}>Supported Formats</Text>
          <View style={styles.formatsGrid}>
            {SUPPORTED_FORMATS.map((f) => (
              <View key={f.ext} style={styles.formatBadge}>
                <Text style={styles.formatText}>{f.ext}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.dropzone} onPress={pickFile}>
          {selectedFile ? (
            <View style={styles.fileInfo}>
              <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
              <Text style={styles.fileName} numberOfLines={2}>{selectedFile.name}</Text>
              <Text style={styles.fileSize}>{formatSize(selectedFile.size)}</Text>
              <Text style={styles.changeFile}>Tap to change</Text>
            </View>
          ) : (
            <View style={styles.dropzoneContent}>
              <Ionicons name="folder-open-outline" size={48} color="#6C63FF" />
              <Text style={styles.dropzoneText}>Tap to browse files</Text>
              <Text style={styles.dropzoneSubtext}>Audio or video files up to 500MB</Text>
            </View>
          )}
        </TouchableOpacity>

        {selectedFile && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Title (auto-filled from filename)"
              placeholderTextColor="#555"
              value={title}
              onChangeText={setTitle}
            />
            <TouchableOpacity
              style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
              onPress={uploadFile}
              disabled={uploading}
            >
              {uploading ? (
                <><ActivityIndicator color="#fff" /><Text style={styles.uploadBtnText}>Uploading...</Text></>
              ) : (
                <><Ionicons name="cloud-upload" size={24} color="#fff" /><Text style={styles.uploadBtnText}>Upload & Transcribe</Text></>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 12 },
  headerSubtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  formatsContainer: { marginBottom: 24 },
  formatsTitle: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  formatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formatBadge: { backgroundColor: '#6C63FF22', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#6C63FF44' },
  formatText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  dropzone: {
    borderWidth: 2, borderColor: '#2a2a4a', borderStyle: 'dashed',
    borderRadius: 16, padding: 40, alignItems: 'center', marginBottom: 24, backgroundColor: '#1a1a2e',
  },
  dropzoneContent: { alignItems: 'center' },
  dropzoneText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 12 },
  dropzoneSubtext: { color: '#666', fontSize: 14, marginTop: 4 },
  fileInfo: { alignItems: 'center' },
  fileName: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  fileSize: { color: '#888', fontSize: 13, marginTop: 4 },
  changeFile: { color: '#6C63FF', fontSize: 13, marginTop: 8 },
  input: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16,
    color: '#fff', fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a4a',
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6C63FF', borderRadius: 16, padding: 18, gap: 12,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
