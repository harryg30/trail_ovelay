import { getSessionUser } from '@/lib/auth'
import ClientPage from '@/app/ClientPage'

export default async function Home() {
  const user = await getSessionUser()
  return <ClientPage user={user} />
}
