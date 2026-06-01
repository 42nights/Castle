import { Avatar } from "@/components/atoms";
import type { DigestSections } from "@/convex/dailyDigests";

type Person = DigestSections["people"][number];

export function PeopleCards({ people }: { people: Person[] }) {
  return (
    <section aria-label="People you're meeting today">
      <h2 className="t-h2 mb-3">People you&rsquo;re meeting</h2>
      <div className="flex flex-col gap-3">
        {people.map((person) => (
          <div
            key={person.name}
            className="rounded-lg bg-canvas shadow-[var(--shadow-base)] px-4 py-3 flex items-start gap-3"
          >
            <Avatar name={person.name} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-medium text-ink leading-snug">{person.name}</p>
              <p className="text-[12px] text-ink-3 mb-1.5">{person.title}</p>
              <p className="text-[13px] text-ink-2 leading-[1.55]">{person.context}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
