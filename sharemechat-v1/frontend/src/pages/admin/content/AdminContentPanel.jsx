// src/pages/admin/content/AdminContentPanel.jsx
//
// Listado de articulos del CMS bilingue (paquete 6, ADR-025).
//
// Cambios respecto al modelo viejo (paquete 0):
//  - Eliminado el filtro `locale` del listado: en el modelo nuevo todos los
//    articulos son bilingues por diseno; un filtro de locale a nivel
//    articulo no aporta. El listado muestra el resumen multilingue de cada
//    fila (badges con los locales presentes).
//  - El parametro `locale` ya no se envia en el query string a
//    GET /admin/content/articles.
//  - i18n preventiva: todas las strings de la UI pasan por el namespace
//    `cms` con fallback ES. EN se traducira en paquete editorial futuro.

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../config/http';
import {
  Badge,
  ControlsRow,
  NoteCard,
  RightInfo,
  StyledButton,
  StyledError,
  StyledInput,
  StyledSelect,
  StyledTable,
  TableActionButton,
  TableActionGroup,
} from '../../../styles/AdminStyles';
import ContentArticleEditor from './ContentArticleEditor';

// ADR-016: workflow simplificado a cuatro estados operables. SCHEDULED
// queda modelado en BD pero inalcanzable; no se ofrece en el filtro.
const STATE_OPTIONS = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETRACTED'];

const fmtDate = (v) => {
  if (!v) return '-';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
};

// Render del resumen de locales presentes en el articulo. Espera
// `translations: TranslationSummaryDTO[]` con `locale` y `hasBody`. Si el
// DTO viejo del listado no expone `translations`, devolvemos placeholder
// "—" sin romper.
const TranslationsBadges = ({ translations }) => {
  if (!Array.isArray(translations) || translations.length === 0) {
    return <span style={{ color: '#94a3b8' }}>—</span>;
  }
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {translations.map((t) => (
        <Badge
          key={t.locale}
          style={{
            background: t.hasBody ? '#dcfce7' : '#fef3c7',
            color: t.hasBody ? '#166534' : '#92400e',
            fontSize: 10,
          }}
        >
          {t.locale.toUpperCase()}
        </Badge>
      ))}
    </span>
  );
};

const pickListingTitle = (article) => {
  // El listado nuevo no trae title compartido (ya no existe). Cogemos el
  // title de la traduccion ES si esta, EN si no, "—" si ninguna.
  if (!Array.isArray(article.translations)) return '—';
  const es = article.translations.find((t) => t.locale === 'es');
  if (es && es.title) return es.title;
  const en = article.translations.find((t) => t.locale === 'en');
  if (en && en.title) return en.title;
  return '—';
};

const AdminContentPanel = () => {
  const { t } = useTranslation('cms');

  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);

  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filtros que sobreviven al rediseno (paquete 6 elimina filterLocale):
  const [filterState, setFilterState] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadArticles = useCallback(async (overridePage) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterState) params.set('state', filterState);
      if (filterCategory) params.set('category', filterCategory);
      params.set('page', String(overridePage ?? page));
      params.set('size', String(size));
      const data = await apiFetch(`/admin/content/articles?${params.toString()}`);
      setArticles(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(typeof data?.totalPages === 'number' ? data.totalPages : 0);
    } catch (e) {
      setError(e?.message || t('list.errorLoading', 'Error cargando artículos'));
      setArticles([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filterState, filterCategory, page, size, t]);

  useEffect(() => {
    if (view === 'list') {
      loadArticles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, page]);

  const handleApplyFilters = () => {
    setPage(0);
    loadArticles(0);
  };

  const handleNew = () => {
    setEditingId(null);
    setView('editor');
  };

  const handleEdit = (id) => {
    setEditingId(id);
    setView('editor');
  };

  const handleBackFromEditor = () => {
    setView('list');
    setEditingId(null);
  };

  if (view === 'editor') {
    return <ContentArticleEditor articleId={editingId} onBack={handleBackFromEditor} />;
  }

  return (
    <div>
      <ControlsRow>
        <StyledSelect
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          aria-label={t('list.filterStateLabel', 'Filtro estado')}
        >
          <option value="">{t('list.filterState', 'Todos los estados')}</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </StyledSelect>
        <StyledInput
          placeholder={t('list.filterCategoryPlaceholder', 'Categoría')}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        />
        <StyledButton type="button" onClick={handleApplyFilters} disabled={loading}>
          {t('list.btnApplyFilters', 'Aplicar filtros')}
        </StyledButton>
        <RightInfo>
          <StyledButton type="button" onClick={handleNew}>
            {t('list.btnNew', 'Nuevo artículo')}
          </StyledButton>
        </RightInfo>
      </ControlsRow>

      {error ? <StyledError>{error}</StyledError> : null}

      {loading ? (
        <NoteCard>{t('list.loading', 'Cargando artículos...')}</NoteCard>
      ) : articles.length === 0 ? (
        <NoteCard>
          {t('list.empty',
            'No hay artículos. Crea el primero con el botón "Nuevo artículo".')}
        </NoteCard>
      ) : (
        <>
          <StyledTable>
            <thead>
              <tr>
                <th>{t('list.colId', 'ID')}</th>
                <th>{t('list.colTranslations', 'Idiomas')}</th>
                <th>{t('list.colState', 'Estado')}</th>
                <th>{t('list.colTitle', 'Título')}</th>
                <th>{t('list.colCategory', 'Categoría')}</th>
                <th>{t('list.colUpdated', 'Actualizado')}</th>
                <th>{t('list.colActions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td><TranslationsBadges translations={a.translations} /></td>
                  <td><Badge>{a.state}</Badge></td>
                  <td>{pickListingTitle(a)}</td>
                  <td>{a.category || '-'}</td>
                  <td>{fmtDate(a.updatedAt)}</td>
                  <td>
                    <TableActionGroup>
                      <TableActionButton type="button" onClick={() => handleEdit(a.id)}>
                        {t('list.actionOpen', 'Abrir')}
                      </TableActionButton>
                    </TableActionGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>

          <ControlsRow>
            <StyledButton
              type="button"
              disabled={page <= 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t('list.pagePrev', 'Anterior')}
            </StyledButton>
            <span style={{ fontSize: 13, color: '#475569' }}>
              {t('list.pageOf', 'Página {{page}} / {{total}}',
                  { page: page + 1, total: Math.max(1, totalPages) })}
            </span>
            <StyledButton
              type="button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('list.pageNext', 'Siguiente')}
            </StyledButton>
          </ControlsRow>
        </>
      )}
    </div>
  );
};

export default AdminContentPanel;
