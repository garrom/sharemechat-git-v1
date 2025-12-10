// src/components/PromoVideoLightbox.jsx
import React from 'react';
import {
  Backdrop,
  Wrapper,
  Dialog,
  Header,
  Title,
  CloseBtn,
  Body,
} from '../styles/ModalStyles';
import { BtnPromoNav } from '../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

export default function PromoVideoLightbox({
  videos,
  activeIndex,
  onClose,
  onPrev,
  onNext,
}) {
  if(!Array.isArray(videos)||videos.length===0)return null;
  if(activeIndex==null||activeIndex<0||activeIndex>=videos.length)return null;

  const video=videos[activeIndex];
  const avatarSrc=video.thumb||'/img/avatarChica.png';
  const modelName=video.modelName||'Modelo';

  const handleBackdropClick=()=>{onClose&&onClose();};
  const stopPropagation=e=>e.stopPropagation();

  const canPrev=activeIndex>0;
  const canNext=activeIndex<videos.length-1;

  return(
    <>
      <Backdrop onClick={handleBackdropClick}/>
      <Wrapper onClick={handleBackdropClick}>
        <Dialog data-variant="info" data-hidechrome="true" $size="xl" onClick={stopPropagation}>
          <Header>
            <Title>{video.title||'Vídeo de modelo'}</Title>
            <CloseBtn onClick={onClose} aria-label="Cerrar vídeo">×</CloseBtn>
          </Header>

          <Body data-kind="promo-video">
            {/* CABECERA TIPO HOME: avatar + "Modelo destacada" + nombre */}
            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
              <img src={avatarSrc} alt={modelName} style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(255,255,255,0.4)'}}/>
              <div style={{display:'flex',flexDirection:'column'}}>
                <span style={{fontSize:'0.78rem',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.08em'}}>Modelo destacada</span>
                <span style={{fontSize:'1.1rem',fontWeight:700,color:'#f9fafb'}}>{modelName}</span>
              </div>
            </div>

            {/* CONTENEDOR DEL VÍDEO GRANDE (formato vertical tipo TikTok) */}
            <div style={{position:'relative',margin:'0 auto',width:'min(420px, 100%)',height:'calc(100vh - 220px)',borderRadius:14,overflow:'hidden',background:'#000'}}>
              {/* Botón anterior */}
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

              {/* Botón siguiente */}
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

              {/* Vídeo principal */}
              <video
                src={video.src}
                controls
                autoPlay
                playsInline
                style={{width:'100%',height:'100%',display:'block',objectFit:'cover',background:'#000'}}
              />
            </div>

            {/* PIE CON INFO EXTRA (de momento solo duración) */}
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
