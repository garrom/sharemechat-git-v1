import React, { useEffect, useState, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import i18n from '../../i18n';

import {
  DocumentsShell,
  DocumentsTopbar,
  DocumentsTopbarInner,
  DocumentsBrand,
  DocumentsTopbarActions,
  DocumentsUserLabel,
  DocumentsBackButton,
  DocumentsPage,
  DocumentsStack,
  DocumentOverviewCard,
  DocumentCard,
  DocumentCardSoft,
  CardHeader,
  CardHeaderTop,
  CardTitle,
  CardSubtitle,
  OverviewIntro,
  SummaryGrid,
  SummaryItem,
  SummaryItemLabel,
  SummaryItemValue,
  CardBody,
  SummaryLabel,
  SummaryCount,
  StatusPill,
  UploadBadge,
  Message,
  FileInput,
  Hint,
  FileNameWrapper,
  SelectedFileTag,
  PreviewPanel,
  PhotoPreview,
  PhotoImg,
  PhotoEmpty,
  LinkPreviewBox,
  PhotoActions,
  DocumentPrimaryButton,
  DocumentSecondaryButton,
  DocumentDangerButton,
  WorkflowList,
  WorkflowStep,
  WorkflowStepTitle,
  WorkflowStepBody,
} from '../../styles/pages-styles/ModelDocumentStyles';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';

const ModelDocuments = () => {
  const { uiLocale } = useSession();
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();
  const location = useLocation();
  const isVeriffRoute = location.pathname === '/model-kyc';

  const DOCS_GET_URL = isVeriffRoute ? '/models/kyc/me' : '/models/documents/me';
  const DOCS_UPLOAD_URL = isVeriffRoute ? '/models/kyc' : '/models/documents';

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
      const data = await apiFetch(DOCS_GET_URL);
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
    try {
      const st = await apiFetch('/consent/model-contract/status');
      if (!st?.accepted) {
        history.push('/dashboard-user-model');
        return false;
      }
      return true;
    } catch (e) {
      if (Number(e?.status) === 401) {
        history.push('/');
        return false;
      }

      history.push('/dashboard-user-model');
      return false;
    }
  };

  const startVeriff = async () => {
    setStartingVeriff(true);
    setError('');
    setMsg('');

    try {
      const data = await apiFetch('/kyc/veriff/start', {
        method: 'POST',
      });
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

        const me = await apiFetch('/users/me');
        setUserName(me.nickname || me.name || me.email || '');

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
    String(doc.verificationStatus || 'PENDING').toUpperCase();

  const uploadedCount = [doc.urlVerificFront, doc.urlVerificBack, doc.urlVerificDoc].filter(Boolean).length;
  void uiLocale;

  const uploadSingle = async (fieldName, fileObj) => {
    if (!fileObj) return;
    setBusyField(fieldName);
    setError('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append(fieldName, fileObj);

      const data = await apiFetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        body: fd,
      });

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
      await apiFetch(`${DOCS_UPLOAD_URL}?field=${encodeURIComponent(fieldName)}`, {
        method: 'DELETE',
      });

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
      <PreviewPanel>
        <PhotoPreview>
          <PhotoImg src={url} alt={t('modelDocuments.alt.document')} />
        </PhotoPreview>
        <FileNameWrapper>
          <a href={url} target="_blank" rel="noreferrer">
            {originalName || t('modelDocuments.actions.openFile')}
          </a>
        </FileNameWrapper>
      </PreviewPanel>
    );
  };

  const renderDocLink = (url, label) => {
    if (!url) return <PhotoEmpty>{t('perfilModel.empty.notUploaded')}</PhotoEmpty>;
    const originalName = extractOriginalNameFromUrl(url);
    return (
      <LinkPreviewBox>
        <FileNameWrapper>
          <a href={url} target="_blank" rel="noreferrer">
            {originalName || label}
          </a>
        </FileNameWrapper>
      </LinkPreviewBox>
    );
  };

  const displayName = userName || t('dashboardUserModel.user.defaultName');

  if (isVeriffRoute) {
    return (
      <DocumentsShell>
        <DocumentsTopbar>
          <DocumentsTopbarInner>
            <DocumentsBrand href="/" aria-label="SharemeChat" />
            <DocumentsTopbarActions>
              <DocumentsUserLabel>{displayName}</DocumentsUserLabel>
              <DocumentsBackButton
                type="button"
                onClick={() => history.push('/dashboard-user-model')}
              >
                {t('common.back')}
              </DocumentsBackButton>
            </DocumentsTopbarActions>
          </DocumentsTopbarInner>
        </DocumentsTopbar>

        <DocumentsPage>
          <DocumentsStack>
            <DocumentCard>
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
                  <PhotoActions>
                    <DocumentPrimaryButton
                      type="button"
                      onClick={startVeriff}
                    >
                      {t('modelDocuments.veriff.actions.retry')}
                    </DocumentPrimaryButton>
                  </PhotoActions>
                )}

                <Hint>
                  {t('modelDocuments.veriff.hint')}
                </Hint>
              </CardBody>
            </DocumentCard>
          </DocumentsStack>
        </DocumentsPage>
      </DocumentsShell>
    );
  }

  return (
    <DocumentsShell>
      <DocumentsTopbar>
        <DocumentsTopbarInner>
          <DocumentsBrand href="/" aria-label="SharemeChat" />
          <DocumentsTopbarActions>
            <DocumentsUserLabel>{displayName}</DocumentsUserLabel>
            <DocumentsBackButton
              type="button"
              onClick={() => history.push('/dashboard-user-model')}
            >
              {t('common.back')}
            </DocumentsBackButton>
          </DocumentsTopbarActions>
        </DocumentsTopbarInner>
      </DocumentsTopbar>

      <DocumentsPage>
        <DocumentsStack>
          <DocumentOverviewCard>
            <CardHeader>
              <OverviewIntro>
                <CardTitle>{t('modelDocuments.title')}</CardTitle>
                <CardSubtitle>
                  {t('modelDocuments.subtitle')}
                </CardSubtitle>
              </OverviewIntro>
            </CardHeader>
            <CardBody>
              <SummaryGrid>
                <SummaryItem>
                  <SummaryItemLabel>{t('modelDocuments.currentStatus')}</SummaryItemLabel>
                  <SummaryItemValue>
                    <SummaryLabel>{getVerificationStatusLabel(doc.verificationStatus)}</SummaryLabel>
                    <StatusPill $status={statusStyles}>
                      {getVerificationStatusLabel(doc.verificationStatus)}
                    </StatusPill>
                  </SummaryItemValue>
                </SummaryItem>

                <SummaryItem>
                  <SummaryItemLabel>{t('modelDocuments.nextSteps.title')}</SummaryItemLabel>
                  <SummaryItemValue>
                    <SummaryLabel>
                      {t('modelDocuments.summary.filesUploaded', { count: uploadedCount, total: 3 })}
                    </SummaryLabel>
                    <SummaryCount>
                      {t('modelDocuments.summary.filesUploadedCompact', { count: uploadedCount, total: 3 })}
                    </SummaryCount>
                  </SummaryItemValue>
                </SummaryItem>
              </SummaryGrid>

              {loading && <p>{t('profileCommon.loading.default')}</p>}
              {error && <Message type="error">{error}</Message>}
              {msg && <Message type="ok">{msg}</Message>}

              <Hint>
                {t('modelDocuments.reviewHint')}
              </Hint>
            </CardBody>
          </DocumentOverviewCard>

          <DocumentCard>
            <CardHeader>
              <CardHeaderTop>
                <CardTitle>{t('modelDocuments.front.title')}</CardTitle>
                <UploadBadge $uploaded={Boolean(doc.urlVerificFront)}>
                  {doc.urlVerificFront ? t('modelDocuments.summary.uploaded') : t('modelDocuments.status.pending')}
                </UploadBadge>
              </CardHeaderTop>
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
                <DocumentSecondaryButton
                  type="button"
                  onClick={() => idFrontInputRef.current && idFrontInputRef.current.click()}
                >
                  {t('profileCommon.actions.selectFile')}
                </DocumentSecondaryButton>

                {idFrontFile && (
                  <SelectedFileTag>{idFrontFile.name}</SelectedFileTag>
                )}

                <DocumentPrimaryButton
                  type="button"
                  onClick={() => uploadSingle('idFront', idFrontFile)}
                  disabled={!idFrontFile || busyField === 'idFront'}
                >
                  {busyField === 'idFront' ? t('profileCommon.actions.uploading') : t('modelDocuments.front.actions.upload')}
                </DocumentPrimaryButton>

                {doc.urlVerificFront && (
                  <DocumentDangerButton
                    type="button"
                    onClick={() => deleteSingle('idFront', t('modelDocuments.front.confirmDelete'))}
                    disabled={deletingField === 'idFront'}
                  >
                    {deletingField === 'idFront' ? t('profileCommon.actions.deleting') : t('modelDocuments.front.actions.delete')}
                  </DocumentDangerButton>
                )}
              </PhotoActions>

              <Hint>{t('modelDocuments.front.hint')}</Hint>
            </CardBody>
          </DocumentCard>

          <DocumentCard>
            <CardHeader>
              <CardHeaderTop>
                <CardTitle>{t('modelDocuments.back.title')}</CardTitle>
                <UploadBadge $uploaded={Boolean(doc.urlVerificBack)}>
                  {doc.urlVerificBack ? t('modelDocuments.summary.uploaded') : t('modelDocuments.status.pending')}
                </UploadBadge>
              </CardHeaderTop>
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
                <DocumentSecondaryButton
                  type="button"
                  onClick={() => idBackInputRef.current && idBackInputRef.current.click()}
                >
                  {t('profileCommon.actions.selectFile')}
                </DocumentSecondaryButton>

                {idBackFile && (
                  <SelectedFileTag>{idBackFile.name}</SelectedFileTag>
                )}

                <DocumentPrimaryButton
                  type="button"
                  onClick={() => uploadSingle('idBack', idBackFile)}
                  disabled={!idBackFile || busyField === 'idBack'}
                >
                  {busyField === 'idBack' ? t('profileCommon.actions.uploading') : t('modelDocuments.back.actions.upload')}
                </DocumentPrimaryButton>

                {doc.urlVerificBack && (
                  <DocumentDangerButton
                    type="button"
                    onClick={() => deleteSingle('idBack', t('modelDocuments.back.confirmDelete'))}
                    disabled={deletingField === 'idBack'}
                  >
                    {deletingField === 'idBack' ? t('profileCommon.actions.deleting') : t('modelDocuments.back.actions.delete')}
                  </DocumentDangerButton>
                )}
              </PhotoActions>

              <Hint>{t('modelDocuments.back.hint')}</Hint>
            </CardBody>
          </DocumentCard>

          <DocumentCard>
            <CardHeader>
              <CardHeaderTop>
                <CardTitle>{t('modelDocuments.verificationFile.title')}</CardTitle>
                <UploadBadge $uploaded={Boolean(doc.urlVerificDoc)}>
                  {doc.urlVerificDoc ? t('modelDocuments.summary.uploaded') : t('modelDocuments.status.pending')}
                </UploadBadge>
              </CardHeaderTop>
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
                <DocumentSecondaryButton
                  type="button"
                  onClick={() => verifDocInputRef.current && verifDocInputRef.current.click()}
                >
                  {t('profileCommon.actions.selectFile')}
                </DocumentSecondaryButton>

                {verifDocFile && (
                  <SelectedFileTag>{verifDocFile.name}</SelectedFileTag>
                )}

                <DocumentPrimaryButton
                  type="button"
                  onClick={() => uploadSingle('verificDoc', verifDocFile)}
                  disabled={!verifDocFile || busyField === 'verificDoc'}
                >
                  {busyField === 'verificDoc' ? t('profileCommon.actions.uploading') : t('modelDocuments.verificationFile.actions.upload')}
                </DocumentPrimaryButton>

                {doc.urlVerificDoc && (
                  <DocumentDangerButton
                    type="button"
                    onClick={() => deleteSingle('verificDoc', t('modelDocuments.verificationFile.confirmDelete'))}
                    disabled={deletingField === 'verificDoc'}
                  >
                    {deletingField === 'verificDoc' ? t('profileCommon.actions.deleting') : t('modelDocuments.verificationFile.actions.delete')}
                  </DocumentDangerButton>
                )}
              </PhotoActions>

              <Hint>
                {t('modelDocuments.verificationFile.hint')}
              </Hint>
            </CardBody>
          </DocumentCard>

          <DocumentCardSoft>
            <CardHeader>
              <CardTitle>{t('modelDocuments.nextSteps.title')}</CardTitle>
              <CardSubtitle>
                {t('modelDocuments.nextSteps.prefix')}{' '}
                <strong>{t('modelDocuments.nextSteps.role')}</strong>{' '}
                {t('modelDocuments.nextSteps.suffix')}
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              <WorkflowList>
                <WorkflowStep>
                  <WorkflowStepTitle>{t('modelDocuments.summary.filesUploadedCompact', { count: uploadedCount, total: 3 })}</WorkflowStepTitle>
                  <WorkflowStepBody>
                    {t('modelDocuments.reviewHint')}
                  </WorkflowStepBody>
                </WorkflowStep>
                <WorkflowStep>
                  <WorkflowStepTitle>{t('modelDocuments.currentStatus')}</WorkflowStepTitle>
                  <WorkflowStepBody>
                    {getVerificationStatusLabel(doc.verificationStatus)}
                  </WorkflowStepBody>
                </WorkflowStep>
                <WorkflowStep>
                  <WorkflowStepTitle>{t('modelDocuments.nextSteps.title')}</WorkflowStepTitle>
                  <WorkflowStepBody>
                    {t('modelDocuments.nextSteps.prefix')}{' '}
                    <strong>{t('modelDocuments.nextSteps.role')}</strong>{' '}
                    {t('modelDocuments.nextSteps.suffix')}
                  </WorkflowStepBody>
                </WorkflowStep>
              </WorkflowList>
            </CardBody>
          </DocumentCardSoft>
        </DocumentsStack>
      </DocumentsPage>
    </DocumentsShell>
  );
};

export default ModelDocuments;
