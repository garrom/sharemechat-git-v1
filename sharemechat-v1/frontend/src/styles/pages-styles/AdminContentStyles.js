import styled from 'styled-components';

export const EditorLayout = styled.div`
  display: grid;
  gap: 16px;
`;

export const EditorRow = styled.div`
  display: grid;
  grid-template-columns: ${({ $cols = 2 }) => `repeat(${$cols}, 1fr)`};
  gap: 12px;
  margin-bottom: 12px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

export const LabelText = styled.label`
  display: block;
  font-size: 12px;
  color: #475569;
  margin-bottom: 4px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

export const MarkdownArea = styled.textarea`
  width: 100%;
  min-height: 360px;
  padding: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  resize: vertical;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
`;

export const BriefArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 8px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  resize: vertical;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
`;

export const MetaCard = styled.div`
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
`;

export const StatusInline = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
  color: #475569;
`;

export const OkBanner = styled.div`
  padding: 10px 12px;
  border-radius: 10px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 13px;
`;

export const HashCode = styled.code`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #6b7280;
  word-break: break-all;
`;

export const DangerButton = styled.button`
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  background: #fee2e2;
  color: #991b1b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &:hover:not(:disabled) {
    background: #fecaca;
  }
`;

export const ToolbarRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 10px;
`;

export const HelperText = styled.span`
  font-size: 12px;
  color: #64748b;
`;

export const TransitionBar = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
`;

export const TransitionLabel = styled.span`
  font-size: 12px;
  color: #475569;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-right: 4px;
`;

export const TransitionButton = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid ${({ $tone }) =>
    $tone === 'danger' ? '#fecaca' : $tone === 'success' ? '#bbf7d0' : '#cbd5e1'};
  background: ${({ $tone }) =>
    $tone === 'danger' ? '#fee2e2' : $tone === 'success' ? '#dcfce7' : '#ffffff'};
  color: ${({ $tone }) =>
    $tone === 'danger' ? '#991b1b' : $tone === 'success' ? '#166534' : '#1f2937'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &:hover:not(:disabled) {
    filter: brightness(0.97);
  }
`;

export const HistorySection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

export const HistoryColumn = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  max-height: 480px;
  overflow-y: auto;
`;

export const HistoryTitle = styled.h4`
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #1f2937;
`;

export const HistoryRow = styled.div`
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 12px;
  color: #334155;
  display: grid;
  gap: 4px;

  &:last-child {
    border-bottom: none;
  }
`;

export const HistoryRowMeta = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  color: #64748b;
  font-size: 11px;
`;

export const EventTypePill = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.02em;
`;

export const VersionLink = styled.button`
  background: none;
  border: none;
  color: #4338ca;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;

  &:hover { color: #3730a3; }
`;

export const ReadOnlyNotice = styled.div`
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 12px;
`;

export const AIPanelGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

export const AIPanelColumn = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
`;

export const AIRunTypeBar = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 12px;
`;

export const AIRunTypeButton = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;

  &:disabled { opacity: 0.55; cursor: default; }
  &:hover:not(:disabled) { background: #e0e7ff; }
`;

export const PromptPre = styled.pre`
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 360px;
  overflow-y: auto;
  margin: 0 0 8px 0;
`;

export const RawOutputArea = styled.textarea`
  width: 100%;
  min-height: 220px;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  resize: vertical;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
`;

export const RunListTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 6px 8px;
    border-bottom: 1px solid #f1f5f9;
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: 600;
    color: #475569;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tr.selected td {
    background: #eef2ff;
  }
`;

export const RunStatusBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.02em;
  background: ${({ $status }) =>
    $status === 'VALIDATED' ? '#dcfce7'
    : $status === 'REJECTED' ? '#fee2e2'
    : $status === 'FAILED' ? '#fde68a'
    : '#e0e7ff'};
  color: ${({ $status }) =>
    $status === 'VALIDATED' ? '#166534'
    : $status === 'REJECTED' ? '#991b1b'
    : $status === 'FAILED' ? '#92400e'
    : '#3730a3'};
`;

export const ValidationErrorsBox = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: #991b1b;
  display: grid;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
`;

export const InlineRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

// ===== Fase 4A hardening — preview modal + disclosure runs avanzados =====

export const PreviewOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px;
  overflow-y: auto;
`;

export const PreviewSheet = styled.div`
  width: 100%;
  max-width: 920px;
  background: #f8fafc;
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35);
  padding: 24px;
  position: relative;
`;

export const PreviewHeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
`;

export const PreviewBadge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: #fef3c7;
  color: #92400e;
`;

export const AdvancedToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 8px;
`;

export const AdvancedToggleButton = styled.button`
  background: none;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;

  &:hover { background: #f1f5f9; }
`;

export const AdvancedRunSection = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 10px;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  margin-bottom: 12px;
`;
