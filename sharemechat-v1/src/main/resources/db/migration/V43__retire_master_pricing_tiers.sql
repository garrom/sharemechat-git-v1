-- V43 — retirar filas regimen MASTER de model_pricing_tiers (ADR-056 D4 revision)
--
-- Contexto: en la revision de D4 (2026-07-30) tras research web se confirmo que
-- LiveJasmin, Stripchat y BongaCams calculan el tramo INDIVIDUALMENTE por
-- modelo, no de forma agregada por estudio. La agregacion de la V42 hacia que
-- SharemeChat regalara ~20pp de margen bruto al Master en el escenario top
-- (T4 agregado 70% vs T4 individual sumado 57%). El sector no lo hace y
-- economicamente no era sostenible.
--
-- Decision: motor a cálculo INDIVIDUAL per modelo. El Master recibe la suma
-- de los pagos individuales al % del tramo INDIVIDUAL de cada modelo. No hay
-- palanca estructural del portal; el margen del Master sale del spread
-- privado (Master↔modelo) y del hecho de que SharemeChat ya paga mejor % que
-- el sector en tramo entrada-medio (T1 50% vs LiveJasmin L1 30%).
--
-- Esta migration cierra vigencia (effective_to = CURRENT_TIMESTAMP) de las 4
-- filas MASTER seed'd por V42. La columna target_type se mantiene por si en
-- el futuro se reactiva el regimen dual. El chk_mpt_target_type y el
-- uq_mpt_target_code_effective tambien se mantienen (no molestan).

UPDATE model_pricing_tiers
    SET effective_to = CURRENT_TIMESTAMP
 WHERE target_type = 'MASTER'
   AND effective_to IS NULL;
