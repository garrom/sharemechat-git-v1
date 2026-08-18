// src/components/ModelReputationCard.jsx
//
// Card 1 Fase C: widget "Tu reputación" en el perfil de la modelo. Muestra
// sus likes + insignia + progreso al siguiente escalón, y un botón para abrir
// el ranking "Top modelos". Tema claro (encaja en PerfilModel).

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import RoyaltyBadge from './RoyaltyBadge';

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e6e7ea;
  border-radius: 16px;
  padding: 18px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: #1f2933;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Count = styled.div`
  .n { font-size: 1.5rem; font-weight: 800; color: #1f2933; line-height: 1; }
  .l { font-size: 0.72rem; color: #7c8792; text-transform: uppercase; letter-spacing: 0.03em; margin-top: 3px; }
`;

const Bar = styled.div`
  height: 8px;
  border-radius: 999px;
  background: #eef0f3;
  overflow: hidden;
  > i {
    display: block;
    height: 100%;
    width: ${({ $pct }) => `${$pct}%`};
    background: linear-gradient(90deg, #e2b03e, #d9ad44);
  }
`;

const Progress = styled.div`
  font-size: 0.8rem;
  color: #5b6470;
  b { color: #b8891f; }
`;

const Btn = styled.button`
  align-self: flex-start;
  margin-top: 2px;
  background: #1f2933;
  color: #fff;
  border: 0;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { filter: brightness(1.12); }
`;

const tk = (k, o) => i18n.t(k, o);
const badgeName = (code) => (code ? tk(`modelProfileExpanded.badgeValues.${code}`, { defaultValue: code }) : null);

const ModelReputationCard = ({ onOpenRanking }) => {
  const [rep, setRep] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch('/models/me/reputation');
        if (!cancelled) setRep(r);
      } catch (e) {
        if (!cancelled) setRep(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const count = rep?.count ?? 0;
  const badge = rep?.badgeCode || null;
  const next = rep?.nextBadgeCode || null;
  const toNext = rep?.likesToNext;
  const nextThreshold = rep?.nextThreshold;
  const pct = next && nextThreshold ? Math.max(4, Math.min(100, Math.round((count / nextThreshold) * 100))) : 100;

  return (
    <Card>
      <Title>{tk('modelReputation.title')}</Title>
      <Head>
        {badge ? (
          <RoyaltyBadge code={badge} size={40} title={badgeName(badge)} />
        ) : (
          <RoyaltyBadge code="TIARA" size={40} title="" />
        )}
        <Count>
          <div className="n">{Number(count).toLocaleString('es-ES')}</div>
          <div className="l">{badge ? badgeName(badge) : tk('modelReputation.noBadge')}</div>
        </Count>
      </Head>

      <Bar $pct={pct}><i /></Bar>
      <Progress>
        {next
          ? <>{tk('modelReputation.toNext', { n: toNext })} <b>{badgeName(next)}</b></>
          : tk('modelReputation.maxed')}
      </Progress>

      <Btn type="button" onClick={() => onOpenRanking && onOpenRanking()}>
        {tk('modelReputation.viewRanking')}
      </Btn>
    </Card>
  );
};

export default ModelReputationCard;
