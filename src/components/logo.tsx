import Image from 'next/image';
import Link from 'next/link';

/** The robot mark with a soft halo behind it. */
export function LogoMark({ size = 40, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span aria-hidden className="absolute inset-[-20%] rounded-full bg-glow/30 blur-xl" />
      <Image
        src="/brand/logo.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        className="relative rounded-full"
      />
    </span>
  );
}

/** Mark + wordmark, links home. */
export function Brand({ size = 36 }: { size?: number }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3 rounded-full" aria-label="PDF QA Bot home">
      <span className="transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-105">
        <LogoMark size={size} priority />
      </span>
      <span className="hidden font-display text-lg font-semibold tracking-tight text-paper min-[440px]:inline">PDF QA Bot</span>
    </Link>
  );
}
