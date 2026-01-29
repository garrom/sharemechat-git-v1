// src/pages/subpages/ModelDocuments.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';

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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

const DOCS_GET_URL = '/api/models/documents/me';
const DOCS_UPLOAD_URL = '/api/models/documents'; // POST: idFront|idBack|verificDoc ; DELETE: ?field=...

const ModelDocuments = () => {
  const history = useHistory();

  const [userName, setUserName] = useState('Usuario');

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

  // refs para los 3 inputs file
  const idFrontInputRef = useRef(null);
  const idBackInputRef = useRef(null);
  const verifDocInputRef = useRef(null);

  const refreshDocs = async () => {
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(DOCS_GET_URL, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      setDoc({
        urlVerificFront: data.urlVerificFront || null,
        urlVerificBack: data.urlVerificBack || null,
        urlVerificDoc: data.urlVerificDoc || null,
        verificationStatus: data.verificationStatus || 'PENDING',
      });
    } catch (e) {
      setError(e.message || 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
        });
        if (meRes.ok) {
          const me = await meRes.json();
          setUserName(me.nickname || me.name || me.email || 'Usuario');
        }
        await refreshDocs();
      } catch {
        // noop
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

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
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
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

      setMsg('Archivo subido correctamente.');
    } catch (e) {
      setError(e.message || 'No se pudo subir el archivo');
    } finally {
      setBusyField(null);
    }
  };

  const deleteSingle = async (fieldName, confirmText) => {
    if (!window.confirm(confirmText || '¿Eliminar este archivo?')) return;
    setDeletingField(fieldName);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=${encodeURIComponent(fieldName)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo eliminar el archivo');

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

      setMsg('Archivo eliminado.');
    } catch (e) {
      setError(e.message || 'No se pudo eliminar el archivo');
    } finally {
      setDeletingField(null);
    }
  };

  const handleLogout = () => {
    window.location.href = '/';
  };

  const renderImageBlock = (url) => {
    if (!url) return <PhotoEmpty>— No subido —</PhotoEmpty>;
    const originalName = extractOriginalNameFromUrl(url);
    return (
      <>
        <PhotoPreview>
          <PhotoImg src={url} alt="Documento" />
        </PhotoPreview>
        <FileNameWrapper>
          <a href={url} target="_blank" rel="noreferrer">
            {originalName || 'Abrir archivo'}
          </a>
        </FileNameWrapper>
      </>
    );
  };

  const renderDocLink = (url, label = 'Ver archivo') => {
    if (!url) return <PhotoEmpty>— No subido —</PhotoEmpty>;
    const originalName = extractOriginalNameFromUrl(url);
    return (
      <FileNameWrapper>
        <a href={url} target="_blank" rel="noreferrer">
          {originalName || label}
        </a>
      </FileNameWrapper>
    );
  };

  return (
    <StyledContainer>
      <StyledNavbar>
        <StyledBrand href="/" aria-label="SharemeChat" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#e9ecef', fontSize: '0.9rem' }}>{userName}</span>
          <NavButton
            type="button"
            onClick={() => history.push('/dashboard-user-model')}
          >
            Volver
          </NavButton>
        </div>
      </StyledNavbar>

      <ProfileMain>
        {/* Card principal de estado */}
        <ProfileCard>
          <CardHeader>
            <CardTitle>Verificación de identidad</CardTitle>
            <CardSubtitle>
              Sube las fotos de tu documento y un archivo de verificación para que podamos aprobar tu perfil de modelo.
            </CardSubtitle>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', color: '#cbd5f5' }}>
                Estado actual de la revisión
              </span>
              <span style={{ ...statusStyles, padding: '4px 10px', borderRadius: 999, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {doc.verificationStatus || 'PENDING'}
              </span>
            </div>

            {loading && <p>Cargando…</p>}
            {error && <Message type="error">{error}</Message>}
            {msg && <Message type="ok">{msg}</Message>}

            <Hint>
              Revisa que las fotos estén nítidas y que los datos sean legibles. Nuestro equipo revisará la información
              lo antes posible.
            </Hint>
          </CardBody>
        </ProfileCard>

        <ProfileGrid>
          {/* Columna izquierda: frontal + trasera */}
          <ProfileColMain>
            {/* Documento frontal */}
            <ProfileCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>Documento (frontal)</CardTitle>
                <CardSubtitle>
                  Sube la parte frontal de tu DNI o documento de identidad.
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
                    Seleccionar archivo
                  </ProfileSecondaryButton>

                  <ProfilePrimaryButton
                    type="button"
                    onClick={() => uploadSingle('idFront', idFrontFile)}
                    disabled={!idFrontFile || busyField === 'idFront'}
                  >
                    {busyField === 'idFront' ? 'Subiendo…' : 'Subir frontal'}
                  </ProfilePrimaryButton>

                  {doc.urlVerificFront && (
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={() => deleteSingle('idFront', '¿Eliminar la imagen frontal del documento?')}
                      disabled={deletingField === 'idFront'}
                    >
                      {deletingField === 'idFront' ? 'Eliminando…' : 'Eliminar frontal'}
                    </ProfileDangerOutlineButton>
                  )}
                </PhotoActions>

                <Hint>Formatos aceptados: JPG/PNG. Asegúrate de que todos los datos se vean claros.</Hint>
              </CardBody>
            </ProfileCard>

            {/* Documento trasera */}
            <ProfileCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>Documento (trasera)</CardTitle>
                <CardSubtitle>
                  Sube la parte trasera de tu DNI o documento de identidad.
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
                    Seleccionar archivo
                  </ProfileSecondaryButton>

                  <ProfilePrimaryButton
                    type="button"
                    onClick={() => uploadSingle('idBack', idBackFile)}
                    disabled={!idBackFile || busyField === 'idBack'}
                  >
                    {busyField === 'idBack' ? 'Subiendo…' : 'Subir trasera'}
                  </ProfilePrimaryButton>

                  {doc.urlVerificBack && (
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={() => deleteSingle('idBack', '¿Eliminar la imagen trasera del documento?')}
                      disabled={deletingField === 'idBack'}
                    >
                      {deletingField === 'idBack' ? 'Eliminando…' : 'Eliminar trasera'}
                    </ProfileDangerOutlineButton>
                  )}
                </PhotoActions>

                <Hint>Formatos aceptados: JPG/PNG. Comprueba que no haya reflejos ni recortes.</Hint>
              </CardBody>
            </ProfileCard>
          </ProfileColMain>

          {/* Columna derecha: selfie / doc verificación + nota */}
          <ProfileColSide>
            {/* Selfie / doc verificación */}
            <ProfileCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>Selfie con DNI o documento de verificación</CardTitle>
                <CardSubtitle>
                  Puedes subir una foto tuya con el documento visible o un PDF de verificación.
                </CardSubtitle>
              </CardHeader>
              <CardBody>
                {renderDocLink(doc.urlVerificDoc, 'Ver archivo de verificación')}

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
                    Seleccionar archivo
                  </ProfileSecondaryButton>

                  <ProfilePrimaryButton
                    type="button"
                    onClick={() => uploadSingle('verificDoc', verifDocFile)}
                    disabled={!verifDocFile || busyField === 'verificDoc'}
                  >
                    {busyField === 'verificDoc' ? 'Subiendo…' : 'Subir archivo'}
                  </ProfilePrimaryButton>

                  {doc.urlVerificDoc && (
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={() => deleteSingle('verificDoc', '¿Eliminar el archivo de verificación?')}
                      disabled={deletingField === 'verificDoc'}
                    >
                      {deletingField === 'verificDoc' ? 'Eliminando…' : 'Eliminar archivo'}
                    </ProfileDangerOutlineButton>
                  )}
                </PhotoActions>

                <Hint>
                  Acepta JPG/PNG o PDF. Asegúrate de que tu rostro y el documento sean claramente visibles.
                </Hint>
              </CardBody>
            </ProfileCard>

            {/* Nota informativa */}
            <SecurityCard style={{ marginTop: '16px' }}>
              <CardHeader>
                <CardTitle>¿Qué pasa después?</CardTitle>
              </CardHeader>
              <CardBody>
                <Hint>
                  Una vez aprobada tu identidad, podrás completar tu{' '}
                  <strong>Perfil de modelo</strong> subiendo foto de perfil y vídeo de
                  presentación desde la sección de Perfil.
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
