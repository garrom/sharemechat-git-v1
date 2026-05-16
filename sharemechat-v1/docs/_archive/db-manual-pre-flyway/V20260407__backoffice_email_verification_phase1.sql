alter table users
    add column email_verified_at datetime null after risk_updated_by;

create table email_verification_tokens (
    id bigint not null auto_increment,
    user_id bigint not null,
    token_hash varchar(64) not null,
    expires_at datetime not null,
    consumed_at datetime null,
    sent_to_email varchar(255) not null,
    created_by_user_id bigint null,
    created_at datetime not null default current_timestamp,
    primary key (id),
    unique key uq_email_verification_tokens_token_hash (token_hash),
    key idx_evt_user_id (user_id),
    key idx_evt_expires_at (expires_at),
    constraint fk_evt_user foreign key (user_id) references users (id)
);
