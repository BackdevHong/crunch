CREATE TABLE `project_invitations` (
  `id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NOT NULL,
  `freelancer_id` CHAR(36) NOT NULL,
  `message` TEXT NULL,
  `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `project_invitations_project_id_freelancer_id_key` (`project_id`, `freelancer_id`),
  INDEX `project_invitations_freelancer_id_idx` (`freelancer_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `project_invitations_project_id_fkey`
    FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_invitations_freelancer_id_fkey`
    FOREIGN KEY (`freelancer_id`) REFERENCES `freelancers`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
