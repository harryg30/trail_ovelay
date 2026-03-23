'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import LeftDrawer from '@/components/LeftDrawer'
import type { Ride, Trail } from '@/lib/types'

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full flex items-center justify-center bg-zinc-100">
      <p className="text-zinc-500 text-sm">Loading map...</p>
    </div>
  ),
})

export default function Home() {
  const [rides, setRides] = useState<Ride[]>([])
  const [trails, setTrails] = useState<Trail[]>([])

  useEffect(() => {
    fetch('/api/trails')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTrails(data.trails)
      })
      .catch(console.error)
  }, [])

  const handleRidesUploaded = (newRides: Ride[]) => {
    setRides((prev) => [...prev, ...newRides])
  }

  return (
    <div className="flex h-screen">
      <LeftDrawer rides={rides} onRidesUploaded={handleRidesUploaded} />
      <LeafletMap rides={rides} trails={trails} />
    </div>
  )
}
