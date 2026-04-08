"use client";

import { useState } from "react";
import type { AnnouncementBioData } from "@/lib/announcement";
import ContactModal from "@/components/ContactModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AnnouncementBioProps {
  bio: AnnouncementBioData;
  onClose: () => void;
}

export default function AnnouncementBio({
  bio,
  onClose
}: AnnouncementBioProps) {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {bio.profilePic && (
          <img
            src={bio.profilePic}
            alt={bio.name}
            className="h-16 w-16 shrink-0 self-start rounded-md border-2 border-foreground object-cover shadow-[3px_3px_0_0_var(--foreground)] sm:h-28 sm:w-28"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-display text-lg font-normal uppercase tracking-wide text-foreground">
                {bio.name}
              </p>
              <p className="text-sm text-muted-foreground">{bio.title}</p>
            </div>

            <div className="flex flex-col gap-2">
              {bio.positions.map((pos, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {pos.role}
                      <div className="flex items-center gap-2">
                        <p className="mb-0.5 text-xs text-muted-foreground">
                          {pos.company}
                        </p>

                        {pos.link && (
                          <a
                            href={pos.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold uppercase tracking-wide text-electric underline-offset-2 hover:underline"
                          >
                            Website
                          </a>
                        )}
                      </div>
                    </span>

                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pos.dates}
                    </span>
                  </div>

                  <p className="mb-1 text-xs text-muted-foreground">{pos.summary}</p>
                  <div className="flex flex-wrap gap-1">
                    {pos.skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="outline"
                        className="normal-case font-medium tracking-normal text-[11px]"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground italic whitespace-pre-wrap">
              {bio.project}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {bio.links.map((link) =>
                link.action === "contact-modal" ? (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => setContactOpen(true)}
                    className="text-xs font-bold uppercase tracking-wide text-electric underline-offset-2 hover:underline"
                  >
                    {link.label}
                  </button>
                ) : link.href ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold uppercase tracking-wide text-electric underline-offset-2 hover:underline"
                  >
                    {link.label}
                  </a>
                ) : null
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" variant="catalog" onClick={onClose}>
              Got it
            </Button>
          </div>
        </div>
      </div>
      <ContactModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </>
  );
}
