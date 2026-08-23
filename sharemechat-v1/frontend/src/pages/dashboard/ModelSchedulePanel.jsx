// Tab "Horarios" del panel de Estadística (2026-08-23). Trae el histograma
// "cuándo sueles estar en línea" (día × hora) que ya existe en el "ver perfil"
// del cliente (ModelProfileExpanded), pero para la vista PROPIA de la modelo.
//
// Fuente de datos: GET /api/models/{miId}/public-profile → ModelPublicProfileDTO
// (availability[] = {dayOfWeek 1-7, hour 0-23, intensity 0-100} + flag
// hasAvailabilityData). No hay endpoint self; se usa el userId de sesión y el
// endpoint público (que también sirve para uno mismo).
//
// Barras en teal (#0ea5e9), coherente con el color del tab Horarios. Cabecera
// con Section/SectionHead como el resto de tabs.

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { useSession } from '../../components/SessionProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import {
  Section,
  SectionHead,
  SectionTitle,
  SectionHint,
  StateLine,
} from '../../styles/pages-styles/EstadisticaStyles';

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e8eaf0;
  border-radius: 12px;
  padding: 18px 16px;
`;

const DayNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 2px 0 16px;
`;

const DayNavBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid #e2e5ee;
  background: #ffffff;
  color: #475569;
  font-size: 16px;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const DayNavLabel = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  min-width: 96px;
  text-align: center;
`;

const Bars = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 150px;
  padding: 0 2px;
`;

const Bar = styled.span`
  flex: 1;
  border-radius: 4px 4px 0 0;
  min-height: 3px;
  height: ${({ $h }) => `${$h}%`};
  background: ${({ $peak }) => ($peak ? 'linear-gradient(180deg,#38bdf8,#0ea5e9)' : '#7dd3fc')};
  opacity: ${({ $peak }) => ($peak ? 1 : 0.7)};
`;

const BarLabels = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: #94a3b8;
  margin-top: 6px;
  padding: 0 2px;
`;

const Note = styled.div`
  font-size: 12px;
  color: #94a3b8;
  margin-top: 12px;
  text-align: center;
  line-height: 1.5;
`;

const EmptyMsg = styled.div`
  padding: 26px 16px;
  text-align: center;
  color: #64748b;
  font-size: 13.5px;
`;

// ISO day actual (1=Lunes .. 7=Domingo).
const currentIsoDay = () => {
  const js = new Date().getDay(); // 0=Domingo .. 6=Sábado
  return js === 0 ? 7 : js;
};

export default function ModelSchedulePanel() {
  const t = (key, options) => i18n.t(key, options);
  const { user } = useSession();
  const myId = user?.id;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(currentIsoDay());

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/models/${myId}/public-profile`)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((ex) => { if (!cancelled) setError(ex?.message || 'Error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [myId]);

  // Matriz día(1-7) × hora(0-23) de intensidad.
  const grid = useMemo(() => {
    const g = Array.from({ length: 8 }, () => new Array(24).fill(0));
    const list = Array.isArray(profile?.availability) ? profile.availability : [];
    for (const b of list) {
      const d = Number(b?.dayOfWeek);
      const h = Number(b?.hour);
      if (d >= 1 && d <= 7 && h >= 0 && h <= 23) g[d][h] = Number(b?.intensity) || 0;
    }
    return g;
  }, [profile]);

  const dayName = (d) => t(`modelProfileExpanded.days.${d}`, { defaultValue: `${d}` });
  const cycleDay = (delta) => {
    setSelectedDay((prev) => {
      let next = prev + delta;
      if (next < 1) next = 7;
      if (next > 7) next = 1;
      return next;
    });
  };

  const hasData = !!profile?.hasAvailabilityData;
  const dayRow = grid[selectedDay] || new Array(24).fill(0);
  const peak = Math.max(...dayRow, 0);

  return (
    <Section>
      <SectionHead>
        <SectionTitle>
          <FontAwesomeIcon icon={faCalendarDays} style={{ marginRight: 8 }} />
          {t('dashboardModel.statistics.schedule.title')}
        </SectionTitle>
        <SectionHint>{t('dashboardModel.statistics.schedule.hint')}</SectionHint>
      </SectionHead>

      <Card>
        {loading && <StateLine>{t('dashboardModel.statistics.status.loading')}</StateLine>}
        {!loading && error && (
          <EmptyMsg>{t('dashboardModel.statistics.schedule.empty')}</EmptyMsg>
        )}
        {!loading && !error && !hasData && (
          <EmptyMsg>{t('dashboardModel.statistics.schedule.empty')}</EmptyMsg>
        )}
        {!loading && !error && hasData && (
          <>
            <DayNav>
              <DayNavBtn type="button" onClick={() => cycleDay(-1)} aria-label={t('dashboardModel.statistics.schedule.prevDay')}>‹</DayNavBtn>
              <DayNavLabel>{dayName(selectedDay)}</DayNavLabel>
              <DayNavBtn type="button" onClick={() => cycleDay(1)} aria-label={t('dashboardModel.statistics.schedule.nextDay')}>›</DayNavBtn>
            </DayNav>

            <Bars>
              {dayRow.map((v, h) => (
                <Bar
                  key={h}
                  $h={peak > 0 ? Math.max(3, (v / peak) * 100) : 3}
                  $peak={v > 0 && v === peak}
                  title={`${String(h).padStart(2, '0')}:00`}
                />
              ))}
            </Bars>
            <BarLabels>
              <span>00h</span><span>03h</span><span>06h</span><span>09h</span>
              <span>12h</span><span>15h</span><span>18h</span><span>21h</span>
            </BarLabels>

            <Note>{t('dashboardModel.statistics.schedule.note')}</Note>
          </>
        )}
      </Card>
    </Section>
  );
}
