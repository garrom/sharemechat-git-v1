// src/dashboard/subpages/ModelDocuments.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
  StyledIconWrapper,
  StyledMainContent,
  StyledLeftColumn,
  StyledCenter,
  StyledRightColumn,
  StyledBrand,
  StyledNavGroup
} from '../../styles/ModelDocumentStyles';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

const DOCS_GET_URL    = '/api/models/documents/me';
const DOCS_UPLOAD_URL = '/api/models/documents'; // POST: idFront|idBack|verificDoc ; DELETE: ?field=...

const ModelDocuments = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');

  // Navbar
  const [userName, setUserName] = useState('Usuario');

  // Estado Docs existentes
  const [doc, setDoc] = useState({
    urlVerificFront: null,
    urlVerificBack: null,
    urlVerificDoc: null,
    verificationStatus: 'PENDING',
  });

  // Inputs file (a subir)
  const [idFrontFile, setIdFrontFile]   = useState(null);
  const [idBackFile, setIdBackFile]     = useState(null);
  const [verifDocFile, setVerifDocFile] = useState(null);

  // Keys para resetear <input type="file">
  const [idFrontKey, setIdFrontKey]   = useState(0);
  const [idBackKey, setIdBackKey]     = useState(0);
  const [verifDocKey, setVerifDocKey] = useState(0);

  // UI
  const [loading, setLoading]             = useState(false);
  const [busyField, setBusyField]         = useState(null);     // subidas
  const [deletingField, setDeletingField] = useState(null);     // borrados
  const [error, setError]                 = useState('');
  const [msg, setMsg]                     = useState('');

  useEffect(() => {
    if (!token) {
      history.push('/login');
      return;
    }
    (async () => {
      try {
        const meRes = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          setUserName(me.nickname || me.name || me.email || 'Usuario');
        }
        await refreshDocs();
      } catch {
        /* noop */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, history]);

  const refreshDocs = async () => {
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(DOCS_GET_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      setDoc({
        urlVerificFront: data.urlVerificFront || null,
        urlVerificBack:  data.urlVerificBack  || null,
        urlVerificDoc:   data.urlVerificDoc   || null,
        verificationStatus: data.verificationStatus || 'PENDING',
      });
    } catch (e) {
      setError(e.message || 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  // Helpers
  const extractOriginalNameFromUrl = (url) => {
    if (!url) return '';
    const raw = (url || '').split('?')[0].split('#')[0].split('/').pop() || '';
    return decodeURIComponent(
      raw.replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/, '')
    );
  };

  const renderImagePreview = (url) => {
    if (!url) return <p style={{ color: '#777', marginBottom: 8 }}>— No subido —</p>;
    const originalName = extractOriginalNameFromUrl(url);
    return (
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <img
          src={url}
          alt="preview"
          style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: 'block' }}
        />
        <div style={{ marginTop: 6 }}>
          <a href={url} target="_blank" rel="noreferrer">
            {originalName || 'Abrir archivo'}
          </a>
        </div>
      </div>
    );
  };

  const renderFileLink = (url, label = 'Ver archivo') => {
    if (!url) return <p style={{ color: '#777', marginBottom: 8 }}>— No subido —</p>;
    const originalName = extractOriginalNameFromUrl(url);
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {originalName || label}
      </a>
    );
  };

  // Subida de un único campo
  const uploadSingle = async (fieldName, fileObj) => {
    if (!fileObj) return;
    setBusyField(fieldName);
    setError('');
    setMsg('');
    try {
      const fd = new FormData();
      // keys esperadas por backend: idFront | idBack | verificDoc
      fd.append(fieldName, fileObj);
      const res = await fetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      setDoc({
        urlVerificFront: data.urlVerificFront || null,
        urlVerificBack:  data.urlVerificBack  || null,
        urlVerificDoc:   data.urlVerificDoc   || null,
        verificationStatus: data.verificationStatus || 'PENDING',
      });

      // limpiar input subido
      if (fieldName === 'idFront') { setIdFrontFile(null); setIdFrontKey(k => k + 1); }
      if (fieldName === 'idBack')  { setIdBackFile(null);  setIdBackKey(k => k + 1); }
      if (fieldName === 'verificDoc') { setVerifDocFile(null); setVerifDocKey(k => k + 1); }

      setMsg('Archivo subido correctamente.');
    } catch (e) {
      setError(e.message || 'No se pudo subir el archivo');
    } finally {
      setBusyField(null);
    }
  };

  // Eliminar un único campo (DELETE ?field=...)
  const deleteSingle = async (fieldName, confirmText) => {
    if (!window.confirm(confirmText || '¿Eliminar este archivo?')) return;
    setDeletingField(fieldName);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=${encodeURIComponent(fieldName)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo eliminar el archivo');

      // Actualiza estado local
      setDoc((d) => {
        const next = { ...d };
        if (fieldName === 'idFront') next.urlVerificFront = null;
        if (fieldName === 'idBack')  next.urlVerificBack  = null;
        if (fieldName === 'verificDoc') next.urlVerificDoc = null;
        return next;
      });

      // Limpia input correspondiente
      if (fieldName === 'idFront') { setIdFrontFile(null); setIdFrontKey(k => k + 1); }
      if (fieldName === 'idBack')  { setIdBackFile(null);  setIdBackKey(k => k + 1); }
      if (fieldName === 'verificDoc') { setVerifDocFile(null); setVerifDocKey(k => k + 1); }

      setMsg('Archivo eliminado.');
    } catch (e) {
      setError(e.message || 'No se pudo eliminar el archivo');
    } finally {
      setDeletingField(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  // Badge estado verificación
  const statusClass =
    doc.verificationStatus === 'APPROVED'
      ? { background: '#198754', color: '#fff' }
      : doc.verificationStatus === 'REJECTED'
      ? { background: '#dc3545', color: '#fff' }
      : { background: '#6c757d', color: '#fff' };

  return (
    <StyledContainer>
      {/* NAVBAR */}
      <StyledNavbar>
        <StyledBrand href="/" aria-label="SharemeChat" />
        <StyledNavGroup>
          <span>Hola, {userName}</span>
          <StyledNavButton type="button" onClick={() => history.push('/dashboard-user-model')}>
            Volver
          </StyledNavButton>
          <StyledNavButton onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </StyledNavButton>
        </StyledNavGroup>
      </StyledNavbar>

      {/* CONTENIDO */}
      <StyledMainContent>
        <StyledLeftColumn />
        <StyledCenter>
          <div style={{ maxWidth: 720, margin: '24px auto', padding: '0 16px' }}>
            {/* Título + estado */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              <h2 style={{ margin: 0 }}>Verificación de identidad</h2>
              <span style={{ ...statusClass, padding: '4px 10px', borderRadius: 999, fontSize: 12 }}>
                {doc.verificationStatus || 'PENDING'}
              </span>
            </div>

            {loading && <p>Cargando…</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {msg && <p style={{ color: 'green' }}>{msg}</p>}

            {/* Documento frontal */}
            <section style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Documento (frontal)</h4>
              {renderImagePreview(doc.urlVerificFront)}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* input oculto + label */}
                <input
                  id="model-id-front"
                  key={idFrontKey}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => setIdFrontFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="model-id-front"
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Seleccionar archivo
                </label>

                <button
                  type="button"
                  onClick={() => uploadSingle('idFront', idFrontFile)}
                  disabled={!idFrontFile || busyField === 'idFront'}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  {busyField === 'idFront' ? 'Subiendo…' : 'Subir frontal'}
                </button>

                {doc.urlVerificFront && (
                  <button
                    type="button"
                    onClick={() => deleteSingle('idFront', '¿Eliminar la imagen frontal del documento?')}
                    disabled={deletingField === 'idFront'}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      border: '1px solid #dc3545',
                      background: 'white',
                      color: '#dc3545',
                      borderRadius: 6,
                    }}
                    title="Eliminar frontal"
                  >
                    {deletingField === 'idFront' ? 'Eliminando…' : 'Eliminar frontal'}
                  </button>
                )}
              </div>

              <p style={{ marginTop: 8, color: '#6c757d' }}>
                Formatos: JPG/PNG. Nítido y legible.
              </p>
            </section>

            {/* Documento trasera */}
            <section style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Documento (trasera)</h4>
              {renderImagePreview(doc.urlVerificBack)}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  id="model-id-back"
                  key={idBackKey}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => setIdBackFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="model-id-back"
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Seleccionar archivo
                </label>

                <button
                  type="button"
                  onClick={() => uploadSingle('idBack', idBackFile)}
                  disabled={!idBackFile || busyField === 'idBack'}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  {busyField === 'idBack' ? 'Subiendo…' : 'Subir trasera'}
                </button>

                {doc.urlVerificBack && (
                  <button
                    type="button"
                    onClick={() => deleteSingle('idBack', '¿Eliminar la imagen trasera del documento?')}
                    disabled={deletingField === 'idBack'}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      border: '1px solid #dc3545',
                      background: 'white',
                      color: '#dc3545',
                      borderRadius: 6,
                    }}
                    title="Eliminar trasera"
                  >
                    {deletingField === 'idBack' ? 'Eliminando…' : 'Eliminar trasera'}
                  </button>
                )}
              </div>

              <p style={{ marginTop: 8, color: '#6c757d' }}>
                Formatos: JPG/PNG. Nítido y legible.
              </p>
            </section>

            {/* Selfie con DNI o PDF */}
            <section style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Selfie con DNI (o documento de verificación)</h4>
              <p className="form-text" style={{ marginBottom: 8 }}>
                Sube una foto clara con tu DNI visible o un PDF de verificación.
              </p>

              <div style={{ marginBottom: 8 }}>
                {renderFileLink(doc.urlVerificDoc, 'Ver archivo')}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  id="model-verific-doc"
                  key={verifDocKey}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => setVerifDocFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="model-verific-doc"
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Seleccionar archivo
                </label>

                <button
                  type="button"
                  onClick={() => uploadSingle('verificDoc', verifDocFile)}
                  disabled={!verifDocFile || busyField === 'verificDoc'}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  {busyField === 'verificDoc' ? 'Subiendo…' : 'Subir archivo'}
                </button>

                {doc.urlVerificDoc && (
                  <button
                    type="button"
                    onClick={() => deleteSingle('verificDoc', '¿Eliminar el archivo de verificación?')}
                    disabled={deletingField === 'verificDoc'}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      border: '1px solid #dc3545',
                      background: 'white',
                      color: '#dc3545',
                      borderRadius: 6,
                    }}
                    title="Eliminar archivo"
                  >
                    {deletingField === 'verificDoc' ? 'Eliminando…' : 'Eliminar archivo'}
                  </button>
                )}
              </div>

              <p style={{ marginTop: 8, color: '#6c757d' }}>
                Acepta JPG/PNG o PDF (varias páginas). Asegúrate de que tu rostro y el documento se vean nítidos.
              </p>
            </section>

            {/* Nota informativa */}
            <div style={{
              background: '#f1f3f5',
              border: '1px solid #e5e5e5',
              borderRadius: 8,
              padding: 16,
              color: '#333',
              marginTop: 8
            }}>
              La <strong>foto de perfil</strong> y el <strong>vídeo</strong> se gestionarán en tu
              <em> Perfil de modelo</em> una vez seas aprobada.
            </div>

            <div style={{ height: 20 }} />
          </div>
        </StyledCenter>
        <StyledRightColumn />
      </StyledMainContent>
    </StyledContainer>
  );
};

export default ModelDocuments;
