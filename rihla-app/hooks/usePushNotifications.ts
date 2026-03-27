import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import apiClient from '../lib/api';

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // Use raw device FCM token — backend sends via Firebase HTTP v1 API directly
  const deviceToken = await Notifications.getDevicePushTokenAsync();
  return deviceToken.data as string;
}

async function sendTokenToServer(token: string) {
  try {
    await apiClient.post('/users/me/push-token', { token, platform: Platform.OS });
  } catch {
    // Non-critical — silently ignore
  }
}

function navigateFromData(data: Record<string, string> | undefined) {
  if (!data) return;
  // Support ticket reply/status notification
  if (data.ticketId && data.ticketType === 'trip') {
    router.push({
      pathname: '/support/trip-ticket' as any,
      params: { ticketId: data.ticketId },
    });
  } else if (data.ticketId && data.ticketType === 'admin') {
    router.push({
      pathname: '/support/admin-ticket' as any,
      params: { ticketId: data.ticketId },
    });
  // Trip update notification: open the booking screen focused on updates tab
  } else if (data.registrationId && data.tripUpdateId) {
    router.push({
      pathname: '/booking/[registrationId]',
      params: { registrationId: data.registrationId, focusUpdateId: data.tripUpdateId },
    } as any);
  } else if (data.registrationId) {
    router.push(`/booking/${data.registrationId}`);
  } else if (data.tripId) {
    router.push(`/trip/${data.tripId}`);
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const tokenListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Expo Go (SDK 53+) removed remote notification support — skip silently
    let cleanup: (() => void) | undefined;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      registerForPushNotifications().then((token) => {
        if (token) sendTokenToServer(token);
      });

      // Handle cold-start: app was killed and user tapped a notification to open it
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          const data = response.notification.request.content.data as Record<string, string> | undefined;
          navigateFromData(data);
        }
      });

      // Token rotation: OS can invalidate and issue a new FCM token at any time
      // (e.g. app reinstall, OS update, Firebase token refresh cycle)
      tokenListener.current = Notifications.addPushTokenListener((newToken) => {
        if (newToken.data) sendTokenToServer(newToken.data as string);
      });

      // Fires when a notification is received while app is foregrounded
      notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
        // Foreground notification received — setNotificationHandler above shows it automatically
      });

      // Fires when user taps a notification while app is foregrounded or backgrounded
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        navigateFromData(data);
      });

      cleanup = () => {
        notificationListener.current?.remove();
        responseListener.current?.remove();
        tokenListener.current?.remove();
      };
    } catch {
      // Push notifications not supported in this environment (e.g. Expo Go SDK 53+)
    }

    return () => cleanup?.();
  }, []);
}
