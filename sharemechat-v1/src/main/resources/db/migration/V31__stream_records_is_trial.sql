-- V31: flag is_trial en stream_records para distinguir shadow records
-- creados por el frente trial-sfw (Bloque 2). Los shadow records
-- comparten schema con los paid pero NO generan billing ni transacciones
-- (UserTrialService liquida aparte via TRIAL_EARNING / TRIAL_COST).
--
-- Aditiva y sin lock. Analytics/billing que consulten stream_records
-- deberian filtrar WHERE is_trial=false para no mezclar paid con trial;
-- deuda tolerable de auditar caso por caso segun aparezca.

ALTER TABLE stream_records
    ADD COLUMN is_trial TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'true si es shadow record creado por UserTrialService.startTrialStream (frente trial-sfw Bloque 2). false para paid streams normales.';

CREATE INDEX idx_stream_records_is_trial ON stream_records (is_trial);
