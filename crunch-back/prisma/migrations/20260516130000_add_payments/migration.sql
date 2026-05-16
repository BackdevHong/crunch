ALTER TABLE `projects`
  MODIFY `status` ENUM('결제대기', '모집중', '진행중', '완료', '취소') NOT NULL DEFAULT '모집중';

CREATE TABLE `payments` (
  `id` CHAR(36) NOT NULL,
  `purpose` ENUM('SERVICE_ORDER', 'PROJECT_DEPOSIT') NOT NULL,
  `status` ENUM('READY', 'REQUESTED', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED') NOT NULL DEFAULT 'READY',
  `provider` VARCHAR(30) NOT NULL DEFAULT 'nicepay',
  `moid` VARCHAR(64) NOT NULL,
  `tid` VARCHAR(40) NULL,
  `order_id` CHAR(36) NULL,
  `project_id` CHAR(36) NULL,
  `buyer_id` CHAR(36) NOT NULL,
  `seller_id` CHAR(36) NULL,
  `amount` INT NOT NULL,
  `fee_rate` DECIMAL(5, 4) NULL,
  `fee_amount` INT NULL,
  `seller_amount` INT NULL,
  `deposit_rate` DECIMAL(5, 4) NULL,
  `goods_name` VARCHAR(120) NOT NULL,
  `pay_method` VARCHAR(20) NULL,
  `requested_at` DATETIME(3) NULL,
  `approved_at` DATETIME(3) NULL,
  `failed_at` DATETIME(3) NULL,
  `canceled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `payments_moid_key` (`moid`),
  INDEX `payments_buyer_id_created_at_idx` (`buyer_id`, `created_at`),
  INDEX `payments_order_id_idx` (`order_id`),
  INDEX `payments_project_id_idx` (`project_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payments_buyer_id_fkey`
    FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payments_order_id_fkey`
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_events` (
  `id` CHAR(36) NOT NULL,
  `payment_id` CHAR(36) NULL,
  `provider` VARCHAR(30) NOT NULL DEFAULT 'nicepay',
  `event_type` VARCHAR(60) NOT NULL,
  `payload` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `payment_events_payment_id_idx` (`payment_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_events_payment_id_fkey`
    FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
