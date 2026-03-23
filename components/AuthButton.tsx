'use client'

interface AuthButtonProps {
  user: { name: string; profilePicture: string | null } | null
}

export default function AuthButton({ user }: AuthButtonProps) {
  if (!user) {
    return (
      <a
        href="/api/auth/strava"
        className="mt-2 flex items-center justify-center gap-2 w-full py-1.5 px-3 rounded-md bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors"
      >
        Connect with Strava
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
          className="w-6 h-6 rounded-full shrink-0 object-cover"
        />
      )}
      <span className="text-xs text-zinc-700 truncate flex-1">{user.name}</span>
      <button
        onClick={handleSignOut}
        className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
