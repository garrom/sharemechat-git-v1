import React, { useEffect, useState } from 'react';
import {
  Badge,
  ControlsRow,
  DbLayout,
  DbTableWrap,
  FieldBlock,
  InlinePanel,
  PanelRow,
  RightInfo,
  SectionTitle,
  SmallBtn,
  StyledButton,
  StyledError,
  StyledSelect,
  StyledTable,
  TextArea,
} from '../../styles/AdminStyles';

const FINAL_ACTIONS = new Set(['WARNING', 'SUSPEND', 'BAN']);
const ACTION_HELP = {
  NONE: 'Sin accion sancionadora. Util para cerrar o documentar el caso sin escalar.',
  WARNING: 'Advertencia al usuario. Senala conducta indebida sin suspender acceso.',
  SUSPEND: 'Suspension operativa. Debe usarse cuando la incidencia requiere bloqueo temporal.',
  BAN: 'Bloqueo definitivo. Reservado a casos graves o reincidentes.',
};
const STATUS_HELP = {
  OPEN: 'Caso recien creado y pendiente de triage.',
  REVIEWING: 'Caso en analisis por soporte o administracion.',
  RESOLVED: 'Caso cerrado con decision final.',
  REJECTED: 'Caso descartado por falta de base o por duplicidad.',
};

const AdminModerationPanel = ({ canReview = false }) => {
  const [modStatus, setModStatus] = useState('ALL');
  const [modReports, setModReports] = useState([]);
  const [modLoading, setModLoading] = useState(false);
  const [modError, setModError] = useState('');
  const [modSelectedId, setModSelectedId] = useState(null);
  const [modSaving, setModSaving] = useState(false);

  const [modReviewStatus, setModReviewStatus] = useState('REVIEWING');
  const [modReviewAction, setModReviewAction] = useState('NONE');
  const [modReviewNotes, setModReviewNotes] = useState('');

  const isFinalAction = FINAL_ACTIONS.has(String(modReviewAction || '').toUpperCase());

  const loadModerationReports = async () => {
    setModLoading(true);
    setModError('');
    try {
      const qs = modStatus === 'ALL' ? '' : `?status=${encodeURIComponent(modStatus)}`;
      const res = await fetch(`/api/admin/moderation/reports${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || 'Error cargando reports');
      const data = await res.json();
      setModReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setModError(e.message || 'Error cargando reports');
      setModReports([]);
    } finally {
      setModLoading(false);
    }
  };

  const loadModerationReportById = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/moderation/reports/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || 'Error cargando reporte');
      const report = await res.json();

      const nextAction = String(report?.adminAction || 'NONE').toUpperCase();
      const nextStatusRaw = String(report?.status || 'REVIEWING').toUpperCase();
      const nextStatus = FINAL_ACTIONS.has(nextAction) ? 'RESOLVED' : nextStatusRaw;

      setModSelectedId(report?.id || null);
      setModReviewAction(nextAction);
      setModReviewStatus(nextStatus);
      setModReviewNotes(report?.resolutionNotes || '');
    } catch (e) {
      setModError(e.message || 'Error cargando reporte');
    }
  };

  const handleReviewActionChange = (value) => {
    const nextAction = String(value || 'NONE').toUpperCase();
    setModReviewAction(nextAction);
    if (FINAL_ACTIONS.has(nextAction)) {
      setModReviewStatus('RESOLVED');
    }
  };

  const saveModerationReview = async () => {
    if (!canReview) return;

    const id = Number(modSelectedId);
    if (!id) return;

    const finalStatus = isFinalAction ? 'RESOLVED' : modReviewStatus;

    setModSaving(true);
    setModError('');
    try {
      const res = await fetch(`/api/admin/moderation/reports/${id}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: finalStatus,
          adminAction: modReviewAction,
          resolutionNotes: modReviewNotes,
        }),
      });

      if (!res.ok) throw new Error((await res.text()) || 'Error guardando review');

      await loadModerationReports();
      await loadModerationReportById(id);
    } catch (e) {
      setModError(e.message || 'Error guardando review');
    } finally {
      setModSaving(false);
    }
  };

  const fmtTs = (value) => {
    if (!value) return '-';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString();
    } catch {
      return String(value);
    }
  };

  useEffect(() => {
    loadModerationReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modStatus]);

  return (
    <div>
      <SectionTitle>Moderacion</SectionTitle>

      <div style={{ fontSize: 12, color: '#52607a', lineHeight: 1.55, marginBottom: 8, maxWidth: 980 }}>
        Vista operativa de reports internos. Permite filtrar incidencias, revisar detalle y documentar una decision administrativa con mejor contexto para soporte y control interno.
      </div>

      <ControlsRow>
        <FieldBlock>
          <label>Estado</label>
          <StyledSelect value={modStatus} onChange={(e) => setModStatus(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="OPEN">OPEN</option>
            <option value="REVIEWING">REVIEWING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="REJECTED">REJECTED</option>
          </StyledSelect>
        </FieldBlock>

        <RightInfo>
          <SmallBtn type="button" onClick={loadModerationReports} disabled={modLoading}>
            {modLoading ? 'Cargando...' : 'Refrescar'}
          </SmallBtn>
        </RightInfo>
      </ControlsRow>

      {modError && <StyledError>{modError}</StyledError>}

      <DbLayout style={{ height: '72vh' }}>
        <DbTableWrap style={{ marginTop: 0 }}>
          <StyledTable>
            <thead>
              <tr>
                <th>ID</th>
                <th>Creado</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Accion</th>
                <th>AutoBlock</th>
                <th>Reporter</th>
                <th>Reported</th>
                <th>Stream</th>
                <th>ReviewedBy</th>
                <th>Revisado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {modReports.map((report) => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td>{fmtTs(report.createdAt)}</td>
                  <td><Badge>{report.reportType || '-'}</Badge></td>
                  <td><Badge data-variant={String(report.status || '').toLowerCase()}>{report.status || '-'}</Badge></td>
                  <td>
                    <strong>{report.adminAction || '-'}</strong>
                    {report.adminAction && report.adminAction !== 'NONE' && (
                      <div style={{ fontSize: 10, color: '#74819a', marginTop: 3 }}>
                        Accion registrada
                      </div>
                    )}
                  </td>
                  <td>{report.autoBlocked ? 'Si' : 'No'}</td>
                  <td>{report.reporterUserId ?? '-'}</td>
                  <td>{report.reportedUserId ?? '-'}</td>
                  <td>{report.streamRecordId ?? '-'}</td>
                  <td>{report.reviewedByUserId ?? '-'}</td>
                  <td>{report.reviewedAt ? fmtTs(report.reviewedAt) : '-'}</td>
                  <td>
                    <SmallBtn
                      type="button"
                      onClick={() => loadModerationReportById(report.id)}
                      title="Detalle"
                    >
                      Detalle
                    </SmallBtn>
                  </td>
                </tr>
              ))}

              {!modLoading && modReports.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ color: '#6c757d' }}>Sin reports.</td>
                </tr>
              )}
            </tbody>
          </StyledTable>
        </DbTableWrap>

        <div style={{ marginTop: 8, width: '100%', maxWidth: 1200 }}>
          <InlinePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>
                {modSelectedId ? `Detalle report #${modSelectedId}` : 'Selecciona un report para revisar'}
              </div>

              {modSelectedId && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <SmallBtn type="button" onClick={() => loadModerationReportById(modSelectedId)} disabled={modSaving}>
                    Recargar
                  </SmallBtn>
                  {canReview && (
                    <StyledButton type="button" onClick={saveModerationReview} disabled={modSaving}>
                      {modSaving ? 'Guardando...' : 'Guardar'}
                    </StyledButton>
                  )}
                </div>
              )}
            </div>

            {modSelectedId && (
              <>
                {!canReview && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6c757d' }}>
                    Modo solo lectura para SUPPORT. La revision sancionadora queda reservada a ADMIN.
                  </div>
                )}

                <div style={{ marginTop: 8, fontSize: 11, color: '#52607a', lineHeight: 1.55 }}>
                  Usa REVIEWING mientras el caso sigue abierto. Las acciones WARNING, SUSPEND y BAN fuerzan cierre en RESOLVED.
                </div>

                <PanelRow>
                  <FieldBlock>
                    <label>Accion administrativa</label>
                    {canReview ? (
                      <StyledSelect
                        value={modReviewAction}
                        onChange={(e) => handleReviewActionChange(e.target.value)}
                      >
                        <option value="NONE">NONE</option>
                        <option value="WARNING">WARNING</option>
                        <option value="SUSPEND">SUSPEND</option>
                        <option value="BAN">BAN</option>
                      </StyledSelect>
                    ) : (
                      <div>{modReviewAction || 'NONE'}</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 11, color: '#74819a', maxWidth: 280, lineHeight: 1.5 }}>
                      {ACTION_HELP[modReviewAction] || ACTION_HELP.NONE}
                    </div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>Estado del caso</label>
                    {canReview ? (
                      <StyledSelect
                        value={isFinalAction ? 'RESOLVED' : modReviewStatus}
                        onChange={(e) => setModReviewStatus(e.target.value)}
                        disabled={isFinalAction}
                      >
                        {!isFinalAction && <option value="OPEN">OPEN</option>}
                        {!isFinalAction && <option value="REVIEWING">REVIEWING</option>}
                        <option value="RESOLVED">RESOLVED</option>
                        {!isFinalAction && <option value="REJECTED">REJECTED</option>}
                      </StyledSelect>
                    ) : (
                      <div>{isFinalAction ? 'RESOLVED' : modReviewStatus}</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 11, color: '#74819a', maxWidth: 280, lineHeight: 1.5 }}>
                      {STATUS_HELP[isFinalAction ? 'RESOLVED' : modReviewStatus] || STATUS_HELP.REVIEWING}
                    </div>
                  </FieldBlock>
                </PanelRow>

                <FieldBlock style={{ marginTop: 10 }}>
                  <label>Notas internas de resolucion</label>
                  {canReview ? (
                    <TextArea
                      value={modReviewNotes}
                      onChange={(e) => setModReviewNotes(e.target.value)}
                      placeholder="Resume criterio, evidencia y motivo de la decision..."
                    />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 72 }}>
                      {modReviewNotes || 'Sin notas.'}
                    </div>
                  )}
                </FieldBlock>
              </>
            )}
          </InlinePanel>
        </div>
      </DbLayout>
    </div>
  );
};

export default AdminModerationPanel;
