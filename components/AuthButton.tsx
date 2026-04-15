'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Image from 'next/image'
import { useState } from 'react'

interface AuthButtonProps {
  user: { name: string; profilePicture: string | null; provider?: string } | null
}

export default function AuthButton({ user }: AuthButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!user) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="mt-2 w-full rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-900 active:bg-slate-950"
        >
          Sign in
        </button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="w-full max-w-sm">
            <DialogHeader>
              <DialogTitle>Sign in</DialogTitle>
              <DialogDescription>Choose your authentication provider</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-2 py-4">
              <button
                onClick={() => {
                  setIsOpen(false)
                  window.location.href = '/api/auth/google'
                }}
                className="mx-auto h-12 w-full max-w-[237px] rounded-lg border-2 border-gray-300 bg-white px-4 font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center gap-3"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  <path fill="none" d="M0 0h24v24H0z"/>
                </svg>
                Sign in with Google
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  window.location.href = '/api/auth/strava'
                }}
                className="mx-auto h-12 w-full max-w-[237px] rounded-lg bg-transparent p-0 transition-opacity hover:opacity-90 active:opacity-80 flex items-center justify-center"
              >
                <span className="sr-only">Sign in with Strava</span>
                <Image
                  src="/branding/strava-connect-orange.svg"
                  alt="Connect with Strava"
                  width={237}
                  height={48}
                  className="h-full w-full"
                />
              </button>
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={() => {
                    setIsOpen(false)
                    window.location.href = '/api/auth/dev-login'
                  }}
                  className="mx-auto h-12 w-full max-w-[237px] rounded-lg bg-slate-700 px-4 font-medium text-white transition-colors hover:bg-slate-800 active:bg-slate-900 flex items-center justify-center gap-3"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                  </svg>
                  Dev Sign In
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {user.profilePicture && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.profilePicture}
          alt={user.name}
          className="h-7 w-7 shrink-0 rounded-full border-2 border-foreground object-cover"
        />
      )}
      <div className="flex-1">
        <div className="truncate text-xs font-semibold text-foreground">{user.name}</div>
        {user.provider && <div className="text-xs text-gray-500 capitalize">{user.provider}</div>}
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        className="shrink-0 text-xs font-bold uppercase tracking-wide text-electric underline-offset-2 hover:underline"
      >
        Sign out
      </button>
    </div>
  )
}
