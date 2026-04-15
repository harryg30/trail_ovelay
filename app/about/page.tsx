import { getSessionUser } from '@/lib/auth'
import ClientPage from '@/app/ClientPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'About — Trail Overlay' }

export default async function AboutPage() {
  const user = await getSessionUser()
  return <ClientPage user={user} initialAbout />
}
