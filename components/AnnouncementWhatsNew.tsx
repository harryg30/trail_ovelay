"use client";

import { useState } from "react";
import Image from "next/image";
import type { AnnouncementItem } from "@/lib/announcement";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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

function ScreenshotThumb({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-1 shrink-0 overflow-hidden rounded border border-foreground/15 hover:border-foreground/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
        aria-label={`View screenshot: ${alt}`}
      >
        <Image
          src={url}
          alt={alt}
          width={72}
          height={48}
          className="block object-cover"
          unoptimized
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex items-center justify-center gap-0 bg-black/90 p-0 border-none sm:max-w-[min(95vw,1200px)] max-h-[95vh]">
          <Image
            src={url}
            alt={alt}
            width={1200}
            height={800}
            className="max-h-[95vh] w-auto max-w-full rounded object-contain"
            unoptimized
          />
        </DialogContent>
      </Dialog>
    </>
  );
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
        className="font-semibold text-electric underline-offset-2 hover:underline"
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
        <h3 className="font-display mb-2 text-xs font-normal uppercase tracking-[0.2em] text-foreground">
          What&apos;s New
        </h3>
        <ul className="flex flex-col gap-1.5">
          {whatsNew.map((item, i) => (
            <li
              key={itemKey(item, i)}
              className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
            >
              <span className="mt-0.5 shrink-0 text-forest">✓</span>
              <span className="min-w-0 flex-1">
                <ItemBody item={item} />
              </span>
              {item.screenshotUrl && (
                <ScreenshotThumb url={item.screenshotUrl} alt={item.title || item.summary} />
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1">
        <h3 className="font-display mb-2 text-xs font-normal uppercase tracking-[0.2em] text-foreground">
          Upcoming
        </h3>
        <ul className="flex flex-col gap-1.5">
          {upcoming.map((item, i) => (
            <li
              key={itemKey(item, i)}
              className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
            >
              <span className="mt-0.5 shrink-0 text-foreground/35">◦</span>
              <span className="min-w-0">
                {publicStatusLabel(item.status) ? (
                  <Badge variant="trail" className="mr-1.5 align-middle">
                    {publicStatusLabel(item.status)}
                  </Badge>
                ) : null}
                <ItemBody item={item} />
              </span>
              {item.screenshotUrl && (
                <ScreenshotThumb url={item.screenshotUrl} alt={item.title || item.summary} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
