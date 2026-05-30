ALTER TABLE `settlements`
  MODIFY `status` ENUM('READY', 'AVAILABLE', 'REQUESTED', 'PAID', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'READY';

UPDATE `settlements`
SET `status` = 'AVAILABLE', `paid_at` = NULL
WHERE `status` = 'PAID';
