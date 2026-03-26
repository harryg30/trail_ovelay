"use client";

import { useEffect, useState } from "react";

const DISCORD_INVITE = "https://discord.gg/uqfASaVkVD";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setEmail("");
      setMessage("");
      setStatus("idle");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message })
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className='fixed inset-0 z-3000 flex items-end sm:items-center justify-center sm:bg-black/50'
      onClick={onClose}
    >
      <div
        className='bg-white sm:rounded-xl shadow-2xl w-full sm:w-[480px] flex flex-col rounded-t-xl overflow-hidden'
        style={{ maxHeight: "95vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className='sm:hidden flex justify-center pt-3 pb-1 shrink-0'>
          <div className='w-10 h-1 rounded-full bg-zinc-300' />
        </div>

        <div className='overflow-y-auto px-5 sm:px-8 pt-4 sm:pt-6 pb-6 flex flex-col gap-4'>
          <div>
            <h2 className='text-lg font-semibold text-zinc-900'>Contact</h2>
            <p className='text-sm text-zinc-500 mt-0.5'>
              Send a message or{" "}
              <a
                href={DISCORD_INVITE}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-700 transition-colors'
              >
                join the Discord server
              </a>
              .
            </p>
          </div>

          {status === "success" ? (
            <div className='flex flex-col gap-4'>
              <p className='text-sm text-zinc-700'>
                Message sent! I&apos;ll get back to you on Discord.
              </p>
              <div className='flex justify-end'>
                <button
                  onClick={onClose}
                  className='py-2 px-5 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors'
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
              <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-zinc-700' htmlFor='contact-name'>
                  Name
                </label>
                <input
                  id='contact-name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  placeholder='Your name'
                  className='border border-zinc-300 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>

              <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-zinc-700' htmlFor='contact-email'>
                  Email <span className='text-zinc-400 font-normal'>(optional)</span>
                </label>
                <input
                  id='contact-email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  placeholder='you@example.com'
                  className='border border-zinc-300 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>

              <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-zinc-700' htmlFor='contact-message'>
                  Message
                </label>
                <textarea
                  id='contact-message'
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  required
                  rows={4}
                  placeholder='Your message…'
                  className='border border-zinc-300 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none'
                />
              </div>

              {status === "error" && (
                <p className='text-xs text-red-500'>
                  Something went wrong. Try again or reach out on Discord.
                </p>
              )}

              <div className='flex justify-end gap-2 pt-1'>
                <button
                  type='button'
                  onClick={onClose}
                  className='py-2 px-4 rounded-md text-sm text-zinc-600 hover:bg-zinc-100 transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={status === "loading"}
                  className='py-2 px-5 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50'
                >
                  {status === "loading" ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
