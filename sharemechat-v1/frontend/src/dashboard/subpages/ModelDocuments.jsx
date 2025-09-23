// ModelDocuments.jsx
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
} from '../../styles/ModelStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

const DOCS_GET_URL    = '/api/models/documents/me';
const DOCS_UPLOAD_URL = '/api/models/documents';

const ModelDocuments = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');

  // Navbar
  const [userName, setUserName] = useState('Usuario');

  // Estado de URLs (lo que ya hay subido)
  const [doc, setDoc] = useState({
    urlVerificFront: null,
    urlVerificBack: null,
    urlVerificDoc: null,
    verificationStatus: 'PENDING',
  });

  // Estado de inputs (archivos a subir)
  const [idFrontFile, setIdFrontFile]   = useState(null);
  const [idBackFile, setIdBackFile]     = useState(null);
  const [verifDocFile, setVerifDocFile] = useState(null);

  // Keys para resetear los <input type="file"> tras subir
  const [idFrontKey, setIdFrontKey]   = useState(0);
  const [idBackKey, setIdBackKey]     = useState(0);
  const [verifDocKey, setVerifDocKey] = useState(0);

  // Estado UI
  const [loading, setLoading]     = useState(false);
  const [busyField, setBusyField] = useState(null);
  const [error, setError]         = useState('');

  // Cargar nombre usuario + documentos
  useEffect(() => {
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
  }, []);

  const refreshDocs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(DOCS_GET_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
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

  // Subida de un único campo (idFront | idBack | verificDoc)
  const uploadSingle = async (fieldName, fileObj) => {
    if (!fileObj) return;
    setBusyField(fieldName);
    setError('');
    try {
      const fd = new FormData();
      // keys: idFront, idBack, verificDoc (coinciden con @RequestPart)
      fd.append(fieldName, fileObj);
      const res = await fetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const data = await res.json();
      setDoc({
        urlVerificFront: data.urlVerificFront || null,
        urlVerificBack:  data.urlVerificBack  || null,
        urlVerificDoc:   data.urlVerificDoc   || null,
        verificationStatus: data.verificationStatus || 'PENDING',
      });
      // limpiar input subido + reiniciar control visual
      if (fieldName === 'idFront') { setIdFrontFile(null); setIdFrontKey(k => k + 1); }
      if (fieldName === 'idBack')  { setIdBackFile(null);  setIdBackKey(k => k + 1); }
      if (fieldName === 'verificDoc') { setVerifDocFile(null); setVerifDocKey(k => k + 1); }
    } catch (e) {
      setError(e.message || 'No se pudo subir el archivo');
    } finally {
      setBusyField(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  const renderImagePreview = (url) => {
    if (!url) return <p style={{ color: '#777', marginBottom: 8 }}>— No subido —</p>;
    return (
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <img
          src={url}
          alt="preview"
          style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: 'block' }}
        />
        <div><a href={url} target="_blank" rel="noreferrer" className="small">Abrir en nueva pestaña</a></div>
      </div>
    );
  };

  const renderFileLink = (url, label = 'Ver archivo') => {
    if (!url) return <p style={{ color: '#777', marginBottom: 8 }}>— No subido —</p>;
    return <a href={url} target="_blank" rel="noreferrer">{label}</a>;
  };

  // Color de estado
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
        <span>Mi Logo</span>
        <div>
          <span className="me-3" style={{ marginLeft: 8 }}>Hola, {userName}</span>
          <StyledNavButton type="button" onClick={() => history.push('/dashboard-user-model')}>
            Volver
          </StyledNavButton>
          <StyledNavButton onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </StyledNavButton>
        </div>
      </StyledNavbar>

      {/* Mantengo tu layout base, pero remaqueto el centro a lo PerfilModel */}
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

            {/* Sección: Documento frontal */}
            <section style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Documento (frontal)</h4>
              {renderImagePreview(doc.urlVerificFront)}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input
                  key={idFrontKey}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setIdFrontFile(e.target.files?.[0] || null)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => uploadSingle('idFront', idFrontFile)}
                  disabled={!idFrontFile || busyField === 'idFront'}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  {busyField === 'idFront' ? 'Subiendo…' : 'Subir frontal'}
                </button>
              </div>
              <p style={{ marginTop: 8, color: '#6c757d' }}>
                Formatos: JPG/PNG. Nítido y legible.
              </p>
            </section>

            {/* Sección: Documento trasera */}
            <section style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Documento (trasera)</h4>
              {renderImagePreview(doc.urlVerificBack)}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input
                  key={idBackKey}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setIdBackFile(e.target.files?.[0] || null)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => uploadSingle('idBack', idBackFile)}
                  disabled={!idBackFile || busyField === 'idBack'}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  {busyField === 'idBack' ? 'Subiendo…' : 'Subir trasera'}
                </button>
              </div>
              <p style={{ marginTop: 8, color: '#6c757d' }}>
                Formatos: JPG/PNG. Nítido y legible.
              </p>
            </section>

            {/* Sección: Selfie con DNI o PDF */}
            <section style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Selfie con DNI (o documento de verificación)</h4>
              <p className="form-text" style={{ marginBottom: 8 }}>
                Sube una foto clara con tu DNI visible o un PDF de verificación.
              </p>
              <div style={{ marginBottom: 8 }}>
                {renderFileLink(doc.urlVerificDoc, 'Ver archivo')}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  key={verifDocKey}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setVerifDocFile(e.target.files?.[0] || null)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => uploadSingle('verificDoc', verifDocFile)}
                  disabled={!verifDocFile || busyField === 'verificDoc'}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  {busyField === 'verificDoc' ? 'Subiendo…' : 'Subir archivo'}
                </button>
              </div>
              <p style={{ marginTop: 8, color: '#6c757d' }}>
                Acepta JPG/PNG o PDF (varias páginas). Asegúrate de que tu rostro y el documento se vean nítidos.
              </p>
            </section>

            {/* Nota informativa (estilo PerfilModel) */}
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
