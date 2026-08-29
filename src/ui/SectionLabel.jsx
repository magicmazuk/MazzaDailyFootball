export default function SectionLabel({ children, muted = false, right = null }) {
  return (
    <h2 className={`font-sans text-[10px] font-semibold uppercase tracking-[.2em] pb-2 mb-4 border-b ${
      muted ? 'text-muted border-rule' : 'text-accent border-ink'
    }${right ? ' flex items-center justify-between' : ''}`}>
      {right ? <span>{children}</span> : children}
      {right}
    </h2>
  );
}
