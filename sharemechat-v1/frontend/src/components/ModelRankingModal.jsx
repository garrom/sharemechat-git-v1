// src/components/ModelRankingModal.jsx
//
// Card 1 Fase C: modal "Top modelos" (ranking por likes) que abre la modelo
// desde su perfil. Ordena por likes desc, muestra la insignia de cada una y
// fija la posición propia si queda fuera del top. Click en una fila → abre el
// perfil de esa modelo (onOpenProfile).

import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import ModalBase from './ModalBase';
import RoyaltyBadge from './RoyaltyBadge';

const Panel = styled.section`
  width: min(560px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: #17191f;
  color: #e8ebef;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: #1c2027;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
`;

const Close = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #c4cad2;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  &:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
`;

const Inner = styled.div`
  padding: 16px 18px 22px;
  overflow-y: auto;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Row = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: ${({ $self }) => ($self ? 'rgba(234,29,29,0.10)' : '#1c2027')};
  border: 1px solid ${({ $self, $top }) =>
    $self ? 'rgba(234,29,29,0.4)' : $top ? 'rgba(217,173,68,0.35)' : 'rgba(255,255,255,0.08)'};
  border-radius: 12px;
  padding: 9px 13px;
  cursor: pointer;
  color: inherit;
  &:hover { border-color: rgba(255,255,255,0.22); }
`;

const Rank = styled.span`
  width: 26px;
  text-align: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
  color: ${({ $top }) => ($top ? '#d9ad44' : '#98a1ad')};
`;

const Av = styled.span`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, #e6b3b3, #c99aa0);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #3a1620;
`;

const Who = styled.div`
  flex: 1;
  min-width: 0;
  .nm { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .likes { font-size: 12px; color: #98a1ad; }
  .likes b { color: #e8ebef; }
`;

const Badge = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  ${({ $none }) => ($none ? 'color:#98a1ad;font-weight:500;' : '')}
`;

const Note = styled.p`
  color: #98a1ad;
  font-size: 12.5px;
  text-align: center;
  margin: 16px 0 0;
`;

const Divider = styled.hr`
  border: 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  margin: 14px 0;
`;

const tk = (k, o) => i18n.t(k, o);
const badgeName = (code) => (code ? tk(`modelProfileExpanded.badgeValues.${code}`, { defaultValue: code }) : null);

const RankRow = ({ e, top, self, onOpenProfile }) => (
  <Row
    type="button"
    $top={top}
    $self={self}
    onClick={() => onOpenProfile && onOpenProfile({ id: e.modelUserId, nickname: e.nickname })}
  >
    <Rank $top={top}>{e.rank}</Rank>
    <Av>{(e.nickname || '?').charAt(0).toUpperCase()}</Av>
    <Who>
      <div className="nm">{e.nickname || '—'}</div>
      <div className="likes"><b>{Number(e.count).toLocaleString('es-ES')}</b> {tk('modelProfileExpanded.likes.label').toLowerCase()}</div>
    </Who>
    {e.badgeCode ? (
      <Badge><RoyaltyBadge code={e.badgeCode} size={24} title={badgeName(e.badgeCode)} />{badgeName(e.badgeCode)}</Badge>
    ) : (
      <Badge $none>{tk('modelRanking.noBadge')}</Badge>
    )}
  </Row>
);

const ModelRankingModal = ({ open, onClose, onOpenProfile }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    (async () => {
      try {
        const res = await apiFetch('/models/ranking');
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e?.message || tk('modelRanking.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleClose = useCallback(() => { if (typeof onClose === 'function') onClose(); }, [onClose]);

  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const self = data?.self || null;

  return (
    <ModalBase open={!!open} onClose={handleClose} title="" size="lg" variant="info" hideChrome>
      <Panel>
        <Head>
          <Title>{tk('modelRanking.title')}</Title>
          <Close type="button" onClick={handleClose} aria-label={tk('common.close')}>✕</Close>
        </Head>
        <Inner>
          {loading && <Note>{tk('modelRanking.loading')}</Note>}
          {error && <Note style={{ color: '#f0b4b4' }}>{error}</Note>}
          {!loading && !error && entries.length === 0 && !self && (
            <Note>{tk('modelRanking.empty')}</Note>
          )}
          {!loading && !error && (entries.length > 0 || self) && (
            <>
              <List>
                {entries.map((e) => (
                  <RankRow key={e.modelUserId} e={e} top={e.rank <= 3} self={false} onOpenProfile={onOpenProfile} />
                ))}
              </List>
              {self && (
                <>
                  <Divider />
                  <List>
                    <RankRow e={self} top={false} self onOpenProfile={onOpenProfile} />
                  </List>
                  <Note>{tk('modelRanking.selfNote')}</Note>
                </>
              )}
            </>
          )}
        </Inner>
      </Panel>
    </ModalBase>
  );
};

export default ModelRankingModal;
