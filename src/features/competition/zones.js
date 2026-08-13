// Zone tick colours and legend labels (spec §7.3). 2px ticks in the
// margin — never coloured row backgrounds.
export const ZONE_META = {
  ucl: { colour: '#1B4F9C', label: 'Champions League' },
  uecl: { colour: '#3E8E7E', label: 'Conference League' },
  adv: { colour: '#1B4F9C', label: 'Advance' },
  promo: { colour: '#1B4F9C', label: 'Promotion' },
  po: { colour: '#C98A1B', label: 'Play-off' },
  rel: { colour: '#A11B1B', label: 'Relegation' },
};

export const zoneFor = (comp, position) => comp.zones?.[position] ?? null;
