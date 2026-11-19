import notifee, { AndroidImportance, AuthorizationStatus, TriggerType, type TimestampTrigger } from '@notifee/react-native';
import { i18n } from '../../i18n';
import type { PlannedReminder } from './plan';

const CHANNEL = 'rabb-reminders';

/** Permission education happens in the app (AppSelection) before this system prompt is shown. */
export async function requestNotificationPermission(): Promise<boolean> {
  const s = await notifee.requestPermission();
  return s.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function replaceScheduledReminders(plan: PlannedReminder[]): Promise<void> {
  await notifee.cancelTriggerNotifications();
  const channelId = await notifee.createChannel({ id: CHANNEL, name: i18n.t('settings.notifications'), importance: AndroidImportance.DEFAULT });
  for (const r of plan) {
    const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: r.atMs };
    await notifee.createTriggerNotification(
      {
        id: r.id,
        title: i18n.t(r.kind === 'morning_reminder' ? 'notifications.morningTitle' : 'notifications.nudgeTitle'),
        body: i18n.t(r.kind === 'morning_reminder' ? 'notifications.morningBody' : 'notifications.nudgeBody'),
        data: { url: 'rabbai://ritual' },
        android: { channelId, pressAction: { id: 'default', launchActivity: 'default' } },
      },
      trigger,
    );
  }
}
