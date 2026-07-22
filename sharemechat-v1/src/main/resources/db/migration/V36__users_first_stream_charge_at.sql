-- V36: timestamp de la primera compra (STREAM_CHARGE) del cliente. Base
-- para la ventana rodante de 12 meses del revshare de afiliacion
-- (ADR-049 D2 revisado: la comision del referrer aplica solo mientras
-- el cargo del cliente esta dentro de first_stream_charge_at + 12 meses).
--
-- NULL antes del primer STREAM_CHARGE del cliente. Se setea la primera
-- vez que el hook AffiliateCommissionService.accrueForStreamCharge
-- observa una compra del cliente. Inmutable a partir de entonces.
--
-- Index para la clausula "esta el cliente dentro de ventana" en la
-- accrue path (lookup por user_id + comparacion contra now).

ALTER TABLE users
    ADD COLUMN first_stream_charge_at DATETIME NULL
        COMMENT 'Timestamp UTC del primer Transaction STREAM_CHARGE del cliente. Ancla la ventana de 12 meses del revshare de afiliacion (ADR-049 D2 revisado).';

CREATE INDEX idx_users_first_stream_charge_at ON users (first_stream_charge_at);
