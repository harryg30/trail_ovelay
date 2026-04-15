import { getSessionUser } from '@/lib/auth'
import ClientPage from '@/app/ClientPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact — Trail Overlay' }

export default async function ContactPage() {
  const user = await getSessionUser()
  return <ClientPage user={user} initialContact />
}
