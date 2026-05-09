CREATE TABLE `admin_audit_logs` (
  `id` CHAR(36) NOT NULL,
  `admin_id` CHAR(36) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(40) NOT NULL,
  `target_id` CHAR(36) NOT NULL,
  `message` VARCHAR(255) NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `admin_audit_logs_admin_id_idx`(`admin_id`),
  INDEX `admin_audit_logs_target_type_target_id_idx`(`target_type`, `target_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `admin_audit_logs`
  ADD CONSTRAINT `admin_audit_logs_admin_id_fkey`
  FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

