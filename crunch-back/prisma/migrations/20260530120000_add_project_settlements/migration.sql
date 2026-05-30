ALTER TABLE `payments`
  MODIFY `purpose` ENUM('SERVICE_ORDER', 'PROJECT_DEPOSIT', 'PROJECT_BALANCE') NOT NULL;

CREATE TABLE `settlements` (
  `id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NOT NULL,
  `proposal_id` CHAR(36) NOT NULL,
  `freelancer_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `payment_id` CHAR(36) NULL,
  `amount` INT NOT NULL,
  `platform_fee_rate` DECIMAL(5, 4) NOT NULL,
  `platform_fee_amount` INT NOT NULL,
  `payout_amount` INT NOT NULL,
  `status` ENUM('READY', 'REQUESTED', 'PAID', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'READY',
  `requested_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `settlements_proposal_id_key` (`proposal_id`),
  INDEX `settlements_project_id_idx` (`project_id`),
  INDEX `settlements_freelancer_id_idx` (`freelancer_id`),
  INDEX `settlements_user_id_idx` (`user_id`),
  INDEX `settlements_payment_id_idx` (`payment_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `settlements_project_id_fkey`
    FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `settlements_proposal_id_fkey`
    FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `settlements_freelancer_id_fkey`
    FOREIGN KEY (`freelancer_id`) REFERENCES `freelancers`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `settlements_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `settlements_payment_id_fkey`
    FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
