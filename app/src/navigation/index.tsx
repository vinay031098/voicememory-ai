import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import UploadScreen from '../screens/UploadScreen';
import ChatScreen from '../screens/ChatScreen';
import TopicsScreen from '../screens/TopicsScreen';
import RecordingDetailScreen from '../screens/RecordingDetailScreen';

export type RootStackParamList = {
  Main: undefined;
  RecordingDetail: { id: string; title: string };
};

export type TabParamList = {
  Home: undefined;
  Record: undefined;
  Upload: undefined;
  Chat: undefined;
  Topics: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Record') iconName = focused ? 'mic' : 'mic-outline';
          else if (route.name === 'Upload') iconName = focused ? 'cloud-upload' : 'cloud-upload-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          else if (route.name === 'Topics') iconName = focused ? 'layers' : 'layers-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a4a' },
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'VoiceMemory AI' }} />
      <Tab.Screen name="Record" component={RecordScreen} options={{ title: 'Record' }} />
      <Tab.Screen name="Upload" component={UploadScreen} options={{ title: 'Upload' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'AI Chat' }} />
      <Tab.Screen name="Topics" component={TopicsScreen} options={{ title: 'Topics' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="RecordingDetail"
        component={RecordingDetailScreen}
        options={{ headerShown: true, title: 'Recording', headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#fff' }}
      />
    </Stack.Navigator>
  );
}
