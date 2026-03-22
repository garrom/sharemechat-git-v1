import styled from 'styled-components';
import { bp, colors, radius, space } from '../core/tokens';
import { inputBase, buttonBase } from '../core/mixins';
import {
  ProfileDangerOutlineButton,
  ProfilePrimaryButton,
  ProfileSecondaryButton,
} from '../ButtonStyles';

const surface = '#ffffff';
const surfaceMuted = '#f8fafb';
const pageBg = 'linear-gradient(180deg, #f9fafb 0%, #f3f5f7 100%)';
const border = '#e6e7ea';
const borderSoft = '#dde3ea';
const textMain = '#1f2933';
const textMuted = '#5b6470';
const accent = '#354556';
const accentHover = '#2d3a49';
const successBg = '#edf6ef';
const successBorder = '#bfd6c6';
const successText = '#476755';
const dangerBg = '#fbf1f1';
const dangerBorder = '#dbbcbc';
const dangerText = '#8f5b5b';
const cardShadow = '0 10px 30px rgba(17, 24, 39, 0.06)';

const profileButtonStyles = `
  min-height: 42px;
  box-shadow: none;
  letter-spacing: 0.05em;
  font-size: 0.76rem;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.05s ease;
`;

export const PageWrap = styled.div`
  max-width: 720px;
  margin: ${space.xl} auto;
  padding: 0 ${space.lg} calc(${space.xl} * 2);

  @media (max-width: ${bp.md}) {
    margin: ${space.lg} auto;
    padding: 0 ${space.md} ${space.xl};
  }
`;

export const Title = styled.h2`
  margin: 0 0 ${space.lg};
  font-weight: 700;
  color: ${textMain};
`;

export const Message = styled.p`
  margin: ${space.sm} 0;
  padding: 13px 15px;
  border-radius: 16px;
  font-size: 0.92rem;
  line-height: 1.58;
  background: ${({ type }) => (type === 'error' ? dangerBg : '#eef3f6')};
  border: 1px solid ${({ type }) => (type === 'error' ? '#e7c7c7' : '#d9e0e7')};
  color: ${({ type }) => (type === 'error' ? dangerText : '#475668')};

  ${({ $muted }) =>
    $muted &&
    `
      margin: 0;
      background: transparent;
      border: none;
      padding: 0;
      color: ${textMuted};
    `}
`;

export const Form = styled.form`
  display: grid;
  gap: ${space.md};
`;

export const FormRow = styled.div`
  display: grid;
  gap: ${space.xs};
`;

export const Label = styled.label`
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #66717d;
`;

export const Input = styled.input`
  ${inputBase}
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-height: 48px;
  background: ${surface};
  border: 1px solid ${borderSoft};
  color: ${textMain};
  border-radius: 14px;

  &::placeholder {
    color: #95a0ab;
  }

  &:focus {
    border-color: #bcc6d1;
    box-shadow: 0 0 0 3px rgba(53, 69, 86, 0.08);
  }

  &:read-only,
  &:disabled {
    background: #f6f8fa;
    border-color: #e1e6eb;
    color: #6d7783;
    cursor: default;
  }
`;

export const Textarea = styled.textarea`
  ${inputBase}
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  resize: vertical;
  min-height: 126px;
  background: ${surface};
  border: 1px solid ${borderSoft};
  color: ${textMain};
  border-radius: 16px;

  &::placeholder {
    color: #95a0ab;
  }

  &:focus {
    border-color: #bcc6d1;
    box-shadow: 0 0 0 3px rgba(53, 69, 86, 0.08);
  }
`;

export const ButtonPrimary = styled.button`
  ${buttonBase}
  background: ${accent};
  color: ${colors.white};

  &:hover {
    background: ${accentHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ButtonDangerOutline = styled.button`
  ${buttonBase}
  border: 1px solid ${dangerBorder};
  background: transparent;
  color: ${dangerText};

  &:hover {
    background: ${dangerBg};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ButtonRow = styled.div`
  display: flex;
  gap: ${space.sm};
  align-items: center;
  flex-wrap: wrap;
`;

export const FileInput = styled.input`
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`;

export const FileLabel = styled.label`
  ${buttonBase}
  border: 1px solid ${border};
  background: ${surface};

  &:hover {
    background: ${surfaceMuted};
  }
`;

export const FileNameWrapper = styled.div`
  margin-top: ${space.xs};
  font-size: 0.9rem;
  color: ${textMuted};
  word-break: break-all;

  a {
    color: #3f5a73;
    text-decoration: none;
    font-weight: 600;
  }

  a:hover {
    text-decoration: underline;
  }
`;

export const Hr = styled.hr`
  margin: ${space.xl} 0;
  border: 0;
  border-top: 1px solid ${border};
`;

export const SectionCard = styled.section`
  border: 1px solid ${border};
  border-radius: 22px;
  padding: ${space.lg};
  box-shadow: ${cardShadow};
  background: ${surface};
  color: ${textMain};
`;

export const SubSectionCard = styled.section`
  border-radius: 18px;
  padding: ${space.md};
  background: ${surfaceMuted};
  border: 1px solid ${border};
`;

export const SectionTitle = styled.h3`
  margin: 0 0 ${space.md};
  font-weight: 700;
  color: ${textMain};
`;

export const Photo = styled.img`
  max-width: 220px;
  width: 100%;
  height: auto;
  border-radius: 18px;
  display: block;
  background: #eef2f5;
`;

export const PhotoBlock = styled.div`
  margin-bottom: ${space.md};
`;

export const Video = styled.video`
  width: 100%;
  max-width: 100%;
  max-height: 320px;
  display: block;
  border-radius: 18px;
  background: #eef2f5;
  border: 1px solid ${border};
  margin-bottom: ${space.sm};
`;

export const Hint = styled.p`
  margin-top: ${space.sm};
  color: ${textMuted};
  font-size: 0.92rem;
  line-height: 1.66;
`;

export const BackButton = styled.button`
  ${buttonBase}
  border: 1px solid ${border};
  background: ${surface};
  color: ${textMain};
  margin-left: ${space.sm};

  &:hover {
    background: ${surfaceMuted};
  }

  @media (max-width: ${bp.md}) {
    margin-left: 0;
  }
`;

export const CenteredMain = styled.main`
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: ${space.lg} ${space.lg} calc(${space.xl} * 2);

  @media (max-width: ${bp.md}) {
    padding: ${space.md};
  }
`;

export const OnboardingCard = styled.section`
  width: 100%;
  max-width: 720px;
  border-radius: 24px;
  padding: ${space.lg};
  margin: 0 auto;
  background: ${surface};
  box-shadow: ${cardShadow};
  color: ${textMain};

  a {
    color: #3f5a73 !important;
  }

  a:visited {
    color: #3f5a73 !important;
  }
`;

export const ProfileMain = styled.main`
  flex: 1;
  width: min(1180px, calc(100% - 40px));
  margin: 24px auto 36px;
  padding: 28px;
  border-radius: 30px;
  background: ${pageBg};
  border: 1px solid ${border};
  box-shadow: 0 16px 42px rgba(17, 24, 39, 0.08);

  @media (max-width: ${bp.md}) {
    width: calc(100% - 20px);
    margin-top: 12px;
    padding: 18px;
    border-radius: 22px;
  }

  ${ProfilePrimaryButton} {
    ${profileButtonStyles}
    background: ${accent};
    border-color: ${accent};
    color: #fff;
  }

  ${ProfilePrimaryButton}:hover:not(:disabled) {
    background: ${accentHover};
    border-color: ${accentHover};
    color: #fff;
  }

  ${ProfileSecondaryButton} {
    ${profileButtonStyles}
    background: ${surface};
    border-color: #cfd6dd;
    color: #304050;
  }

  ${ProfileSecondaryButton}:hover:not(:disabled) {
    background: #f3f6f8;
    border-color: #bcc6d1;
    color: ${textMain};
  }

  ${ProfileDangerOutlineButton} {
    ${profileButtonStyles}
    background: transparent;
    border-color: ${dangerBorder};
    color: ${dangerText};
  }

  ${ProfileDangerOutlineButton}:hover:not(:disabled) {
    background: ${dangerBg};
    border-color: #cfaaaa;
    color: #844f4f;
  }
`;

export const ProfileHeader = styled.section`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  margin-bottom: 18px;
  padding: 24px;
  border-radius: 26px;
  background: ${surface};
  border: 1px solid ${border};
  box-shadow: ${cardShadow};

  @media (max-width: ${bp.md}) {
    grid-template-columns: minmax(0, 1fr);
    padding: 18px;
  }
`;

export const ProfileHeaderAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: ${bp.md}) {
    justify-content: flex-start;
  }
`;

export const Avatar = styled.div`
  width: 88px;
  height: 88px;
  border-radius: 999px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #eef2f5 0%, #dde4eb 100%);
  border: 1px solid #d9e0e7;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
`;

export const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

export const ProfileHeaderInfo = styled.div`
  min-width: 0;
`;

export const ProfileHeaderTitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
`;

export const ProfileHeaderName = styled.h1`
  font-size: 1.45rem;
  margin: 0;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: ${textMain};
`;

export const ChipRole = styled.span`
  border-radius: 999px;
  padding: 6px 11px;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid #d8dee5;
  background: ${surfaceMuted};
  color: #51606f;
`;

export const ProfileHeaderSubtitle = styled.p`
  margin: 0 0 10px;
  font-size: 0.95rem;
  line-height: 1.65;
  color: ${textMuted};
`;

export const ProfileHeaderMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.82rem;
`;

export const MetaItem = styled.span`
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  min-width: 140px;
  border-radius: 16px;
  border: 1px solid ${border};
  background: ${surfaceMuted};
`;

export const MetaLabel = styled.span`
  color: #6b7683;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.68rem;
  font-weight: 700;
`;

export const MetaValue = styled.span`
  color: #364452;
  font-weight: 600;
`;

export const MetaValueOk = styled(MetaValue)`
  color: ${successText};
`;

export const ProfileGrid = styled.section`
  margin-top: ${space.lg};
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 18px;
  align-items: flex-start;

  @media (max-width: ${bp.md}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const ProfileColMain = styled.div`
  min-width: 0;
  display: grid;
  gap: 16px;
`;

export const ProfileColSide = styled.div`
  min-width: 0;
  display: grid;
  gap: 16px;
`;

export const ProfileCard = styled.section`
  background: ${surface};
  border-radius: 24px;
  border: 1px solid ${border};
  box-shadow: ${cardShadow};
  padding: 22px;
  color: ${textMain};

  @media (max-width: ${bp.md}) {
    border-radius: 18px;
    padding: 18px;
  }
`;

export const MediaCard = styled(ProfileCard)`
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%);
`;

export const SecurityCard = styled(ProfileCard)`
  background: linear-gradient(180deg, #ffffff 0%, #fafbfd 100%);
`;

export const ContractNoticeCard = styled(ProfileCard)`
  border-color: #e2d4bf;
  background: linear-gradient(180deg, #fffdf9 0%, #fffaf2 100%);
`;

export const CardHeader = styled.header`
  margin-bottom: 16px;
`;

export const CardTitle = styled.h2`
  margin: 0 0 6px;
  font-size: 1.06rem;
  line-height: 1.25;
  color: ${textMain};
`;

export const CardSubtitle = styled.p`
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.62;
  color: ${textMuted};
`;

export const CardBody = styled.div`
  margin-top: 4px;
  display: grid;
  gap: 14px;
`;

export const CardFooter = styled.footer`
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
`;

export const FormGridNew = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  width: 100%;
`;

export const FormFieldNew = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const PhotoPreview = styled.div`
  width: 100%;
  max-width: 240px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${border};
  background: linear-gradient(180deg, #eef2f5 0%, #dde4eb 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
`;

export const PhotoImg = styled.img`
  width: 100%;
  height: auto;
  object-fit: cover;
  display: block;
`;

export const PhotoEmpty = styled.p`
  margin: 0;
  padding: 18px 16px;
  border-radius: 16px;
  background: ${surfaceMuted};
  border: 1px dashed #d5dce4;
  color: #6d7784;
  font-size: 0.92rem;
  line-height: 1.55;
`;

export const PhotoActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
  align-items: center;
`;

export const InlineActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
`;

export const SecurityActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 4px;
`;
