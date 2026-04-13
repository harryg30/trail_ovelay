'use client'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AuthButtonProps {
  user: { name: string; profilePicture: string | null } | null
}

export default function AuthButton({ user }: AuthButtonProps) {
  if (!user) {
    const isDev = process.env.NODE_ENV === 'development'
    return (
      <a
        href={isDev ? '/api/auth/dev-login' : '/api/auth/strava'}
        className={cn(buttonVariants({ variant: 'catalog', size: 'sm' }), 'mt-2 w-full justify-center')}
      >
        {isDev ? 'Dev Sign In' : 'Connect with Strava'}
      </a>
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
      <span className="flex-1 truncate text-xs font-semibold text-foreground">{user.name}</span>
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
