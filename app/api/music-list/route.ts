import { NextResponse } from 'next/server'
import tracksManifest from '@/data/music-manifest.json'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ManifestTrack = {
  title: string
  artist: string
  duration: string
  src: string
  thumbnail?: string
  video?: string
  mobileVideo?: string
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const preferMobile = requestUrl.searchParams.get('profile') === 'mobile'
    const tracks = (tracksManifest as ManifestTrack[]).map(track => ({
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      src: track.src,
      thumbnail: track.thumbnail,
      video: preferMobile ? (track.mobileVideo ?? track.video) : track.video,
    }))
    return NextResponse.json({ tracks })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read music manifest', detail: String(err) }, { status: 500 })
  }
}
