// src/lib/notifications.ts
import { prisma } from './prisma';
import type { NotificationType } from '@prisma/client';

/*
 * Create an in-app notification for a specific user about a specific event.
 *
 * Why this function is shaped the way it is
 * -----------------------------------------
 * This helper is called from eight different lifecycle routes in the app:
 * tenancy creation, tenancy response, agreement finalization, agreement
 * response, payment proof upload, payment verification, condition report
 * creation, and condition report acknowledgement. The call sites all need
 * the same four pieces of information (who to notify, what type, a title,
 * a body) plus an optional link. Keeping the signature to five primitive
 * arguments rather than an options object means each call site reads as
 * one clear line — no object construction, no destructuring.
 *
 * Error handling philosophy
 * -------------------------
 * A notification creation failure must NEVER propagate upward. Why? Because
 * the primary action the user just performed (signing an agreement, uploading
 * a payment proof) has already succeeded at the database level by the time
 * this helper is called. If we let a notification error bubble up, the HTTP
 * response would show a failure even though the action actually worked,
 * and the user would be confused and might retry the primary action —
 * creating duplicate payments, duplicate signatures, or worse.
 *
 * So we catch everything here. The notification just silently fails to appear,
 * the user's primary action succeeds, and we log the error to the server
 * console for debugging. This is a trade — notification reliability is worse,
 * primary-action reliability is better. For a tenancy platform, that is the
 * correct trade.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        link: link ?? null,
      },
    });
  } catch (error) {
    // Log so we can spot recurring failures during testing, but never throw.
    console.error('[createNotification] Failed to create notification:', {
      userId,
      type,
      error,
    });
  }
}
