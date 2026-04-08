"use client";

import type { AnnouncementContent } from "@/lib/announcement";
import AnnouncementWhatsNew from "@/components/AnnouncementWhatsNew";
import AnnouncementBio from "@/components/AnnouncementBio";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: AnnouncementContent;
}

export default function AnnouncementModal({
  isOpen,
  onClose,
  content
}: AnnouncementModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[95vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(90vw,56rem)]"
        showCloseButton
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-sm bg-foreground/35" aria-hidden />
        </div>
        <DialogHeader className="shrink-0">
          <DialogTitle className="max-w-[90%]">{content.title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-8 flex flex-col gap-6">
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {content.description}
          </p>
          <AnnouncementWhatsNew
            whatsNew={content.whatsNew}
            upcoming={content.upcoming}
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {content.roadmap.description}
            </p>
            <a
              href={content.roadmap.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-xs font-bold uppercase tracking-wider text-electric underline-offset-2 hover:underline"
            >
              {content.roadmap.linkLabel}
            </a>
          </div>
          <Separator className="data-horizontal:h-0.5 bg-foreground/20" />
          <AnnouncementBio bio={content.bio} onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
