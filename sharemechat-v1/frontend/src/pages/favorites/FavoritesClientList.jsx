import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faTrash, faBan } from '@fortawesome/free-solid-svg-icons';

import {
  List,
  StateRow,
  ItemCard,
  Avatar,
  Info,
  Name,
  Badges,
  DotWrap,
  StatusDot,
  FavMenuTrigger,
  FavMenu,
  FavMenuItem,
  FavMenuIcon,
  FavMenuDivider,
} from '../../styles/pages-styles/FavoritesStyles';

import StatusBadge from '../../components/StatusBadge';

function FavListItem({
  user,
  avatarUrl,
  onSelect,
  onOpenMenu,
  selected = false,
  hasUnread = false,
  menuOpen = false,
}) {
  const placeholder = '/img/avatarChica.png';
  const [imgSrc, setImgSrc] = useState(placeholder);

  useEffect(() => {
    if (avatarUrl && typeof avatarUrl === 'string') setImgSrc(avatarUrl);
  }, [avatarUrl]);

  const invited = String(user.invited || '').trim().toLowerCase();
  const presence = String(user.presence || 'offline').toLowerCase();
  const isMenuDisabled = invited === 'pending' || invited === 'sent';

  return (
    <ItemCard
      $clickable
      data-fav-card="true"
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect?.(user)}
    >
      <DotWrap>
        <Avatar
          src={imgSrc}
          alt=""
          $size={28}
          onError={(e) => {
            e.currentTarget.src = '/img/avatarChica.png';
          }}
        />
        <StatusDot
          className={
            presence === 'busy'
              ? 'busy'
              : presence === 'online'
              ? 'online'
              : 'offline'
          }
          aria-label={presence}
        />
      </DotWrap>

      <Info>
        <Name>{user.nickname || `Usuario #${user.id}`}</Name>
      </Info>

      <Badges>
        {invited !== 'accepted' && (
          <StatusBadge
            value={invited}
            title={invited === 'sent' ? 'enviado' : invited}
            size={16}
          />
        )}
      </Badges>

      {hasUnread && (
        <div
          style={{width:10,height:10,borderRadius:'50%',backgroundColor:'#0d6efd',marginRight:6}}
          aria-label="Tienes mensajes sin leer"
          title="Tienes mensajes sin leer"
        />
      )}

      <FavMenuTrigger
        type="button"
        data-open={menuOpen ? 'true' : 'false'}
        aria-label="Más opciones"
        title="Más opciones"
        onClick={(e) => {
          e.stopPropagation();
          if (isMenuDisabled) return;

          const cardEl = e.currentTarget.closest('[data-fav-card]');
          const rect = cardEl
            ? cardEl.getBoundingClientRect()
            : e.currentTarget.getBoundingClientRect();

          onOpenMenu?.(user, rect);
        }}
      >
        <FontAwesomeIcon icon={faChevronDown} />
      </FavMenuTrigger>
    </ItemCard>
  );
}

export default function FavoritesClientList({
  onSelect,
  reloadTrigger = 0,
  selectedId = null,
}) {
  const [items, setItems] = useState([]);
  const [avatarMap, setAvatarMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [menu, setMenu] = useState({ open: false, user: null, x: 0, y: 0 });

  const token = localStorage.getItem('token');
  const menuWidthDesktop = 220;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const closeMenu = () => {
    setMenu({ open: false, user: null, x: 0, y: 0 });
  };

  useEffect(() => {
    const close = () => closeMenu();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openMenuFromRect = (user, rect) => {
    if (menu.open && Number(menu.user?.id) === Number(user.id)) {
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
  };

  // === 1) Cargar favoritos + presencia
  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!token) return;
      setLoading(true);

      try {
        const res = await fetch('/api/favorites/models/meta', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error((await res.text()) || `HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!ignore) {
          const mapped = (data || []).map((d) => {
            const u = d?.user || {};
            return {
              ...u,
              invited: d?.invited,
              status: d?.status,
              presence: d?.presence || 'offline',
            };
          });

          setItems(
            mapped.filter(
              (item) =>
                String(item.invited || '').toLowerCase() !== 'rejected'
            )
          );
        }
      } catch (e) {
        console.warn('[favorites] load error:', e?.message);
        if (!ignore) setItems([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [token, reloadTrigger]);

  // === 2) Avatares
  useEffect(() => {
    let ignore = false;

    const run = async () => {
      if (!items.length || !token) return;

      const ids = items.map((i) => i.id).filter(Boolean);
      const qs = encodeURIComponent(ids.join(','));

      try {
        const r = await fetch(`/api/users/avatars?ids=${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!r.ok) {
          throw new Error((await r.text()) || `HTTP ${r.status}`);
        }

        const map = await r.json();
        if (!ignore) setAvatarMap(map || {});
      } catch (e) {
        console.warn('[favorites] avatars error:', e?.message);
      }
    };

    run();
    return () => {
      ignore = true;
    };
  }, [items, token]);

  // === 3) No leídos
  useEffect(() => {
    let ignore = false;

    const loadUnread = async () => {
      if (!token) return;

      try {
        const res = await fetch('/api/messages/conversations', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error((await res.text()) || `HTTP ${res.status}`);
        }

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
    return () => {
      ignore = true;
    };
  }, [token, reloadTrigger]);

  const handleRemove = async (user) => {
    const inv = String(user?.invited || '').toLowerCase();
    if (inv === 'pending' || inv === 'sent') {
      alert('No puedes eliminar favoritos mientras la solicitud está en proceso.');
      return;
    }

    if (!user?.id) return;

    const ok = window.confirm(
      `¿Eliminar a ${user.nickname || `Usuario #${user.id}`} de tus favoritos?`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/favorites/models/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error((await res.text()) || `HTTP ${res.status}`);
      }

      setItems((prev) => prev.filter((i) => i.id !== user.id));
    } catch (e) {
      alert(e.message || 'No se pudo eliminar de favoritos.');
    }
  };

  const handleBlock = async (user) => {
    if (!token) { alert('No autenticado'); return; }
    if (!user?.id) return;

    const ok = window.confirm(`¿Bloquear a ${user.nickname || `Usuario #${user.id}`}?`);
    if (!ok) return;

    const reason = window.prompt('Motivo del bloqueo (opcional):', '') ?? '';
    try {
      const res = await fetch(`/api/blocks/${user.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

      // UX mínima: quitar de la lista al bloqueado (evita recontacto)
      setItems((prev) => prev.filter((i) => Number(i.id) !== Number(user.id)));
      setUnreadMap((prev) => {
        if (!prev?.[user.id]) return prev;
        const next = { ...prev };
        delete next[user.id];
        return next;
      });

      alert('Usuario bloqueado.');
    } catch (e) {
      alert(e?.message || 'No se pudo bloquear.');
    }
  };

  const menuNode = useMemo(() => {
    if (!menu.open || !menu.user) return null;

    return ReactDOM.createPortal(
      <FavMenu
        style={{ left: menu.x, top: menu.y }}
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        <FavMenuItem
          type="button"
          onClick={async () => {
            closeMenu();
            await handleRemove(menu.user);
          }}
        >
          <FavMenuIcon>
            <FontAwesomeIcon icon={faTrash} />
          </FavMenuIcon>
          <span>Eliminar</span>
        </FavMenuItem>

        <FavMenuDivider />

        <FavMenuItem
          type="button"
          onClick={async () => {
            closeMenu();
            await handleBlock(menu.user);
          }}
        >
          <FavMenuIcon>
            <FontAwesomeIcon icon={faBan} />
          </FavMenuIcon>
          <span>Bloquear</span>
        </FavMenuItem>
      </FavMenu>,
      document.body
    );
  }, [menu]);

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
