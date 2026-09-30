import { brandSvg } from '@naya/assets/src/brand';

/** Renders the supplied "Rencontre" lockup/symbol from its original SVG source. */
export function BrandMark({ mark = 'lockup', height = 26, className }: { mark?: keyof typeof brandSvg; height?: number; className?: string }) {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(brandSvg[mark])}`;
  return <img src={src} alt="Naya" style={{ height }} className={className} />;
}
