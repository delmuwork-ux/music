import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MEDIA_DIR_NAME = 'music & thumbail'
const MEDIA_DIR = path.join(process.cwd(), 'public', MEDIA_DIR_NAME)
const MEDIA_PUBLIC_PREFIX = `/${encodeURIComponent(MEDIA_DIR_NAME)}`
const VIDEO_DIR = path.join(process.cwd(), 'public', 'video')
const MOBILE_VIDEO_DIR = path.join(process.cwd(), 'public', 'video-mobile')
const AUDIO_EXTS = ['.m4a']
const IMAGE_EXTS = ['.jpg']
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v']

function getDurationPlaceholder(filename: string) {
  return '--:--'
}

function normalizeStem(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveThumbnail(mediaFiles: string[], filename: string) {
  const base = path.parse(filename).name
  const imageFiles = mediaFiles.filter(file => IMAGE_EXTS.includes(path.extname(file).toLowerCase()))

  const exactMatch = IMAGE_EXTS
    .map(ext => `${base}${ext}`)
    .find(image => imageFiles.some(file => file.toLowerCase() === image.toLowerCase()))

  if (exactMatch) {
    const matchedFilename = imageFiles.find(file => file.toLowerCase() === exactMatch.toLowerCase())
    return matchedFilename ? `${MEDIA_PUBLIC_PREFIX}/${encodeURIComponent(matchedFilename)}` : undefined
  }

  const normalizedAudioStem = normalizeStem(base)
  const fuzzyMatch = imageFiles.find(imageFile => normalizeStem(path.parse(imageFile).name) === normalizedAudioStem)
  return fuzzyMatch ? `${MEDIA_PUBLIC_PREFIX}/${encodeURIComponent(fuzzyMatch)}` : undefined
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
    return `${MEDIA_PUBLIC_PREFIX}/${encodeURIComponent(filename)}`
  }

  return undefined
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const preferMobile = requestUrl.searchParams.get('profile') === 'mobile'
    const files = fs.readdirSync(MEDIA_DIR)
    const videoFiles = fs.existsSync(VIDEO_DIR) ? fs.readdirSync(VIDEO_DIR) : []
    const mobileVideoFiles = fs.existsSync(MOBILE_VIDEO_DIR) ? fs.readdirSync(MOBILE_VIDEO_DIR) : []
    const tracks = files.filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase())).map(f => ({
      title: path.parse(f).name,
      artist: 'Unknown Artist',
      duration: getDurationPlaceholder(f),
      src: `${MEDIA_PUBLIC_PREFIX}/${encodeURIComponent(f)}`,
      thumbnail: resolveThumbnail(files, f),
      video: resolveVideo(videoFiles, mobileVideoFiles, f, preferMobile),
    }))
    return NextResponse.json({ tracks })
  } catch (err) {
    return NextResponse.json({ error: `Failed to read ${MEDIA_DIR_NAME} directory`, detail: String(err) }, { status: 500 })
  }
}
