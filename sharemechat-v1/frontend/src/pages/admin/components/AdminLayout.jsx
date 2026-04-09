import React from 'react';
import {
  AdminMain,
  AdminShell,
  AdminSidebar,
  AdminTopbar,
  MetaPill,
  SidebarBrand,
  SidebarFooter,
  SidebarLogoutButton,
  SidebarNavButton,
  SidebarSection,
  SidebarSectionLabel,
  TopbarActionButton,
  TopbarMeta,
  TopbarTitleBlock,
} from '../../../styles/AdminShellStyles';

const AdminLayout = ({
  title,
  subtitle,
  eyebrow = 'SharemeChat Backoffice',
  meta = [],
  sections = [],
  activeKey,
  onSelect,
  topbarActions = [],
  footerLabel,
  footerValue,
  onLogout,
  children,
}) => (
  <AdminShell>
    <AdminSidebar>
      <SidebarBrand>
        <div className="eyebrow">Internal Tooling</div>
        <div className="title">SharemeChat</div>
        <div className="subtitle">Backoffice operativo para soporte, control interno y operaciones.</div>
      </SidebarBrand>

      {sections.map((section) => (
        <SidebarSection key={section.label}>
          <SidebarSectionLabel>{section.label}</SidebarSectionLabel>
          {section.items.map((item) => (
            <SidebarNavButton
              key={item.key}
              type="button"
              $active={item.key === activeKey}
              onClick={() => onSelect(item.key)}
            >
              <span className="title">{item.label}</span>
              <span className="meta">{item.meta}</span>
            </SidebarNavButton>
          ))}
        </SidebarSection>
      ))}

      <SidebarFooter>
        <div className="label">{footerLabel}</div>
        <div className="value">{footerValue}</div>
        <SidebarLogoutButton type="button" onClick={onLogout}>
          Cerrar sesion
        </SidebarLogoutButton>
      </SidebarFooter>
    </AdminSidebar>

    <AdminMain>
      <AdminTopbar>
        <TopbarTitleBlock>
          <div className="eyebrow">{eyebrow}</div>
          <div className="title">{title}</div>
          {subtitle ? <div className="subtitle">{subtitle}</div> : null}
        </TopbarTitleBlock>

        <TopbarMeta>
          {topbarActions.map((action) => (
            <TopbarActionButton
              key={action.key || action.label}
              type="button"
              $active={Boolean(action.active)}
              onClick={action.onClick}
            >
              {action.label}
            </TopbarActionButton>
          ))}
          {meta.map((item) => (
            <MetaPill key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </MetaPill>
          ))}
        </TopbarMeta>
      </AdminTopbar>

      {children}
    </AdminMain>
  </AdminShell>
);

export default AdminLayout;
