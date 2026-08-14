const kickoffTime = iso =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function StatusWord({ fixture }) {
  if (fixture.status === 'live') {
    return (
      <span className="font-sans text-[10px] uppercase tracking-[.14em] text-accent
                       inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
        {fixture.minute ?? 'Live'}
      </span>
    );
  }
  if (fixture.status === 'ft') {
    return <span className="font-sans text-[10px] uppercase tracking-[.14em] text-muted">FT</span>;
  }
  if (fixture.status === 'postponed' || fixture.status === 'canceled') {
    return (
      <span className="font-sans text-[9px] uppercase tracking-[.14em] text-muted/70">P–P</span>
    );
  }
  return (
    <span className="font-sans text-[11px] text-muted tabular-nums">
      {kickoffTime(fixture.kickoff)}
    </span>
  );
}
