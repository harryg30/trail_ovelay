"use client";

import { useEffect } from "react";
import type { AnnouncementContent } from "@/lib/announcement";
import AnnouncementWhatsNew from "@/components/AnnouncementWhatsNew";
import AnnouncementBio from "@/components/AnnouncementBio";

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
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-3000 flex items-end sm:items-center justify-center sm:bg-black/50'
      onClick={onClose}
    >
      <div
        className='bg-white sm:rounded-xl shadow-2xl w-full sm:w-[80vw] sm:max-w-none flex flex-col rounded-t-xl overflow-hidden'
        style={{ maxHeight: "95vh", height: "auto", minHeight: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className='sm:hidden flex justify-center pt-3 pb-1 shrink-0'>
          <div className='w-10 h-1 rounded-full bg-zinc-300' />
        </div>

        {/* Single scrollable body */}
        <div className='overflow-y-auto px-5 sm:px-8 pt-4 sm:pt-8 pb-8 flex flex-col gap-6'>
          <div>
            <h2 className='text-lg font-semibold text-zinc-900 mb-1'>
              {content.title}
            </h2>
            <p className='text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap'>
              {content.description}
            </p>
          </div>
          <AnnouncementWhatsNew
            whatsNew={content.whatsNew}
            upcoming={content.upcoming}
          />
          <div className='flex flex-col gap-2'>
            <p className='text-sm text-zinc-600 leading-relaxed'>
              {content.roadmap.description}
            </p>
            <a
              href={content.roadmap.href}
              target='_blank'
              rel='noopener noreferrer'
              className='text-xs text-blue-500 hover:text-blue-700 transition-colors w-fit'
            >
              {content.roadmap.linkLabel}
            </a>
          </div>
          <hr className='border-zinc-200' />
          <AnnouncementBio bio={content.bio} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
