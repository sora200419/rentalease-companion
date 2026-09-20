import { prisma } from './prisma';

// Sends a message within a tenancy thread.
// Used both for human-typed messages (from the UI) and system-generated
// notifications (from API routes after lifecycle events).
export async function sendSystemMessage(
  tenancyId: string,
  senderId: string,
  receiverId: string,
  content: string,
): Promise<void> {
  await prisma.message.create({
    data: {
      tenancyId,
      senderId,
      receiverId,
      content,
      read: false, // always starts unread for the recipient
    },
  });
}
