import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '../../hooks/useTheme';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';
export default function TabsLayout() {
  const { colors } = useTheme();
  const { reduceMotion } = useMotionPreferences();
  return <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade', sceneStyle: { backgroundColor: colors.background } }}>
    <Tabs.Screen name="index" />
    <Tabs.Screen name="shop" />
    <Tabs.Screen name="cart" />
    <Tabs.Screen name="categories" />
    <Tabs.Screen name="profile" />
    <Tabs.Screen name="favorites" options={{ href: null }} />
  </Tabs>;
}
