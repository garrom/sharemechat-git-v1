import styled from 'styled-components';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
`;

export const StyledTable = styled.table`
  width: 100%;
  max-width: 1200px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-collapse: collapse;
  margin-top: 20px;

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #dee2e6;
    vertical-align: top;
  }

  th {
    position: sticky;
    top: 0;
    background-color: #f8f9fa;
    font-weight: bold;
    z-index: 1;
  }

  tr:hover {
    background-color: #f7f9fb;
  }
`;

export const StyledButton = styled.button`
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 14px;
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
  margin: 10px 0;
  font-size: 14px;
`;

export const StyledInput = styled.input`
  width: 100%;
  max-width: 200px;
  padding: 8px;
  margin: 0 5px;
  border: 1px solid #ced4da;
  border-radius: 5px;
  font-size: 14px;
`;

export const StyledSelect = styled.select`
  width: 100%;
  max-width: 220px;
  padding: 8px;
  margin: 0;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
`;

/* ======= Nuevos componentes de layout/estilo ======= */
export const HeaderBar = styled.div`
  width: 100%;
  max-width: 1200px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 { margin: 0; }
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
  margin: 8px 0 12px;
`;

export const ControlsRow = styled.div`
  width: 100%;
  max-width: 1200px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;

export const FieldBlock = styled.div`
  label {
    display: block;
    font-size: 12px;
    margin-bottom: 4px;
    color: #6c757d;
  }
`;

export const RightInfo = styled.div`
  margin-left: auto;
  font-size: 12px;
  color: #6c757d;
`;

export const ScrollBox = styled.div`
  width: 100%;
  max-width: 1200px;
  max-height: 480px;
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
  gap: 12px;
  margin-top: 12px;
`;

export const StatCard = styled.div`
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 16px;
  background: #fff;

  .label { font-size: 12px; color: #6c757d; }
  .value { font-size: 28px; font-weight: 700; }
  .meta  { font-size: 12px; color: #6c757d; margin-top: 6px; }
`;

export const NoteCard = styled.div`
  border: ${({ $muted }) => ($muted ? '1px dashed #eee' : '1px solid #f4f4f4')};
  border-radius: 10px;
  padding: 16px;
  background: ${({ $muted }) => ($muted ? '#fafafa' : '#fff')};
  color: ${({ $muted }) => ($muted ? '#6c757d' : '#bbb')};

  .label { font-size: 12px; }
  .value { font-size: 20px; margin-top: 8px; }
  .meta  { font-size: 14px; margin-top: 8px; }
`;

export const FinanceList = styled.ol`
  margin-top: 8px;
  padding-left: 18px;
`;

export const FinanceItem = styled.li`
  margin-bottom: 6px;
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
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  gap: 8px;
  margin-bottom: 8px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const DocLink = styled.a`
  display: inline-block;
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  text-decoration: none;
  color: #0d6efd;
  pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
`;

export const CheckBox = styled.input`
  width: 18px;
  height: 18px;
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
  padding: 14px;
`;

export const PanelRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-top: 10px;
`;

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 90px;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
`;

export const SmallBtn = styled.button`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;

  &:hover { background: #f8f9fa; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: #f1f3f5;
  color: #343a40;

  &[data-variant='open'] { background: #fff3cd; color: #856404; }
  &[data-variant='reviewing'] { background: #d1ecf1; color: #0c5460; }
  &[data-variant='resolved'] { background: #d4edda; color: #155724; }
  &[data-variant='rejected'] { background: #f8d7da; color: #721c24; }
`;