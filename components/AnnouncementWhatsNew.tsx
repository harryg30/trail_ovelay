'use client'

interface AnnouncementWhatsNewProps {
  whatsNew: string[]
  upcoming: string[]
}

export default function AnnouncementWhatsNew({ whatsNew, upcoming }: AnnouncementWhatsNewProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-zinc-700 mb-2">What's New</h3>
        <ul className="flex flex-col gap-1.5">
          {whatsNew.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-zinc-600 leading-relaxed">
              <span className="text-green-500 mt-0.5 shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-zinc-700 mb-2">Upcoming</h3>
        <ul className="flex flex-col gap-1.5">
          {upcoming.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-zinc-500 leading-relaxed">
              <span className="text-zinc-300 mt-0.5 shrink-0">◦</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
