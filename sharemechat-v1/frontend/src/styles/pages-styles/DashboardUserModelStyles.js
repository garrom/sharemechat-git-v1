import styled from 'styled-components';
import { ProfilePrimaryButton, ProfileSecondaryButton } from '../ButtonStyles';

export const DashboardUserModelShell = styled.div`
  flex: 1;
  overflow: auto;
  background: linear-gradient(180deg, #f9fafb 0%, #f3f5f7 100%);
`;

export const DashboardUserModelPage = styled.main`
  max-width: 980px;
  margin: 0 auto;
  padding: 28px 20px 40px;

  @media (max-width: 768px) {
    padding: 18px 14px calc(var(--bottom-nav-height) + 18px);
  }
`;

export const DashboardUserModelStack = styled.div`
  display: grid;
  gap: 20px;
`;

export const DashboardHeroCard = styled.section`
  background: #ffffff;
  border: 1px solid #e6e7ea;
  border-radius: 28px;
  box-shadow: 0 12px 34px rgba(17, 24, 39, 0.07);
  padding: 30px;

  @media (max-width: 768px) {
    border-radius: 20px;
    padding: 20px;
  }
`;

export const DashboardHeroKicker = styled.div`
  margin-bottom: 10px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #6b7683;
`;

export const DashboardHeroTitle = styled.h1`
  margin: 0 0 10px;
  font-size: clamp(1.7rem, 3vw, 2.4rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #1f2933;
`;

export const DashboardHeroLead = styled.p`
  margin: 0;
  max-width: 760px;
  font-size: 0.98rem;
  line-height: 1.72;
  color: #5b6470;
`;

export const DashboardStatusRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

export const DashboardStatusCard = styled.div`
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid #e6e9ed;
  background: #f8fafb;
`;

export const DashboardStatusLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7683;
`;

export const DashboardStatusValue = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

export const DashboardStatusText = styled.span`
  font-size: 0.95rem;
  line-height: 1.5;
  color: #364452;
`;

export const DashboardStatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 0.75rem;
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

export const DashboardGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const DashboardPanel = styled.section`
  background: #ffffff;
  border: 1px solid #e6e7ea;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.06);
  padding: 24px;

  @media (max-width: 768px) {
    border-radius: 18px;
    padding: 18px;
  }
`;

export const DashboardPanelHeader = styled.header`
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
`;

export const DashboardPanelEyebrow = styled.span`
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7683;
`;

export const DashboardPanelTitle = styled.h2`
  margin: 0;
  font-size: 1.08rem;
  line-height: 1.28;
  color: #1f2933;
`;

export const DashboardPanelSubtitle = styled.p`
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.66;
  color: #5b6470;
`;

export const DashboardPanelBody = styled.div`
  display: grid;
  gap: 14px;
`;

export const DashboardHint = styled.p`
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.68;
  color: #5b6470;
`;

export const DashboardMessage = styled.div`
  padding: 13px 15px;
  border-radius: 16px;
  font-size: 0.92rem;
  line-height: 1.6;
  background: ${({ $type }) =>
    $type === 'error'
      ? '#fbf1f1'
      : '#eef3f6'};
  border: 1px solid
    ${({ $type }) =>
      $type === 'error'
        ? '#e7c7c7'
        : '#d9e0e7'};
  color: ${({ $type }) => ($type === 'error' ? '#8b4d4d' : '#475668')};
`;

export const DashboardInlineNotice = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid #ead7a6;
  background: linear-gradient(180deg, #fff7dd 0%, #fff2c4 100%);
  color: #6f5410;

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

export const DashboardInlineNoticeText = styled.p`
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: inherit;
`;

export const DashboardLinkBox = styled.div`
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid #e6e9ed;
  background: #f8fafb;

  a {
    color: #3f5a73;
    text-decoration: none;
    font-weight: 700;
  }

  a:hover {
    text-decoration: underline;
  }
`;

export const DashboardCheckboxRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid #e6e9ed;
  background: #f8fafb;
  color: #324150;
  line-height: 1.6;

  input {
    margin-top: 2px;
    accent-color: #4f6276;
  }
`;

export const DashboardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
`;

const buttonBase = `
  min-height: 42px;
  box-shadow: none;
  letter-spacing: 0.05em;
  font-size: 0.76rem;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.05s ease;
`;

export const DashboardPrimaryButton = styled(ProfilePrimaryButton)`
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

export const DashboardSecondaryButton = styled(ProfileSecondaryButton)`
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

export const DashboardFooterCard = styled(DashboardPanel)`
  background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
`;

export const DashboardFooterList = styled.div`
  display: grid;
  gap: 12px;
`;

export const DashboardFooterItem = styled.div`
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid #e6e9ed;
  background: #f8fafb;
`;

export const DashboardFooterItemTitle = styled.span`
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #687380;
`;

export const DashboardFooterItemBody = styled.span`
  font-size: 0.92rem;
  line-height: 1.62;
  color: #374553;
`;
