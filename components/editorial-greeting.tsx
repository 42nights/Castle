/**
 * EditorialGreeting — the quiet Fraunces dateline that opens /overview.
 *
 * "Tuesday, May 31" — one line, no metrics yet. Sets the editorial register
 * before the hero numbers arrive. Pure server component (no interactivity).
 */

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatGreetingDate(date: Date): string {
  const day = DAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  const d = date.getDate();
  return `${day}, ${month} ${d}`;
}

export function EditorialGreeting({ date }: { date?: Date }) {
  const d = date ?? new Date();
  return (
    <div className="mb-8" aria-label={`Today is ${formatGreetingDate(d)}`}>
      <p className="t-headline text-ink-3">{formatGreetingDate(d)}</p>
    </div>
  );
}
