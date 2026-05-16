
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounting_anomalies` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `anomaly_type` varchar(50) NOT NULL,
  `severity` varchar(20) NOT NULL,
  `user_id` bigint DEFAULT NULL,
  `stream_record_id` bigint DEFAULT NULL,
  `transaction_id` bigint DEFAULT NULL,
  `platform_transaction_id` bigint DEFAULT NULL,
  `detected_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expected_value` decimal(12,4) DEFAULT NULL,
  `actual_value` decimal(12,4) DEFAULT NULL,
  `delta_value` decimal(12,4) DEFAULT NULL,
  `description` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'OPEN',
  `resolved_at` datetime DEFAULT NULL,
  `resolution_note` text,
  `audit_run_id` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_anomaly_type` (`anomaly_type`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_stream_id` (`stream_record_id`),
  KEY `idx_status` (`status`),
  KEY `idx_detected_at` (`detected_at`),
  KEY `idx_anom_platform_tx` (`platform_transaction_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_name` varchar(100) NOT NULL,
  `trigger` varchar(30) NOT NULL DEFAULT 'MANUAL',
  `requested_by_user_id` bigint DEFAULT NULL,
  `from_ts` timestamp NULL DEFAULT NULL,
  `to_ts` timestamp NULL DEFAULT NULL,
  `scope` varchar(50) NOT NULL DEFAULT 'DEFAULT',
  `dry_run` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(20) NOT NULL DEFAULT 'RUNNING',
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` timestamp NULL DEFAULT NULL,
  `checks_executed` int NOT NULL DEFAULT '0',
  `anomalies_found` int NOT NULL DEFAULT '0',
  `anomalies_created` int NOT NULL DEFAULT '0',
  `anomalies_updated` int NOT NULL DEFAULT '0',
  `error_message` text,
  `execution_ms` bigint DEFAULT NULL,
  `input_hash` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_runs_job_time` (`job_name`,`started_at`),
  KEY `idx_audit_runs_status_time` (`status`,`started_at`),
  KEY `idx_audit_runs_from_to` (`from_ts`,`to_ts`),
  KEY `idx_audit_runs_requested_by` (`requested_by_user_id`),
  CONSTRAINT `fk_audit_runs_requested_by_user` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backoffice_access_audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `target_user_id` bigint NOT NULL,
  `actor_user_id` bigint DEFAULT NULL,
  `action` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_backoffice_access_audit_target_user` (`target_user_id`),
  KEY `idx_backoffice_access_audit_actor_user` (`actor_user_id`),
  KEY `idx_backoffice_access_audit_action` (`action`),
  KEY `idx_backoffice_access_audit_created_at` (`created_at`),
  CONSTRAINT `fk_backoffice_access_audit_actor_user` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_backoffice_access_audit_target_user` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backoffice_roles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backoffice_user_access` (
  `user_id` bigint NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by_user_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `idx_backoffice_user_access_active` (`active`),
  KEY `idx_backoffice_user_access_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_backoffice_user_access_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_backoffice_user_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `balances` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `transaction_id` bigint NOT NULL,
  `operation_type` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `balance` decimal(10,2) NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `description` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_balances_transaction_id` (`transaction_id`),
  KEY `idx_balances_user_time` (`user_id`,`timestamp`),
  KEY `idx_balances_time` (`timestamp`),
  KEY `idx_balances_user_time_id` (`user_id`,`timestamp`,`id`),
  CONSTRAINT `fk_transaction_balance` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`),
  CONSTRAINT `fk_user_balance` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=805 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_documents` (
  `user_id` bigint NOT NULL,
  `url_pic` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_client_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `user_id` bigint NOT NULL,
  `streaming_hours` decimal(10,2) DEFAULT NULL,
  `saldo_actual` decimal(10,2) DEFAULT NULL,
  `total_pagos` decimal(10,2) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `consent_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event_type` varchar(32) NOT NULL,
  `version` varchar(20) DEFAULT NULL,
  `consent_id` varchar(64) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `user_id_norm` bigint GENERATED ALWAYS AS (ifnull(`user_id`,0)) STORED,
  `ts` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_agent` varchar(512) DEFAULT NULL,
  `ip_hint` varchar(64) DEFAULT NULL,
  `path` varchar(1024) DEFAULT NULL,
  `sig` varchar(128) NOT NULL,
  `version_norm` varchar(20) GENERATED ALWAYS AS (ifnull(`version`,_utf8mb4'')) STORED,
  PRIMARY KEY (`id`),
  KEY `idx_consent_events_cid_ts` (`consent_id`,`ts`),
  KEY `idx_consent_events_type_ts` (`event_type`,`ts`),
  KEY `idx_consent_events_user_ts` (`user_id`,`ts`)
) ENGINE=InnoDB AUTO_INCREMENT=619 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verification_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `sent_to_email` varchar(255) NOT NULL,
  `created_by_user_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email_verification_tokens_token_hash` (`token_hash`),
  KEY `idx_evt_user_id` (`user_id`),
  KEY `idx_evt_expires_at` (`expires_at`),
  KEY `idx_evt_token_hash` (`token_hash`),
  CONSTRAINT `fk_evt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorites_clients` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `model_id` bigint NOT NULL,
  `client_id` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `invited` varchar(16) NOT NULL DEFAULT 'pending',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_model_client` (`model_id`,`client_id`),
  KEY `idx_fav_clients_model` (`model_id`),
  KEY `idx_fav_clients_client` (`client_id`),
  KEY `idx_fav_clients_created` (`created_at`),
  KEY `idx_fav_clients_status` (`status`),
  KEY `idx_fav_clients_invited` (`invited`),
  CONSTRAINT `fk_fav_clients_client` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_clients_model` FOREIGN KEY (`model_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorites_models` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_id` bigint NOT NULL,
  `model_id` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `invited` varchar(16) NOT NULL DEFAULT 'pending',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_client_model` (`client_id`,`model_id`),
  KEY `idx_fav_models_client` (`client_id`),
  KEY `idx_fav_models_model` (`model_id`),
  KEY `idx_fav_models_created` (`created_at`),
  KEY `idx_fav_models_status` (`status`),
  KEY `idx_fav_models_invited` (`invited`),
  CONSTRAINT `fk_fav_models_client` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_models_model` FOREIGN KEY (`model_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gifts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(64) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `tier` varchar(32) NOT NULL DEFAULT 'QUICK',
  `sort_order` int NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `featured` tinyint(1) NOT NULL DEFAULT '0',
  `animation_key` varchar(64) DEFAULT NULL,
  `locale_key` varchar(128) DEFAULT NULL,
  `icon` varchar(512) NOT NULL,
  `cost` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `home_featured_models` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `model_id` bigint NOT NULL,
  `position` int NOT NULL,
  `source_type` varchar(20) NOT NULL,
  `avatar_url` varchar(500) NOT NULL,
  `video_url` varchar(500) NOT NULL,
  `snapshot_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_home_featured_position` (`position`),
  KEY `fk_home_featured_model_user` (`model_id`),
  CONSTRAINT `fk_home_featured_model_user` FOREIGN KEY (`model_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11425 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kyc_provider_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider_key` varchar(50) NOT NULL,
  `active_mode` varchar(20) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `note` varchar(255) DEFAULT NULL,
  `updated_by_user_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_kyc_provider_config_key` (`provider_key`),
  KEY `idx_kyc_provider_config_mode` (`active_mode`),
  KEY `idx_kyc_provider_config_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kyc_webhook_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_event_id` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_session_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_signature_valid` tinyint(1) NOT NULL DEFAULT '0',
  `is_processed` tinyint(1) NOT NULL DEFAULT '0',
  `processing_error_message` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_kwe_provider_event` (`provider`,`provider_event_id`),
  KEY `idx_kwe_provider_session` (`provider`,`provider_session_id`),
  KEY `idx_kwe_processed` (`is_processed`),
  KEY `idx_kwe_processed_received_at` (`is_processed`,`received_at`),
  KEY `idx_kwe_provider_received_at` (`provider`,`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_key` varchar(64) NOT NULL,
  `sender_id` bigint NOT NULL,
  `recipient_id` bigint NOT NULL,
  `body` varchar(1000) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read_at` datetime(3) DEFAULT NULL,
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_messages_conv_created` (`conversation_key`,`created_at`,`id`),
  KEY `idx_messages_sender_created` (`sender_id`,`created_at`,`id`),
  KEY `idx_messages_recipient_readat` (`recipient_id`,`read_at`),
  CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=318 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_contract_acceptances` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `contract_version` varchar(50) NOT NULL,
  `contract_sha256` varchar(64) NOT NULL,
  `accepted_at` datetime NOT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_model_contract_user_version` (`user_id`,`contract_version`),
  KEY `idx_mca_user_id` (`user_id`),
  CONSTRAINT `fk_model_contract_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_documents` (
  `user_id` bigint NOT NULL,
  `url_verific_front` varchar(500) DEFAULT NULL,
  `url_verific_back` varchar(500) DEFAULT NULL,
  `url_verific_doc` varchar(500) DEFAULT NULL,
  `url_pic` varchar(500) DEFAULT NULL,
  `url_video` varchar(500) DEFAULT NULL,
  `url_consent` varchar(500) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_model_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_earning_tiers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_billed_minutes` int NOT NULL,
  `first_minute_earning_per_min` decimal(10,4) NOT NULL,
  `next_minutes_earning_per_min` decimal(10,4) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_kyc_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `provider` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_session_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_vendor_ref` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `kyc_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_decision_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_decision_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hosted_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `last_webhook_at` datetime DEFAULT NULL,
  `last_provider_event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mks_provider_session` (`provider`,`provider_session_id`),
  KEY `idx_mks_user_id` (`user_id`),
  KEY `idx_mks_provider_status` (`provider_status`),
  KEY `idx_mks_provider` (`provider`),
  KEY `idx_mks_user_created_at` (`user_id`,`created_at`),
  KEY `idx_mks_provider_status_updated_at` (`provider`,`provider_status`,`updated_at`),
  CONSTRAINT `fk_model_kyc_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_review_checklist` (
  `user_id` bigint NOT NULL,
  `front_ok` tinyint(1) NOT NULL DEFAULT '0',
  `back_ok` tinyint(1) NOT NULL DEFAULT '0',
  `selfie_ok` tinyint(1) NOT NULL DEFAULT '0',
  `last_reviewer_id` bigint DEFAULT NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_tier_daily_snapshots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `model_id` bigint NOT NULL,
  `snapshot_date` date NOT NULL,
  `window_start` datetime NOT NULL,
  `window_end` datetime NOT NULL,
  `billed_seconds` bigint NOT NULL,
  `billed_minutes` int NOT NULL,
  `tier_id` bigint NOT NULL,
  `tier_name` varchar(50) NOT NULL,
  `first_minute_earning_per_min` decimal(10,4) NOT NULL,
  `next_minutes_earning_per_min` decimal(10,4) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_day` (`model_id`,`snapshot_date`),
  KEY `idx_model` (`model_id`),
  KEY `idx_snapshot_date` (`snapshot_date`)
) ENGINE=InnoDB AUTO_INCREMENT=276 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `models` (
  `user_id` bigint NOT NULL,
  `profile_visits` int DEFAULT '0',
  `streaming_hours` decimal(5,2) DEFAULT '0.00',
  `objetivo_ganancias` decimal(10,2) DEFAULT NULL,
  `saldo_actual` decimal(10,2) DEFAULT NULL,
  `total_ingresos` decimal(10,2) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `models_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `moderation_reports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `reporter_user_id` bigint NOT NULL,
  `reported_user_id` bigint NOT NULL,
  `stream_record_id` bigint DEFAULT NULL,
  `report_type` varchar(32) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `admin_action` varchar(20) NOT NULL,
  `auto_blocked` tinyint(1) NOT NULL DEFAULT '0',
  `resolution_notes` varchar(2000) DEFAULT NULL,
  `reviewed_by_user_id` bigint DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mr_reporter` (`reporter_user_id`),
  KEY `idx_mr_reported` (`reported_user_id`),
  KEY `idx_mr_status` (`status`),
  KEY `idx_mr_type` (`report_type`),
  KEY `idx_mr_created` (`created_at`),
  KEY `idx_mr_stream` (`stream_record_id`),
  KEY `fk_mr_reviewed_by_user` (`reviewed_by_user_id`),
  CONSTRAINT `fk_mr_reported_user` FOREIGN KEY (`reported_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_mr_reporter_user` FOREIGN KEY (`reporter_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_mr_reviewed_by_user` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_mr_stream_record` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `request_ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_prt_token_hash` (`token_hash`),
  KEY `ix_prt_user` (`user_id`),
  KEY `ix_prt_expires` (`expires_at`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `pack_id` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) NOT NULL,
  `first_payment` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(20) NOT NULL,
  `order_id` varchar(100) NOT NULL,
  `psp_transaction_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_sessions_order` (`order_id`),
  UNIQUE KEY `uk_payment_sessions_psp` (`psp_transaction_id`),
  KEY `idx_payment_sessions_user` (`user_id`),
  CONSTRAINT `fk_payment_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payout_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `model_user_id` bigint NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'EUR',
  `status` varchar(20) NOT NULL DEFAULT 'REQUESTED',
  `reason` varchar(255) DEFAULT NULL,
  `admin_notes` text,
  `reviewed_by_user_id` bigint DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payout_model_status` (`model_user_id`,`status`,`created_at`),
  KEY `fk_payout_reviewed_by` (`reviewed_by_user_id`),
  CONSTRAINT `fk_payout_model_user` FOREIGN KEY (`model_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_payout_reviewed_by` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `domain` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_balances` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transaction_id` bigint NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `balance` decimal(10,2) NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `description` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_platform_balances_transaction_id` (`transaction_id`),
  KEY `idx_platform_bal_time` (`timestamp`),
  KEY `idx_platform_bal_time_id` (`timestamp`,`id`),
  CONSTRAINT `fk_platform_bal_tx` FOREIGN KEY (`transaction_id`) REFERENCES `platform_transactions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=304 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `operation_type` varchar(50) NOT NULL,
  `stream_record_id` bigint DEFAULT NULL,
  `description` text,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_platform_tx_stream` (`stream_record_id`),
  KEY `idx_platform_tx_time` (`timestamp`),
  CONSTRAINT `fk_platform_tx_stream` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=304 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `replaced_by_token_id` bigint DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refresh_token_hash` (`token_hash`),
  KEY `fk_refresh_replaced` (`replaced_by_token_id`),
  KEY `idx_refresh_user` (`user_id`),
  KEY `idx_refresh_expiry` (`expires_at`),
  CONSTRAINT `fk_refresh_replaced` FOREIGN KEY (`replaced_by_token_id`) REFERENCES `refresh_tokens` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=398 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `role_id` bigint NOT NULL,
  `permission_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_permission` (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `backoffice_roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_id` bigint NOT NULL,
  `model_id` bigint NOT NULL,
  `stream_type` varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  `start_time` datetime NOT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `billable_start` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stream_client` (`client_id`),
  KEY `idx_stream_model` (`model_id`),
  KEY `idx_stream_confirmed_at` (`confirmed_at`),
  KEY `idx_stream_active_start` (`end_time`,`start_time`),
  KEY `idx_stream_type_active` (`stream_type`,`end_time`,`start_time`),
  KEY `idx_stream_client_active` (`client_id`,`end_time`,`start_time`),
  KEY `idx_stream_model_active` (`model_id`,`end_time`,`start_time`),
  CONSTRAINT `stream_records_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`),
  CONSTRAINT `stream_records_ibfk_2` FOREIGN KEY (`model_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_stream_records_stream_type` CHECK ((`stream_type` in (_utf8mb4'UNKNOWN',_utf8mb4'RANDOM',_utf8mb4'CALLING')))
) ENGINE=InnoDB AUTO_INCREMENT=317 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_status_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stream_record_id` bigint NOT NULL,
  `event_type` varchar(40) NOT NULL,
  `reason` varchar(100) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sse_stream_time` (`stream_record_id`,`created_at`),
  KEY `idx_sse_time` (`created_at`),
  CONSTRAINT `fk_sse_stream_record` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_sse_event_type` CHECK ((`event_type` in (_utf8mb4'CREATED',_utf8mb4'CONFIRMED',_utf8mb4'BILLING_STARTED',_utf8mb4'ENDED',_utf8mb4'CUT_LOW_BALANCE',_utf8mb4'DISCONNECT',_utf8mb4'TIMEOUT')))
) ENGINE=InnoDB AUTO_INCREMENT=1212 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `operation_type` varchar(50) NOT NULL,
  `stream_record_id` bigint DEFAULT NULL,
  `gift_id` bigint DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `description` text,
  PRIMARY KEY (`id`),
  KEY `fk_stream_record_transactions` (`stream_record_id`),
  KEY `fk_gift_transactions` (`gift_id`),
  KEY `idx_transactions_user_time` (`user_id`,`timestamp`),
  KEY `idx_transactions_time` (`timestamp`),
  CONSTRAINT `fk_gift_transactions` FOREIGN KEY (`gift_id`) REFERENCES `gifts` (`id`),
  CONSTRAINT `fk_stream_record_transactions` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`),
  CONSTRAINT `fk_user_transactions` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=805 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unsubscribe` (
  `user_id` bigint NOT NULL,
  `end_date` date NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `forfeit_after` date DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_unsubscribe_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_backoffice_roles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `role_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_role` (`user_id`,`role_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_backoffice_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_backoffice_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `backoffice_roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_blocks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `blocker_user_id` bigint NOT NULL,
  `blocked_user_id` bigint NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_blocks_pair` (`blocker_user_id`,`blocked_user_id`),
  KEY `idx_user_blocks_blocker` (`blocker_user_id`),
  KEY `idx_user_blocks_blocked` (`blocked_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_languages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `lang_code` varchar(5) NOT NULL,
  `level` varchar(10) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `preference_weight` int NOT NULL DEFAULT '50',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_lang` (`user_id`,`lang_code`),
  KEY `idx_user_languages_user` (`user_id`),
  KEY `idx_user_languages_lang` (`lang_code`),
  KEY `idx_user_languages_primary` (`is_primary`),
  CONSTRAINT `fk_user_languages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_permission_overrides` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `permission_id` bigint NOT NULL,
  `allowed` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_permission` (`user_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `user_permission_overrides_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_permission_overrides_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_trial_streams` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `viewer_user_id` bigint NOT NULL,
  `model_id` bigint NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `close_reason` varchar(50) DEFAULT NULL,
  `seconds` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_user_trial_streams_viewer` (`viewer_user_id`),
  KEY `fk_user_trial_streams_model` (`model_id`),
  CONSTRAINT `fk_user_trial_streams_model` FOREIGN KEY (`model_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_user_trial_streams_viewer` FOREIGN KEY (`viewer_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ui_locale` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'es',
  `country_detected` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `surname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `confir_adult` tinyint(1) NOT NULL DEFAULT '0',
  `accept_term` datetime DEFAULT NULL,
  `term_version` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `regist_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biography` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `interests` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `unsubscribe` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verification_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `account_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `suspended_until` datetime DEFAULT NULL,
  `risk_reason` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `risk_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `risk_updated_by` bigint DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `nickname` (`nickname`),
  KEY `idx_users_country_detected` (`country_detected`),
  KEY `fk_users_risk_updated_by` (`risk_updated_by`),
  KEY `idx_users_model_gate` (`role`,`verification_status`,`is_active`,`unsubscribe`),
  KEY `idx_users_account_status` (`account_status`),
  KEY `idx_users_suspended_until` (`account_status`,`suspended_until`),
  KEY `idx_users_risk_updated_at` (`risk_updated_at`),
  CONSTRAINT `fk_users_risk_updated_by` FOREIGN KEY (`risk_updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

