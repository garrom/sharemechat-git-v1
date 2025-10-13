import styled from 'styled-components';

const brand = { client: '#355C7D', model: '#B39DDB' };

export const Shell = styled.div`min-height:100vh; background:#f0f2f5; display:flex; flex-direction:column;`;

export const Navbar = styled.nav`
  background:#1f2328; /* gris oscuro unificado */
  color:#fff;
  padding:14px 20px;
  display:flex;
  align-items:center;
  justify-content:space-between;
`;

export const NavbarRight = styled.div`display:flex; gap:10px; align-items:center;`;

/* Marca con logo*/
export const StyledBrand = styled.a`
  /* Caja fija solo para el logo */
  display: inline-block;
  width: 190px;          /* <- ajusta si tu SVG es más ancho/estrecho */
  height: 40px;          /* <- tamaño visual del logo en el navbar */
  background: url('/img/SharemeChat.svg') no-repeat left center / contain;

  /* Oculta cualquier texto dentro para que no se superponga */
  text-indent: -9999px;
  overflow: hidden;
  line-height: 0;
  color: transparent;

  &:hover { opacity: .95; }
  &:focus-visible {
    outline: 2px solid rgba(255,255,255,.45);
    outline-offset: 2px;
  }

  /* Responsivo */
  @media (max-width: 768px) {
    width: 160px;
    height: 34px;
  }
  @media (max-width: 480px) {
    width: 140px;
    height: 30px;
  }
`;


export const LogoutBtn = styled.button`
  background:#dc3545; color:#fff; border:0; border-radius:8px; padding:8px 12px; font-weight:600; cursor:pointer;
  &:hover{background:#c82333;}
`;

export const Main = styled.main`
  flex:1; display:flex; align-items:center; justify-content:center; padding:16px;
`;
export const Card = styled.section`
  width:100%; max-width:720px; background:#fff; border:1px solid #eee; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.05);
`;

export const Row = styled.div`display:flex; gap:10px; align-items:center; flex-wrap:wrap;`;
export const Input = styled.input`
  border:1px solid #ced4da; border-radius:8px; padding:10px 12px; font-size:16px; width:140px;
`;
export const PrimaryBtn = styled.button`
  background:#28a745; color:#fff; border:0; border-radius:8px; padding:10px 14px; font-weight:600; cursor:pointer;
  &:hover{background:#218838;} &:disabled{opacity:.65; cursor:not-allowed;}
`;

export const Muted = styled.p`margin:8px 0 0; color:#6c757d;`;
export const OkMsg = styled.p`margin:12px 0 0; color:#198754; font-weight:600;`;
export const ErrMsg = styled.p`margin:12px 0 0; color:#dc3545; font-weight:600;`;
