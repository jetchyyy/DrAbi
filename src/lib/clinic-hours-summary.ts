/** Operating hours rows (matches `ClinicSettings.operatingHours`). */
export type ClinicOperatingHourRow = {
  day: string;
  open: string;
  close: string;
  enabled: boolean;
};

function formatClockTime(raw: string) {
  const [hStr, mStr] = raw.split(':');
  const hours = Number(hStr);
  const minutes = Number(mStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return raw;
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function shortWeekday(day: string) {
  const d = day.trim();
  return (d.charAt(0).toUpperCase() + d.slice(1, 3).toLowerCase()) as string;
}

function formatHourRange(open: string, close: string) {
  return `${formatClockTime(open)}\u2009-\u2009${formatClockTime(close)}`;
}

/** Group consecutive rows with identical hours; labels use Mon-Fri-style ranges. */
export function summarizeOperatingHours(rows: ClinicOperatingHourRow[]): { label: string; value: string }[] {
  if (!rows.length) return [];
  const out: { label: string; value: string }[] = [];
  let i = 0;
  while (i < rows.length) {
    const sig = `${rows[i].enabled}:${rows[i].open}:${rows[i].close}`;
    let j = i + 1;
    while (
      j < rows.length &&
      `${rows[j].enabled}:${rows[j].open}:${rows[j].close}` === sig
    ) {
      j += 1;
    }
    const chunk = rows.slice(i, j);
    const isWeekdayChunk =
      chunk.length === 5 &&
      /^monday$/i.test(chunk[0].day) &&
      /^friday$/i.test(chunk[chunk.length - 1].day);
    let label: string;
    if (isWeekdayChunk) label = 'Mon-Fri';
    else if (chunk.length === 1) label = shortWeekday(chunk[0].day);
    else label = `${shortWeekday(chunk[0].day)}-${shortWeekday(chunk[chunk.length - 1].day)}`;
    const value = chunk[0].enabled ? formatHourRange(chunk[0].open, chunk[0].close) : 'Closed';
    out.push({ label, value });
    i = j;
  }
  return out;
}
