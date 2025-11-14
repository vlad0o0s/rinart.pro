-- SQL schema for rinart.pro project
-- Run this against the target MySQL database once (example: mysql -u user -p dbname < sql/schema.sql)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `ProjectScheme`;
DROP TABLE IF EXISTS `ProjectMedia`;
DROP TABLE IF EXISTS `Project`;

CREATE TABLE `Project` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(191) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `tagline` TEXT NULL,
  `location` TEXT NULL,
  `year` TEXT NULL,
  `area` TEXT NULL,
  `scope` TEXT NULL,
  `intro` TEXT NULL,
  `heroImageUrl` TEXT NULL,
  `order` INT NOT NULL DEFAULT 0,
  `categories` JSON NULL,
  `content` JSON NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Project_slug_key` (`slug`),
  KEY `Project_order_idx` (`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ProjectMedia` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `projectId` INT UNSIGNED NOT NULL,
  `url` TEXT NOT NULL,
  `caption` TEXT NULL,
  `kind` ENUM('FEATURE','GALLERY','SCHEME') NOT NULL DEFAULT 'GALLERY',
  `order` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ProjectMedia_projectId_idx` (`projectId`),
  KEY `ProjectMedia_project_order_idx` (`projectId`,`order`),
  CONSTRAINT `ProjectMedia_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ProjectScheme` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `projectId` INT UNSIGNED NOT NULL,
  `title` TEXT NOT NULL,
  `url` TEXT NOT NULL,
  `order` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ProjectScheme_projectId_idx` (`projectId`),
  KEY `ProjectScheme_project_order_idx` (`projectId`,`order`),
  CONSTRAINT `ProjectScheme_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AdminUser` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `login` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AdminUser_login_key` (`login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AdminSession` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` INT UNSIGNED NOT NULL,
  `token` CHAR(64) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AdminSession_token_key` (`token`),
  KEY `AdminSession_user_idx` (`userId`),
  CONSTRAINT `AdminSession_user_fkey` FOREIGN KEY (`userId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
