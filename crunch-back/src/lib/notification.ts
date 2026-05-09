import { prisma } from './prisma'

type NotificationInput = {
  userId: string
  type: string
  title: string
  message: string
  link?: string
}

type BroadcastNotificationInput = Omit<NotificationInput, 'userId'> & {
  userIds: string[]
}

export async function createUserNotification(input: NotificationInput): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO user_notifications
      (id, user_id, type, title, message, link)
    VALUES
      (UUID(), ${input.userId}, ${input.type}, ${input.title}, ${input.message}, ${input.link ?? null})
  `
}

export async function createUserNotifications(input: BroadcastNotificationInput): Promise<void> {
  const userIds = [...new Set(input.userIds)].filter(Boolean)
  if (userIds.length === 0) return

  await Promise.all(userIds.map(userId => createUserNotification({
    userId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
  })))
}
