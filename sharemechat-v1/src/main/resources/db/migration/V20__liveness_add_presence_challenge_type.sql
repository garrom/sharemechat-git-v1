-- V20__liveness_add_presence_challenge_type.sql
--
-- ADR-050 D4 revisado 2026-07-13: cambio de gesture challenge (BLINK/
-- TURN_LEFT/TURN_RIGHT/SMILE) a presence check simple (PRESENCE).
--
-- Motivo del cambio: testing empirico en TEST con Logitech C270 + luz
-- de casa mostro tasa de falso negativo alta con los gestures de
-- face-attributes de SightEngine. UX inaceptable ("no reconoce ni el
-- parpadeo ni la sonrisa"). Cambio a modelo pasivo alineado con CooMeet
-- y el resto del vertical: modal 3s sin gesto, backend valida que hay
-- cara y micro-movement entre frames (bounding box no identico).
--
-- Migracion: relajar el CHECK constraint para incluir PRESENCE. Los
-- valores legacy se conservan por retrocompat con filas historicas
-- (aunque el service solo emitira PRESENCE en adelante).

ALTER TABLE liveness_attempts
    DROP CHECK chk_la_challenge_type;

ALTER TABLE liveness_attempts
    ADD CONSTRAINT chk_la_challenge_type CHECK (
        challenge_type IN ('BLINK','TURN_LEFT','TURN_RIGHT','SMILE','PRESENCE')
    );
