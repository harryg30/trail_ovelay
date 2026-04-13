import type { Ride } from '@/lib/types'

export type UploadRideFilesProgress = (done: number, total: number) => void

/** Upload one or more .gpx / .zip files via `/api/upload` (requires session). */
export async function uploadRideFilesClient(
  files: File[],
  onProgress?: UploadRideFilesProgress
): Promise<{ rides: Ride[]; errors: string[] }> {
  const allRides: Ride[] = []
  const errors: string[] = []

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length)
    try {
      const formData = new FormData()
      formData.append('file', files[i])
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = (await res.json()) as { success?: boolean; rides?: Ride[]; error?: string }
      if (data.success && data.rides) {
        allRides.push(...data.rides)
      } else {
        errors.push(`${files[i].name}: ${data.error ?? 'failed'}`)
      }
    } catch {
      errors.push(`${files[i].name}: network error`)
    }
  }

  onProgress?.(files.length, files.length)
  return { rides: allRides, errors }
}
