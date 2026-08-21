-- V57 (2026-08-22): Fase 5 i18n — limpieza final. Elimina la columna
-- users.preferred_chat_lang, deprecada desde la Fase 2 (2026-08-21).
--
-- El idioma personal / destino de traducción de chat vive ahora en la tabla
-- user_languages (fila primaria), editable por el usuario en el card "Tu chat
-- se traduce a". La columna ya NO se lee ni se escribe desde ese despliegue, así
-- que su borrado no cambia comportamiento; sus valores eran dato muerto.
--
-- El campo mapeado se retira a la vez de la entidad User (ddl-auto=validate
-- fallaría al arrancar si la columna desaparece pero el @Column sigue).

ALTER TABLE users DROP COLUMN preferred_chat_lang;
