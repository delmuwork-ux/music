import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MUSIC_DIR = path.join(process.cwd(), 'public', 'music')
const AUDIO_EXTS = ['.mp3', '.webm', '.wav', '.ogg', '.m4a']

function getDurationPlaceholder(filename: string) {
  return '--:--'
}

export async function GET() {
  try {
    const files = fs.readdirSync(MUSIC_DIR)
    const tracks = files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())).map(f => ({
      title: path.parse(f).name,
      artist: '',
      duration: getDurationPlaceholder(f),
      src: `/music/${f}`,
    }))
    return NextResponse.json({ tracks })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read music directory', detail: String(err) }, { status: 500 })
  }
}
