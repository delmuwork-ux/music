const fs = require("fs");
const path = require("path");

const mediaDirName = "music & thumbail";
const mediaDir = path.join(process.cwd(), "public", mediaDirName);
const mediaPublicPrefix = `/${encodeURIComponent(mediaDirName)}`;
const videoDir = path.join(process.cwd(), "public", "video");
const mobileVideoDir = path.join(process.cwd(), "public", "video-mobile");
const AUDIO_EXTS = [".m4a"];
const IMAGE_EXTS = [".jpg"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".m4v"];

const normalizeStem = (value) => value
  .normalize("NFKC")
  .toLowerCase()
  .replace(/\s*-\s*/g, "-")
  .replace(/\s+/g, " ")
  .trim();

const resolveThumbnail = (mediaFiles, filename) => {
  const base = path.parse(filename).name;
  const imageFiles = mediaFiles.filter(file => IMAGE_EXTS.includes(path.extname(file).toLowerCase()));

  const exactMatch = IMAGE_EXTS
    .map(ext => `${base}${ext}`)
    .find(image => imageFiles.some(file => file.toLowerCase() === image.toLowerCase()));

  if (exactMatch) {
    const matchedFilename = imageFiles.find(file => file.toLowerCase() === exactMatch.toLowerCase());
    return matchedFilename ? `${mediaPublicPrefix}/${encodeURIComponent(matchedFilename)}` : undefined;
  }

  const normalizedAudioStem = normalizeStem(base);
  const fuzzyMatch = imageFiles.find(imageFile => normalizeStem(path.parse(imageFile).name) === normalizedAudioStem);
  return fuzzyMatch ? `${mediaPublicPrefix}/${encodeURIComponent(fuzzyMatch)}` : undefined;
};

const resolveVideo = (videoFiles, mobileVideoFiles, filename, preferMobile = false) => {
  const base = path.parse(filename).name;

  if (preferMobile) {
    const mobileMatch = VIDEO_EXTS.map(ext => `${base}${ext}`).find(video => mobileVideoFiles.includes(video));
    if (mobileMatch) return `/video-mobile/${encodeURIComponent(mobileMatch)}`;
  }

  const fromVideoFolder = VIDEO_EXTS.map(ext => `${base}${ext}`).find(video => videoFiles.includes(video));
  if (fromVideoFolder) return `/video/${encodeURIComponent(fromVideoFolder)}`;

  if (VIDEO_EXTS.includes(path.extname(filename).toLowerCase())) {
    return `${mediaPublicPrefix}/${encodeURIComponent(filename)}`;
  }

  return undefined;
};

const files = fs.readdirSync(mediaDir);
const videoFiles = fs.existsSync(videoDir) ? fs.readdirSync(videoDir) : [];
const mobileVideoFiles = fs.existsSync(mobileVideoDir) ? fs.readdirSync(mobileVideoDir) : [];

const tracks = files
  .filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
  .map(f => ({
    title: path.parse(f).name,
    artist: "Unknown Artist",
    duration: "--:--",
    src: `${mediaPublicPrefix}/${encodeURIComponent(f)}`,
    thumbnail: resolveThumbnail(files, f),
    video: resolveVideo(videoFiles, mobileVideoFiles, f, false),
    mobileVideo: resolveVideo(videoFiles, mobileVideoFiles, f, true)
  }));

fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "data", "music-manifest.json"), JSON.stringify(tracks, null, 2) + "\n");
console.log(`Generated ${tracks.length} tracks.`);
