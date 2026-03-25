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
      className='fixed inset-0 z-1000 flex items-center justify-center bg-black/50'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-xl shadow-2xl w-[80vw] max-w-none mx-4 flex flex-col'
        style={{ height: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main content — top ~60% */}
        <div className='flex-2 overflow-y-auto px-8 pt-8 pb-4 flex flex-col gap-6'>
          <div>
            <h2 className='text-lg font-semibold text-zinc-900 mb-1'>
              {content.title}
            </h2>
            <p className='text-sm text-zinc-600 leading-relaxed'>
              {content.description}
            </p>
          </div>
          <AnnouncementWhatsNew
            whatsNew={content.whatsNew}
            upcoming={content.upcoming}
          />
        </div>

        {/* Divider */}
        <hr className='border-zinc-200 mx-8' />

        {/* Bio — bottom */}
        <div className='flex-1 px-8 py-5'>
          <AnnouncementBio bio={content.bio} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
