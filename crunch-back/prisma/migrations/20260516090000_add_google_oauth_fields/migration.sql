ALTER TABLE `users`
  ADD COLUMN `auth_provider` VARCHAR(30) NOT NULL DEFAULT 'local',
  ADD COLUMN `google_id` VARCHAR(100) NULL,
  ADD COLUMN `naver_id` VARCHAR(100) NULL,
  ADD COLUMN `kakao_id` VARCHAR(100) NULL;

CREATE UNIQUE INDEX `users_google_id_key` ON `users`(`google_id`);
CREATE UNIQUE INDEX `users_naver_id_key` ON `users`(`naver_id`);
CREATE UNIQUE INDEX `users_kakao_id_key` ON `users`(`kakao_id`);
