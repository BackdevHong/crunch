ALTER TABLE `projects`
  ADD COLUMN `budget` INT NULL;

CREATE TABLE `project_roles` (
  `id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NOT NULL,
  `role` VARCHAR(80) NOT NULL,
  `headcount` INT NOT NULL DEFAULT 1,
  `budget_percent` INT NOT NULL,
  `budget_amount` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `project_roles_project_id_idx` (`project_id`),
  CONSTRAINT `project_roles_project_id_fkey`
    FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
