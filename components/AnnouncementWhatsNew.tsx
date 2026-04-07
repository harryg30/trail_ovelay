"use client";

import type { AnnouncementItem } from "@/lib/announcement";

function itemKey(item: AnnouncementItem, index: number): string {
  const base = [item.title, item.summary, item.notionUrl ?? ""].join("|");
  return `${base}:${index}`;
}

/** Only show a public badge for active work; hide internal column names from older JSON. */
function publicStatusLabel(status?: string): string | null {
  if (!status?.trim()) return null;
  const n = status.trim().toLowerCase();
  if (n === "in progress" || n === "in_progress") return "In progress";
  return null;
}

function ItemBody({ item }: { item: AnnouncementItem }) {
  const text =
    item.title && item.summary
      ? `${item.title}: ${item.summary}`
      : item.title || item.summary;

  if (item.notionUrl) {
    return (
      <a
        href={item.notionUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:text-blue-700 underline-offset-2 hover:underline"
      >
        {text}
      </a>
    );
  }

  return <span>{text}</span>;
}

interface AnnouncementWhatsNewProps {
  whatsNew: AnnouncementItem[];
  upcoming: AnnouncementItem[];
}

export default function AnnouncementWhatsNew({
  whatsNew,
  upcoming
}: AnnouncementWhatsNewProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-zinc-700 mb-2">
          What&apos;s New
        </h3>
        <ul className="flex flex-col gap-1.5">
          {whatsNew.map((item, i) => (
            <li
              key={itemKey(item, i)}
              className="flex gap-2 text-sm text-zinc-600 leading-relaxed"
            >
              <span className="text-green-500 mt-0.5 shrink-0">✓</span>
              <ItemBody item={item} />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-zinc-700 mb-2">Upcoming</h3>
        <ul className="flex flex-col gap-1.5">
          {upcoming.map((item, i) => (
            <li
              key={itemKey(item, i)}
              className="flex gap-2 text-sm text-zinc-500 leading-relaxed"
            >
              <span className="text-zinc-300 mt-0.5 shrink-0">◦</span>
              <span className="min-w-0">
                {publicStatusLabel(item.status) ? (
                  <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded mr-1.5 align-middle">
                    {publicStatusLabel(item.status)}
                  </span>
                ) : null}
                <ItemBody item={item} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
