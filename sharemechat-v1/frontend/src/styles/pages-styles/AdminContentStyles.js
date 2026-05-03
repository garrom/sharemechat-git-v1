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
