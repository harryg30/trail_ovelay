'use client'

import { useState } from 'react'
import { Puzzle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const webstoreUrl = process.env.NEXT_PUBLIC_CHROME_WEBSTORE_URL?.trim() ?? ''

export default function GetExtensionButton() {
  const [open, setOpen] = useState(false)

  if (webstoreUrl) {
    return (
      <a
        href={webstoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: 'catalog', size: 'sm' }),
          'w-full justify-center gap-2 whitespace-normal text-center'
        )}
      >
        <Puzzle className="size-4 shrink-0" aria-hidden />
        Get extension
      </a>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="catalog"
        size="sm"
        className="w-full gap-2 whitespace-normal"
        onClick={() => setOpen(true)}
      >
        <Puzzle className="size-4 shrink-0" aria-hidden />
        Get extension
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Install the Chrome extension</DialogTitle>
            <DialogDescription>
              Sideload the Trail Overlay extension for Strava&apos;s route builder (
              <span className="text-foreground">strava.com/maps/create</span>).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 border-t-2 border-border px-4 py-4 text-sm text-foreground">
            <ol className="list-decimal space-y-2 pl-5 marker:font-semibold">
              <li>Download the ZIP below and unzip it to a folder you will keep (Chrome reads from that folder).</li>
              <li>Open Chrome and go to <span className="font-mono text-xs">chrome://extensions</span>.</li>
              <li>Turn on <strong>Developer mode</strong> (top right).</li>
              <li>Click <strong>Load unpacked</strong> and choose the unzipped folder (the one that contains{' '}
                <span className="font-mono text-xs">manifest.json</span>).</li>
              <li>Open Strava route builder; trail overlays load on matching pages.</li>
            </ol>
          </div>
          <DialogFooter className="flex-col gap-2 border-t-2 border-foreground sm:flex-col">
            <a
              href="/api/extension/download"
              className={cn(buttonVariants({ variant: 'default' }), 'w-full justify-center')}
            >
              Download ZIP
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
