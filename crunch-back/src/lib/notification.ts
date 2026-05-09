import { prisma } from './prisma'

type NotificationInput = {
  userId: string
  type: string
  title: string
  message: string
  link?: string
}

export async function createUserNotification(input: NotificationInput): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO user_notifications
      (id, user_id, type, title, message, link)
    VALUES
      (UUID(), ${input.userId}, ${input.type}, ${input.title}, ${input.message}, ${input.link ?? null})
  `
}
