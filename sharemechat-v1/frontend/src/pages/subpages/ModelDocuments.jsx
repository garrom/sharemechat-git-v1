import React, { useEffect, useState, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import i18n from '../../i18n';

import {
  StyledContainer,
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
  FileInput,
  Hint,
  FileNameWrapper,
  ProfileMain,
  ProfileCard,
  SecurityCard,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  ProfileGrid,
  ProfileColMain,
  ProfileColSide,
  PhotoPreview,
  PhotoImg,
  PhotoEmpty,
  PhotoActions,
} from '../../styles/subpages/PerfilClientModelStyle';

const ModelDocuments = () => {
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();
  const location = useLocation();
  const isVeriffRoute = location.pathname === '/model-kyc';

  const DOCS_GET_URL = isVeriffRoute ? '/api/models/kyc/me' : '/api/models/documents/me';
  const DOCS_UPLOAD_URL = isVeriffRoute ? '/api/models/kyc' : '/api/models/documents';

  const [userName, setUserName] = useState('');

  const [doc, setDoc] = useState({
    urlVerificFront: null,
    urlVerificBack: null,
    urlVerificDoc: null,
    verificationStatus: 'PENDING',
  });

  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [verifDocFile, setVerifDocFile] = useState(null);

  const [idFrontKey, setIdFrontKey] = useState(0);
  const [idBackKey, setIdBackKey] = useState(0);
  const [verifDocKey, setVerifDocKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [busyField, setBusyField] = useState(null);
  const [deletingField, setDeletingField] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [startingVeriff, setStartingVeriff] = useState(false);

  const idFrontInputRef = useRef(null);
  const idBackInputRef = useRef(null);
  const verifDocInputRef = useRef(null);

  const getVerificationStatusLabel = (status) => {
    const normalizedStatus = String(status || 'PENDING').toUpperCase();
    if (normalizedStatus === 'APPROVED') return t('modelDocuments.status.approved');
    if (normalizedStatus === 'REJECTED') return t('modelDocuments.status.rejected');
    return t('modelDocuments.status.pending');
  };

  const refreshDocs = async () => {
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(DOCS_GET_URL, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDoc({
        urlVerificFront: data.urlVerificFront || null,
        urlVerificBack: data.urlVerificBack || null,
        urlVerificDoc: data.urlVerificDoc || null,
        verificationStatus: data.verificationStatus || 'PENDING',
      });
    } catch {
      setError(t('modelDocuments.errors.load'));
    } finally {
      setLoading(false);
    }
  };

  const ensureContractAccepted = async () => {
    const res = await fetch('/api/consent/model-contract/status', {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 401) {
      history.push('/');
      return false;
    }

    if (res.ok) {
      const st = await res.json();
      if (!st?.accepted) {
        history.push('/dashboard-user-model');
        return false;
      }
      return true;
    }

    history.push('/dashboard-user-model');
    return false;
  };

  const startVeriff = async () => {
    setStartingVeriff(true);
    setError('');
    setMsg('');

    try {
      const res = await fetch('/api/kyc/veriff/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const url = data?.verificationUrl;

      if (!url) {
        throw new Error('missing_verification_url');
      }

      window.location.href = url;
    } catch {
      setError(t('modelDocuments.veriff.errors.start'));
      setStartingVeriff(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const ok = await ensureContractAccepted();
        if (!ok) return;

        const meRes = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (meRes.ok) {
          const me = await meRes.json();
          setUserName(me.nickname || me.name || me.email || '');
        }

        if (isVeriffRoute) {
          await startVeriff();
          return;
        }

        await refreshDocs();
      } catch {
        // noop
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, isVeriffRoute]);

  const extractOriginalNameFromUrl = (url) => {
    if (!url) return '';
    const raw = (url || '').split('?')[0].split('#')[0].split('/').pop() || '';
    return decodeURIComponent(
      raw.replace(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/,
        ''
      )
    );
  };

  const statusStyles =
    doc.verificationStatus === 'APPROVED'
      ? { background: '#198754', color: '#fff' }
      : doc.verificationStatus === 'REJECTED'
      ? { background: '#dc3545', color: '#fff' }
      : { background: '#6c757d', color: '#fff' };

  const uploadSingle = async (fieldName, fileObj) => {
    if (!fileObj) return;
    setBusyField(fieldName);
    setError('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append(fieldName, fileObj);

      const res = await fetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setDoc({
        urlVerificFront: data.urlVerificFront || null,
        urlVerificBack: data.urlVerificBack || null,
        urlVerificDoc: data.urlVerificDoc || null,
        verificationStatus: data.verificationStatus || 'PENDING',
      });

      if (fieldName === 'idFront') {
        setIdFrontFile(null);
        setIdFrontKey((k) => k + 1);
      }
      if (fieldName === 'idBack') {
        setIdBackFile(null);
        setIdBackKey((k) => k + 1);
      }
      if (fieldName === 'verificDoc') {
        setVerifDocFile(null);
        setVerifDocKey((k) => k + 1);
      }

      setMsg(t('modelDocuments.success.upload'));
    } catch {
      setError(t('modelDocuments.errors.upload'));
    } finally {
      setBusyField(null);
    }
  };

  const deleteSingle = async (fieldName, confirmText) => {
    if (!window.confirm(confirmText || t('modelDocuments.confirm.deleteFile'))) return;
    setDeletingField(fieldName);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=${encodeURIComponent(fieldName)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setDoc((d) => {
        const next = { ...d };
        if (fieldName === 'idFront') next.urlVerificFront = null;
        if (fieldName === 'idBack') next.urlVerificBack = null;
        if (fieldName === 'verificDoc') next.urlVerificDoc = null;
        return next;
      });

      if (fieldName === 'idFront') {
        setIdFrontFile(null);
        setIdFrontKey((k) => k + 1);
      }
      if (fieldName === 'idBack') {
        setIdBackFile(null);
        setIdBackKey((k) => k + 1);
      }
      if (fieldName === 'verificDoc') {
        setVerifDocFile(null);
        setVerifDocKey((k) => k + 1);
      }

      setMsg(t('modelDocuments.success.delete'));
    } catch {
      setError(t('modelDocuments.errors.delete'));
    } finally {
      setDeletingField(null);
    }
  };

  const renderImageBlock = (url) => {
    if (!url) return <PhotoEmpty>{t('perfilModel.empty.notUploaded')}</PhotoEmpty>;
    const originalName = extractOriginalNameFromUrl(url);
    return (
      <>
        <PhotoPreview>
          <PhotoImg src={url} alt={t('modelDocuments.alt.document')} />
        </PhotoPreview>
        <FileNameWrapper>
          <a href={url} target="_blank" rel="noreferrer">
            {originalName || t('modelDocuments.actions.openFile')}
          </a>
        </FileNameWrapper>
      </>
    );
  };

  const renderDocLink = (url, label) => {
    if (!url) return <PhotoEmpty>{t('perfilModel.empty.notUploaded')}</PhotoEmpty>;
    const originalName = extractOriginalNameFromUrl(url);
    return (
      <FileNameWrapper>
        <a href={url} target="_blank" rel="noreferrer">
          {originalName || label}
        </a>
      </FileNameWrapper>
    );
  };

  const displayName = userName || t('dashboardUserModel.user.defaultName');

  if (isVeriffRoute) {
    return (
      <StyledContainer>
        <StyledNavbar>
          <StyledBrand href="/" aria-label="SharemeChat" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#e9ecef', fontSize: '0.9rem' }}>{displayName}</span>
            <NavButton
              type="button"
              onClick={() => history.push('/dashboard-user-model')}
            >
              {t('common.back')}
            </NavButton>
          </div>
        </StyledNavbar>

        <ProfileMain>
          <ProfileCard>
            <CardHeader>
              <CardTitle>{t('modelDocuments.veriff.title')}</CardTitle>
              <CardSubtitle>
                {t('modelDocuments.veriff.subtitle')}
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              {startingVeriff && <p>{t('modelDocuments.veriff.loading')}</p>}
              {error && <Message type="error">{error}</Message>}

              {!startingVeriff && error && (
                <div style={{ marginTop: 12 }}>
                  <ProfilePrimaryButton
                    type="button"
                    onClick={startVeriff}
                  >
                    {t('modelDocuments.veriff.actions.retry')}
                  </ProfilePrimaryButton>
                </div>
              )}

              <Hint style={{ marginTop: 12 }}>
                {t('modelDocuments.veriff.hint')}
              </Hint>
            </CardBody>
          </ProfileCard>
        </ProfileMain>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledNavbar>
        <StyledBrand href="/" aria-label="SharemeChat" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#e9ecef', fontSize: '0.9rem' }}>{displayName}</span>
          <NavButton
            type="button"
            onClick={() => history.push('/dashboard-user-model')}
          >
            {t('common.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <ProfileMain>
        <ProfileCard>
          <CardHeader>
            <CardTitle>{t('modelDocuments.title')}</CardTitle>
            <CardSubtitle>
              {t('modelDocuments.subtitle')}
            </CardSubtitle>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', color: '#cbd5f5' }}>
                {t('modelDocuments.currentStatus')}
              </span>
              <span style={{ ...statusStyles, padding: '4px 10px', borderRadius: 999, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {getVerificationStatusLabel(doc.verificationStatus)}
              </span>
            </div>

            {loading && <p>{t('profileCommon.loading.default')}</p>}
            {error && <Message type="error">{error}</Message>}
            {msg && <Message type="ok">{msg}</Message>}

            <Hint>
              {t('modelDocuments.reviewHint')}
            </Hint>
          </CardBody>
        </ProfileCard>

        <ProfileGrid>
          <ProfileColMain>
            <ProfileCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>{t('modelDocuments.front.title')}</CardTitle>
                <CardSubtitle>
                  {t('modelDocuments.front.subtitle')}
                </CardSubtitle>
              </CardHeader>
              <CardBody>
                {renderImageBlock(doc.urlVerificFront)}

                <PhotoActions>
                  <FileInput
                    id="model-id-front"
                    key={idFrontKey}
                    type="file"
                    accept="image/*"
                    ref={idFrontInputRef}
                    onChange={(e) => setIdFrontFile(e.target.files?.[0] || null)}
                  />
                  <ProfileSecondaryButton
                    type="button"
                    onClick={() => idFrontInputRef.current && idFrontInputRef.current.click()}
                  >
                    {t('profileCommon.actions.selectFile')}
                  </ProfileSecondaryButton>

                  {idFrontFile && (
                    <FileNameWrapper>
                      <span>{idFrontFile.name}</span>
                    </FileNameWrapper>
                  )}

                  <ProfilePrimaryButton
                    type="button"
                    onClick={() => uploadSingle('idFront', idFrontFile)}
                    disabled={!idFrontFile || busyField === 'idFront'}
                  >
                    {busyField === 'idFront' ? t('profileCommon.actions.uploading') : t('modelDocuments.front.actions.upload')}
                  </ProfilePrimaryButton>

                  {doc.urlVerificFront && (
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={() => deleteSingle('idFront', t('modelDocuments.front.confirmDelete'))}
                      disabled={deletingField === 'idFront'}
                    >
                      {deletingField === 'idFront' ? t('profileCommon.actions.deleting') : t('modelDocuments.front.actions.delete')}
                    </ProfileDangerOutlineButton>
                  )}
                </PhotoActions>

                <Hint>{t('modelDocuments.front.hint')}</Hint>
              </CardBody>
            </ProfileCard>

            <ProfileCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>{t('modelDocuments.back.title')}</CardTitle>
                <CardSubtitle>
                  {t('modelDocuments.back.subtitle')}
                </CardSubtitle>
              </CardHeader>
              <CardBody>
                {renderImageBlock(doc.urlVerificBack)}

                <PhotoActions>
                  <FileInput
                    id="model-id-back"
                    key={idBackKey}
                    type="file"
                    accept="image/*"
                    ref={idBackInputRef}
                    onChange={(e) => setIdBackFile(e.target.files?.[0] || null)}
                  />
                  <ProfileSecondaryButton
                    type="button"
                    onClick={() => idBackInputRef.current && idBackInputRef.current.click()}
                  >
                    {t('profileCommon.actions.selectFile')}
                  </ProfileSecondaryButton>

                  {idBackFile && (
                    <FileNameWrapper>
                      <span>{idBackFile.name}</span>
                    </FileNameWrapper>
                  )}

                  <ProfilePrimaryButton
                    type="button"
                    onClick={() => uploadSingle('idBack', idBackFile)}
                    disabled={!idBackFile || busyField === 'idBack'}
                  >
                    {busyField === 'idBack' ? t('profileCommon.actions.uploading') : t('modelDocuments.back.actions.upload')}
                  </ProfilePrimaryButton>

                  {doc.urlVerificBack && (
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={() => deleteSingle('idBack', t('modelDocuments.back.confirmDelete'))}
                      disabled={deletingField === 'idBack'}
                    >
                      {deletingField === 'idBack' ? t('profileCommon.actions.deleting') : t('modelDocuments.back.actions.delete')}
                    </ProfileDangerOutlineButton>
                  )}
                </PhotoActions>

                <Hint>{t('modelDocuments.back.hint')}</Hint>
              </CardBody>
            </ProfileCard>
          </ProfileColMain>

          <ProfileColSide>
            <ProfileCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>{t('modelDocuments.verificationFile.title')}</CardTitle>
                <CardSubtitle>
                  {t('modelDocuments.verificationFile.subtitle')}
                </CardSubtitle>
              </CardHeader>
              <CardBody>
                {renderDocLink(doc.urlVerificDoc, t('modelDocuments.verificationFile.linkLabel'))}

                <PhotoActions>
                  <FileInput
                    id="model-verific-doc"
                    key={verifDocKey}
                    type="file"
                    accept="image/*,application/pdf"
                    ref={verifDocInputRef}
                    onChange={(e) => setVerifDocFile(e.target.files?.[0] || null)}
                  />
                  <ProfileSecondaryButton
                    type="button"
                    onClick={() => verifDocInputRef.current && verifDocInputRef.current.click()}
                  >
                    {t('profileCommon.actions.selectFile')}
                  </ProfileSecondaryButton>

                  {verifDocFile && (
                    <FileNameWrapper>
                      <span>{verifDocFile.name}</span>
                    </FileNameWrapper>
                  )}

                  <ProfilePrimaryButton
                    type="button"
                    onClick={() => uploadSingle('verificDoc', verifDocFile)}
                    disabled={!verifDocFile || busyField === 'verificDoc'}
                  >
                    {busyField === 'verificDoc' ? t('profileCommon.actions.uploading') : t('modelDocuments.verificationFile.actions.upload')}
                  </ProfilePrimaryButton>

                  {doc.urlVerificDoc && (
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={() => deleteSingle('verificDoc', t('modelDocuments.verificationFile.confirmDelete'))}
                      disabled={deletingField === 'verificDoc'}
                    >
                      {deletingField === 'verificDoc' ? t('profileCommon.actions.deleting') : t('modelDocuments.verificationFile.actions.delete')}
                    </ProfileDangerOutlineButton>
                  )}
                </PhotoActions>

                <Hint>
                  {t('modelDocuments.verificationFile.hint')}
                </Hint>
              </CardBody>
            </ProfileCard>

            <SecurityCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>{t('modelDocuments.nextSteps.title')}</CardTitle>
              </CardHeader>
              <CardBody>
                <Hint>
                  {t('modelDocuments.nextSteps.prefix')}{' '}
                  <strong>{t('modelDocuments.nextSteps.role')}</strong>{' '}
                  {t('modelDocuments.nextSteps.suffix')}
                </Hint>
              </CardBody>
            </SecurityCard>
          </ProfileColSide>
        </ProfileGrid>
      </ProfileMain>
    </StyledContainer>
  );
};

export default ModelDocuments;
