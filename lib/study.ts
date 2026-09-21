const zone = "Europe/Istanbul";

export function istanbulDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function millisecondsUntilNextIstanbulDay(date: Date): number {
  const currentDay = istanbulDay(date);
  let first = date.getTime() + 1;
  let last = date.getTime() + 27 * 60 * 60 * 1000;
  while (first < last) {
    const middle = Math.floor((first + last) / 2);
    if (istanbulDay(new Date(middle)) === currentDay) first = middle + 1;
    else last = middle;
  }
  return first - date.getTime();
}

export function dayIndex(startDay: string, currentDay: string): number {
  const start = Date.parse(`${startDay}T00:00:00Z`);
  const current = Date.parse(`${currentDay}T00:00:00Z`);
  return Math.round((current - start) / 86_400_000) + 1;
}

export function activeOn(startDay: string, currentDay: string, durationDays = 7): boolean {
  const day = dayIndex(startDay, currentDay);
  return day >= 1 && day <= durationDays;
}
