-- ADR-059 opcion B: baseline de esquema REAL de Sharemechat.
-- Generado aplicando las 51 migraciones Flyway (V1..V51) en un MySQL 8.4
-- efimero, en dos tandas con pausa para evitar la colision no-determinista
-- de V42 (uq_mpt_target_code_effective). NO editar a mano: regenerar con
-- ops/scripts o el script gen-baseline.sh cuando cambie el esquema.
-- Consumido SOLO por tests (perfil ci): spring.flyway.locations=classpath:db/migration-it


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
DROP TABLE IF EXISTS `accounting_anomalies`;
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

LOCK TABLES `accounting_anomalies` WRITE;
/*!40000 ALTER TABLE `accounting_anomalies` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounting_anomalies` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `audit_runs`;
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

LOCK TABLES `audit_runs` WRITE;
/*!40000 ALTER TABLE `audit_runs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_runs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `backoffice_access_audit_log`;
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

LOCK TABLES `backoffice_access_audit_log` WRITE;
/*!40000 ALTER TABLE `backoffice_access_audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `backoffice_access_audit_log` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `backoffice_agent_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backoffice_agent_profile` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `display_name` varchar(80) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `category` varchar(40) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bap_display_name` (`display_name`),
  KEY `fk_bap_created_by` (`created_by`),
  CONSTRAINT `fk_bap_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `backoffice_agent_profile` WRITE;
/*!40000 ALTER TABLE `backoffice_agent_profile` DISABLE KEYS */;
/*!40000 ALTER TABLE `backoffice_agent_profile` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `backoffice_agent_profile_grant`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backoffice_agent_profile_grant` (
  `user_id` bigint NOT NULL,
  `profile_id` bigint NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `granted_by` bigint DEFAULT NULL,
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`profile_id`),
  KEY `fk_bapg_granted_by` (`granted_by`),
  KEY `idx_bapg_profile_active` (`profile_id`,`active`),
  KEY `idx_bapg_user_active` (`user_id`,`active`),
  CONSTRAINT `fk_bapg_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bapg_profile` FOREIGN KEY (`profile_id`) REFERENCES `backoffice_agent_profile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bapg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `backoffice_agent_profile_grant` WRITE;
/*!40000 ALTER TABLE `backoffice_agent_profile_grant` DISABLE KEYS */;
/*!40000 ALTER TABLE `backoffice_agent_profile_grant` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `backoffice_roles`;
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

LOCK TABLES `backoffice_roles` WRITE;
/*!40000 ALTER TABLE `backoffice_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `backoffice_roles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `backoffice_user_access`;
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

LOCK TABLES `backoffice_user_access` WRITE;
/*!40000 ALTER TABLE `backoffice_user_access` DISABLE KEYS */;
/*!40000 ALTER TABLE `backoffice_user_access` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `balances`;
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

LOCK TABLES `balances` WRITE;
/*!40000 ALTER TABLE `balances` DISABLE KEYS */;
/*!40000 ALTER TABLE `balances` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `client_documents`;
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

LOCK TABLES `client_documents` WRITE;
/*!40000 ALTER TABLE `client_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_documents` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `clients`;
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

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `complaint_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `complaint_audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `complaint_id` bigint NOT NULL,
  `actor_user_id` bigint DEFAULT NULL,
  `action` varchar(40) NOT NULL,
  `from_status` varchar(20) DEFAULT NULL,
  `to_status` varchar(20) DEFAULT NULL,
  `notes` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cal_complaint` (`complaint_id`,`created_at`),
  KEY `idx_cal_action` (`action`),
  KEY `fk_cal_actor_user` (`actor_user_id`),
  CONSTRAINT `fk_cal_actor_user` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cal_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_cal_action` CHECK ((`action` in (_latin1'CREATED',_latin1'ACK_SENT',_latin1'STATUS_CHANGED',_latin1'NOTE_ADDED',_latin1'DECISION',_latin1'ESCALATED',_latin1'EVIDENCE_UPLOADED',_latin1'ADMIN_ALERT_SENT')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `complaint_audit_log` WRITE;
/*!40000 ALTER TABLE `complaint_audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `complaint_audit_log` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `complaints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `complaints` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `reporter_email` varchar(255) DEFAULT NULL,
  `reporter_name` varchar(255) DEFAULT NULL,
  `reporter_ip_hash` varchar(64) DEFAULT NULL,
  `category` varchar(40) NOT NULL,
  `description` varchar(2000) NOT NULL,
  `subject_email` varchar(255) DEFAULT NULL,
  `subject_url` varchar(2000) DEFAULT NULL,
  `subject_user_id` bigint DEFAULT NULL,
  `subject_stream_record_id` bigint DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'OPEN',
  `channel` varchar(20) NOT NULL DEFAULT 'WEB',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `acknowledged_at` datetime DEFAULT NULL,
  `expected_resolution_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `sla_breach_at` datetime DEFAULT NULL,
  `decision_code` varchar(40) DEFAULT NULL,
  `decision_notes` varchar(2000) DEFAULT NULL,
  `reviewed_by_user_id` bigint DEFAULT NULL,
  `related_moderation_report_id` bigint DEFAULT NULL,
  `related_stream_review_id` bigint DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_complaint_status` (`status`),
  KEY `idx_complaint_category` (`category`),
  KEY `idx_complaint_sla` (`expected_resolution_at`,`status`),
  KEY `idx_complaint_subject_user` (`subject_user_id`),
  KEY `idx_complaint_subject_stream` (`subject_stream_record_id`),
  KEY `idx_complaint_created` (`created_at`),
  KEY `fk_complaint_reviewed_by` (`reviewed_by_user_id`),
  KEY `fk_complaint_related_moderation_report` (`related_moderation_report_id`),
  KEY `fk_complaint_related_stream_review` (`related_stream_review_id`),
  CONSTRAINT `fk_complaint_related_moderation_report` FOREIGN KEY (`related_moderation_report_id`) REFERENCES `moderation_reports` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_complaint_related_stream_review` FOREIGN KEY (`related_stream_review_id`) REFERENCES `stream_moderation_reviews` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_complaint_reviewed_by` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_complaint_subject_stream` FOREIGN KEY (`subject_stream_record_id`) REFERENCES `stream_records` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_complaint_subject_user` FOREIGN KEY (`subject_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_complaint_category` CHECK ((`category` in (_latin1'CSAM',_latin1'NON_CONSENSUAL',_latin1'MINOR_AT_RISK',_latin1'HATE_SYMBOLS',_latin1'COPYRIGHT',_latin1'ILLEGAL',_latin1'HARASSMENT',_latin1'IMPERSONATION',_latin1'FRAUD',_latin1'OTHER'))),
  CONSTRAINT `chk_complaint_channel` CHECK ((`channel` in (_latin1'WEB',_latin1'EMAIL',_latin1'ADMIN'))),
  CONSTRAINT `chk_complaint_decision_code` CHECK (((`decision_code` is null) or (`decision_code` in (_latin1'CONTENT_REMOVED',_latin1'USER_SUSPENDED',_latin1'USER_BANNED',_latin1'NO_ACTION',_latin1'INSUFFICIENT_INFO',_latin1'ESCALATED_TO_AUTHORITIES',_latin1'FORWARDED_TO_NCMEC')))),
  CONSTRAINT `chk_complaint_status` CHECK ((`status` in (_latin1'OPEN',_latin1'ACKNOWLEDGED',_latin1'REVIEWING',_latin1'RESOLVED',_latin1'REJECTED',_latin1'ESCALATED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `complaints` WRITE;
/*!40000 ALTER TABLE `complaints` DISABLE KEYS */;
/*!40000 ALTER TABLE `complaints` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `consent_events`;
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

LOCK TABLES `consent_events` WRITE;
/*!40000 ALTER TABLE `consent_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `consent_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `content_article_translation_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_article_translation_versions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `version_id` bigint NOT NULL,
  `locale` varchar(10) NOT NULL,
  `body_s3_key` varchar(500) NOT NULL,
  `body_content_hash` varchar(64) NOT NULL,
  `slug` varchar(160) NOT NULL,
  `title` varchar(255) NOT NULL,
  `seo_title` varchar(60) DEFAULT NULL,
  `meta_description` varchar(160) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catv_version_locale` (`version_id`,`locale`),
  CONSTRAINT `fk_catv_version` FOREIGN KEY (`version_id`) REFERENCES `content_article_versions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `content_article_translation_versions` WRITE;
/*!40000 ALTER TABLE `content_article_translation_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_article_translation_versions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `content_article_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_article_translations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `article_id` bigint NOT NULL,
  `locale` varchar(10) NOT NULL,
  `slug` varchar(160) NOT NULL,
  `title` varchar(255) NOT NULL,
  `seo_title` varchar(60) DEFAULT NULL,
  `meta_description` varchar(160) DEFAULT NULL,
  `brief` text,
  `body_s3_key` varchar(500) DEFAULT NULL,
  `body_content_hash` varchar(64) DEFAULT NULL,
  `target_keywords` json DEFAULT NULL COMMENT 'Array JSON de {term, type, search_intent_match} per-locale. Input operador (primary + secondaries) + enriquecimiento IA con merge, ADR-045 D1/D4. Exactamente 1 type=primary; 0..5 type=secondary.',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_content_article_translations_article_locale` (`article_id`,`locale`),
  UNIQUE KEY `uq_content_article_translations_slug_locale` (`slug`,`locale`),
  KEY `idx_content_article_translations_locale` (`locale`),
  CONSTRAINT `fk_content_article_translations_article` FOREIGN KEY (`article_id`) REFERENCES `content_articles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `content_article_translations` WRITE;
/*!40000 ALTER TABLE `content_article_translations` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_article_translations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `content_article_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_article_versions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `article_id` bigint NOT NULL,
  `version_number` int NOT NULL,
  `source_run_id` bigint DEFAULT NULL,
  `created_by_user_id` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_content_article_versions_article_n` (`article_id`,`version_number`),
  KEY `fk_content_article_versions_creator` (`created_by_user_id`),
  KEY `fk_content_article_versions_run` (`source_run_id`),
  CONSTRAINT `fk_content_article_versions_article` FOREIGN KEY (`article_id`) REFERENCES `content_articles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_article_versions_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_content_article_versions_run` FOREIGN KEY (`source_run_id`) REFERENCES `content_generation_runs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `content_article_versions` WRITE;
/*!40000 ALTER TABLE `content_article_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_article_versions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `content_articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_articles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `hero_image_url` varchar(500) DEFAULT NULL,
  `category` varchar(80) DEFAULT NULL,
  `keywords` json DEFAULT NULL COMMENT 'LEGACY (ADR-045 D5): sustituido por content_article_translations.target_keywords per-locale. Sigue operativo por compat 2A; retirada planificada para ADR futuro con backfill.',
  `state` varchar(30) NOT NULL DEFAULT 'DRAFT',
  `ai_assisted` tinyint(1) NOT NULL DEFAULT '0',
  `disclosure_required` tinyint(1) NOT NULL DEFAULT '0',
  `published_at` datetime DEFAULT NULL,
  `scheduled_for` datetime DEFAULT NULL,
  `retracted_at` datetime DEFAULT NULL,
  `current_version_id` bigint DEFAULT NULL,
  `responsible_editor_user_id` bigint DEFAULT NULL,
  `created_by_user_id` bigint NOT NULL,
  `updated_by_user_id` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_content_articles_state` (`state`),
  KEY `fk_content_articles_responsible` (`responsible_editor_user_id`),
  KEY `fk_content_articles_creator` (`created_by_user_id`),
  KEY `fk_content_articles_updater` (`updated_by_user_id`),
  KEY `fk_content_articles_current_version` (`current_version_id`),
  CONSTRAINT `fk_content_articles_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_content_articles_current_version` FOREIGN KEY (`current_version_id`) REFERENCES `content_article_versions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_content_articles_responsible` FOREIGN KEY (`responsible_editor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_content_articles_updater` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_content_articles_state` CHECK ((`state` in (_utf8mb4'DRAFT',_utf8mb4'IN_REVIEW',_utf8mb4'PUBLISHED',_utf8mb4'RETRACTED',_utf8mb4'SCHEDULED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `content_articles` WRITE;
/*!40000 ALTER TABLE `content_articles` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_articles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `content_generation_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_generation_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `article_id` bigint NOT NULL,
  `model_provider` varchar(40) NOT NULL,
  `model_id` varchar(80) NOT NULL,
  `model_version` varchar(80) DEFAULT NULL,
  `prompt_template_id` varchar(80) DEFAULT NULL,
  `prompt_s3_key` varchar(500) DEFAULT NULL,
  `prompt_hash` varchar(64) DEFAULT NULL,
  `output_s3_key` varchar(500) DEFAULT NULL,
  `output_hash` varchar(64) DEFAULT NULL,
  `output_validated` tinyint(1) NOT NULL DEFAULT '0',
  `tokens_input` int DEFAULT NULL,
  `tokens_output` int DEFAULT NULL,
  `estimated_cost_eur` decimal(10,4) DEFAULT NULL,
  `triggered_by_user_id` bigint DEFAULT NULL,
  `mode` varchar(30) NOT NULL DEFAULT 'MANUAL_STRUCTURED',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_content_generation_runs_article` (`article_id`),
  KEY `idx_content_generation_runs_user` (`triggered_by_user_id`),
  CONSTRAINT `fk_content_generation_runs_article` FOREIGN KEY (`article_id`) REFERENCES `content_articles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_generation_runs_user` FOREIGN KEY (`triggered_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_content_generation_runs_mode` CHECK ((`mode` in (_latin1'MANUAL_STRUCTURED',_latin1'API_HYBRID',_latin1'API_AUTO'))),
  CONSTRAINT `chk_content_generation_runs_status` CHECK ((`status` in (_latin1'PENDING',_latin1'VALIDATED',_latin1'REJECTED',_latin1'FAILED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `content_generation_runs` WRITE;
/*!40000 ALTER TABLE `content_generation_runs` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_generation_runs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `content_review_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_review_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `article_id` bigint NOT NULL,
  `version_id` bigint DEFAULT NULL,
  `event_type` varchar(40) NOT NULL,
  `actor_user_id` bigint NOT NULL,
  `payload_json` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_content_review_events_article_created` (`article_id`,`created_at`),
  KEY `idx_content_review_events_actor` (`actor_user_id`),
  KEY `fk_content_review_events_version` (`version_id`),
  CONSTRAINT `fk_content_review_events_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_content_review_events_article` FOREIGN KEY (`article_id`) REFERENCES `content_articles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_review_events_version` FOREIGN KEY (`version_id`) REFERENCES `content_article_versions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_content_review_events_type` CHECK ((`event_type` in (_latin1'EDIT_APPLIED',_latin1'DRAFT_REQUESTED',_latin1'PUBLISHED',_latin1'RETRACTED',_latin1'SCHEDULED',_latin1'DISCLOSURE_OVERRIDE')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `content_review_events` WRITE;
/*!40000 ALTER TABLE `content_review_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_review_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `email_verification_tokens`;
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

LOCK TABLES `email_verification_tokens` WRITE;
/*!40000 ALTER TABLE `email_verification_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_verification_tokens` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `favorites_clients`;
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

LOCK TABLES `favorites_clients` WRITE;
/*!40000 ALTER TABLE `favorites_clients` DISABLE KEYS */;
/*!40000 ALTER TABLE `favorites_clients` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `favorites_models`;
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

LOCK TABLES `favorites_models` WRITE;
/*!40000 ALTER TABLE `favorites_models` DISABLE KEYS */;
/*!40000 ALTER TABLE `favorites_models` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `gifts`;
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

LOCK TABLES `gifts` WRITE;
/*!40000 ALTER TABLE `gifts` DISABLE KEYS */;
/*!40000 ALTER TABLE `gifts` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `home_featured_models`;
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

LOCK TABLES `home_featured_models` WRITE;
/*!40000 ALTER TABLE `home_featured_models` DISABLE KEYS */;
/*!40000 ALTER TABLE `home_featured_models` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `kyc_provider_config`;
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

LOCK TABLES `kyc_provider_config` WRITE;
/*!40000 ALTER TABLE `kyc_provider_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_provider_config` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `kyc_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kyc_sessions` (
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
  `session_type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MODEL',
  `estimated_age_decimal` decimal(5,2) DEFAULT NULL,
  `confidence_score` decimal(5,2) DEFAULT NULL,
  `age_estimation_threshold` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mks_provider_session` (`provider`,`provider_session_id`),
  KEY `idx_mks_user_id` (`user_id`),
  KEY `idx_mks_provider_status` (`provider_status`),
  KEY `idx_mks_provider` (`provider`),
  KEY `idx_mks_user_created_at` (`user_id`,`created_at`),
  KEY `idx_mks_provider_status_updated_at` (`provider`,`provider_status`,`updated_at`),
  KEY `idx_kyc_sessions_user_session_type` (`user_id`,`session_type`,`kyc_status`),
  CONSTRAINT `fk_model_kyc_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `kyc_sessions` WRITE;
/*!40000 ALTER TABLE `kyc_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_sessions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `kyc_webhook_events`;
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

LOCK TABLES `kyc_webhook_events` WRITE;
/*!40000 ALTER TABLE `kyc_webhook_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_webhook_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `liveness_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `liveness_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `challenge_type` varchar(20) NOT NULL COMMENT 'ADR-050 D4: BLINK, TURN_LEFT, TURN_RIGHT, SMILE',
  `prompt_lc` varchar(40) NOT NULL COMMENT 'Codigo del prompt mostrado al usuario. La traduccion vive en i18n.',
  `status` varchar(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING -> PASSED | FAILED | EXPIRED. Solo PASSED con passed_until > NOW habilita startMatch.',
  `sightengine_verdict` json DEFAULT NULL COMMENT 'Respuesta cruda de SightEngine (D10) o marcadores especiales {mock:true} / {vendor_unavailable:true} (D5).',
  `frames_count` int NOT NULL DEFAULT '0' COMMENT 'Numero de frames enviados a SightEngine en el verify. Tipico: 3.',
  `passed_until` datetime DEFAULT NULL COMMENT 'Ventana de validez del pass. NULL mientras status != PASSED. UTC estricto.',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp UTC del startChallenge.',
  `resolved_at` datetime DEFAULT NULL COMMENT 'Timestamp UTC de la transicion a estado terminal (PASSED/FAILED/EXPIRED).',
  PRIMARY KEY (`id`),
  KEY `idx_la_user_passed` (`user_id`,`status`,`passed_until`),
  KEY `idx_la_user_created` (`user_id`,`created_at`),
  KEY `idx_la_created` (`created_at`),
  CONSTRAINT `fk_la_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_la_challenge_type` CHECK ((`challenge_type` in (_latin1'BLINK',_latin1'TURN_LEFT',_latin1'TURN_RIGHT',_latin1'SMILE',_latin1'PRESENCE'))),
  CONSTRAINT `chk_la_frames_count_non_negative` CHECK ((`frames_count` >= 0)),
  CONSTRAINT `chk_la_passed_until_only_when_passed` CHECK ((((`status` = _utf8mb4'PASSED') and (`passed_until` is not null)) or ((`status` <> _utf8mb4'PASSED') and (`passed_until` is null)))),
  CONSTRAINT `chk_la_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'PASSED',_utf8mb4'FAILED',_utf8mb4'EXPIRED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `liveness_attempts` WRITE;
/*!40000 ALTER TABLE `liveness_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `liveness_attempts` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `master_contract_acceptances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_contract_acceptances` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `contract_version` varchar(50) NOT NULL,
  `contract_sha256` varchar(64) NOT NULL,
  `accepted_at` datetime NOT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_master_contract_user_version` (`user_id`,`contract_version`),
  KEY `idx_mca_user` (`user_id`),
  CONSTRAINT `fk_master_contract_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `master_contract_acceptances` WRITE;
/*!40000 ALTER TABLE `master_contract_acceptances` DISABLE KEYS */;
/*!40000 ALTER TABLE `master_contract_acceptances` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `master_model_splits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_model_splits` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `master_user_id` bigint NOT NULL,
  `model_user_id` bigint NOT NULL,
  `internal_share_pct` decimal(5,2) NOT NULL,
  `effective_from` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `effective_to` datetime DEFAULT NULL,
  `set_by_master_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text,
  PRIMARY KEY (`id`),
  KEY `idx_mms_master` (`master_user_id`,`effective_to`),
  KEY `idx_mms_model` (`model_user_id`,`effective_to`),
  CONSTRAINT `fk_mms_master` FOREIGN KEY (`master_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_mms_model` FOREIGN KEY (`model_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_mms_share` CHECK (((`internal_share_pct` >= 0) and (`internal_share_pct` <= 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `master_model_splits` WRITE;
/*!40000 ALTER TABLE `master_model_splits` DISABLE KEYS */;
/*!40000 ALTER TABLE `master_model_splits` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `masters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `masters` (
  `user_id` bigint NOT NULL,
  `company_name` varchar(200) DEFAULT NULL,
  `company_registration_number` varchar(100) DEFAULT NULL,
  `company_country` varchar(2) DEFAULT NULL,
  `total_models_active` int NOT NULL DEFAULT '0',
  `total_paid_out_eur` decimal(12,2) NOT NULL DEFAULT '0.00',
  `onboarded_at` datetime DEFAULT NULL,
  `suspended_at` timestamp NULL DEFAULT NULL,
  `suspended_by_user_id` bigint DEFAULT NULL,
  `suspension_reason` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `fk_masters_suspended_by` (`suspended_by_user_id`),
  KEY `idx_masters_suspended` (`suspended_at`),
  CONSTRAINT `fk_masters_suspended_by` FOREIGN KEY (`suspended_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_masters_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `masters` WRITE;
/*!40000 ALTER TABLE `masters` DISABLE KEYS */;
/*!40000 ALTER TABLE `masters` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `message_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_translations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `message_id` bigint NOT NULL,
  `target_lang` varchar(5) NOT NULL,
  `translated_text` varchar(2000) NOT NULL,
  `provider` varchar(20) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_translations_msg_lang` (`message_id`,`target_lang`),
  CONSTRAINT `fk_message_translations_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `message_translations` WRITE;
/*!40000 ALTER TABLE `message_translations` DISABLE KEYS */;
/*!40000 ALTER TABLE `message_translations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `messages`;
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

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_asset_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_asset_reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `asset_type` varchar(20) NOT NULL,
  `asset_url` varchar(500) NOT NULL,
  `asset_id` bigint DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `rejection_reason_code` varchar(50) DEFAULT NULL,
  `rejection_reason_text` varchar(500) DEFAULT NULL,
  `uploaded_at` datetime NOT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewer_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_model_asset_reviews_status_uploaded` (`status`,`uploaded_at`),
  KEY `idx_model_asset_reviews_user` (`user_id`),
  KEY `fk_model_asset_reviews_reviewer` (`reviewer_id`),
  KEY `fk_mar_asset` (`asset_id`),
  CONSTRAINT `fk_mar_asset` FOREIGN KEY (`asset_id`) REFERENCES `model_assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_model_asset_reviews_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_model_asset_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_model_asset_reviews_asset_type` CHECK ((`asset_type` in (_utf8mb4'PIC',_utf8mb4'VIDEO'))),
  CONSTRAINT `chk_model_asset_reviews_status` CHECK ((`status` in (_latin1'PENDING_REVIEW',_latin1'APPROVED',_latin1'REJECTED',_latin1'CANCELLED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_asset_reviews` WRITE;
/*!40000 ALTER TABLE `model_asset_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_asset_reviews` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_assets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `asset_type` varchar(20) NOT NULL,
  `url` varchar(500) NOT NULL,
  `is_principal` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `position` int NOT NULL DEFAULT '0',
  `uploaded_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_model_assets_user_type` (`user_id`,`asset_type`),
  KEY `idx_model_assets_user_principal` (`user_id`,`asset_type`,`is_principal`),
  CONSTRAINT `fk_model_assets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_model_assets_asset_type` CHECK ((`asset_type` in (_latin1'PIC',_latin1'VIDEO')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_assets` WRITE;
/*!40000 ALTER TABLE `model_assets` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_assets` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_contract_acceptances`;
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
  CONSTRAINT `fk_model_contract_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_contract_acceptances` WRITE;
/*!40000 ALTER TABLE `model_contract_acceptances` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_contract_acceptances` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_documents` (
  `user_id` bigint NOT NULL,
  `url_verific_front` varchar(500) DEFAULT NULL,
  `url_verific_back` varchar(500) DEFAULT NULL,
  `url_verific_doc` varchar(500) DEFAULT NULL,
  `url_consent` varchar(500) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_model_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_documents` WRITE;
/*!40000 ALTER TABLE `model_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_documents` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_moderation_bans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_moderation_bans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `model_user_id` bigint NOT NULL,
  `strike_count_at_ban` int NOT NULL,
  `ban_started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ban_ends_at` datetime NOT NULL,
  `reason` varchar(200) NOT NULL,
  `source_strike_id` bigint NOT NULL,
  `requires_manual_review` tinyint(1) NOT NULL DEFAULT '0',
  `reviewed` tinyint(1) NOT NULL DEFAULT '0',
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_model_moderation_bans_source_strike` (`source_strike_id`),
  KEY `idx_model_moderation_bans_model_ends` (`model_user_id`,`ban_ends_at`),
  KEY `idx_model_moderation_bans_review` (`requires_manual_review`,`reviewed`),
  CONSTRAINT `fk_model_moderation_bans_source_strike` FOREIGN KEY (`source_strike_id`) REFERENCES `model_moderation_strikes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_moderation_bans` WRITE;
/*!40000 ALTER TABLE `model_moderation_bans` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_moderation_bans` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_moderation_strikes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_moderation_strikes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `model_user_id` bigint NOT NULL,
  `stream_moderation_session_id` bigint NOT NULL,
  `severity` varchar(20) NOT NULL,
  `category` varchar(50) NOT NULL,
  `is_trial` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_moderation_strikes_session` (`stream_moderation_session_id`),
  KEY `idx_model_moderation_strikes_model_created` (`model_user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_moderation_strikes` WRITE;
/*!40000 ALTER TABLE `model_moderation_strikes` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_moderation_strikes` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_pricing_tiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_pricing_tiers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tier_code` varchar(4) NOT NULL COMMENT 'Identificador del tramo: T0, T1, T2, T3 (ADR-052 Â§D1).',
  `target_type` varchar(15) NOT NULL DEFAULT 'INDIVIDUAL',
  `min_billed_gross_eur_30d` decimal(10,2) NOT NULL COMMENT 'Umbral inferior de facturacion bruta rolling 30d en EUR (0 para T0).',
  `model_share_pct` decimal(5,2) NOT NULL COMMENT '%reparto modelo (75.00, 77.00, 78.00, 79.00).',
  `rate_min_eur_per_min` decimal(4,2) NOT NULL COMMENT 'Precio minimo por minuto elegible en este tramo.',
  `rate_max_eur_per_min` decimal(4,2) NOT NULL COMMENT 'Precio maximo por minuto elegible en este tramo.',
  `effective_from` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Inicio de vigencia UTC.',
  `effective_to` datetime DEFAULT NULL COMMENT 'Fin de vigencia UTC. NULL para filas vigentes.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mpt_target_code_effective` (`target_type`,`tier_code`,`effective_from`),
  KEY `idx_mpt_vigencia` (`effective_to`,`min_billed_gross_eur_30d`),
  CONSTRAINT `chk_mpt_range` CHECK ((`rate_max_eur_per_min` >= `rate_min_eur_per_min`)),
  CONSTRAINT `chk_mpt_share` CHECK (((`model_share_pct` > 0) and (`model_share_pct` < 100))),
  CONSTRAINT `chk_mpt_target_type` CHECK ((`target_type` in (_latin1'INDIVIDUAL',_latin1'MASTER')))
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_pricing_tiers` WRITE;
/*!40000 ALTER TABLE `model_pricing_tiers` DISABLE KEYS */;
INSERT INTO `model_pricing_tiers` VALUES (1,'T1','INDIVIDUAL',0.00,75.00,1.00,1.00,'2026-08-12 00:22:27','2026-08-12 00:22:31'),(2,'T2','INDIVIDUAL',3500.00,77.00,1.00,3.00,'2026-08-12 00:22:27','2026-08-12 00:22:31'),(3,'T3','INDIVIDUAL',5000.00,78.00,1.00,6.00,'2026-08-12 00:22:27','2026-08-12 00:22:31'),(4,'T4','INDIVIDUAL',6500.00,79.00,1.00,9.00,'2026-08-12 00:22:27','2026-08-12 00:22:31'),(5,'T1','INDIVIDUAL',0.00,50.00,1.00,1.00,'2026-08-12 00:22:31',NULL),(6,'T2','INDIVIDUAL',1000.00,54.00,1.00,3.00,'2026-08-12 00:22:31',NULL),(7,'T3','INDIVIDUAL',4000.00,57.00,1.00,6.00,'2026-08-12 00:22:31',NULL),(8,'T4','INDIVIDUAL',15000.00,60.00,1.00,9.00,'2026-08-12 00:22:31',NULL),(9,'T1','MASTER',0.00,50.00,1.00,1.00,'2026-08-12 00:22:31','2026-08-12 00:22:31'),(10,'T2','MASTER',1000.00,60.00,1.00,3.00,'2026-08-12 00:22:31','2026-08-12 00:22:31'),(11,'T3','MASTER',4000.00,65.00,1.00,6.00,'2026-08-12 00:22:31','2026-08-12 00:22:31'),(12,'T4','MASTER',15000.00,70.00,1.00,9.00,'2026-08-12 00:22:31','2026-08-12 00:22:31');
/*!40000 ALTER TABLE `model_pricing_tiers` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_review_checklist`;
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

LOCK TABLES `model_review_checklist` WRITE;
/*!40000 ALTER TABLE `model_review_checklist` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_review_checklist` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_tier_daily_snapshots`;
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
  `tier_id` bigint DEFAULT NULL,
  `tier_name` varchar(50) DEFAULT NULL,
  `first_minute_earning_per_min` decimal(10,4) DEFAULT NULL,
  `next_minutes_earning_per_min` decimal(10,4) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `billed_gross_eur_30d` decimal(10,2) DEFAULT NULL COMMENT 'Facturacion bruta acumulada rolling 30d en EUR (base del tramo, ADR-052 Â§D6).',
  `pricing_tier_id` bigint DEFAULT NULL COMMENT 'FK a model_pricing_tiers vigente en el snapshot date.',
  `pricing_tier_code` varchar(4) DEFAULT NULL COMMENT 'Codigo del tramo resuelto (T0/T1/T2/T3) para lectura rapida sin join.',
  `model_share_pct` decimal(5,2) DEFAULT NULL COMMENT '%reparto modelo vigente en el snapshot (denormalizado para auditoria).',
  `rate_min_eur_per_min` decimal(4,2) DEFAULT NULL COMMENT 'Precio minimo permitido en el tramo (denormalizado).',
  `rate_max_eur_per_min` decimal(4,2) DEFAULT NULL COMMENT 'Precio maximo permitido en el tramo (denormalizado).',
  `pro_status_active` tinyint(1) DEFAULT NULL COMMENT 'True si en el snapshot la modelo cumple el umbral de Estatus Pro (facturacion bruta rolling 30d > billing.pro-status.min-billed-gross-eur-30d).',
  `target_type` varchar(15) DEFAULT NULL COMMENT 'INDIVIDUAL o MASTER (post ADR-056)',
  `master_user_id` bigint DEFAULT NULL COMMENT 'Presente si target_type=MASTER, indica el Master cuyo bruto agregado se computo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_day` (`model_id`,`snapshot_date`),
  KEY `idx_model` (`model_id`),
  KEY `idx_snapshot_date` (`snapshot_date`),
  KEY `fk_mtds_pricing_tier` (`pricing_tier_id`),
  KEY `idx_mtds_master` (`master_user_id`,`snapshot_date`),
  CONSTRAINT `fk_mtds_master` FOREIGN KEY (`master_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_mtds_pricing_tier` FOREIGN KEY (`pricing_tier_id`) REFERENCES `model_pricing_tiers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=276 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_tier_daily_snapshots` WRITE;
/*!40000 ALTER TABLE `model_tier_daily_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_tier_daily_snapshots` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `models`;
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
  `streaming_banned_until` datetime DEFAULT NULL COMMENT 'Fecha/hora fin de ban de streaming automatico. NULL o pasado = no baneada. Escrito por ModelBanService (ADR-037 Bloque 3), leido por matching gate.',
  `master_user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_models_streaming_banned_until` (`streaming_banned_until`),
  KEY `idx_models_master` (`master_user_id`),
  CONSTRAINT `fk_models_master` FOREIGN KEY (`master_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `models_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `models` WRITE;
/*!40000 ALTER TABLE `models` DISABLE KEYS */;
/*!40000 ALTER TABLE `models` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `moderation_reports`;
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

LOCK TABLES `moderation_reports` WRITE;
/*!40000 ALTER TABLE `moderation_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `moderation_reports` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `moderation_usage_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `moderation_usage_alerts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `period_type` varchar(10) NOT NULL,
  `period_start` date NOT NULL,
  `threshold_pct` int NOT NULL,
  `plan_name` varchar(20) NOT NULL,
  `quota_at_alert` bigint NOT NULL,
  `operations_at_alert` bigint NOT NULL,
  `pct_at_alert` decimal(5,1) NOT NULL,
  `email_sent` tinyint(1) NOT NULL DEFAULT '0',
  `email_sent_at` datetime DEFAULT NULL,
  `email_to` varchar(200) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_moderation_usage_alerts_period_threshold` (`period_type`,`period_start`,`threshold_pct`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `moderation_usage_alerts` WRITE;
/*!40000 ALTER TABLE `moderation_usage_alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `moderation_usage_alerts` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `oauth_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_accounts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `provider` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_at_signup` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `google_hd` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `picture_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_oauth_provider_sub` (`provider`,`provider_user_id`),
  KEY `idx_oauth_user` (`user_id`),
  KEY `idx_oauth_email_at_signup` (`email_at_signup`),
  CONSTRAINT `fk_oauth_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_oauth_provider` CHECK ((`provider` in (_latin1'google',_latin1'apple',_latin1'twitter')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `oauth_accounts` WRITE;
/*!40000 ALTER TABLE `oauth_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `oauth_accounts` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `password_reset_tokens`;
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

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `payment_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `pack_id` varchar(50) NOT NULL,
  `provider` varchar(30) NOT NULL DEFAULT 'nowpayments',
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
  UNIQUE KEY `uk_payment_sessions_provider_psp` (`provider`,`psp_transaction_id`),
  KEY `idx_payment_sessions_user` (`user_id`),
  KEY `idx_payment_sessions_provider` (`provider`),
  CONSTRAINT `fk_payment_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `payment_sessions` WRITE;
/*!40000 ALTER TABLE `payment_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_sessions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `payout_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payout_methods` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `rail` varchar(30) NOT NULL,
  `account_ref` varchar(255) NOT NULL,
  `display_alias` varchar(80) DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payout_methods_user_rail_ref` (`user_id`,`rail`,`account_ref`),
  KEY `idx_payout_methods_user` (`user_id`,`is_default`),
  CONSTRAINT `fk_payout_methods_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_payout_methods_rail` CHECK ((`rail` in (_latin1'PAXUM',_latin1'YOURSAFE',_latin1'NOWPAYMENTS_CRYPTO',_latin1'SEPA_MANUAL')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `payout_methods` WRITE;
/*!40000 ALTER TABLE `payout_methods` DISABLE KEYS */;
/*!40000 ALTER TABLE `payout_methods` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `payout_requests`;
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
  `payout_method_id` bigint DEFAULT NULL,
  `rail` varchar(30) DEFAULT NULL COMMENT 'Denormalizado desde payout_methods.rail para reporting',
  PRIMARY KEY (`id`),
  KEY `idx_payout_model_status` (`model_user_id`,`status`,`created_at`),
  KEY `fk_payout_reviewed_by` (`reviewed_by_user_id`),
  KEY `fk_payout_requests_method` (`payout_method_id`),
  KEY `idx_payout_requests_rail` (`rail`,`status`),
  CONSTRAINT `fk_payout_model_user` FOREIGN KEY (`model_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_payout_requests_method` FOREIGN KEY (`payout_method_id`) REFERENCES `payout_methods` (`id`),
  CONSTRAINT `fk_payout_reviewed_by` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `payout_requests` WRITE;
/*!40000 ALTER TABLE `payout_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `payout_requests` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `permissions`;
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

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `platform_balances`;
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

LOCK TABLES `platform_balances` WRITE;
/*!40000 ALTER TABLE `platform_balances` DISABLE KEYS */;
/*!40000 ALTER TABLE `platform_balances` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `platform_transactions`;
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

LOCK TABLES `platform_transactions` WRITE;
/*!40000 ALTER TABLE `platform_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `platform_transactions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `psp_provider_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `psp_provider_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active_mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by_user_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_psp_provider_config_key` (`provider_key`),
  KEY `idx_psp_provider_config_mode` (`active_mode`),
  KEY `idx_psp_provider_config_enabled` (`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `psp_provider_config` WRITE;
/*!40000 ALTER TABLE `psp_provider_config` DISABLE KEYS */;
INSERT INTO `psp_provider_config` VALUES (1,'nowpayments','DISABLED',1,'Seed inicial ADR-051 Fase 1. Activar a ENABLED cuando (a) credenciales sandbox en secrets.env, (b) adapter validado end-to-end.',NULL,'2026-08-12 00:22:26','2026-08-12 00:22:26');
/*!40000 ALTER TABLE `psp_provider_config` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `psp_webhook_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `psp_webhook_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_event_id` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_payment_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_event_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_signature_valid` tinyint(1) NOT NULL DEFAULT '0',
  `is_processed` tinyint(1) NOT NULL DEFAULT '0',
  `processing_error_message` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pwe_provider_event` (`provider`,`provider_event_id`),
  KEY `idx_pwe_provider_payment` (`provider`,`provider_payment_id`),
  KEY `idx_pwe_processed` (`is_processed`),
  KEY `idx_pwe_processed_received_at` (`is_processed`,`received_at`),
  KEY `idx_pwe_provider_received_at` (`provider`,`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `psp_webhook_events` WRITE;
/*!40000 ALTER TABLE `psp_webhook_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `psp_webhook_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `refresh_tokens`;
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

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `role_permissions`;
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

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `stream_moderation_attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_moderation_attendance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stream_record_id` bigint NOT NULL,
  `model_user_id` bigint NOT NULL,
  `present` tinyint(1) NOT NULL,
  `presence_score` decimal(5,2) DEFAULT NULL,
  `sampled_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `provider` varchar(20) NOT NULL,
  `provider_event_id` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stream_moderation_attendance_provider_event` (`provider`,`provider_event_id`),
  KEY `idx_stream_moderation_attendance_stream` (`stream_record_id`),
  KEY `idx_stream_moderation_attendance_model` (`model_user_id`),
  KEY `idx_stream_moderation_attendance_stream_sampled` (`stream_record_id`,`sampled_at`),
  CONSTRAINT `fk_stream_moderation_attendance_model_user` FOREIGN KEY (`model_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stream_moderation_attendance_stream_record` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_stream_moderation_attendance_provider` CHECK ((`provider` in (_latin1'MOCK',_latin1'SIGHTENGINE',_latin1'HIVE',_latin1'REKOGNITION')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `stream_moderation_attendance` WRITE;
/*!40000 ALTER TABLE `stream_moderation_attendance` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_moderation_attendance` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `stream_moderation_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_moderation_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stream_moderation_session_id` bigint NOT NULL,
  `provider` varchar(20) NOT NULL,
  `provider_event_id` varchar(150) DEFAULT NULL,
  `event_type` varchar(40) NOT NULL,
  `is_signature_valid` tinyint(1) DEFAULT NULL,
  `is_processed` tinyint(1) NOT NULL DEFAULT '0',
  `processing_error_message` varchar(500) DEFAULT NULL,
  `payload_json` longtext NOT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stream_moderation_events_provider_event` (`provider`,`provider_event_id`),
  KEY `idx_stream_moderation_events_session` (`stream_moderation_session_id`),
  KEY `idx_stream_moderation_events_processed` (`is_processed`),
  KEY `idx_stream_moderation_events_processed_received_at` (`is_processed`,`received_at`),
  KEY `idx_stream_moderation_events_provider_received_at` (`provider`,`received_at`),
  CONSTRAINT `fk_stream_moderation_events_session` FOREIGN KEY (`stream_moderation_session_id`) REFERENCES `stream_moderation_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_stream_moderation_events_event_type` CHECK ((`event_type` in (_latin1'VERDICT_RECEIVED',_latin1'VERDICT_TIMEOUT',_latin1'VERDICT_ERROR',_latin1'WEBHOOK_RECEIVED'))),
  CONSTRAINT `chk_stream_moderation_events_provider` CHECK ((`provider` in (_latin1'MOCK',_latin1'SIGHTENGINE',_latin1'HIVE',_latin1'REKOGNITION')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `stream_moderation_events` WRITE;
/*!40000 ALTER TABLE `stream_moderation_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_moderation_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `stream_moderation_provider_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_moderation_provider_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider_key` varchar(50) NOT NULL,
  `active_mode` varchar(20) NOT NULL DEFAULT 'MOCK',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `note` varchar(255) DEFAULT NULL,
  `updated_by_user_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stream_moderation_provider_config_key` (`provider_key`),
  KEY `idx_stream_moderation_provider_config_mode` (`active_mode`),
  KEY `idx_stream_moderation_provider_config_enabled` (`enabled`),
  KEY `fk_stream_moderation_provider_config_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_stream_moderation_provider_config_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_stream_moderation_provider_config_mode` CHECK ((`active_mode` in (_latin1'MOCK',_latin1'SIGHTENGINE',_latin1'HIVE',_latin1'REKOGNITION')))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `stream_moderation_provider_config` WRITE;
/*!40000 ALTER TABLE `stream_moderation_provider_config` DISABLE KEYS */;
INSERT INTO `stream_moderation_provider_config` VALUES (1,'STREAM_VISUAL_MODERATION','MOCK',1,'Initial seed - P1.1 schema bootstrap (ADR-036/ADR-037)',NULL,'2026-08-12 00:22:23','2026-08-12 00:22:23');
/*!40000 ALTER TABLE `stream_moderation_provider_config` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `stream_moderation_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_moderation_reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stream_record_id` bigint NOT NULL,
  `stream_moderation_session_id` bigint NOT NULL,
  `provider` varchar(20) NOT NULL,
  `category` varchar(40) NOT NULL,
  `severity` varchar(10) NOT NULL,
  `score` decimal(5,2) NOT NULL,
  `provider_event_id` varchar(150) DEFAULT NULL,
  `evidence_ref` varchar(255) DEFAULT NULL,
  `frame_timestamp` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `priority` int NOT NULL DEFAULT '100',
  `reviewer_id` bigint DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `decision_code` varchar(50) DEFAULT NULL,
  `decision_note` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stream_moderation_reviews_provider_event` (`provider`,`provider_event_id`),
  KEY `idx_stream_moderation_reviews_status_priority` (`status`,`priority`,`created_at`),
  KEY `idx_stream_moderation_reviews_stream` (`stream_record_id`),
  KEY `idx_stream_moderation_reviews_session` (`stream_moderation_session_id`),
  KEY `idx_stream_moderation_reviews_severity_status` (`severity`,`status`),
  KEY `idx_stream_moderation_reviews_reviewer` (`reviewer_id`),
  CONSTRAINT `fk_stream_moderation_reviews_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_stream_moderation_reviews_session` FOREIGN KEY (`stream_moderation_session_id`) REFERENCES `stream_moderation_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stream_moderation_reviews_stream_record` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_stream_moderation_reviews_category` CHECK ((`category` in (_latin1'NUDITY',_latin1'WEAPONS',_latin1'DRUGS',_latin1'VIOLENCE',_latin1'GORE',_latin1'SELF_HARM',_latin1'GAMBLING',_latin1'OFFENSIVE_SYMBOLS',_latin1'MINORS',_latin1'OTHER',_latin1'OUT_OF_SCENE',_latin1'FROZEN_STREAM',_latin1'NO_FACE_SUSTAINED'))),
  CONSTRAINT `chk_stream_moderation_reviews_provider` CHECK ((`provider` in (_utf8mb4'MOCK',_utf8mb4'SIGHTENGINE',_utf8mb4'HIVE',_utf8mb4'REKOGNITION'))),
  CONSTRAINT `chk_stream_moderation_reviews_severity` CHECK ((`severity` in (_utf8mb4'GREEN',_utf8mb4'AMBER',_utf8mb4'RED',_utf8mb4'CRITICAL'))),
  CONSTRAINT `chk_stream_moderation_reviews_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'IN_REVIEW',_utf8mb4'APPROVED',_utf8mb4'REJECTED',_utf8mb4'CANCELLED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `stream_moderation_reviews` WRITE;
/*!40000 ALTER TABLE `stream_moderation_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_moderation_reviews` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `stream_moderation_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_moderation_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stream_record_id` bigint NOT NULL,
  `provider` varchar(20) NOT NULL,
  `provider_session_id` varchar(100) DEFAULT NULL,
  `sampling_cadence_seconds` int NOT NULL DEFAULT '15',
  `sampling_strategy` varchar(20) NOT NULL DEFAULT 'INTERVAL',
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `stopped_at` datetime DEFAULT NULL,
  `frames_submitted` int NOT NULL DEFAULT '0',
  `verdicts_received` int NOT NULL DEFAULT '0',
  `degraded_since` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_frame_sha256` char(64) DEFAULT NULL COMMENT 'ADR-050 Fase D: SHA-256 hex del ultimo frame recibido; NULL antes del primer frame.',
  `consecutive_identical_frames` int NOT NULL DEFAULT '0' COMMENT 'ADR-050 Fase D: contador de frames identicos consecutivos (via hash). Se resetea al recibir un frame distinto.',
  `consecutive_no_face_frames` int NOT NULL DEFAULT '0' COMMENT 'ADR-050 Fase E (#D-33): contador de frames consecutivos sin cara detectada. Se resetea al detectar cara.',
  `operations_consumed` bigint NOT NULL DEFAULT '0' COMMENT 'Suma de operations Sightengine consumidas por esta sesion. MOCK deja 0.',
  `is_trial` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'true si la sesion es de un trial shadow record. Activa umbrales estrictos locales del mapper (moderation.thresholds.trial.*).',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stream_moderation_sessions_stream` (`stream_record_id`),
  KEY `idx_stream_moderation_sessions_status` (`status`),
  KEY `idx_stream_moderation_sessions_provider` (`provider`),
  KEY `idx_stream_moderation_sessions_started_at` (`started_at`),
  KEY `idx_stream_moderation_sessions_degraded_since` (`degraded_since`),
  KEY `idx_stream_moderation_sessions_created_at` (`created_at`),
  CONSTRAINT `fk_stream_moderation_sessions_stream_record` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_stream_moderation_sessions_provider` CHECK ((`provider` in (_utf8mb4'MOCK',_utf8mb4'SIGHTENGINE',_utf8mb4'HIVE',_utf8mb4'REKOGNITION'))),
  CONSTRAINT `chk_stream_moderation_sessions_sampling_strategy` CHECK ((`sampling_strategy` in (_utf8mb4'INTERVAL',_utf8mb4'EVENT',_utf8mb4'HYBRID'))),
  CONSTRAINT `chk_stream_moderation_sessions_status` CHECK ((`status` in (_utf8mb4'ACTIVE',_utf8mb4'STOPPED',_utf8mb4'ERROR',_utf8mb4'DEGRADED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `stream_moderation_sessions` WRITE;
/*!40000 ALTER TABLE `stream_moderation_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_moderation_sessions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `stream_records`;
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
  `is_trial` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'true si es shadow record creado por UserTrialService.startTrialStream (frente trial-sfw Bloque 2). false para paid streams normales.',
  PRIMARY KEY (`id`),
  KEY `idx_stream_client` (`client_id`),
  KEY `idx_stream_model` (`model_id`),
  KEY `idx_stream_confirmed_at` (`confirmed_at`),
  KEY `idx_stream_active_start` (`end_time`,`start_time`),
  KEY `idx_stream_type_active` (`stream_type`,`end_time`,`start_time`),
  KEY `idx_stream_client_active` (`client_id`,`end_time`,`start_time`),
  KEY `idx_stream_model_active` (`model_id`,`end_time`,`start_time`),
  KEY `idx_stream_records_is_trial` (`is_trial`),
  CONSTRAINT `stream_records_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`),
  CONSTRAINT `stream_records_ibfk_2` FOREIGN KEY (`model_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_stream_records_stream_type` CHECK ((`stream_type` in (_utf8mb4'UNKNOWN',_utf8mb4'RANDOM',_utf8mb4'CALLING')))
) ENGINE=InnoDB AUTO_INCREMENT=317 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `stream_records` WRITE;
/*!40000 ALTER TABLE `stream_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_records` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `stream_status_events`;
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

LOCK TABLES `stream_status_events` WRITE;
/*!40000 ALTER TABLE `stream_status_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_status_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `support_bot_prompts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_bot_prompts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `case_key` varchar(120) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'BOTH',
  `content` longtext NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `version` int NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_bot_prompts_case_key` (`case_key`),
  KEY `idx_support_bot_prompts_role_active` (`role`,`active`),
  CONSTRAINT `chk_support_bot_prompts_role` CHECK ((`role` in (_latin1'CLIENT',_latin1'MODEL',_latin1'BOTH')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `support_bot_prompts` WRITE;
/*!40000 ALTER TABLE `support_bot_prompts` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_bot_prompts` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `support_conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_conversations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` datetime DEFAULT NULL,
  `resolution_status` varchar(20) NOT NULL DEFAULT 'OPEN',
  `escalated_at` datetime DEFAULT NULL,
  `escalation_reason` varchar(500) DEFAULT NULL,
  `escalated_by_llm` tinyint(1) NOT NULL DEFAULT '0',
  `reporter_ip_hash` varchar(64) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `assigned_agent_id` bigint DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `assigned_profile_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_support_conv_user` (`user_id`,`started_at` DESC),
  KEY `idx_support_conv_status` (`resolution_status`,`started_at` DESC),
  KEY `fk_support_conv_assigned_profile` (`assigned_profile_id`),
  KEY `idx_support_conv_assigned_status` (`assigned_agent_id`,`resolution_status`),
  CONSTRAINT `fk_support_conv_assigned_agent` FOREIGN KEY (`assigned_agent_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_support_conv_assigned_profile` FOREIGN KEY (`assigned_profile_id`) REFERENCES `backoffice_agent_profile` (`id`),
  CONSTRAINT `fk_support_conv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_support_conv_assign_bicolumn` CHECK ((((`assigned_agent_id` is null) and (`assigned_profile_id` is null)) or ((`assigned_agent_id` is not null) and (`assigned_profile_id` is not null)))),
  CONSTRAINT `chk_support_conv_resolution` CHECK ((`resolution_status` in (_utf8mb4'OPEN',_utf8mb4'RESOLVED',_utf8mb4'ESCALATED',_utf8mb4'ABANDONED',_utf8mb4'RATE_LIMITED',_utf8mb4'HUMAN_HANDLING')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `support_conversations` WRITE;
/*!40000 ALTER TABLE `support_conversations` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_conversations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `support_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint NOT NULL,
  `sender` varchar(10) NOT NULL,
  `content` varchar(4000) NOT NULL,
  `tokens_input` int DEFAULT NULL,
  `tokens_output` int DEFAULT NULL,
  `cost_estimate_micros` bigint DEFAULT NULL,
  `llm_model` varchar(50) DEFAULT NULL,
  `llm_finish_reason` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_by_user_id` bigint DEFAULT NULL,
  `sent_by_profile_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_support_msg_conv` (`conversation_id`,`created_at`),
  KEY `fk_support_msg_sent_by_profile` (`sent_by_profile_id`),
  KEY `idx_support_msg_sent_by_user` (`sent_by_user_id`),
  CONSTRAINT `fk_support_msg_conv` FOREIGN KEY (`conversation_id`) REFERENCES `support_conversations` (`id`),
  CONSTRAINT `fk_support_msg_sent_by_profile` FOREIGN KEY (`sent_by_profile_id`) REFERENCES `backoffice_agent_profile` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_support_msg_sent_by_user` FOREIGN KEY (`sent_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_support_msg_sender` CHECK ((`sender` in (_utf8mb4'USER',_utf8mb4'LLM',_utf8mb4'HUMAN',_utf8mb4'SYSTEM')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `support_messages` WRITE;
/*!40000 ALTER TABLE `support_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_messages` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `support_rate_limit_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_rate_limit_daily` (
  `user_id` bigint NOT NULL,
  `usage_date` date NOT NULL,
  `messages_count` int NOT NULL DEFAULT '0',
  `tokens_count` bigint NOT NULL DEFAULT '0',
  `exceeded_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`usage_date`),
  KEY `idx_support_rl_date` (`usage_date`),
  CONSTRAINT `fk_support_rl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `support_rate_limit_daily` WRITE;
/*!40000 ALTER TABLE `support_rate_limit_daily` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_rate_limit_daily` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `support_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_tickets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `category` varchar(40) NOT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'OPEN',
  `description` text NOT NULL,
  `reported_incident_at` datetime DEFAULT NULL,
  `linked_conversation_id` bigint DEFAULT NULL,
  `linked_stream_record_id` bigint DEFAULT NULL,
  `linked_payment_session_id` bigint DEFAULT NULL,
  `verification_last_run_at` datetime DEFAULT NULL,
  `verification_last_result_json` json DEFAULT NULL,
  `verification_last_signal` varchar(20) DEFAULT NULL,
  `compensated_amount_eur` decimal(10,2) DEFAULT NULL,
  `compensated_transaction_id` bigint DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by_admin_id` bigint DEFAULT NULL,
  `resolution_notes` text,
  `high_history_flag` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_ticket_conv` (`linked_conversation_id`),
  KEY `fk_ticket_stream` (`linked_stream_record_id`),
  KEY `fk_ticket_payment` (`linked_payment_session_id`),
  KEY `fk_ticket_admin` (`resolved_by_admin_id`),
  KEY `idx_ticket_user` (`user_id`,`created_at` DESC),
  KEY `idx_ticket_status` (`status`,`created_at` DESC),
  KEY `idx_ticket_category` (`category`,`created_at` DESC),
  KEY `fk_ticket_tx` (`compensated_transaction_id`),
  CONSTRAINT `fk_ticket_admin` FOREIGN KEY (`resolved_by_admin_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_ticket_conv` FOREIGN KEY (`linked_conversation_id`) REFERENCES `support_conversations` (`id`),
  CONSTRAINT `fk_ticket_payment` FOREIGN KEY (`linked_payment_session_id`) REFERENCES `payment_sessions` (`id`),
  CONSTRAINT `fk_ticket_stream` FOREIGN KEY (`linked_stream_record_id`) REFERENCES `stream_records` (`id`),
  CONSTRAINT `fk_ticket_tx` FOREIGN KEY (`compensated_transaction_id`) REFERENCES `transactions` (`id`),
  CONSTRAINT `fk_ticket_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_ticket_category` CHECK ((`category` in (_utf8mb4'STREAM_INTERRUPTED',_utf8mb4'PAYMENT_NOT_CREDITED',_utf8mb4'MODERATION_FALSE_POSITIVE',_utf8mb4'ACCOUNT_ISSUE',_utf8mb4'PAYOUT_ISSUE',_utf8mb4'KYC_VERIFICATION',_utf8mb4'ACCOUNT_SECURITY',_utf8mb4'REFUND_REQUEST',_utf8mb4'ABUSE_REPORT',_utf8mb4'OTHER'))),
  CONSTRAINT `chk_ticket_signal` CHECK (((`verification_last_signal` is null) or (`verification_last_signal` in (_utf8mb4'STRONG_POSITIVE',_utf8mb4'WEAK_POSITIVE',_utf8mb4'NEUTRAL',_utf8mb4'NEGATIVE')))),
  CONSTRAINT `chk_ticket_status` CHECK ((`status` in (_utf8mb4'OPEN',_utf8mb4'INVESTIGATING',_utf8mb4'RESOLVED_COMPENSATED_PENDING_CREDIT',_utf8mb4'RESOLVED_COMPENSATED',_utf8mb4'RESOLVED_NO_COMPENSATION',_utf8mb4'REJECTED_INVALID',_utf8mb4'ABANDONED')))
) ENGINE=InnoDB AUTO_INCREMENT=10001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `support_tickets` WRITE;
/*!40000 ALTER TABLE `support_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_tickets` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `transactions`;
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
  `ticket_id` bigint DEFAULT NULL,
  `attributed_model_user_id` bigint DEFAULT NULL COMMENT 'Modelo que origino el ingreso cuando user=Master (ADR-056)',
  PRIMARY KEY (`id`),
  KEY `fk_stream_record_transactions` (`stream_record_id`),
  KEY `fk_gift_transactions` (`gift_id`),
  KEY `idx_transactions_user_time` (`user_id`,`timestamp`),
  KEY `idx_transactions_time` (`timestamp`),
  KEY `idx_tx_ticket` (`ticket_id`),
  KEY `idx_tx_attributed_model` (`attributed_model_user_id`),
  CONSTRAINT `fk_gift_transactions` FOREIGN KEY (`gift_id`) REFERENCES `gifts` (`id`),
  CONSTRAINT `fk_stream_record_transactions` FOREIGN KEY (`stream_record_id`) REFERENCES `stream_records` (`id`),
  CONSTRAINT `fk_tx_attributed_model` FOREIGN KEY (`attributed_model_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_tx_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`),
  CONSTRAINT `fk_user_transactions` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=805 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `unsubscribe`;
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

LOCK TABLES `unsubscribe` WRITE;
/*!40000 ALTER TABLE `unsubscribe` DISABLE KEYS */;
/*!40000 ALTER TABLE `unsubscribe` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_acquisition`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_acquisition` (
  `user_id` bigint NOT NULL,
  `utm_source` varchar(128) DEFAULT NULL,
  `utm_medium` varchar(128) DEFAULT NULL,
  `utm_campaign` varchar(191) DEFAULT NULL,
  `referrer_host` varchar(191) DEFAULT NULL,
  `landing_path` varchar(512) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `ix_user_acquisition_source` (`utm_source`),
  CONSTRAINT `fk_user_acquisition_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_acquisition` WRITE;
/*!40000 ALTER TABLE `user_acquisition` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_acquisition` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_backoffice_roles`;
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

LOCK TABLES `user_backoffice_roles` WRITE;
/*!40000 ALTER TABLE `user_backoffice_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_backoffice_roles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_blocks`;
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

LOCK TABLES `user_blocks` WRITE;
/*!40000 ALTER TABLE `user_blocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_blocks` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_languages`;
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

LOCK TABLES `user_languages` WRITE;
/*!40000 ALTER TABLE `user_languages` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_languages` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_permission_overrides`;
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

LOCK TABLES `user_permission_overrides` WRITE;
/*!40000 ALTER TABLE `user_permission_overrides` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permission_overrides` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_trial_streams`;
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

LOCK TABLES `user_trial_streams` WRITE;
/*!40000 ALTER TABLE `user_trial_streams` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_trial_streams` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ui_locale` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'es',
  `preferred_chat_lang` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
  `client_kyc_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_kyc_decided_at` datetime DEFAULT NULL,
  `client_kyc_estimated_age` decimal(5,2) DEFAULT NULL,
  `last_activity_at` datetime DEFAULT NULL COMMENT 'Timestamp UTC del ultimo login o refresh exitoso. Base de la politica de cuentas dormidas (V37).',
  `dormant_since` datetime DEFAULT NULL COMMENT 'Cuando NOT NULL, la cuenta fue marcada dormant por el AccountDormancyJob. Distingue del bloqueo por ban real (is_active=false sin dormant_since). El login auto-reactiva (dormant_since=NULL) sin intervencion admin.',
  `chosen_rate_eur_per_min` decimal(4,2) NOT NULL DEFAULT '1.00' COMMENT 'Tarifa por minuto elegida por la modelo dentro del rango de su tramo (ADR-052 Â§D2). Default 1.00 (T0). Se recorta automaticamente al max del tramo destino si la modelo baja de tramo.',
  `pro_accepts_trial` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Toggle Estatus Pro (ADR-052 Â§D3): true si la modelo Pro acepta clientes trial. Default true para no romper flujo trial existente cuando Pro se active por primera vez.',
  `password_temporary` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'ADR-056 D7: si 1, forzar cambio password al primer login antes de firmar/KYC',
  `first_password_change_at` datetime DEFAULT NULL COMMENT 'Auditoria: instante en que el usuario cambio password por primera vez',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `nickname` (`nickname`),
  KEY `idx_users_country_detected` (`country_detected`),
  KEY `fk_users_risk_updated_by` (`risk_updated_by`),
  KEY `idx_users_model_gate` (`role`,`verification_status`,`is_active`,`unsubscribe`),
  KEY `idx_users_account_status` (`account_status`),
  KEY `idx_users_suspended_until` (`account_status`,`suspended_until`),
  KEY `idx_users_risk_updated_at` (`risk_updated_at`),
  KEY `idx_users_last_activity_at` (`last_activity_at`),
  KEY `idx_users_dormant_since` (`dormant_since`),
  CONSTRAINT `fk_users_risk_updated_by` FOREIGN KEY (`risk_updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (27,'Soporte SharemeChat','bot+support@sharemechat.com','__NO_LOGIN__','SUPPORT_BOT','es',NULL,NULL,'BOT',NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,1,0,'2026-08-12 00:22:23',NULL,'2026-08-12 00:22:23','ACTIVE',NULL,NULL,'2026-08-12 00:22:23',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1.00,1,0,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promo_grant_counter` (promo "100 primeros
-- clientes", migración V52; añadida al baseline IT para ddl-auto=validate).
--
DROP TABLE IF EXISTS `promo_grant_counter`;
CREATE TABLE `promo_grant_counter` (
  `promo_key` varchar(64) NOT NULL,
  `granted` int NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`promo_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `promo_grant_counter` WRITE;
INSERT INTO `promo_grant_counter` VALUES ('WELCOME_100',0,'2026-08-16 00:00:00');
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_profile_attributes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_profile_attributes` (
  `user_id` bigint NOT NULL,
  `bust_size` varchar(16) DEFAULT NULL,
  `height_cm` int DEFAULT NULL,
  `butt_size` varchar(16) DEFAULT NULL,
  `body_type` varchar(16) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_model_profile_attributes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_profile_attributes` WRITE;
/*!40000 ALTER TABLE `model_profile_attributes` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_profile_attributes` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_presence_samples`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_presence_samples` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `model_user_id` bigint NOT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'AVAILABLE',
  `sampled_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mps_model_sampled` (`model_user_id`,`sampled_at`),
  KEY `idx_mps_sampled` (`sampled_at`),
  CONSTRAINT `fk_model_presence_samples_user` FOREIGN KEY (`model_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_model_presence_samples_status` CHECK ((`status` in (_utf8mb4'AVAILABLE',_utf8mb4'BUSY')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_presence_samples` WRITE;
/*!40000 ALTER TABLE `model_presence_samples` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_presence_samples` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `model_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_likes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `client_user_id` bigint NOT NULL,
  `model_user_id` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_likes_pair` (`client_user_id`,`model_user_id`),
  KEY `idx_model_likes_model` (`model_user_id`),
  CONSTRAINT `fk_model_likes_client` FOREIGN KEY (`client_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_model_likes_model` FOREIGN KEY (`model_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `model_likes` WRITE;
/*!40000 ALTER TABLE `model_likes` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_likes` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

