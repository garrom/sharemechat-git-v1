-- pending-hardening §5.3 (2026-08-08): traductor automatico chat P2P
-- cross-language. Provider Google Cloud Translate (v2), pattern UX auto
-- ambas versiones + toggle global (opcion C tipo CooMeet).
--
-- Cache tabla message_translations: cada mensaje ya traducido a un idioma
-- NO se re-traduce nunca mas para ese idioma. Reduce coste API ~5x en
-- historial re-leido y evita duplicar chars contra la cuota Google.
--
-- Free tier Google Cloud Translation: 500.000 chars/mes sin caducidad.
-- Con cache + soft launch (100-500 users, ~30% cross-language) esta feature
-- deberia mantenerse gratis durante meses. Coste overage $20/M chars.
--
-- Diseño:
--   message_id     -> FK a messages.id, ON DELETE CASCADE (si expira o
--                     borran el mensaje, se limpian sus traducciones).
--   target_lang    -> idioma destino de la traduccion (ej. "es", "en", "fr").
--                     UNIQUE (message_id, target_lang): un mensaje solo se
--                     traduce una vez a cada idioma.
--   translated_text-> VARCHAR(2000). Body original es VARCHAR(1000); las
--                     traducciones pueden crecer hasta ~40% en algunos pares
--                     (ES↔DE, EN↔FR). 2000 da margen holgado.
--   provider       -> "google", "deepl", etc. Permite mezclar providers en
--                     el futuro sin migracion (adapter vendor-agnostic).

CREATE TABLE `message_translations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT NOT NULL,
  `target_lang` VARCHAR(5) NOT NULL,
  `translated_text` VARCHAR(2000) NOT NULL,
  `provider` VARCHAR(20) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_translations_msg_lang` (`message_id`, `target_lang`),
  CONSTRAINT `fk_message_translations_message` FOREIGN KEY (`message_id`)
    REFERENCES `messages`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Idioma preferido del user para chat P2P. NULLABLE: fallback a ui_locale
-- si nunca se ha seteado. El selector del perfil (T6) escribe aqui; los
-- users legacy siguen funcionando via ui_locale sin migracion de datos.
ALTER TABLE `users`
  ADD COLUMN `preferred_chat_lang` VARCHAR(5) NULL AFTER `ui_locale`;
