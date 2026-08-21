// src/pages/subpages/PerfilModel.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAppModals } from '../../components/useAppModals';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import i18n from '../../i18n';
import LocaleSwitcher from '../../components/LocaleSwitcher';

import {
  PageShell,
  StyledNavbar,
  StyledBrand,
} from '../../styles/NavbarStyles';

import {
  NavButton,
  ProfilePrimaryButton,
  ProfileSecondaryButton,
  ProfileDangerOutlineButton,
} from '../../styles/ButtonStyles';

import {
  Message,
  Label,
  Input,
  Select,
  Textarea,
  Hint,
  ProfileMain,
  ProfileHeader,
  ProfileHeaderAvatar,
  Avatar,
  AvatarImg,
  ProfileHeaderInfo,
  ProfileHeaderTitleRow,
  ProfileHeaderName,
  ChipRole,
  ProfileHeaderSubtitle,
  CompletenessWrap,
  CompletenessBar,
  CompletenessText,
  ProfileHeaderMeta,
  MetaItem,
  MetaLabel,
  MetaValue,
  MetaValueOk,
  ProfileGrid,
  ProfileColMain,
  ProfileColSide,
  ProfileCard,
  SecurityCard,
  ContractNoticeCard,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  CardFooter,
  FormGridNew,
  FormFieldNew,
  InlineActions,
  SecurityActions,
} from '../../styles/subpages/PerfilClientModelStyle';

import MyAssetsManager from './MyAssetsManager';
import MyLanguagesCard from '../../components/MyLanguagesCard';
import ModelReputationCard from '../../components/ModelReputationCard';
import ModelRankingModal from '../../components/ModelRankingModal';
import ModelProfileExpanded from './ModelProfileExpanded';

const PerfilModel = () => {
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();
  const { alert, openUnsubscribeModal } = useAppModals();
  const { user: sessionUser, loading: sessionLoading } = useSession();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [userId, setUserId] = useState(null);

  // Card 1 Fase C: ranking "Top modelos" + perfil de una modelo del ranking.
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankProfileUser, setRankProfileUser] = useState(null);

  const [form, setForm] = useState({
    email: '',
    name: '',
    surname: '',
    nickname: '',
    biography: '',
    interests: '',
  });

  // Card 1 Fase 2: datos físicos (perfil público visto por el cliente).
  const [physical, setPhysical] = useState({ bustSize: '', heightCm: '', buttSize: '', bodyType: '' });
  const [physicalSaving, setPhysicalSaving] = useState(false);
  const PHYS_OPTS = {
    bust: ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'],
    butt: ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'],
    body: ['SLIM', 'ATHLETIC', 'AVERAGE', 'CURVY', 'BBW'],
  };
  const physLabel = (kind, code) => t(`modelProfileExpanded.${kind}Values.${code}`, { defaultValue: code });

  // Capa 2: avatar del header derivado del asset PIC principal APPROVED.
  // El MyAssetsManager nos lo entrega vía onAssetsChange en cada refresh.
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState(null);
  // Rediseño UX Fase 1: lista completa de assets (para calcular completitud).
  const [allAssets, setAllAssets] = useState([]);

  // Contrato (solo UX de ROLE_MODEL)
  const [contractLoading, setContractLoading] = useState(false);
  const [contractAccepting, setContractAccepting] = useState(false);
  const [contractInfo, setContractInfo] = useState({
    accepted: true,
    acceptedCurrent: true,
    acceptedEver: false,
    needsReaccept: false,
    currentVersion: null,
    currentSha256: null,
    currentUrl: null,
  });

  const loadContractStatus = async () => {
    setContractLoading(true);
    try {
      const data = await apiFetch('/consent/model-contract/status');

      setContractInfo({
        accepted: !!data?.accepted,
        acceptedCurrent: !!data?.acceptedCurrent,
        acceptedEver: !!data?.acceptedEver,
        needsReaccept: !!data?.needsReaccept,
        currentVersion: data?.currentVersion || null,
        currentSha256: data?.currentSha256 || null,
        currentUrl: data?.currentUrl || null,
      });
    } catch {
      // Si falla, no rompemos perfil. Dejamos sin bloqueo UX extra.
      setContractInfo((prev) => ({
        ...prev,
        accepted: true,
        acceptedCurrent: true,
        needsReaccept: false,
      }));
    } finally {
      setContractLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionUser && !sessionLoading) {
      history.push('/login');
      return;
    }

    if (!sessionUser) return;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await apiFetch('/users/me');

        setUserId(data.id);

        setForm({
          email: data.email || '',
          name: data.name || '',
          surname: data.surname || '',
          nickname: data.nickname || '',
          biography: data.biography || '',
          interests: data.interests || '',
        });

        // Card 1 Fase 2: datos físicos (no bloquea el perfil si falla).
        try {
          const attrs = await apiFetch('/me/profile-attributes');
          setPhysical({
            bustSize: attrs?.bustSize || '',
            heightCm: attrs?.heightCm != null ? String(attrs.heightCm) : '',
            buttSize: attrs?.buttSize || '',
            bodyType: attrs?.bodyType || '',
          });
        } catch (_) { /* sin atributos aún */ }

        await loadContractStatus();
      } catch (e) {
        setError(e?.message || t('profileCommon.errors.loadProfile'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionUser, sessionLoading, history]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onChangePhysical = (e) => {
    const { name, value } = e.target;
    setPhysical((p) => ({ ...p, [name]: value }));
  };

  const handleSavePhysical = async () => {
    setPhysicalSaving(true);
    setError('');
    setMsg('');
    try {
      const payload = {
        bustSize: physical.bustSize || null,
        heightCm: physical.heightCm !== '' ? Number(physical.heightCm) : null,
        buttSize: physical.buttSize || null,
        bodyType: physical.bodyType || null,
      };
      const saved = await apiFetch('/me/profile-attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setPhysical({
        bustSize: saved?.bustSize || '',
        heightCm: saved?.heightCm != null ? String(saved.heightCm) : '',
        buttSize: saved?.buttSize || '',
        bodyType: saved?.bodyType || '',
      });
      setMsg(t('profileCommon.success.saved'));
    } catch (e) {
      setError(e?.message || t('profileCommon.errors.save'));
    } finally {
      setPhysicalSaving(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    setError('');
    setMsg('');

    try {
      const payload = {
        name: form.name || null,
        surname: form.surname || null,
        nickname: form.nickname || null,
        biography: form.biography || null,
        interests: form.interests || null,
      };

      await apiFetch(`/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setMsg(t('profileCommon.success.saved'));
    } catch (e) {
      setError(e?.message || t('profileCommon.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const onUnsubscribe = async () => {
    const { confirmed, reason } = await openUnsubscribeModal();
    if (!confirmed) return;

    try {
      await apiFetch('/users/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      await alert({
        title: t('profileCommon.accountTitle'),
        message: t('profileCommon.success.unsubscribed'),
        variant: 'success',
        size: 'sm',
      });

      history.push('/login');
    } catch (e) {
      await alert({
        title: t('profileCommon.accountTitle'),
        message: e?.message || t('profileCommon.errors.unsubscribe'),
        variant: 'danger',
        size: 'sm',
      });
    }
  };

  const handleAcceptNewContract = async () => {
    const url = contractInfo?.currentUrl;

    const confirmed = window.confirm(
      t('perfilModel.contract.confirmAccept')
    );

    if (!confirmed) return;

    setContractAccepting(true);
    setError('');
    setMsg('');

    try {
      await apiFetch('/consent/model-contract/accept', {
        method: 'POST',
      });

      await loadContractStatus();
      setMsg(t('perfilModel.contract.success.accepted'));
    } catch (e) {
      setError(e?.message || t('perfilModel.contract.errors.accept'));
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setContractAccepting(false);
    }
  };

  // Callback que MyAssetsManager invoca tras cada carga/cambio.
  // El avatar del header es la URL del asset PIC principal APPROVED.
  const onAssetsChange = (assets) => {
    setAllAssets(Array.isArray(assets) ? assets : []);
    if (!Array.isArray(assets)) {
      setHeaderAvatarUrl(null);
      return;
    }
    const principalPic = assets.find(
      (a) =>
        a.assetType === 'PIC'
        && a.isPrincipal === true
        && a.isActive === true
        && a.reviewStatus === 'APPROVED'
    );
    setHeaderAvatarUrl(principalPic?.url || null);
  };

  const displayName = form.nickname || form.name || form.email || t('perfilModel.displayName');
  const contractBlocked = contractInfo?.acceptedCurrent === false;

  // Rediseño UX Fase 1: completitud del perfil (pesos D3). foto principal 30% ·
  // ≥1 vídeo 20% · biografía 15% · ≥2 datos físicos 15% · intereses 10% · nickname 10%.
  const hasPrincipalPhoto = !!headerAvatarUrl;
  const hasVideo = allAssets.some((a) => a.assetType === 'VIDEO');
  const physFilled = ['bustSize', 'heightCm', 'buttSize', 'bodyType']
    .filter((k) => String(physical[k] || '').trim() !== '').length;
  const complChecks = [
    { ok: hasPrincipalPhoto, w: 30, tip: 'photo' },
    { ok: hasVideo, w: 20, tip: 'video' },
    { ok: !!String(form.biography || '').trim(), w: 15, tip: 'bio' },
    { ok: physFilled >= 2, w: 15, tip: 'physical' },
    { ok: !!String(form.interests || '').trim(), w: 10, tip: 'interests' },
    { ok: !!String(form.nickname || '').trim(), w: 10, tip: 'nickname' },
  ];
  const completeness = complChecks.reduce((s, c) => s + (c.ok ? c.w : 0), 0);
  const nextTip = complChecks.find((c) => !c.ok);

  return (
    <PageShell>
      <StyledNavbar>
        <StyledBrand
          href="/"
          aria-label="SharemeChat"
          onClick={(e) => { e.preventDefault(); history.push('/'); }}
        />
        <div>
          <NavButton type="button" onClick={() => history.push('/model')}>
            {t('common.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <ProfileMain>
        {/* CABECERA PERFIL */}
        <ProfileHeader>
          <ProfileHeaderAvatar>
            <Avatar>
              {headerAvatarUrl && (
                <AvatarImg src={headerAvatarUrl} alt={t('profileCommon.alt.profilePhoto')} />
              )}
            </Avatar>
          </ProfileHeaderAvatar>

          <ProfileHeaderInfo>
            <ProfileHeaderTitleRow>
              <ProfileHeaderName>{displayName}</ProfileHeaderName>
              <ChipRole>{t('perfilModel.role')}</ChipRole>
            </ProfileHeaderTitleRow>
            <ProfileHeaderSubtitle>
              {t('perfilModel.header.subtitle')}
            </ProfileHeaderSubtitle>
            <CompletenessWrap>
              <CompletenessBar $pct={completeness}><i /></CompletenessBar>
              <CompletenessText>
                <b>{completeness}%</b> {t('profileCommon.completeness.complete', 'completo')}
                {nextTip && (
                  <>{' · '}<span className="go">{t(`profileCommon.completeness.tip.${nextTip.tip}`)}</span></>
                )}
              </CompletenessText>
            </CompletenessWrap>
            <ProfileHeaderMeta>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.status')}</MetaLabel>
                <MetaValueOk>{t('profileCommon.status.active')}</MetaValueOk>
              </MetaItem>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.email')}</MetaLabel>
                <MetaValue>{form.email || t('profileCommon.empty.value')}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.language')}</MetaLabel>
                <LocaleSwitcher />
              </MetaItem>
            </ProfileHeaderMeta>
          </ProfileHeaderInfo>
        </ProfileHeader>

        {/* Aviso contrato actualizado (solo cuando aplica) */}
        {!loading && contractBlocked && (
          <ContractNoticeCard>
            <CardHeader>
              <CardTitle>{t('perfilModel.contract.title')}</CardTitle>
              <CardSubtitle>
                {t('perfilModel.contract.subtitle')}
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              {contractInfo?.currentVersion && (
                <Hint>
                  {t('perfilModel.contract.currentVersion')} <strong>{contractInfo.currentVersion}</strong>
                </Hint>
              )}

              <InlineActions>
                {contractInfo?.currentUrl && (
                  <ProfileSecondaryButton
                    type="button"
                    onClick={() => window.open(contractInfo.currentUrl, '_blank', 'noopener,noreferrer')}
                  >
                    {t('perfilModel.contract.actions.viewContract')}
                  </ProfileSecondaryButton>
                )}

                <ProfilePrimaryButton
                  type="button"
                  onClick={handleAcceptNewContract}
                  disabled={contractAccepting || contractLoading}
                >
                  {contractAccepting ? t('perfilModel.contract.actions.accepting') : t('perfilModel.contract.actions.acceptNewVersion')}
                </ProfilePrimaryButton>
              </InlineActions>
            </CardBody>
          </ContractNoticeCard>
        )}

        {/* Mensajes de estado */}
        {loading && <p>{t('profileCommon.loading.default')}</p>}
        {error && <Message type="error">{error}</Message>}
        {msg && <Message type="ok">{msg}</Message>}

        {!loading && (
          <ProfileGrid>
            {/* COLUMNA IZQUIERDA: DATOS */}
            <ProfileColMain>
              {/* Rediseño UX: fotos/vídeos como HERO (arriba), es el activo nº1
                  del modelo. Antes iba lo último. El sistema no cambia. */}
              <MyAssetsManager
                contractBlocked={contractBlocked}
                onAssetsChange={onAssetsChange}
              />

              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.basicData.title')}</CardTitle>
                  <CardSubtitle>
                    {t('perfilModel.sections.basicData.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormGridNew>
                    <FormFieldNew>
                      <Label>{t('profileCommon.labels.name')}</Label>
                      <Input
                        name="name"
                        value={form.name}
                        onChange={onChange}
                        placeholder={t('profileCommon.placeholders.name')}
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>{t('profileCommon.labels.surname')}</Label>
                      <Input
                        name="surname"
                        value={form.surname}
                        onChange={onChange}
                        placeholder={t('profileCommon.placeholders.surname')}
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>{t('profileCommon.labels.nickname')}</Label>
                      <Input
                        name="nickname"
                        value={form.nickname}
                        onChange={onChange}
                        placeholder={t('profileCommon.placeholders.nickname')}
                      />
                    </FormFieldNew>
                  </FormGridNew>
                </CardBody>
                <CardFooter>
                  <ProfilePrimaryButton
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? t('profileCommon.actions.saving') : t('profileCommon.actions.saveChanges')}
                  </ProfilePrimaryButton>
                </CardFooter>
              </ProfileCard>

              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.about.title')}</CardTitle>
                  <CardSubtitle>
                    {t('perfilModel.sections.about.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormFieldNew>
                    <Label>{t('profileCommon.labels.biography')}</Label>
                    <Textarea
                      name="biography"
                      value={form.biography}
                      onChange={onChange}
                      placeholder={t('perfilModel.placeholders.biography')}
                      rows={4}
                    />
                  </FormFieldNew>

                  <FormFieldNew>
                    <Label>{t('profileCommon.labels.interests')}</Label>
                    <Input
                      name="interests"
                      value={form.interests}
                      onChange={onChange}
                      placeholder={t('perfilModel.placeholders.interests')}
                    />
                    <Hint>
                      {t('perfilModel.hints.interests')}
                    </Hint>
                  </FormFieldNew>
                </CardBody>
                <CardFooter>
                  <ProfilePrimaryButton
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? t('profileCommon.actions.saving') : t('profileCommon.actions.saveChanges')}
                  </ProfilePrimaryButton>
                </CardFooter>
              </ProfileCard>

              {/* Card 1 Fase 2: DATOS FÍSICOS (perfil público visto por el cliente) */}
              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('perfilModel.physical.title')}</CardTitle>
                  <CardSubtitle>{t('perfilModel.physical.subtitle')}</CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormGridNew $two>
                    <FormFieldNew>
                      <Label>{t('perfilModel.physical.bust')}</Label>
                      <Select name="bustSize" value={physical.bustSize} onChange={onChangePhysical}>
                        <option value="">{t('perfilModel.physical.none')}</option>
                        {PHYS_OPTS.bust.map((c) => <option key={c} value={c}>{physLabel('bust', c)}</option>)}
                      </Select>
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>{t('perfilModel.physical.height')}</Label>
                      <Input
                        type="number"
                        name="heightCm"
                        min="120"
                        max="220"
                        value={physical.heightCm}
                        onChange={onChangePhysical}
                        placeholder="165"
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>{t('perfilModel.physical.butt')}</Label>
                      <Select name="buttSize" value={physical.buttSize} onChange={onChangePhysical}>
                        <option value="">{t('perfilModel.physical.none')}</option>
                        {PHYS_OPTS.butt.map((c) => <option key={c} value={c}>{physLabel('butt', c)}</option>)}
                      </Select>
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>{t('perfilModel.physical.body')}</Label>
                      <Select name="bodyType" value={physical.bodyType} onChange={onChangePhysical}>
                        <option value="">{t('perfilModel.physical.none')}</option>
                        {PHYS_OPTS.body.map((c) => <option key={c} value={c}>{physLabel('body', c)}</option>)}
                      </Select>
                    </FormFieldNew>
                  </FormGridNew>
                  <Hint>{t('perfilModel.physical.hint')}</Hint>
                </CardBody>
                <CardFooter>
                  <ProfilePrimaryButton type="button" onClick={handleSavePhysical} disabled={physicalSaving}>
                    {physicalSaving ? t('profileCommon.actions.saving') : t('profileCommon.actions.saveChanges')}
                  </ProfilePrimaryButton>
                </CardFooter>
              </ProfileCard>

            </ProfileColMain>

            {/* COLUMNA DERECHA: SEGURIDAD Y CUENTA */}
            <ProfileColSide>
              {/* Card 1 Fase C: reputación (likes + insignia + progreso) + acceso al ranking. */}
              <ModelReputationCard onOpenRanking={() => setRankingOpen(true)} />

              {/* Fase 2 i18n (2026-08-21): card "Tu idioma" (Nivel B). El idioma
                  personal (16 opciones incl. malgache) = destino de traducción
                  de chat + idioma del perfil. Se auto-oculta si la traducción
                  no está habilitada en el entorno. */}
              <MyLanguagesCard />

              <SecurityCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.security.title')}</CardTitle>
                </CardHeader>
                <CardBody>
                  <SecurityActions>
                    <ProfileSecondaryButton
                      type="button"
                      onClick={() => history.push('/change-password')}
                    >
                      {t('profileCommon.actions.changePassword')}
                    </ProfileSecondaryButton>
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={onUnsubscribe}
                    >
                      {t('modals.unsubscribe.title')}
                    </ProfileDangerOutlineButton>
                  </SecurityActions>
                  <Hint>
                    {t('modals.unsubscribe.warning')}
                  </Hint>
                </CardBody>
              </SecurityCard>
            </ProfileColSide>
          </ProfileGrid>
        )}
      </ProfileMain>

      {/* Card 1 Fase C: ranking Top modelos + perfil de una modelo del ranking. */}
      <ModelRankingModal
        open={rankingOpen}
        onClose={() => setRankingOpen(false)}
        onOpenProfile={(u) => { setRankingOpen(false); setRankProfileUser(u); }}
      />
      <ModelProfileExpanded
        open={!!rankProfileUser}
        userId={rankProfileUser?.id}
        fallbackNickname={rankProfileUser?.nickname}
        onClose={() => setRankProfileUser(null)}
      />
    </PageShell>
  );
};

export default PerfilModel;
