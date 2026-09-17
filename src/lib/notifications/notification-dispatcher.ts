// ==============================================================================
// src/lib/notifications/notification-dispatcher.ts
// In-App & Email Webhook Notification Dispatcher
// Dispatches notifications for assignments, blockers, mentions, and due dates.
// ==============================================================================

import { UserNotification, Task, UserProfile } from '@/types/database';
import { db } from '@/lib/supabase/mock-db';

export interface NotificationPreferences {
  inApp: boolean;
  emailWebhook: boolean;
  frequency: 'instant' | 'daily_digest';
  categories: {
    taskAssigned: boolean;
    dueSoon: boolean;
    blockerResolved: boolean;
    mentions: boolean;
  };
}

export const defaultNotificationPreferences: NotificationPreferences = {
  inApp: true,
  emailWebhook: true,
  frequency: 'instant',
  categories: {
    taskAssigned: true,
    dueSoon: true,
    blockerResolved: true,
    mentions: true,
  },
};

export class NotificationDispatcher {
  public static dispatch(
    data: Omit<UserNotification, 'id' | 'created_at' | 'is_read'>
  ): UserNotification {
    return db.createNotification(data);
  }

  public static notifyTaskAssigned(
    task: Task,
    assignee: UserProfile,
    actor: UserProfile,
    tenantId: string
  ): UserNotification {
    return this.dispatch({
      tenant_id: tenantId,
      recipient_id: assignee.id,
      actor_id: actor.id,
      event_type: 'task_assigned',
      title: 'New Task Assignment',
      message: `${actor.full_name} assigned you to task "${task.title}".`,
      entity_type: 'task',
      entity_id: task.id,
    });
  }

  public static notifyDueSoon(
    task: Task,
    recipient: UserProfile,
    hoursRemaining: number,
    tenantId: string
  ): UserNotification {
    return this.dispatch({
      tenant_id: tenantId,
      recipient_id: recipient.id,
      actor_id: null,
      event_type: 'due_soon',
      title: 'Task Due Soon',
      message: `Task "${task.title}" is due in approximately ${hoursRemaining} hours.`,
      entity_type: 'task',
      entity_id: task.id,
    });
  }

  public static notifyDependencyResolved(
    task: Task,
    predecessorTask: Task,
    recipient: UserProfile,
    tenantId: string
  ): UserNotification {
    return this.dispatch({
      tenant_id: tenantId,
      recipient_id: recipient.id,
      actor_id: null,
      event_type: 'dependency_blocked',
      title: 'Predecessor Dependency Completed',
      message: `Predecessor "${predecessorTask.title}" is done. You can now start "${task.title}".`,
      entity_type: 'task',
      entity_id: task.id,
    });
  }

  public static notifyMention(
    task: Task,
    mentionedUser: UserProfile,
    actor: UserProfile,
    snippet: string,
    tenantId: string
  ): UserNotification {
    return this.dispatch({
      tenant_id: tenantId,
      recipient_id: mentionedUser.id,
      actor_id: actor.id,
      event_type: 'mention',
      title: `Mentioned in ${task.title}`,
      message: `${actor.full_name} mentioned you: "${snippet}"`,
      entity_type: 'task',
      entity_id: task.id,
    });
  }
}
