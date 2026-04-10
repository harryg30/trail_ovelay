'use client'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AuthButtonProps {
  user: { name: string; profilePicture: string | null } | null
}

const isDev = process.env.NODE_ENV === 'development'

export default function AuthButton({ user }: AuthButtonProps) {
  if (!user) {
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <a
          href="/api/auth/strava"
          className={cn(buttonVariants({ variant: 'catalog', size: 'sm' }), 'w-full justify-center')}
        >
          Connect with Strava
        </a>
        {isDev && (
          <a
            href="/api/auth/dev-login"
            className="w-full text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            title="Sign in as the oldest user row in the local database (no Strava). NODE_ENV=development only."
          >
            Dev sign-in (first DB user)
          </a>
        )}
      </div>
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
