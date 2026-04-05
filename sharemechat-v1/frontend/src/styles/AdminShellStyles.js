import styled from 'styled-components';

export const AdminShell = styled.div`
  --admin-bg: #f3f6fb;
  --admin-surface: #ffffff;
  --admin-surface-alt: #f8fafc;
  --admin-border: #d7deea;
  --admin-border-strong: #c0cad9;
  --admin-text: #162033;
  --admin-text-soft: #52607a;
  --admin-text-muted: #74819a;
  --admin-sidebar: #101826;
  --admin-sidebar-border: rgba(255, 255, 255, 0.08);
  --admin-sidebar-text: #dfe7f5;
  --admin-sidebar-muted: #8c9ab4;
  --admin-accent: #0f5bd6;
  --admin-accent-soft: #dce9ff;
  --admin-success-soft: #ddf7e5;
  --admin-warning-soft: #fff1d6;
  --admin-danger-soft: #ffe2e0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--admin-bg);
  color: var(--admin-text);

  @media (max-width: 1100px) {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  @media (max-width: 760px) {
    display: block;
  }
`;

export const AdminSidebar = styled.aside`
  position: sticky;
  top: 0;
  height: 100vh;
  max-height: 100vh;
  background:
    linear-gradient(180deg, rgba(15, 91, 214, 0.18) 0%, rgba(15, 24, 38, 0) 28%),
    var(--admin-sidebar);
  color: var(--admin-sidebar-text);
  border-right: 1px solid var(--admin-sidebar-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 16px 24px;
  gap: 14px;
  scrollbar-gutter: stable;

  @media (max-width: 760px) {
    position: static;
    height: auto;
    max-height: none;
    overflow: visible;
    padding: 16px;
  }
`;

export const SidebarBrand = styled.div`
  padding: 6px 8px 14px;
  border-bottom: 1px solid var(--admin-sidebar-border);

  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--admin-sidebar-muted);
    margin-bottom: 8px;
  }

  .title {
    font-size: 18px;
    font-weight: 700;
    color: #f8fbff;
  }

  .subtitle {
    margin-top: 6px;
    font-size: 12px;
    color: var(--admin-sidebar-muted);
    line-height: 1.45;
  }

  @media (max-width: 1100px) {
    padding-left: 6px;
    padding-right: 6px;

    .subtitle {
      display: none;
    }
  }
`;

export const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const SidebarSectionLabel = styled.div`
  padding: 0 10px 6px;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--admin-sidebar-muted);

  @media (max-width: 1100px) {
    display: none;
  }
`;

export const SidebarNavButton = styled.button`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  border: 1px solid ${({ $active }) => ($active ? 'rgba(220, 233, 255, 0.32)' : 'transparent')};
  border-radius: 12px;
  background: ${({ $active }) => ($active ? 'rgba(220, 233, 255, 0.12)' : 'transparent')};
  color: ${({ $active }) => ($active ? '#f8fbff' : 'var(--admin-sidebar-text)')};
  padding: 9px 10px;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;

  &:hover {
    background: rgba(220, 233, 255, 0.08);
    border-color: rgba(220, 233, 255, 0.18);
  }

  .title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
  }

  .meta {
    font-size: 11px;
    color: ${({ $active }) => ($active ? '#c7d9fb' : 'var(--admin-sidebar-muted)')};
    line-height: 1.35;
  }

  @media (max-width: 1100px) {
    align-items: center;
    justify-content: center;
    padding: 12px 8px;

    .meta {
      display: none;
    }

    .title {
      font-size: 12px;
      text-align: center;
    }
  }
`;

export const SidebarFooter = styled.div`
  margin-top: auto;
  padding: 14px 8px 14px;
  border-top: 1px solid var(--admin-sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 10px;

  .label {
    font-size: 11px;
    color: var(--admin-sidebar-muted);
  }

  .value {
    font-size: 13px;
    color: #f8fbff;
    font-weight: 600;
    line-height: 1.4;
  }

  @media (max-width: 1100px) {
    padding-left: 0;
    padding-right: 0;

    .label,
    .value {
      display: none;
    }
  }
`;

export const SidebarLogoutButton = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #f8fbff;
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

export const AdminMain = styled.main`
  min-width: 0;
  padding: 12px 18px 20px;

  @media (max-width: 760px) {
    padding: 16px;
  }
`;

export const AdminTopbar = styled.header`
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0 12px;
`;

export const TopbarTitleBlock = styled.div`
  min-width: 0;

  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--admin-text-muted);
    margin-bottom: 7px;
  }

  .title {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--admin-text);
  }

  .subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: var(--admin-text-soft);
    line-height: 1.45;
    max-width: 820px;
  }
`;

export const TopbarMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

export const MetaPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 11px;
  border: 1px solid var(--admin-border);
  border-radius: 999px;
  background: var(--admin-surface);
  color: var(--admin-text-soft);
  font-size: 12px;
  white-space: nowrap;

  strong {
    color: var(--admin-text);
  }
`;

export const PageSection = styled.section`
  margin-top: ${({ $compact }) => ($compact ? '8px' : '14px')};
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;

  .title {
    font-size: 15px;
    font-weight: 700;
    color: var(--admin-text);
  }

  .subtitle {
    margin-top: 3px;
    font-size: 12px;
    color: var(--admin-text-soft);
    line-height: 1.45;
    max-width: 760px;
  }
`;

export const SectionActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
`;

export const SurfaceCard = styled.div`
  border: 1px solid var(--admin-border);
  border-radius: 14px;
  background: ${({ $muted }) => ($muted ? 'var(--admin-surface-alt)' : 'var(--admin-surface)')};
  box-shadow: 0 10px 30px rgba(15, 24, 38, 0.04);
  padding: ${({ $dense }) => ($dense ? '12px' : '14px')};
`;

export const OverviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const OverviewSpan = styled.div`
  grid-column: span ${({ $span = 12 }) => $span};

  @media (max-width: 1180px) {
    grid-column: span ${({ $spanTablet = 6 }) => $spanTablet};
  }

  @media (max-width: 760px) {
    grid-column: span 1;
  }
`;

export const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
`;

export const MetricCard = styled(SurfaceCard)`
  padding: 12px;

  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--admin-text-muted);
  }

  .value {
    margin-top: 8px;
    font-size: 22px;
    font-weight: 700;
    color: var(--admin-text);
    line-height: 1.1;
  }

  .meta {
    margin-top: 8px;
    font-size: 11px;
    color: var(--admin-text-soft);
    line-height: 1.45;
  }
`;

export const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
`;

export const QuickActionButton = styled.button`
  width: 100%;
  text-align: left;
  border: 1px solid var(--admin-border);
  border-radius: 14px;
  background: var(--admin-surface);
  padding: 12px 13px 13px;
  cursor: pointer;
  transition: border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;

  &:hover {
    border-color: var(--admin-border-strong);
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(15, 24, 38, 0.06);
  }

  .title {
    font-size: 13px;
    font-weight: 700;
    color: var(--admin-text);
  }

  .meta {
    margin-top: 6px;
    font-size: 12px;
    color: var(--admin-text-soft);
    line-height: 1.45;
  }
`;

export const InlineKpiRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

export const InlineKpi = styled.div`
  min-width: 126px;
  padding: 9px 11px;
  border-radius: 12px;
  background: ${({ $tone = 'neutral' }) => {
    if ($tone === 'success') return 'var(--admin-success-soft)';
    if ($tone === 'warning') return 'var(--admin-warning-soft)';
    if ($tone === 'danger') return 'var(--admin-danger-soft)';
    return 'var(--admin-surface-alt)';
  }};
  border: 1px solid var(--admin-border);

  .label {
    font-size: 11px;
    color: var(--admin-text-muted);
  }

  .value {
    margin-top: 5px;
    font-size: 18px;
    font-weight: 700;
    color: var(--admin-text);
  }
`;

export const PlaceholderWrap = styled(SurfaceCard)`
  display: flex;
  flex-direction: column;
  gap: 10px;

  .title {
    font-size: 16px;
    font-weight: 700;
    color: var(--admin-text);
  }

  .body {
    font-size: 13px;
    line-height: 1.55;
    color: var(--admin-text-soft);
  }

  .note {
    font-size: 11px;
    line-height: 1.45;
    color: var(--admin-text-muted);
  }
`;
