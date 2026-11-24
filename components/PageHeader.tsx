/** Shared page frame: serif title, one line of context, optional actions. */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[40px] sm:text-[44px] leading-none text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-secondary">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

/** Centred content column used by every app page. */
export const PAGE = "px-4 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-14";
export const PAGE_INNER = "max-w-[1100px] mx-auto flex flex-col gap-6";
