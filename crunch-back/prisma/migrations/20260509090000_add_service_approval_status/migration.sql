ALTER TABLE `services`
  ADD COLUMN `approval_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `rejected_reason` TEXT NULL;

UPDATE `services`
SET `approval_status` = 'APPROVED'
WHERE `is_active` = true;
