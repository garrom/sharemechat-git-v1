// src/components/PromoVideoLightbox.jsx
import React from'react';
import{Backdrop,Wrapper,Dialog,CloseBtn,Body}from'../styles/ModalStyles';
import{BtnPromoNav,ButtonAddFavorite}from'../styles/ButtonStyles';
import{FontAwesomeIcon}from'@fortawesome/react-fontawesome';
import{faChevronLeft,faChevronRight,faUserPlus}from'@fortawesome/free-solid-svg-icons';

export default function PromoVideoLightbox({videos,activeIndex,onClose,onPrev,onNext,onAddFavorite}){
  if(!Array.isArray(videos)||videos.length===0)return null;
  if(activeIndex==null||activeIndex<0||activeIndex>=videos.length)return null;

  const video=videos[activeIndex];
  const avatarSrc=video.thumb||'/img/avatarChica.png';
  const modelName=video.modelName||'Modelo';

  const handleBackdropClick=()=>{onClose&&onClose();};
  const stopPropagation=e=>e.stopPropagation();

  const canPrev=activeIndex>0;
  const canNext=activeIndex<videos.length-1;

  const handleAddFavoriteClick=()=>{
    if(typeof onAddFavorite==='function'){
      onAddFavorite(video);
    }
  };

  return(
    <>
      <Backdrop onClick={handleBackdropClick}/>
      <Wrapper onClick={handleBackdropClick}>
        <Dialog data-variant="info" data-hidechrome="true" $size="xl" onClick={stopPropagation} style={{width:'min(600px, calc(100% - 24px))',maxWidth:'none'}}>
          <Body data-kind="promo-video">
            {/* CABECERA: avatar + textos + botón cerrar en la misma línea */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <img src={avatarSrc} alt={modelName} style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(255,255,255,0.4)'}}/>
                <div style={{display:'flex',flexDirection:'column'}}>
                  <span style={{fontSize:'0.78rem',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.08em'}}>Modelo destacada</span>
                  <span style={{fontSize:'1.1rem',fontWeight:700,color:'#f9fafb'}}>{modelName}</span>
                </div>
              </div>
              <CloseBtn onClick={onClose} aria-label="Cerrar vídeo">×</CloseBtn>
            </div>

            {/* CONTENEDOR DEL VÍDEO GRANDE (vertical tipo TikTok) */}
            <div style={{position:'relative',margin:'0 auto',width:'min(360px, calc(100% - 32px))',height:'calc(100vh - 220px)',borderRadius:14,overflow:'hidden',background:'#000'}}>
              {/* Botón favoritos flotando SOBRE el vídeo */}
              {onAddFavorite&&(
                <ButtonAddFavorite
                  type="button"
                  onClick={handleAddFavoriteClick}
                  aria-label="Añadir a favoritos"
                  title="Añadir a favoritos"
                  style={{position:'absolute',right:12,top:12,zIndex:3,width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='#000';e.currentTarget.style.color='#fff';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';}}
                >
                  <FontAwesomeIcon icon={faUserPlus}/>
                </ButtonAddFavorite>

              )}

              {canPrev&&(
                <BtnPromoNav
                  type="button"
                  onClick={onPrev}
                  aria-label="Vídeo anterior"
                  style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',zIndex:2,background:'transparent',border:'none',boxShadow:'none',padding:0,cursor:'pointer'}}
                >
                  <FontAwesomeIcon icon={faChevronLeft}/>
                </BtnPromoNav>
              )}

              {canNext&&(
                <BtnPromoNav
                  type="button"
                  onClick={onNext}
                  aria-label="Siguiente vídeo"
                  style={{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',zIndex:2,background:'transparent',border:'none',boxShadow:'none',padding:0,cursor:'pointer'}}
                >
                  <FontAwesomeIcon icon={faChevronRight}/>
                </BtnPromoNav>
              )}

              <video
                src={video.src}
                controls
                autoPlay
                playsInline
                style={{width:'100%',height:'100%',display:'block',objectFit:'cover',background:'#000'}}
              />
            </div>

            <div style={{marginTop:10,fontSize:13,opacity:0.9,textAlign:'left'}}>
              {video.durationSec!=null&&(
                <div><strong>Duración:</strong> {video.durationSec} s</div>
              )}
            </div>
          </Body>
        </Dialog>
      </Wrapper>
    </>
  );
}
