"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    if (!isOpen) return
    /* eslint-disable react-hooks/set-state-in-effect -- reset when modal opens */
    setName("");
    setEmail("");
    setMessage("");
    setStatus("idle");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen]);

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
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[95vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-sm bg-foreground/35" aria-hidden />
        </div>
        <DialogHeader className="shrink-0">
          <DialogTitle>Contact</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send a message or{" "}
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-electric underline-offset-2 hover:underline"
            >
              join the Discord server
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
          {status === "success" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-foreground">
                Message sent! I&apos;ll get back to you on Discord.
              </p>
              <div className="flex justify-end">
                <Button type="button" variant="catalog" size="default" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  placeholder="Your name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-email">
                  Email <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  required
                  rows={4}
                  placeholder="Your message…"
                />
              </div>

              {status === "error" && (
                <p className="text-xs font-semibold text-destructive">
                  Something went wrong. Try again or reach out on Discord.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outlineThick" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="catalog" disabled={status === "loading"}>
                  {status === "loading" ? "Sending…" : "Send"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
