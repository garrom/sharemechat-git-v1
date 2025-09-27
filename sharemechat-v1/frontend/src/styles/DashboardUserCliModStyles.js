import styled, { css } from 'styled-components';

const brand = { client: '#355C7D', model: '#B39DDB' };

export const Shell = styled.div`min-height:100vh; background:#f0f2f5; display:flex; flex-direction:column;`;
export const Navbar = styled.nav`
  ${({ $variant }) => css`background:${brand[$variant] || '#355C7D'};`}
  color:#fff; padding:14px 20px; display:flex; align-items:center; justify-content:space-between;
`;
export const NavbarRight = styled.div`display:flex; gap:10px; align-items:center;`;
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
