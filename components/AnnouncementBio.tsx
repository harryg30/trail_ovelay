"use client";

import { useState } from "react";
import type { AnnouncementBioData } from "@/lib/announcement";
import ContactModal from "@/components/ContactModal";

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
    <div className='flex flex-col sm:flex-row gap-4 sm:gap-6'>
      {/* Photo */}
      {bio.profilePic && (
        <img
          src={bio.profilePic}
          alt={bio.name}
          className='w-16 h-16 sm:w-28 sm:h-28 rounded-xl object-cover shrink-0 self-start'
        />
      )}

      {/* Text */}
      <div className='flex flex-col justify-between flex-1 min-w-0'>
        <div className='flex flex-col gap-3'>
          <div>
            <p className='text-base font-semibold text-zinc-900'>{bio.name}</p>
            <p className='text-sm text-zinc-500'>{bio.title}</p>
          </div>

          {/* Positions */}
          <div className='flex flex-col gap-2'>
            {bio.positions.map((pos, i) => (
              <div key={i}>
                <div className='flex items-baseline justify-between gap-2'>
                  <span className='text-sm font-medium text-zinc-700'>
                    {pos.role}
                    <div className='flex items-center gap-2'>
                      <p className='text-xs text-zinc-500 mb-0.5'>
                        {pos.company}
                      </p>

                      {pos.link && (
                        <a
                          href={pos.link}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-xs text-blue-500 hover:text-blue-700 transition-colors'
                        >
                          Website
                        </a>
                      )}
                    </div>
                  </span>

                  <span className='text-xs text-zinc-400 shrink-0'>
                    {pos.dates}
                  </span>
                </div>

                <p className='text-xs text-zinc-500 mb-1'>{pos.summary}</p>
                <div className='flex flex-wrap gap-1'>
                  {pos.skills.map((skill) => (
                    <span
                      key={skill}
                      className='text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded'
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Project note */}
          <p className='text-xs text-zinc-500 leading-relaxed italic whitespace-pre-wrap'>
            {bio.project}
          </p>

          {/* Links */}
          <div className='flex flex-wrap gap-x-4 gap-y-1'>
            {bio.links.map((link) =>
              link.action === "contact-modal" ? (
                <button
                  key='contact'
                  onClick={() => setContactOpen(true)}
                  className='text-xs text-blue-500 hover:text-blue-700 transition-colors'
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-xs text-blue-500 hover:text-blue-700 transition-colors'
                >
                  {link.label}
                </a>
              )
            )}
          </div>
        </div>

        <div className='flex justify-end pt-2'>
          <button
            onClick={onClose}
            className='py-2 px-5 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors'
          >
            Got it
          </button>
        </div>
      </div>
    </div>
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
