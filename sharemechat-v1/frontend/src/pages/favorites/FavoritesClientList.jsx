import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faTrash, faBan,faUnlock } from '@fortawesome/free-solid-svg-icons';

import {
  List,
  StateRow,
  ItemCard,
  Avatar,
  Info,
  Name,
  Badges,
  Badge,
  DotWrap,
  StatusDot,
  FavMenuTrigger,
  FavMenu,
  FavMenuItem,
  FavMenuIcon,
  FavMenuDivider,
} from '../../styles/pages-styles/FavoritesStyles';

import StatusBadge from '../../components/StatusBadge';
import { useAppModals } from '../../components/useAppModals';

function FavListItem({ user, avatarUrl, onSelect, onOpenMenu, selected = false, hasUnread = false, menuOpen = false }) {
  const placeholder = '/img/avatarChica.png';
  const [imgSrc, setImgSrc] = useState(placeholder);

  useEffect(() => { if (avatarUrl && typeof avatarUrl === 'string') setImgSrc(avatarUrl); }, [avatarUrl]);

  const invited = String(user?.invited || '').trim().toLowerCase();
  const presence = String(user?.presence || 'offline').toLowerCase();
  const isBlocked = !!user?.blocked;
  const blockedByMe = !!user?.blockedByMe;
  const blockedByOther = !!user?.blockedByOther;

  // FIX #1: si está bloqueado PERO lo he bloqueado yo, el desplegable debe seguir funcionando (para "Desbloquear")
  const isMenuDisabled = invited === 'pending' || invited === 'sent' || (isBlocked && !blockedByMe);

  return (
    <ItemCard
      $clickable={!isBlocked}
      data-fav-card="true"
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected ? 'true' : 'false'}
      data-disabled={isBlocked ? 'true' : 'false'}
      onClick={() => { if (isBlocked) return; onSelect?.(user); }}
      style={isBlocked ? { opacity: 0.55, filter: 'grayscale(0.25)' } : undefined}
      title={isBlocked ? (blockedByMe ? 'Usuario bloqueado (lo has bloqueado tú)' : (blockedByOther ? 'Usuario bloqueado' : 'Usuario bloqueado')) : undefined}
    >
      <DotWrap>
        <Avatar src={imgSrc} alt="" $size={28} onError={(e) => { e.currentTarget.src = '/img/avatarChica.png'; }} />
        <StatusDot className={presence === 'busy' ? 'busy' : presence === 'online' ? 'online' : 'offline'} aria-label={presence} />
      </DotWrap>

      <Info>
        <Name>{user?.nickname || `Usuario #${user?.id}`}</Name>
      </Info>

      <Badges>
        {!isBlocked && invited !== 'accepted' && <StatusBadge value={invited} title={invited === 'sent' ? 'enviado' : invited} size={16} />}
      </Badges>

      {hasUnread && !isBlocked && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#0d6efd', marginRight: 6 }} aria-label="Tienes mensajes sin leer" title="Tienes mensajes sin leer" />}

      <FavMenuTrigger
        type="button"
        data-open={menuOpen ? 'true' : 'false'}
        aria-label="Más opciones"
        title={isMenuDisabled ? (blockedByOther ? 'Acciones no disponibles' : 'Acciones no disponibles') : 'Más opciones'}
        disabled={isMenuDisabled}
        onClick={(e) => {
          e.stopPropagation();
          if (isMenuDisabled) return;
          const cardEl = e.currentTarget.closest('[data-fav-card]');
          const rect = cardEl ? cardEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
          onOpenMenu?.(user, rect);
        }}
        style={isMenuDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      >
        <FontAwesomeIcon icon={faChevronDown} />
      </FavMenuTrigger>
    </ItemCard>
  );
}

export default function FavoritesClientList({ onSelect, reloadTrigger = 0, selectedId = null }) {
  const [items, setItems] = useState([]);
  const [avatarMap, setAvatarMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [menu, setMenu] = useState({ open: false, user: null, x: 0, y: 0 });
  const [blockedMap, setBlockedMap] = useState({});

  const token = localStorage.getItem('token');
  const { alert, confirm, openBlockReasonModal,openRemoveFavoriteConfirm } = useAppModals();
  const menuWidthDesktop = 220;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const closeMenu = useCallback(() => { setMenu({ open: false, user: null, x: 0, y: 0 }); }, []);

  useEffect(() => {
    const close = () => closeMenu();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [closeMenu]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMenu]);

  const openMenuFromRect = useCallback((user, rect) => {
    if (menu.open && Number(menu.user?.id) === Number(user?.id)) {
      closeMenu();
      return;
    }

    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const width = Math.min(menuWidthDesktop, vw - 16);

    let x = rect.left + rect.width / 2 - width / 2;
    x = clamp(x, 8, vw - width - 8);

    let y = rect.bottom + 6;
    const maxY = vh - 8;
    if (y > maxY) y = maxY;

    setMenu({ open: true, user, x, y });
  }, [menu.open, menu.user?.id, closeMenu]);

  const handleUnblock = useCallback(async (user) => {
    if (!token) { await alert({ title:'Sesión', message:'No autenticado', variant:'warning', size:'sm' }); return; }
    if (!user?.id) return;

    const displayName = user?.nickname || `Usuario #${user.id}`;
    const ok = await confirm({ title:'Desbloquear', message:`¿Quieres desbloquear a ${displayName}?`, okText:'Desbloquear', cancelText:'Cancelar', variant:'confirm', size:'sm', danger:false });
    if (!ok) return;

    try {
      const res = await fetch(`/api/blocks/${user.id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

      setBlockedMap((prev) => { const next = { ...(prev || {}) }; delete next[user.id]; return next; });
      setItems((prev) => (prev || []).map((i) => (Number(i.id) === Number(user.id) ? { ...i, blocked:false, blockedByMe:false, blockedByOther:false } : i)));

      await alert({ title:'Desbloquear', message:'Usuario desbloqueado.', variant:'success', size:'sm' });
    } catch (e) {
      await alert({ title:'Desbloquear', message: e?.message || 'No se pudo desbloquear.', variant:'danger', size:'sm' });
    }
  }, [token, alert, confirm]);


  // === 1) Cargar MIS bloqueos (bloqueos donde yo soy el blocker)
  useEffect(() => {
    let ignore = false;

    const loadBlocks = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/blocks', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const data = await res.json();
        if (ignore) return;

        const map = {};
        (data || []).forEach((b) => {
          const id = Number(b?.blockedUserId ?? b?.blocked_user_id ?? b?.blockedUser ?? 0);
          if (id) map[id] = true;
        });
        setBlockedMap(map);
      } catch (e) {
        console.warn('[blocks] load error:', e?.message);
        if (!ignore) setBlockedMap({});
      }
    };

    loadBlocks();
    return () => { ignore = true; };
  }, [token, reloadTrigger]);

  // === 2) Cargar favoritos + presencia
  // FIX #2: diferenciamos "blockedByMe" vs "blockedByOther"
  // - blockedByMe: sale de /api/blocks
  // - blockedByOther: lo deducimos cuando meta trae blocked=true pero blockedMap no lo contiene
  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!token) return;
      setLoading(true);

      try {
        const res = await fetch('/api/favorites/models/meta', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

        const data = await res.json();

        if (!ignore) {
          const mapped = (data || []).map((d) => {
            const u = d?.user || {};
            const id = u?.id;
            const blockedByMe = !!blockedMap?.[id];
            const blockedFromBackend = !!d?.blocked;
            const blocked = blockedFromBackend || blockedByMe;
            const blockedByOther = blocked && !blockedByMe;
            return { ...u, invited: d?.invited, status: d?.status, presence: d?.presence || 'offline', blocked, blockedByMe, blockedByOther };
          });

          setItems(mapped.filter((item) => String(item?.invited || '').toLowerCase() !== 'rejected'));
        }
      } catch (e) {
        console.warn('[favorites] load error:', e?.message);
        if (!ignore) setItems([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => { ignore = true; };
  }, [token, reloadTrigger, blockedMap]);

  // === 3) Reconciliar blocked si llega /api/blocks después
  useEffect(() => {
    setItems((prev) => (prev || []).map((u) => {
      const id = u?.id;
      const blockedByMe = !!blockedMap?.[id];
      const blocked = !!u?.blocked || blockedByMe;
      const blockedByOther = blocked && !blockedByMe;
      if (!!u?.blockedByMe === blockedByMe && !!u?.blocked === blocked && !!u?.blockedByOther === blockedByOther) return u;
      return { ...u, blocked, blockedByMe, blockedByOther };
    }));
  }, [blockedMap]);

  // Avatares
  useEffect(() => {
    let ignore = false;

    const run = async () => {
      if (!items.length || !token) return;

      const ids = items.map((i) => i.id).filter(Boolean);
      const qs = encodeURIComponent(ids.join(','));

      try {
        const r = await fetch(`/api/users/avatars?ids=${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);

        const map = await r.json();
        if (!ignore) setAvatarMap(map || {});
      } catch (e) {
        console.warn('[favorites] avatars error:', e?.message);
      }
    };

    run();
    return () => { ignore = true; };
  }, [items, token]);

  // No leídos
  useEffect(() => {
    let ignore = false;

    const loadUnread = async () => {
      if (!token) return;

      try {
        const res = await fetch('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

        const data = await res.json();
        if (ignore) return;

        const map = {};
        (data || []).forEach((conv) => {
          const peerId = Number(conv.peer ?? conv.peerId);
          const unread = Number(conv.unreadCount ?? 0);
          if (peerId && unread > 0) map[peerId] = true;
        });

        setUnreadMap(map);
      } catch (e) {
        console.warn('[favorites] unread load error:', e?.message);
        if (!ignore) setUnreadMap({});
      }
    };

    loadUnread();
    return () => { ignore = true; };
  }, [token, reloadTrigger]);

  // Listener global para "Desbloquear" desde otros componentes
  useEffect(() => {
    const onUnblock = (e) => {
      const u = e?.detail?.user;
      if (!u?.id) return;
      handleUnblock(u);
    };
    window.addEventListener('unblock-user', onUnblock);
    return () => window.removeEventListener('unblock-user', onUnblock);
  }, [handleUnblock]);

  const handleRemove = useCallback(async (user) => {
    const inv = String(user?.invited || '').toLowerCase();
    if (inv === 'pending' || inv === 'sent') { await alert({ title:'Favoritos', message:'No puedes eliminar mientras la solicitud está en proceso.', variant:'warning', size:'sm' }); return; }
    if (!user?.id) return;

    const displayName = user?.nickname || `Usuario #${user.id}`;
    const ok = await openRemoveFavoriteConfirm(displayName);
    if (!ok) return;

    try {
      const res = await fetch(`/api/favorites/models/${user.id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setItems((prev) => (prev || []).filter((i) => Number(i.id) !== Number(user.id)));
      await alert({ title:'Favoritos', message:'Eliminado de favoritos.', variant:'success', size:'sm' });
    } catch (e) {
      await alert({ title:'Favoritos', message: e?.message || 'No se pudo eliminar de favoritos.', variant:'danger', size:'sm' });
    }
  }, [token, alert, openRemoveFavoriteConfirm]);


  const handleBlock = useCallback(async (user) => {
    if (!token) { await alert({ title:'Sesión', message:'No autenticado', variant:'warning', size:'sm' }); return; }
    if (!user?.id) return;

    const displayName = user?.nickname || `Usuario #${user.id}`;
    const pick = await openBlockReasonModal({ displayName });
    if (!pick?.confirmed) return;

    try {
      const res = await fetch(`/api/blocks/${user.id}`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ reason: pick.reason || '' }) });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

      setBlockedMap((prev) => ({ ...(prev || {}), [user.id]: true }));
      setItems((prev) => (prev || []).map((i) => (Number(i.id) === Number(user.id) ? { ...i, blocked:true, blockedByMe:true, blockedByOther:false } : i)));
      setUnreadMap((prev) => { if (!prev?.[user.id]) return prev; const next = { ...prev }; delete next[user.id]; return next; });

      await alert({ title:'Bloquear', message:'Usuario bloqueado.', variant:'success', size:'sm' });
    } catch (e) {
      await alert({ title:'Bloquear', message: e?.message || 'No se pudo bloquear.', variant:'danger', size:'sm' });
    }
  }, [token, alert, openBlockReasonModal]);


  const menuNode = useMemo(() => {
    if (!menu.open || !menu.user) return null;

    const u = menu.user;
    const isBlocked = !!u?.blocked;
    const blockedByMe = !!u?.blockedByMe;
    const blockedByOther = !!u?.blockedByOther;

    return ReactDOM.createPortal(
      <FavMenu style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} role="menu">
        {!isBlocked && (
          <>
            <FavMenuItem type="button" onClick={async () => { closeMenu(); await handleRemove(u); }}>
              <FavMenuIcon><FontAwesomeIcon icon={faTrash} /></FavMenuIcon>
              <span>Eliminar</span>
            </FavMenuItem>

            <FavMenuDivider />

            <FavMenuItem type="button" onClick={async () => { closeMenu(); await handleBlock(u); }}>
              <FavMenuIcon><FontAwesomeIcon icon={faBan} /></FavMenuIcon>
              <span>Bloquear</span>
            </FavMenuItem>
          </>
        )}

        {isBlocked && blockedByMe && (
          <FavMenuItem type="button" onClick={async () => { closeMenu(); await handleUnblock(u); }}>
            <FavMenuIcon><FontAwesomeIcon icon={faUnlock} /></FavMenuIcon>
            <span>Desbloquear</span>
          </FavMenuItem>
        )}
      </FavMenu>,
      document.body
    );
  }, [menu, closeMenu, handleRemove, handleBlock, handleUnblock]);

  if (loading) return <StateRow>Cargando…</StateRow>;
  if (!items.length) return <StateRow>No tienes favoritos todavía.</StateRow>;

  return (
    <>
      <List>
        {items.map((u) => (
          <FavListItem
            key={u.id}
            user={u}
            avatarUrl={avatarMap?.[u.id] || null}
            selected={Number(u.id) === Number(selectedId)}
            hasUnread={!!unreadMap[u.id]}
            menuOpen={menu.open && Number(menu.user?.id) === Number(u.id)}
            onSelect={(user) => {
              if (user?.blocked) return;
              setUnreadMap((prev) => {
                if (!prev?.[user.id]) return prev;
                const next = { ...prev };
                delete next[user.id];
                return next;
              });
              onSelect?.(user);
            }}
            onOpenMenu={(user, rect) => openMenuFromRect(user, rect)}
          />
        ))}
      </List>

      {menuNode}
    </>
  );
}
