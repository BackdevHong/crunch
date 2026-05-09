import { prisma } from './prisma'

type AdminAuditInput = {
  adminId: string
  action: string
  targetType: string
  targetId: string
  message: string
  metadata?: Record<string, unknown>
}

export async function writeAdminAuditLog(input: AdminAuditInput): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO admin_audit_logs
      (id, admin_id, action, target_type, target_id, message, metadata)
    VALUES
      (UUID(), ${input.adminId}, ${input.action}, ${input.targetType}, ${input.targetId}, ${input.message}, ${input.metadata ? JSON.stringify(input.metadata) : null})
  `
}
