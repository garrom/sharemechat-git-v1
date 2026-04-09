import styled from 'styled-components';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  color: #1f2937;
  padding: 20px;
`;

export const StyledTable = styled.table`
  width: 100%;
  max-width: 1200px;
  background-color: #ffffff;
  color: #18212f;
  border-radius: 4px;
  box-shadow: none;
  border: 1px solid #bfc8d3;
  border-collapse: collapse;
  margin-top: 8px;
  table-layout: auto;

  th, td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid #d3dae3;
    vertical-align: top;
    font-size: 12px;
  }

  th {
    position: sticky;
    top: 0;
    background-color: #dfe6ee;
    color: #253243;
    font-weight: 700;
    z-index: 1;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #b3beca;
  }

  td {
    color: #18212f;
    background: #fff;
  }

  tbody tr:nth-child(even) td {
    background: #fafbfd;
  }

  tbody tr:hover td {
    background-color: #eef2f6;
  }

  tbody tr[data-selected='true'] td {
    background-color: #e3eaf2 !important;
    border-bottom-color: #c6d0db;
  }

  tbody tr[data-selected='true'] td:first-child {
    box-shadow: inset 3px 0 0 #6a7687;
  }

  tbody tr[data-selected='true']:hover td {
    background-color: #dfe7f0 !important;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
`;

export const DarkHeaderTable = styled(StyledTable)`
  th {
    background: #445262;
    color: #f5f7fa;
    border-bottom: 1px solid #354252;
  }
`;

export const StyledButton = styled.button`
  padding: 7px 12px;
  background-color: #2a3646;
  color: #fff;
  border: 1px solid #2a3646;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:not(:disabled):hover {
    background-color: #202a38;
    border-color: #202a38;
  }

  &:disabled,
  &[disabled] {
    background-color: #98a2b3 !important;
    border-color: #98a2b3 !important;
    color: #fff !important;
    cursor: not-allowed !important;
    opacity: 0.65;
    box-shadow: none;
    pointer-events: none;
  }
`;

export const StyledLinkButton = styled.button`
  background: none;
  border: none;
  color: #334155;
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
`;

export const StyledError = styled.p`
  color: #8f1d1d;
  margin: 8px 0;
  font-size: 12px;
`;

export const StyledInput = styled.input`
  width: 100%;
  max-width: 200px;
  padding: 7px 9px;
  margin: 0 5px;
  border: 1px solid #bcc6d1;
  border-radius: 4px;
  background: #fff;
  color: #18212f;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: #67768a;
    box-shadow: inset 0 0 0 1px #67768a;
  }
`;

export const StyledSelect = styled.select`
  width: 100%;
  max-width: 220px;
  padding: 7px 9px;
  margin: 0;
  border: 1px solid #bcc6d1;
  border-radius: 4px;
  font-size: 12px;
  background: #fff;
  color: #18212f;

  &:focus {
    outline: none;
    border-color: #67768a;
    box-shadow: inset 0 0 0 1px #67768a;
  }
`;

export const HeaderBar = styled.div`
  width: 100%;
  max-width: 1200px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    margin: 0;
    color: #0f172a;
  }
`;

export const TabsBar = styled.div`
  width: 100%;
  max-width: 1200px;
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #d5dbe3;
  padding-bottom: 8px;
`;

export const TabButton = styled.button`
  padding: 7px 12px;
  border-radius: 4px;
  border: 1px solid ${({ active }) => (active ? '#707d90' : '#c1cad5')};
  cursor: pointer;
  font-weight: 600;
  color: ${({ active }) => (active ? '#111927' : '#475467')};
  background: ${({ active }) => (active ? '#dde5ee' : '#f7f9fb')};
  box-shadow: ${({ active }) => (active ? 'inset 0 -1px 0 #707d90' : 'none')};

  &:hover {
    background: ${({ active }) => (active ? '#d9e1ea' : '#eef2f6')};
  }
`;

export const SectionTitle = styled.h3`
  width: 100%;
  max-width: 1200px;
  margin: 4px 0 10px;
  color: #0f172a;
  font-size: 16px;
`;

export const ControlsRow = styled.div`
  width: 100%;
  max-width: 1200px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 8px;
  flex-wrap: wrap;
`;

export const FieldBlock = styled.div`
  label {
    display: block;
    font-size: 10px;
    margin-bottom: 4px;
    color: #475569;
  }
`;

export const RightInfo = styled.div`
  margin-left: auto;
  font-size: 12px;
  color: #475569;
`;

export const ScrollBox = styled.div`
  width: 100%;
  max-width: 1200px;
  max-height: 560px;
  overflow: auto;
  border: 1px solid #bfc8d3;
  border-radius: 4px;
  background: #fff;
`;

export const CardsGrid = styled.div`
  width: 100%;
  max-width: 1200px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
  margin-top: 8px;
`;

export const StatCard = styled.div`
  border: 1px solid #d8dee6;
  border-radius: 4px;
  padding: 11px 12px;
  background: #fff;
  color: #18212f;
  box-shadow: none;

  .label { font-size: 11px; color: #5b6675; text-transform: uppercase; letter-spacing: 0.04em; }
  .value { font-size: 21px; font-weight: 700; color: #111927; }
  .meta  { font-size: 12px; color: #697586; margin-top: 5px; }
`;

export const NoteCard = styled.div`
  border: ${({ $muted }) => ($muted ? '1px dashed #d5dbe3' : '1px solid #d8dee6')};
  border-radius: 4px;
  padding: 11px 12px;
  background: ${({ $muted }) => ($muted ? '#fbfcfd' : '#fff')};
  color: ${({ $muted }) => ($muted ? '#697586' : '#475467')};

  .label { font-size: 11px; }
  .value { font-size: 17px; margin-top: 5px; color: #111927; }
  .meta  { font-size: 13px; margin-top: 7px; color: inherit; }
`;

export const FinanceList = styled.ol`
  margin-top: 8px;
  padding-left: 18px;
`;

export const FinanceItem = styled.li`
  margin-bottom: 4px;
  font-size: 12px;
`;

export const DbLayout = styled.div`
  width: 100%;
  max-width: 1200px;
  display: grid;
  grid-template-rows: auto 1fr;
  height: 75vh;
  min-height: 480px;
  overflow: visible;
`;

export const DbFilters = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 8px 0 10px;
  border-bottom: 1px solid #d5dbe3;
  background: #fff;
  overflow: visible;
  z-index: 1;
  position: sticky;
  top: 0;
`;

export const DbTableWrap = styled.div`
  overflow: auto;
  border: 1px solid #bfc8d3;
  border-radius: 4px;
  margin-top: 8px;
  position: relative;
  background: #fff;
`;

export const FloatingBtn = styled.button`
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9999;
  padding: 10px 14px;
  border: 1px solid #bcc6d1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  color: #18212f;
`;

export const DocGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(150px, 1fr));
  gap: 6px;
  margin-bottom: 6px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const DocLink = styled.a`
  display: inline-block;
  padding: 5px 7px;
  border: 1px solid #c6cfda;
  border-radius: 4px;
  text-decoration: none;
  color: #334155;
  pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  font-size: 12px;
  background: #fff;
`;

export const CheckBox = styled.input`
  width: 16px;
  height: 16px;
`;

export const LogoutButton = styled(StyledButton)`
  background-color: #dc3545;
  &:not(:disabled):hover { background-color: #c82333; }
`;

export const InlinePanel = styled.div`
  width: 100%;
  border: 1px solid #d8dee6;
  border-radius: 4px;
  background: #fff;
  color: #18212f;
  padding: 10px 12px;
  box-shadow: none;
`;

export const PanelRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-top: 7px;
`;

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 74px;
  padding: 8px 9px;
  border: 1px solid #bcc6d1;
  border-radius: 4px;
  font-size: 12px;
  resize: vertical;
  color: #18212f;

  &:focus {
    outline: none;
    border-color: #67768a;
    box-shadow: inset 0 0 0 1px #67768a;
  }
`;

export const SmallBtn = styled.button`
  padding: 6px 9px;
  border: 1px solid #b5c0cc;
  background: #f4f6f8;
  color: #2f3b4b;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;

  &:hover {
    background: #e9eef3;
    border-color: #aab6c3;
  }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

export const TableActionButton = styled(SmallBtn)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 5px 10px;
  border-radius: 4px;
  background: #fff;
  border-color: #b8c2cd;
  color: #344255;
  line-height: 1.1;

  &:hover:not(:disabled) {
    background: #344255;
    border-color: #344255;
    color: #f8fafc;
  }

  &:disabled {
    background: #f6f8fa;
    border-color: #d2d9e0;
    color: #8a95a3;
  }
`;

export const TableSuccessButton = styled(TableActionButton)`
  border-color: #9db5a2;
  color: #3d5a44;

  &:hover:not(:disabled) {
    background: #4c6852;
    border-color: #4c6852;
    color: #f8fafc;
  }
`;

export const TableDangerButton = styled(TableActionButton)`
  border-color: #c5a8a8;
  color: #724848;

  &:hover:not(:disabled) {
    background: #7d5454;
    border-color: #7d5454;
    color: #f8fafc;
  }
`;

export const TableActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border: 1px solid #d5dbe3;
  background: #fbfcfd;
  color: #556070;

  &[data-variant='active'] { background: #f7f9f7; color: #3d5543; border-color: #d3dcd4; }
  &[data-variant='connecting'] { background: #f7f8fa; color: #43566c; border-color: #d4dbe2; }
  &[data-variant='closed'] { background: #fafbfc; color: #667281; border-color: #dde2e8; }
  &[data-variant='danger'] { background: #fbf7f7; color: #714646; border-color: #e1d3d3; }
  &[data-variant='open'] { background: #fbfaf7; color: #6e5d3b; border-color: #e2ddcf; }
  &[data-variant='reviewing'] { background: #f8f9fb; color: #516171; border-color: #d8dee5; }
  &[data-variant='resolved'] { background: #f7f9f7; color: #3d5543; border-color: #d3dcd4; }
  &[data-variant='rejected'] { background: #faf7f7; color: #6e4848; border-color: #ddd1d1; }
`;
