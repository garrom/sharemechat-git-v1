// src/pages/admin/content/AdminContentPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
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

const STATE_OPTIONS = [
  'IDEA', 'OUTLINE_READY', 'DRAFT_GENERATED', 'IN_REVIEW',
  'APPROVED', 'SCHEDULED', 'PUBLISHED', 'RETRACTED',
];

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

const AdminContentPanel = () => {
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);

  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [filterState, setFilterState] = useState('');
  const [filterLocale, setFilterLocale] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadArticles = useCallback(async (overridePage) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterState) params.set('state', filterState);
      if (filterLocale) params.set('locale', filterLocale);
      if (filterCategory) params.set('category', filterCategory);
      params.set('page', String(overridePage ?? page));
      params.set('size', String(size));
      const data = await apiFetch(`/admin/content/articles?${params.toString()}`);
      setArticles(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(typeof data?.totalPages === 'number' ? data.totalPages : 0);
    } catch (e) {
      setError(e?.message || 'Error cargando articulos');
      setArticles([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filterState, filterLocale, filterCategory, page, size]);

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
          aria-label="Filtro estado"
        >
          <option value="">Todos los estados</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </StyledSelect>
        <StyledSelect
          value={filterLocale}
          onChange={(e) => setFilterLocale(e.target.value)}
          aria-label="Filtro locale"
        >
          <option value="">Todos los idiomas</option>
          <option value="es">es</option>
          <option value="en">en</option>
        </StyledSelect>
        <StyledInput
          placeholder="Categoria"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        />
        <StyledButton type="button" onClick={handleApplyFilters} disabled={loading}>
          Aplicar filtros
        </StyledButton>
        <RightInfo>
          <StyledButton type="button" onClick={handleNew}>
            Nuevo articulo
          </StyledButton>
        </RightInfo>
      </ControlsRow>

      {error ? <StyledError>{error}</StyledError> : null}

      {loading ? (
        <NoteCard>Cargando articulos...</NoteCard>
      ) : articles.length === 0 ? (
        <NoteCard>
          No hay articulos. Crea el primero con el boton &quot;Nuevo articulo&quot;.
        </NoteCard>
      ) : (
        <>
          <StyledTable>
            <thead>
              <tr>
                <th>ID</th>
                <th>Slug</th>
                <th>Locale</th>
                <th>Estado</th>
                <th>Titulo</th>
                <th>Categoria</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{a.slug}</td>
                  <td>{a.locale}</td>
                  <td><Badge>{a.state}</Badge></td>
                  <td>{a.title}</td>
                  <td>{a.category || '-'}</td>
                  <td>{fmtDate(a.updatedAt)}</td>
                  <td>
                    <TableActionGroup>
                      <TableActionButton type="button" onClick={() => handleEdit(a.id)}>
                        Abrir
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
              Anterior
            </StyledButton>
            <span style={{ fontSize: 13, color: '#475569' }}>
              Pagina {page + 1} / {Math.max(1, totalPages)}
            </span>
            <StyledButton
              type="button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </StyledButton>
          </ControlsRow>
        </>
      )}
    </div>
  );
};

export default AdminContentPanel;
