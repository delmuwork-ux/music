import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MUSIC_DIR = path.join(process.cwd(), 'public', 'music')
const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbail')
const AUDIO_EXTS = ['.mp3', '.webm', '.wav', '.ogg', '.m4a']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

function getDurationPlaceholder(filename: string) {
  return '--:--'
}

function resolveThumbnail(thumbnailFiles: string[], filename: string) {
  const base = path.parse(filename).name
  const match = IMAGE_EXTS.map(ext => `${base}${ext}`).find(image => thumbnailFiles.includes(image))
  return match ? `/thumbail/${match}` : undefined
}

export async function GET() {
  try {
    const files = fs.readdirSync(MUSIC_DIR)
    const thumbnailFiles = fs.existsSync(THUMBNAIL_DIR) ? fs.readdirSync(THUMBNAIL_DIR) : []
    const tracks = files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())).map(f => ({
      title: path.parse(f).name,
      artist: '',
      duration: getDurationPlaceholder(f),
      src: `/music/${f}`,
      thumbnail: resolveThumbnail(thumbnailFiles, f),
    }))
    return NextResponse.json({ tracks })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read music directory', detail: String(err) }, { status: 500 })
  }
}
