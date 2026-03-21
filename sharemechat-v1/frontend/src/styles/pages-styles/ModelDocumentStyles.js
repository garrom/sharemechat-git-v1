import styled from 'styled-components';
import {
  NavButton,
  ProfileDangerOutlineButton,
  ProfilePrimaryButton,
  ProfileSecondaryButton,
} from '../ButtonStyles';
import { StyledBrand } from '../NavbarStyles';

export const DocumentsShell = styled.div`
  min-height: 100vh;
  background: linear-gradient(180deg, #f9fafb 0%, #f3f5f7 100%);
  color: #1f2933;
`;

export const DocumentsTopbar = styled.header`
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
  background: rgba(247, 248, 250, 0.92);
  border-bottom: 1px solid rgba(214, 219, 225, 0.92);
`;

export const DocumentsTopbarInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
  min-height: 72px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  @media (max-width: 768px) {
    min-height: 64px;
    padding: 0 14px;
  }
`;

export const DocumentsBrand = styled(StyledBrand)`
  filter: invert(1) brightness(0.14) saturate(0.5);
`;

export const DocumentsTopbarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

export const DocumentsUserLabel = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #d8dde3;
  background: #ffffff;
  color: #44515f;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1;
`;

export const DocumentsBackButton = styled(NavButton)`
  min-height: 40px;
  padding-inline: 16px;
  border-color: #c8d0d9;
  background: #ffffff;
  color: #22303c;
  box-shadow: none;

  &:hover:not(:disabled) {
    background: #eef2f5;
    color: #111827;
    border-color: #bcc6d1;
  }
`;

export const DocumentsPage = styled.main`
  flex: 1;
  max-width: 960px;
  margin: 28px auto 44px;
  padding: 0 20px 32px;
  width: 100%;
  box-sizing: border-box;

  @media (max-width: 768px) {
    margin: 20px auto 28px;
    padding: 0 14px 18px;
  }
`;

export const DocumentsStack = styled.section`
  display: grid;
  gap: 20px;
`;

const cardBase = `
  background: #ffffff;
  border: 1px solid #e6e7ea;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.06);
  padding: 26px;

  @media (max-width: 768px) {
    border-radius: 18px;
    padding: 18px;
  }
`;

export const DocumentCard = styled.section`
  ${cardBase}
`;

export const DocumentOverviewCard = styled(DocumentCard)`
  padding: 30px;
  box-shadow: 0 14px 36px rgba(17, 24, 39, 0.07);

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

export const DocumentCardSoft = styled(DocumentCard)`
  background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
`;

export const CardHeader = styled.header`
  margin-bottom: 18px;
`;

export const CardHeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

export const CardTitle = styled.h2`
  margin: 0;
  font-size: 1.08rem;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: #1f2933;
`;

export const CardSubtitle = styled.p`
  margin: 0;
  max-width: 720px;
  font-size: 0.94rem;
  line-height: 1.65;
  color: #5b6470;
`;

export const OverviewIntro = styled.div`
  display: grid;
  gap: 6px;
`;

export const CardBody = styled.div`
  display: grid;
  gap: 16px;
`;

export const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

export const SummaryItem = styled.div`
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid #e6e9ed;
  background: #f8fafb;
`;

export const SummaryItemLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7683;
`;

export const SummaryItemValue = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

export const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

export const SummaryLabel = styled.span`
  font-size: 0.96rem;
  color: #324150;
  line-height: 1.5;
`;

export const SummaryCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #edf2f5;
  border: 1px solid #d7dee6;
  color: #324150;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

export const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid
    ${({ $status }) =>
      $status === 'APPROVED'
        ? '#bfd6c6'
        : $status === 'REJECTED'
        ? '#e3c1c1'
        : '#d3d9df'};
  background: ${({ $status }) =>
    $status === 'APPROVED'
      ? '#edf6ef'
      : $status === 'REJECTED'
      ? '#f9eeee'
      : '#f3f5f7'};
  color: ${({ $status }) =>
    $status === 'APPROVED'
      ? '#41634c'
      : $status === 'REJECTED'
      ? '#8b4d4d'
      : '#5f6a76'};
`;

export const UploadBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  background: ${({ $uploaded }) => ($uploaded ? '#edf6ef' : '#f3f5f7')};
  border: 1px solid ${({ $uploaded }) => ($uploaded ? '#bfd6c6' : '#d7dee6')};
  color: ${({ $uploaded }) => ($uploaded ? '#476755' : '#687480')};
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: currentColor;
    opacity: ${({ $uploaded }) => ($uploaded ? 1 : 0.55)};
  }
`;

export const Message = styled.p`
  margin: 0;
  padding: 13px 15px;
  border-radius: 16px;
  font-size: 0.92rem;
  line-height: 1.6;
  background: ${({ type }) =>
    type === 'error'
      ? '#fbf1f1'
      : '#eef6f0'};
  border: 1px solid
    ${({ type }) =>
      type === 'error'
        ? '#e7c7c7'
        : '#c8dbc9'};
  color: ${({ type }) => (type === 'error' ? '#8b4d4d' : '#476755')};
`;

export const Hint = styled.p`
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.68;
  color: #5b6470;
`;

export const FileInput = styled.input`
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`;

export const FileNameWrapper = styled.div`
  font-size: 0.9rem;
  color: #506070;
  word-break: break-word;

  a {
    color: #3f5a73;
    text-decoration: none;
    font-weight: 600;
  }

  a:hover {
    text-decoration: underline;
  }
`;

export const SelectedFileTag = styled.div`
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  max-width: 100%;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #d9dee5;
  background: #f8fafb;
  color: #4c5a69;
  font-size: 0.86rem;
  font-weight: 600;
  word-break: break-word;
`;

export const PreviewPanel = styled.div`
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: #f8fafb;
  border: 1px solid #e5e8ec;
`;

export const PhotoPreview = styled.div`
  width: 100%;
  max-width: 280px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #dce2e8;
  background: linear-gradient(180deg, #e8edf2 0%, #d7dee6 100%);
`;

export const PhotoImg = styled.img`
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
`;

export const PhotoEmpty = styled.div`
  padding: 20px 16px;
  border-radius: 16px;
  background: #f8fafb;
  border: 1px dashed #d5dce4;
  color: #6d7784;
  font-size: 0.92rem;
  line-height: 1.55;
`;

export const LinkPreviewBox = styled.div`
  padding: 18px;
  border-radius: 18px;
  background: #f8fafb;
  border: 1px solid #e5e8ec;
`;

export const PhotoActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
`;

const buttonBase = `
  min-height: 42px;
  box-shadow: none;
  letter-spacing: 0.05em;
  font-size: 0.76rem;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.05s ease;
`;

export const DocumentPrimaryButton = styled(ProfilePrimaryButton)`
  ${buttonBase}
  background: #354556;
  border-color: #354556;
  color: #ffffff;

  &:hover:not(:disabled) {
    background: #2d3a49;
    border-color: #2d3a49;
    color: #ffffff;
  }
`;

export const DocumentSecondaryButton = styled(ProfileSecondaryButton)`
  ${buttonBase}
  background: #ffffff;
  border-color: #cfd6dd;
  color: #304050;

  &:hover:not(:disabled) {
    background: #f3f6f8;
    border-color: #bcc6d1;
    color: #1f2933;
  }
`;

export const DocumentDangerButton = styled(ProfileDangerOutlineButton)`
  ${buttonBase}
  background: transparent;
  border-color: #dbbcbc;
  color: #8f5b5b;

  &:hover:not(:disabled) {
    background: #fbf1f1;
    border-color: #cfaaaa;
    color: #844f4f;
  }
`;

export const WorkflowList = styled.div`
  display: grid;
  gap: 12px;
`;

export const WorkflowStep = styled.div`
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid #e6e9ed;
  background: #f8fafb;
`;

export const WorkflowStepTitle = styled.span`
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #687380;
`;

export const WorkflowStepBody = styled.span`
  font-size: 0.92rem;
  line-height: 1.62;
  color: #374553;
`;
