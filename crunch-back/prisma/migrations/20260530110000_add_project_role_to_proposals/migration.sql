ALTER TABLE `proposals`
  ADD COLUMN `project_role_id` CHAR(36) NULL;

CREATE INDEX `proposals_project_role_id_idx` ON `proposals`(`project_role_id`);

ALTER TABLE `proposals`
  ADD CONSTRAINT `proposals_project_role_id_fkey`
  FOREIGN KEY (`project_role_id`) REFERENCES `project_roles`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
