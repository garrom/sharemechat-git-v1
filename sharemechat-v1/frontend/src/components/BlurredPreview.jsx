// src/components/BlurredPreview.jsx
import React from 'react';
import styled from 'styled-components';

const Wrap = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background: #000;
  isolation: isolate;
`;

const Base = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;

  & > video,
  & > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #000;
  }
`;

const BlurSupport = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.10);

  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);

  @supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
    display: none;
  }
`;

const BlurFallback = styled.div`
  position: absolute;
  inset: -10px;
  z-index: 2;
  pointer-events: none;

  filter: blur(16px) saturate(1.1);
  transform: scale(1.06);
  opacity: 0.85;

  @supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
    display: none;
  }

  & > video,
  & > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #000;
  }
`;

const Dark = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.45);
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.55) 100%);
  opacity: 0.55;
`;

const Content = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
`;

export default function BlurredPreview({
  type = 'video',
  src,
  alt = '',
  poster,
  onClick,
  muted = true,
  autoPlay = true,
  loop = true,
  playsInline = true,
  controls = false,
  preload = 'metadata',
  crossOrigin,
  showVignette = true,
  children,
  className,
  style
}) {
  const isImg = type === 'img';

  const MainMedia = isImg ? (
    <img src={src} alt={alt} />
  ) : (
    <video src={src} poster={poster || undefined} muted={muted} autoPlay={autoPlay} loop={loop} playsInline={playsInline} controls={controls} preload={preload} crossOrigin={crossOrigin} />
  );

  const BgMedia = isImg ? (
    <img src={src} alt="" aria-hidden="true" />
  ) : (
    <video src={src} poster={poster || undefined} muted={true} autoPlay={autoPlay} loop={loop} playsInline={playsInline} controls={false} preload={preload} crossOrigin={crossOrigin} aria-hidden="true" />
  );

  return (
    <Wrap className={className} style={style} onClick={onClick}>
      {src && (
        <>
          <Base>{MainMedia}</Base>
          <BlurSupport />
          <BlurFallback>
            <div style={{position:'absolute',inset:0}}>{BgMedia}</div>
          </BlurFallback>
          <Dark />
          {showVignette && <Vignette />}
        </>
      )}
      <Content>{children}</Content>
    </Wrap>
  );
}
