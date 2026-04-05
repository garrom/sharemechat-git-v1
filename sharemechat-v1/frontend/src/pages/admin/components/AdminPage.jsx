import React from 'react';
import {
  PageSection,
  SectionActions,
  SectionHeader,
  SurfaceCard,
} from '../../../styles/AdminShellStyles';

const AdminPage = ({
  title,
  subtitle,
  actions = null,
  children,
  dense = false,
  muted = false,
}) => (
  <PageSection>
    {(title || subtitle || actions) ? (
      <SectionHeader>
        <div>
          {title ? <div className="title">{title}</div> : null}
          {subtitle ? <div className="subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <SectionActions>{actions}</SectionActions> : null}
      </SectionHeader>
    ) : null}

    <SurfaceCard $dense={dense} $muted={muted}>
      {children}
    </SurfaceCard>
  </PageSection>
);

export default AdminPage;
