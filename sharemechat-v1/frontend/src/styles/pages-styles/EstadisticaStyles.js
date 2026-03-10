import styled from 'styled-components';

export const Wrap = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  background: linear-gradient(
    180deg,
    rgba(248,250,252,0.92) 0%,
    rgba(241,245,249,0.92) 55%,
    rgba(236,254,255,0.65) 100%
  );

  color: rgba(15,23,42,0.92);
  overflow: auto;
  border-radius: 6px;
  border: 1px solid rgba(15,23,42,0.06);

  @media (max-width: 768px) {
    padding: 12px;
    border-radius: 14px;
  }
`;

export const TopBar = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
`;

export const TopLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

export const TopIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  background: rgba(34,197,94,0.14);
  border: 1px solid rgba(34,197,94,0.22);
  color: rgba(22,163,74,0.95);
`;

export const Title = styled.div`
  font-size: 18px;
  font-weight: 900;
  color: rgba(2,6,23,0.92);
  letter-spacing: .2px;
`;

export const SubTitle = styled.div`
  margin-top: 2px;
  font-size: 13px;
  color: rgba(30,41,59,0.78);
`;

export const TopRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-wrap: wrap;
`;

export const Filters = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const FilterLabel = styled.span`
  color: rgba(30,41,59,0.78);
  font-weight: 800;
`;

export const Select = styled.select`
  height: 40px;
  border-radius: 12px;
  padding: 0 12px;

  border: 1px solid rgba(15,23,42,0.14);
  background: rgba(255,255,255,0.78);
  color: rgba(2,6,23,0.88);
  outline: none;

  &:hover {
    background: rgba(255,255,255,0.90);
  }

  &:focus {
    box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
    border-color: rgba(59,130,246,0.40);
  }

  option {
    background: #ffffff;
    color: #111;
  }

  &:disabled {
    opacity: .65;
    cursor: not-allowed;
  }
`;

export const ReloadBtn = styled.button`
  height: 40px;
  border-radius: 12px;
  padding: 0 14px;

  border: 1px solid rgba(15,23,42,0.14);
  background: rgba(255,255,255,0.78);
  color: rgba(2,6,23,0.88);
  cursor: pointer;
  font-weight: 900;

  &:hover:not(:disabled) {
    background: rgba(255,255,255,0.94);
  }

  &:disabled {
    opacity: .6;
    cursor: not-allowed;
  }
`;

export const AvailabilityPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 999px;

  border: 1px solid rgba(59,130,246,0.22);
  background: rgba(59,130,246,0.10);
  color: rgba(30,64,175,0.92);

  font-weight: 900;
  font-size: 12px;
`;

export const PayoutNotice = styled.div`
  max-width: min(680px, 100%);
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid rgba(2, 132, 199, 0.22);
  background: rgba(2, 132, 199, 0.08);
  color: rgba(15, 23, 42, 0.86);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 700;

  b {
    color: rgba(12, 74, 110, 0.95);
    font-weight: 900;
  }
`;

export const TabsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0px;
  flex-wrap: wrap;

  width: 100%;
  padding: 2px 2px 0 2px;
  border-bottom: 1px solid rgba(236,72,153,0.22);

  @media (max-width: 768px) {
    flex-wrap: nowrap;
  }
`;

export const TabButton = styled.button`
  appearance: none;
  -webkit-appearance: none;

  display: inline-flex;
  align-items: center;
  gap: 10px;

  padding: 10px 14px;
  border-radius: 2px 2px 0 0;

  cursor: pointer;
  font-weight: 900;
  white-space: nowrap;

  background: rgba(255,255,255,0.82);
  color: rgba(2,6,23,0.88);
  border: 1px solid rgba(15,23,42,0.12);
  border-bottom-color: transparent;

  &:hover {
    background: rgba(236,72,153,0.08);
    border-color: rgba(236,72,153,0.22);
    border-bottom-color: transparent;
  }

  &[data-active="true"] {
    background: rgba(236,72,153,0.14);
    border-color: rgba(236,72,153,0.28);
    color: rgba(157,23,77,0.96);
    border-bottom-color: rgba(248,250,252,0.92);
  }

  &:focus-visible {
    outline: 2px solid rgba(236,72,153,0.32);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    padding: 8px 10px;
    font-size: 12px;
    gap: 6px;
  }
`;

export const StateLine = styled.div`
  color: rgba(30,41,59,0.80);
  padding: 12px 2px;
  font-weight: 800;
`;

export const ErrorLine = styled.div`
  color: rgba(185,28,28,0.92);
  font-weight: 900;
  padding: 12px 2px;
`;

export const Section = styled.section`
  border-radius: 18px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.78);

  padding: 14px;

  box-shadow:
    0 10px 30px rgba(15,23,42,0.06),
    0 1px 0 rgba(255,255,255,0.65) inset;

  @media (max-width: 768px) {
    padding: 12px;
  }
`;

export const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

export const SectionTitle = styled.div`
  font-size: 18px;
  font-weight: 1000;
  color: rgba(2,6,23,0.92);
  letter-spacing: .2px;
`;

export const SectionHint = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: rgba(30,41,59,0.70);
`;

export const GridCards = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  &[data-compact="true"] {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    &[data-compact="true"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

export const MiniCard = styled.div`
  border-radius: 16px;
  padding: 14px;

  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.86);

  min-width: 0;

  transition: transform .10s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255,255,255,0.96);
    border-color: rgba(15,23,42,0.14);
    box-shadow: 0 12px 28px rgba(15,23,42,0.08);
  }

  ${({ $accent }) => {
    if ($accent === 'green') {
      return `
        box-shadow: 0 0 0 3px rgba(34,197,94,0.10) inset;
        border-color: rgba(34,197,94,0.22);
      `;
    }
    if ($accent === 'blue') {
      return `
        box-shadow: 0 0 0 3px rgba(59,130,246,0.10) inset;
        border-color: rgba(59,130,246,0.22);
      `;
    }
    if ($accent === 'amber') {
      return `
        box-shadow: 0 0 0 3px rgba(245,158,11,0.10) inset;
        border-color: rgba(245,158,11,0.20);
      `;
    }
    if ($accent === 'purple') {
      return `
        box-shadow: 0 0 0 3px rgba(168,85,247,0.10) inset;
        border-color: rgba(168,85,247,0.20);
      `;
    }
    return '';
  }}
`;

export const MiniLabel = styled.div`
  font-size: 12px;
  color: rgba(30,41,59,0.70);
  font-weight: 900;
`;

export const MiniValue = styled.div`
  margin-top: 6px;
  font-size: 22px;
  font-weight: 1000;
  color: rgba(2,6,23,0.92);
  letter-spacing: .2px;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const MiniMeta = styled.div`
  margin-top: 8px;
  font-size: 13px;
  color: rgba(30,41,59,0.72);

  b {
    color: rgba(2,6,23,0.92);
  }
`;

export const ProgressCard = styled.div`
  border-radius: 18px;
  padding: 14px;

  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(248,250,252,0.90);

  box-shadow: 0 10px 28px rgba(15,23,42,0.06);
`;

export const ProgressRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const ProgressCol = styled.div`
  min-width: 0;
`;

export const KpiTitle = styled.div`
  font-weight: 1000;
  color: rgba(2,6,23,0.92);
  margin-bottom: 6px;
`;

export const KpiLine = styled.div`
  font-size: 13px;
  color: rgba(30,41,59,0.78);
  line-height: 1.45;

  b {
    color: rgba(2,6,23,0.92);
  }
`;

export const BarWrap = styled.div`
  margin-top: 14px;
`;

export const BarTrack = styled.div`
  position: relative;
  height: 12px;
  border-radius: 999px;

  background: rgba(15,23,42,0.08);
  overflow: hidden;
  border: 1px solid rgba(15,23,42,0.12);
`;

export const BarFill = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 999px;

  background: linear-gradient(
    90deg,
    rgba(34,197,94,0.95) 0%,
    rgba(59,130,246,0.92) 60%,
    rgba(168,85,247,0.90) 100%
  );
`;

export const BarGlow = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 999px;
  box-shadow: 0 0 18px rgba(59,130,246,0.22);
  opacity: .65;
  pointer-events: none;
`;

export const BarLegend = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 900;
  color: rgba(30,41,59,0.72);
`;

export const SuccessPill = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 999px;

  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.22);
  color: rgba(22,101,52,0.92);

  font-weight: 1000;
`;

export const TableWrap = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: 14px;

  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.86);

  box-shadow: 0 8px 24px rgba(15,23,42,0.06);
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;

  thead th {
    text-align: left;
    padding: 12px 12px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: .2px;

    color: rgba(15,23,42,0.82);
    border-bottom: 1px solid rgba(15,23,42,0.08);
    background: rgba(248,250,252,0.92);
  }

  tbody td {
    padding: 12px 12px;
    border-bottom: 1px solid rgba(15,23,42,0.06);
    font-weight: 800;
    color: rgba(2,6,23,0.88);
  }

  tbody tr {
    transition: background-color .12s ease;
  }

  tbody tr.is-expandable {
    cursor: pointer;
  }

  tbody tr.is-expandable:hover {
    background: rgba(59,130,246,0.06);
  }

  tbody tr.tier-detail {
    background: rgba(59,130,246,0.05);
  }

  tbody tr.tier-detail:hover {
    background: rgba(59,130,246,0.05);
  }

  tbody tr.tier-detail td {
    padding: 10px 12px;
    background: rgba(59,130,246,0.05);
    border-top: 1px solid rgba(15,23,42,0.06);
    border-bottom: 1px solid rgba(15,23,42,0.06);
    font-weight: 700;
    color: rgba(30,41,59,0.78);
    line-height: 1.45;
  }

  td.name {
    color: rgba(2,6,23,0.92);
    font-weight: 1000;
  }

  td.hist-date,
  td.hist-tier {
    font-size: 14px;
    font-weight: 900;
    color: rgba(2,6,23,0.92);
  }

  @media (max-width: 900px) {
    min-width: 680px;

    thead th {
      font-size: 12px;
    }
  }
`;

export const Placeholder = styled.div`
  border-radius: 14px;
  border: 1px dashed rgba(15,23,42,0.18);
  background: rgba(255,255,255,0.60);
  padding: 16px;
`;

export const PlaceholderTitle = styled.div`
  font-weight: 1000;
  color: rgba(2,6,23,0.90);
`;

export const PlaceholderText = styled.div`
  margin-top: 6px;
  color: rgba(30,41,59,0.74);
  font-weight: 700;
  line-height: 1.45;
`;

export const TierNameCell = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

export const TierExpandIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  min-width: 14px;
  color: rgba(30,41,59,0.68);
  font-size: 11px;
`;

export const TierDetailText = styled.div`
  font-size: 12px;
  line-height: 1.45;
  font-weight: 700;
  color: rgba(30,41,59,0.78);
`;