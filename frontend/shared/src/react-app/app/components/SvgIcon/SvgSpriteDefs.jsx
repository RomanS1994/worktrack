import spriteMarkup from './sprite.svg?raw';

const spriteHostStyle = {
  position: 'absolute',
  width: 0,
  height: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

export function SvgSpriteDefs() {
  return (
    <div
      aria-hidden="true"
      style={spriteHostStyle}
      dangerouslySetInnerHTML={{ __html: spriteMarkup }}
    />
  );
}
