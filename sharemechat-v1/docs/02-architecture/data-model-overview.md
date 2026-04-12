# Visión general del modelo de datos

## Núcleo de cuenta y acceso

- `users`
- `refresh_tokens`
- `password_reset_tokens`
- `email_verification_tokens`
- `consent_events`
- `unsubscribes`

## Producto y relaciones

- `clients`
- `models`
- `messages`
- `favorite_clients`
- `favorite_models`
- `user_blocks`
- `user_languages`
- `home_featured_models`

## Streaming y realtime

- `stream_records`
- `stream_status_events`
- `user_trial_streams`

## Economía

- `transactions`
- `balances`
- `platform_transactions`
- `platform_balances`
- `payment_sessions`
- `payout_requests`
- `gifts`

## Onboarding y KYC

- `model_documents`
- `client_documents`
- `model_contract_acceptances`
- `model_kyc_sessions`
- `kyc_webhook_events`
- `kyc_provider_configs`
- `model_review_checklists`
- `model_earning_tiers`
- `model_tier_daily_snapshots`

## Backoffice y auditoría interna

- `backoffice_roles`
- `permissions`
- `role_permissions`
- `user_backoffice_roles`
- `user_permission_overrides`
- `backoffice_access_audit_log`
- `audit_runs`
- `accounting_anomalies`

## Lectura de conjunto

El modelo refleja un sistema con trazabilidad relativamente alta en economía, streams y control interno. Esa es una fortaleza del repositorio y debe mantenerse como conocimiento duradero.
