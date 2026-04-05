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
  color: #1f2937;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-collapse: collapse;
  margin-top: 12px;

  th, td {
    padding: 8px 9px;
    text-align: left;
    border-bottom: 1px solid #dee2e6;
    vertical-align: top;
    font-size: 12px;
  }

  th {
    position: sticky;
    top: 0;
    background-color: #f8f9fa;
    color: #334155;
    font-weight: bold;
    z-index: 1;
    font-size: 11px;
  }

  td {
    color: #1f2937;
  }

  tr:hover {
    background-color: #f7f9fb;
  }
`;

export const StyledButton = styled.button`
  padding: 6px 11px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:not(:disabled):hover {
    background-color: #218838;
  }

  &:disabled,
  &[disabled] {
    background-color: #adb5bd !important;
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
  color: #007bff;
  cursor: pointer;
  font-size: 14px;
`;

export const StyledError = styled.p`
  color: #dc3545;
  margin: 8px 0;
  font-size: 12px;
`;

export const StyledInput = styled.input`
  width: 100%;
  max-width: 200px;
  padding: 6px 8px;
  margin: 0 5px;
  border: 1px solid #ced4da;
  border-radius: 5px;
  font-size: 12px;
`;

export const StyledSelect = styled.select`
  width: 100%;
  max-width: 220px;
  padding: 6px 8px;
  margin: 0;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 12px;
  background: #fff;
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
  margin-bottom: 20px;
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: 8px;
`;

export const TabButton = styled.button`
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  color: #fff;
  background: ${({ active }) => (active ? '#007bff' : '#6c757d')};

  &:hover { filter: brightness(0.95); }
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
  border: 1px solid #eee;
  border-radius: 6px;
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
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 11px;
  background: #fff;
  color: #1f2937;

  .label { font-size: 11px; color: #475569; }
  .value { font-size: 22px; font-weight: 700; color: #0f172a; }
  .meta  { font-size: 12px; color: #64748b; margin-top: 5px; }
`;

export const NoteCard = styled.div`
  border: ${({ $muted }) => ($muted ? '1px dashed #eee' : '1px solid #f4f4f4')};
  border-radius: 10px;
  padding: 11px;
  background: ${({ $muted }) => ($muted ? '#fafafa' : '#fff')};
  color: ${({ $muted }) => ($muted ? '#64748b' : '#475569')};

  .label { font-size: 11px; }
  .value { font-size: 17px; margin-top: 5px; color: #0f172a; }
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
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  background: #fff;
  overflow: visible;
  z-index: 1;
  position: sticky;
  top: 0;
`;

export const DbTableWrap = styled.div`
  overflow: auto;
  border: 1px solid #eee;
  border-radius: 6px;
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
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
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
  border: 1px solid #ced4da;
  border-radius: 6px;
  text-decoration: none;
  color: #0d6efd;
  pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  font-size: 12px;
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
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fff;
  color: #1f2937;
  padding: 10px;
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
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 12px;
  resize: vertical;
`;

export const SmallBtn = styled.button`
  padding: 6px 9px;
  border: 1px solid #ced4da;
  background: #fff;
  color: #1f2937;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;

  &:hover { background: #f8f9fa; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  background: #f1f3f5;
  color: #343a40;

  &[data-variant='active'] { background: #dcfce7; color: #166534; }
  &[data-variant='connecting'] { background: #dbeafe; color: #1d4ed8; }
  &[data-variant='closed'] { background: #e5e7eb; color: #475569; }
  &[data-variant='danger'] { background: #fee2e2; color: #b91c1c; }
  &[data-variant='open'] { background: #fff3cd; color: #856404; }
  &[data-variant='reviewing'] { background: #d1ecf1; color: #0c5460; }
  &[data-variant='resolved'] { background: #d4edda; color: #155724; }
  &[data-variant='rejected'] { background: #f8d7da; color: #721c24; }
`;
