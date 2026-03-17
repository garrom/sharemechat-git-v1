import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import {
  StyledNavbar,
  StyledBrand,
  HamburgerButton,
} from '../../styles/NavbarStyles';

const NavbarBase = ({
  onBrandClick,
  brandAriaLabel = 'SharemeChat',
  desktopLeft = null,
  desktopRight = null,
  mobileMenu = null,
  mobileBottomNav = null,
  mobileMenuButtonLabel,
  mobileMenuButtonTitle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleBrandClick = (e) => {
    closeMenu();
    if (onBrandClick) onBrandClick(e);
  };

  return (
    <>
      <StyledNavbar>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <StyledBrand
            href="#"
            aria-label={brandAriaLabel}
            onClick={handleBrandClick}
          />
          {desktopLeft}
        </div>

        {desktopRight}

        <HamburgerButton
          type="button"
          onClick={toggleMenu}
          aria-label={mobileMenuButtonLabel}
          title={mobileMenuButtonTitle}
        >
          <FontAwesomeIcon icon={faBars} />
        </HamburgerButton>

        {mobileMenu ? mobileMenu({ menuOpen, closeMenu }) : null}
      </StyledNavbar>

      {mobileBottomNav}
    </>
  );
};

export default NavbarBase;