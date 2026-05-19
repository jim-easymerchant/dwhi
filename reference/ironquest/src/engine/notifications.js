import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MONSTER_PERSIST_KEY } from '../store/combatStore';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log('[IQ] expo-notifications handler init skipped in Expo Go');
}

export async function requestNotificationPermissions() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.log('[IQ] Cannot request notification permissions in Expo Go');
    return false;
  }
}

export async function scheduleDungeonTriggers() {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  try {
    // Clear all pending before scheduling new ones
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 1. Post-session hook (+8 hours)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Tavern Restocked',
        body: 'Phil has opinions about your last performance.',
      },
      trigger: { seconds: 8 * 60 * 60 },
    });

    // 2. Idle nudge (+48 hours)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Absence Noted',
        body: 'A monster has been pacing the dungeon. It filed a complaint about your absence. The complaint was acknowledged.',
      },
      trigger: { seconds: 48 * 60 * 60 },
    });

    // 3. Defeat Taunt (+24 hours)
    const saved = await AsyncStorage.getItem(MONSTER_PERSIST_KEY);
    if (saved) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Unfinished Business',
          body: 'The monster waits at the dungeon entrance. It is worse at fighting now, but more emotionally prepared.',
        },
        trigger: { seconds: 24 * 60 * 60 },
      });
    }
  } catch (e) {
    console.log('[IQ] Notification scheduling skipped (Expo Go limitation)');
  }
}
