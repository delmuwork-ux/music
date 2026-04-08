import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MUSIC_DIR = path.join(process.cwd(), 'public', 'music')
const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbail')
const VIDEO_DIR = path.join(process.cwd(), 'public', 'video')
const MOBILE_VIDEO_DIR = path.join(process.cwd(), 'public', 'video-mobile')
const AUDIO_EXTS = ['.mp3', '.webm', '.wav', '.ogg', '.m4a']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v']

function getDurationPlaceholder(filename: string) {
  return '--:--'
}

function resolveThumbnail(thumbnailFiles: string[], filename: string) {
  const base = path.parse(filename).name
  const match = IMAGE_EXTS.map(ext => `${base}${ext}`).find(image => thumbnailFiles.includes(image))
  return match ? `/thumbail/${encodeURIComponent(match)}` : undefined
}

function resolveVideo(videoFiles: string[], mobileVideoFiles: string[], filename: string, preferMobile = false) {
  const base = path.parse(filename).name

  if (preferMobile) {
    const mobileMatch = VIDEO_EXTS.map(ext => `${base}${ext}`).find(video => mobileVideoFiles.includes(video))
    if (mobileMatch) {
      return `/video-mobile/${encodeURIComponent(mobileMatch)}`
    }
  }

  const fromVideoFolder = VIDEO_EXTS.map(ext => `${base}${ext}`).find(video => videoFiles.includes(video))
  if (fromVideoFolder) {
    return `/video/${encodeURIComponent(fromVideoFolder)}`
  }

  if (VIDEO_EXTS.includes(path.extname(filename).toLowerCase())) {
    return `/music/${encodeURIComponent(filename)}`
  }

  return undefined
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const preferMobile = requestUrl.searchParams.get('profile') === 'mobile'
    const files = fs.readdirSync(MUSIC_DIR)
    const thumbnailFiles = fs.existsSync(THUMBNAIL_DIR) ? fs.readdirSync(THUMBNAIL_DIR) : []
    const videoFiles = fs.existsSync(VIDEO_DIR) ? fs.readdirSync(VIDEO_DIR) : []
    const mobileVideoFiles = fs.existsSync(MOBILE_VIDEO_DIR) ? fs.readdirSync(MOBILE_VIDEO_DIR) : []
    const tracks = files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())).map(f => ({
      title: path.parse(f).name,
      artist: '',
      duration: getDurationPlaceholder(f),
      src: `/music/${encodeURIComponent(f)}`,
      thumbnail: resolveThumbnail(thumbnailFiles, f),
      video: resolveVideo(videoFiles, mobileVideoFiles, f, preferMobile),
    }))
    return NextResponse.json({ tracks })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read music directory', detail: String(err) }, { status: 500 })
  }
}
