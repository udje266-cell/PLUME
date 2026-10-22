import logoPlume from '../../assets/logo-plume.png';
import logoPlumeDark from '../../assets/logo-plume-dark.png';

/** Compact wordmark using the original artwork, at one uniform scale. */
export default function HeaderLogo() {
  const imageStyle = { width: 224, maxWidth: 'none', left: -57, top: -52 };
  return <span aria-hidden="true" data-header-logo className="relative block h-9 w-[104px] overflow-hidden shrink-0">
    <img src={logoPlume} alt="" draggable={false} className="absolute dark:hidden" style={imageStyle} />
    <img src={logoPlumeDark} alt="" draggable={false} className="absolute hidden dark:block" style={imageStyle} />
  </span>;
}
