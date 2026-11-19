export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatExperience(years) {
  if (years === 0) return 'No minimum experience';
  return `${years}+ ${years === 1 ? 'year' : 'years'} experience`;
}
