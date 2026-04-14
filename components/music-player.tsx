"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, LayoutGroup, useAnimationControls } from "framer-motion"
import { Play, Pause, SkipBack, SkipForward, Music2, Video, ImageIcon } from "lucide-react"
import { Repeat, Shuffle } from "lucide-react"

import { useAudioPlayer } from "@/hooks/use-audio-player"
import { ANIMATION_CONFIG } from "@/lib/constants"



interface MusicPlayerProps {
  isVisible?: boolean
}

interface Track {
  title: string
  artist: string
  duration: string
  src: string
  thumbnail?: string
  video?: string
}

function AudioBars({ playing }: { playing: boolean }) {
  if (!playing) {
    return (
      <div className="flex items-end gap-[2px] h-3">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="w-[3px] bg-white rounded-none origin-bottom"
            style={{ height: 12, transform: "scaleY(0.3)" }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0, 1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="w-[3px] bg-white rounded-none origin-bottom"
          animate={playing ? {
            scaleY: [0.3, 1, 0.5, 0.8, 0.3],
          } : { scaleY: 0.3 }}
          transition={playing ? {
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          } : { duration: 0.2 }}
          style={{ height: 12 }}
        />
      ))}
    </div>
  )
}



export function MusicPlayer({ isVisible = false }: MusicPlayerProps) {
      // Shuffle and repeat state
      const [shuffle, setShuffle] = useState(false)
      const [repeat, setRepeat] = useState(false)
      const [shuffleQueue, setShuffleQueue] = useState<number[]>([])
      const [shuffleSweep, setShuffleSweep] = useState(false)
      const [repeatSweep, setRepeatSweep] = useState(false)
      const shuffleControls = useAnimationControls()
      const repeatControls = useAnimationControls()
      const shuffleSweepInProgress = useRef(false)
      const repeatSweepInProgress = useRef(false)


      const [tracks, setTracks] = useState<Track[]>([])
      const [loading, setLoading] = useState(true)
      const [nameSweep, setNameSweep] = useState(false)
      const [thumbSweep, setThumbSweep] = useState(false)
      const [displayedIndex, setDisplayedIndex] = useState(0)
      const [showVideo, setShowVideo] = useState(false)
      const [focusMode, setFocusMode] = useState(false)
      const [videoReady, setVideoReady] = useState(false)
      const [thumbnailFallbackBySrc, setThumbnailFallbackBySrc] = useState<Record<string, string>>({})
      const [unsupportedVideoSources, setUnsupportedVideoSources] = useState<Set<string>>(new Set())
      const [isAnimating, setIsAnimating] = useState(false)
      const [showPlaylistPopup, setShowPlaylistPopup] = useState(false)
      const [showPlaylistOverlay, setShowPlaylistOverlay] = useState(false)
      const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false)
      const playerVideoRef = useRef<HTMLVideoElement | null>(null)
      const nameControls = useAnimationControls()
      const titleControls = useAnimationControls()
      const thumbControls = useAnimationControls()
      const sweepToken = useRef(0)
      const isAnimatingRef = useRef(false)
      const skipNextSweepRef = useRef(false)
      const titleContainerRef = useRef<HTMLDivElement | null>(null)
      const titleTextRef = useRef<HTMLDivElement | null>(null)
      const queueRef = useRef<HTMLDivElement | null>(null)
      const focusCardRef = useRef<HTMLDivElement | null>(null)
      const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
      const holdStartYRef = useRef<number | null>(null)
      const holdCompletedRef = useRef(false)
      const swipeDirectionRef = useRef<"down" | "up" | null>(null)
      const animationWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
      const expanded = true

      useEffect(() => {
        async function fetchTracks() {
          setLoading(true)
          try {
            const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
            const endpoint = isMobile ? "/api/music-list?profile=mobile" : "/api/music-list"
            const res = await fetch(endpoint)
            const data = await res.json()
            setTracks(data.tracks || [])
          } catch (error) {
            setTracks([])
          }
          setLoading(false)
        }
        fetchTracks()
      }, [])

      const player = useAudioPlayer({
        tracks,
        autoPlay: true,
        mediaRef: playerVideoRef,
        onEnded: () => handleNext({ skipLoadWait: true }),
      })

      const mountedRef = useRef(false)
      const initialLoadRef = useRef(true)
      useEffect(() => {
        mountedRef.current = true
        // Initialize animation controls
        shuffleControls.set({ x: "-100%" })
        repeatControls.set({ x: "-100%" })
        nameControls.set({ x: "-100%" })
        thumbControls.set({ y: "-100%" })
        return () => {
          mountedRef.current = false
        }
      }, [])

      useEffect(() => {
        setDisplayedIndex(player.trackIndex)
        if (!initialLoadRef.current && !skipNextSweepRef.current) {
          runSweep(player.trackIndex)
        }
        skipNextSweepRef.current = false
        initialLoadRef.current = false
      }, [player.trackIndex])

      const createShuffleQueue = (currentIndex: number) => {
        const remaining = tracks
          .map((_, index) => index)
          .filter(index => index !== currentIndex)

        for (let i = remaining.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
        }

        return remaining
      }

      useEffect(() => {
        if (!shuffle || tracks.length <= 1) return

        setShuffleQueue(prev => {
          const normalized = prev.filter(index => index !== player.trackIndex)
          return normalized.length > 0 ? normalized : createShuffleQueue(player.trackIndex)
        })
      }, [player.trackIndex, shuffle, tracks])

      function handlePrev() {
        const targetIndex = (player.trackIndex - 1 + tracks.length) % tracks.length
        const action = () => player.prev()

        if (!player.playing) {
          player.play()
        }

        performAnimatedTrackSwitch(action, targetIndex)
      }

      function handleTrackSelect(index: number) {
        const action = () => player.setTrack(index)
        
        if (!player.playing) {
          player.play()
        }

        performAnimatedTrackSwitch(action, index)
      }

      useEffect(() => {
        const el = queueRef.current
        if (!el) return
        
        const itemHeight = 48
        const trackTop = player.trackIndex * itemHeight
        const containerHeight = el.clientHeight
        
        // Center the track in the middle of the container
        const centeredScroll = trackTop - (containerHeight / 2 - itemHeight / 2)
        
        el.scrollTo({ top: Math.max(0, centeredScroll), behavior: "smooth" })
      }, [player.trackIndex])

      // Handle shuffle sweep animation
      useEffect(() => {
        if (!shuffleSweep || shuffleSweepInProgress.current) return

        shuffleSweepInProgress.current = true
        const animate = async () => {
          try {
            shuffleControls.set({ x: "-100%" })
            await shuffleControls.start({
              x: "100%",
              transition: {
                duration: ANIMATION_CONFIG.sweep.duration,
                ease: ANIMATION_CONFIG.sweep.ease
              }
            })
          } catch (error) {
            // Animation was cancelled
          } finally {
            shuffleSweepInProgress.current = false
            setShuffleSweep(false)
          }
        }

        animate()
      }, [shuffleSweep, shuffleControls])

      // Handle repeat sweep animation
      useEffect(() => {
        if (!repeatSweep || repeatSweepInProgress.current) return

        repeatSweepInProgress.current = true
        const animate = async () => {
          try {
            repeatControls.set({ x: "-100%" })
            await repeatControls.start({
              x: "100%",
              transition: {
                duration: ANIMATION_CONFIG.sweep.duration,
                ease: ANIMATION_CONFIG.sweep.ease
              }
            })
          } catch (error) {
            // Animation was cancelled
          } finally {
            repeatSweepInProgress.current = false
            setRepeatSweep(false)
          }
        }

        animate()
      }, [repeatSweep, repeatControls])

      async function runSweep(requestedIndex: number) {
        const myToken = ++sweepToken.current
        
        if (!mountedRef.current || isAnimatingRef.current) {
          return
        }

        isAnimatingRef.current = true

        try {
          setNameSweep(true)
          setThumbSweep(true)

          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
          if (myToken !== sweepToken.current || !mountedRef.current) {
            return
          }

          const D = ANIMATION_CONFIG.sweep.duration
          const half = D / 2

          await Promise.all([
            nameControls.start({ x: "0%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
            thumbControls.start({ y: "0%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
          ])
          await new Promise<void>(resolve => setTimeout(resolve, 100))

          if (myToken !== sweepToken.current) return

          setDisplayedIndex(requestedIndex)

          await Promise.all([
            nameControls.start({ x: "100%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
            thumbControls.start({ y: "100%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
          ])
        } finally {
          if (myToken === sweepToken.current) {
            setNameSweep(false)
            setThumbSweep(false)
          }
          isAnimatingRef.current = false
        }
      }

      // Wait for audio file to be ready
      async function waitForAudioReady(trackIdx: number, maxWait = 5000) {
        const startTime = Date.now()
        const audio = player.audioRef?.current
        
        // Check if track has load error
        if (player.loadErrors?.[trackIdx]) {
          return false
        }
        
        // Poll for audio ready state
        while (Date.now() - startTime < maxWait) {
          if (audio && audio.readyState >= 2) { // HAVE_CURRENT_DATA or better
            return true
          }
          await new Promise<void>(resolve => setTimeout(resolve, 50))
        }
        
        return false
      }

      // Wait for thumbnail image to load
      async function waitForThumbnailLoad(thumbnailSrc: string | undefined, maxWait = 5000) {
        if (!thumbnailSrc) return true // No thumbnail needed
        
        return new Promise<boolean>(resolve => {
          const img = new Image()
          const timeout = setTimeout(() => {
            resolve(false)
          }, maxWait)
          
          img.onload = () => {
            clearTimeout(timeout)
            resolve(true)
          }
          
          img.onerror = () => {
            clearTimeout(timeout)
            resolve(false)
          }
          
          img.src = thumbnailSrc
        })
      }

      async function performAnimatedTrackSwitch(
        action: () => void,
        targetIndex?: number,
        options?: { skipLoadWait?: boolean }
      ) {
        const myToken = ++sweepToken.current
        
        if (!mountedRef.current || isAnimatingRef.current) {
          return
        }

        isAnimatingRef.current = true
        setIsAnimating(true)
        if (animationWatchdogRef.current) {
          clearTimeout(animationWatchdogRef.current)
        }
        animationWatchdogRef.current = setTimeout(() => {
          isAnimatingRef.current = false
          setIsAnimating(false)
          setNameSweep(false)
          setThumbSweep(false)
        }, 8000)

        try {
          setNameSweep(true)
          setThumbSweep(true)

          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
          if (myToken !== sweepToken.current || !mountedRef.current) {
            return
          }

          const D = ANIMATION_CONFIG.sweep.duration
          const half = D / 2

          // Phase 1: Sweep in to cover
          await Promise.all([
            nameControls.start({ x: "0%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
            thumbControls.start({ y: "0%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
          ])
          
          // Phase 2: Confirm coverage
          await new Promise<void>(resolve => setTimeout(resolve, 100))

          if (myToken !== sweepToken.current) return

          // Phase 3: Execute track change while covered
          skipNextSweepRef.current = true

          // If caller provided a target index, update visual thumbnail immediately
          if (typeof targetIndex === 'number') {
            setDisplayedIndex(targetIndex)
          }

          action()

          if (!options?.skipLoadWait) {
            // Phase 3.5: Wait for audio and thumbnail to load
            const targetTrack = tracks[targetIndex ?? player.trackIndex]
            await Promise.all([
              waitForAudioReady(targetIndex ?? player.trackIndex),
              waitForThumbnailLoad(targetTrack?.thumbnail),
            ])

            // Keep sweep covering for additional 0.2s after load verification
            await new Promise<void>(resolve => setTimeout(resolve, 200))
          }

          if (myToken !== sweepToken.current) return

          // Phase 4: Sweep out to reveal new track (faster out)
          const outDuration = Math.max(0.06, half * 0.6)
          await Promise.all([
            nameControls.start({ x: "100%", transition: { duration: outDuration, ease: ANIMATION_CONFIG.sweep.ease } }),
            thumbControls.start({ y: "100%", transition: { duration: outDuration, ease: ANIMATION_CONFIG.sweep.ease } }),
          ])
          
          // Phase 5: Immediately hide the sweep elements after animation completes
          if (myToken === sweepToken.current) {
            setNameSweep(false)
            setThumbSweep(false)
          }
        } finally {
          if (animationWatchdogRef.current) {
            clearTimeout(animationWatchdogRef.current)
            animationWatchdogRef.current = null
          }
          isAnimatingRef.current = false
          setIsAnimating(false)
        }
      }

      // Shuffle logic: randomize next track without repeating until all tracks are played
      function handleNext(options?: { skipLoadWait?: boolean }) {
        if (tracks.length === 0) {
          return
        }

        let action: () => void
        let targetIndex: number | undefined

        if (shuffle && tracks.length > 1) {
          const queue = shuffleQueue.length > 0 ? shuffleQueue : createShuffleQueue(player.trackIndex)
          const [nextIdx, ...rest] = queue
          targetIndex = nextIdx
          action = () => player.setTrack(nextIdx)
          setShuffleQueue(rest)
        } else if (repeat) {
          targetIndex = player.trackIndex
          action = () => player.setTrack(player.trackIndex)
        } else {
          targetIndex = (player.trackIndex + 1) % tracks.length
          action = () => player.next()
        }

        if (!player.playing) {
          player.play()
        }

        performAnimatedTrackSwitch(action, targetIndex, options)
      }

      const displayed = tracks[displayedIndex] ?? player.currentTrack ?? { title: '', artist: '', duration: '', src: '' }
      const defaultThumbnailFromSrc = displayed.src
        ? displayed.src.replace(/\.m4a$/i, '.jpg')
        : undefined
      const displayedThumbnail = thumbnailFallbackBySrc[displayed.src] ?? displayed.thumbnail ?? defaultThumbnailFromSrc
      const canUseDisplayedVideo = Boolean(displayed.video && !unsupportedVideoSources.has(displayed.src))

      const handleDisplayedThumbnailError = () => {
        if (!displayed.src || !displayedThumbnail) return

        const toggledDashVariant = displayedThumbnail.includes('%20-%20')
          ? displayedThumbnail.replace('%20-%20', '-')
          : displayedThumbnail.includes('-')
            ? displayedThumbnail.replace('-', '%20-%20')
            : displayedThumbnail

        if (toggledDashVariant === displayedThumbnail) return

        setThumbnailFallbackBySrc(prev => ({
          ...prev,
          [displayed.src]: toggledDashVariant,
        }))
      }

      useEffect(() => {
        const container = titleContainerRef.current
        const text = titleTextRef.current
        if (!container || !text) {
          titleControls.stop()
          titleControls.set({ x: 0 })
          return
        }

        const containerWidth = container.offsetWidth
        const textWidth = text.scrollWidth
        if (textWidth <= containerWidth) {
          titleControls.stop()
          titleControls.set({ x: 0 })
          return
        }

        const distance = textWidth - containerWidth
        titleControls.start({
          x: [0, -distance, 0],
          transition: {
            duration: Math.max(6, distance / 30),
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop",
            times: [0, 0.5, 1],
            delay: 1,
          },
        })
      }, [displayed.title, titleControls])

      useEffect(() => {
        setShowVideo(false)
        setFocusMode(false)
        setVideoReady(false)
      }, [displayedIndex])

      useEffect(() => {
        setVideoReady(false)
      }, [displayed.video])

      useEffect(() => {
        return () => {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current)
            holdTimerRef.current = null
          }
          if (animationWatchdogRef.current) {
            clearTimeout(animationWatchdogRef.current)
            animationWatchdogRef.current = null
          }
        }
      }, [])

      useEffect(() => {
        if (!showPlaylistPopup) {
          setShowPlaylistOverlay(false)
          return
        }

        const timer = setTimeout(() => {
          setShowPlaylistOverlay(true)
        }, 240)

        return () => clearTimeout(timer)
      }, [showPlaylistPopup])

      useEffect(() => {
        setIsLayoutTransitioning(true)
        const timer = setTimeout(() => setIsLayoutTransitioning(false), 650)
        return () => clearTimeout(timer)
      }, [showPlaylistPopup])

      useEffect(() => {
        if (!focusMode) return

        const handlePointerDown = (event: PointerEvent) => {
          const target = event.target as Node | null
          if (!target) return
          if (focusCardRef.current?.contains(target)) return
          setFocusMode(false)
        }

        document.addEventListener("pointerdown", handlePointerDown)
        return () => {
          document.removeEventListener("pointerdown", handlePointerDown)
        }
      }, [focusMode])

      const startThumbnailHold = () => {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current)
        }
        holdCompletedRef.current = false
        swipeDirectionRef.current = null
        holdTimerRef.current = setTimeout(() => {
          setFocusMode(true)
          holdCompletedRef.current = true
          holdTimerRef.current = null
        }, 700)
      }

      const cancelThumbnailHold = () => {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current)
          holdTimerRef.current = null
        }
        holdCompletedRef.current = false
        holdStartYRef.current = null
        swipeDirectionRef.current = null
      }

      const handleThumbnailPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        holdStartYRef.current = event.clientY
        startThumbnailHold()
      }

      const handleThumbnailPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!holdCompletedRef.current) return
        if (!canUseDisplayedVideo) return
        if (holdStartYRef.current === null) return

        const deltaY = event.clientY - holdStartYRef.current
        if (deltaY >= 60) {
          swipeDirectionRef.current = "down"
        } else if (deltaY <= -60) {
          swipeDirectionRef.current = "up"
        }
      }

      const handleThumbnailPointerEnd = () => {
        if (holdCompletedRef.current && swipeDirectionRef.current && canUseDisplayedVideo) {
          if (swipeDirectionRef.current === "down") {
            setShowVideo(true)
            setFocusMode(false)
          } else if (swipeDirectionRef.current === "up") {
            setShowVideo(false)
            setFocusMode(false)
          }
        }
        cancelThumbnailHold()
      }

      if (loading) {
        return <div className="!text-white">Đang tải danh sách nhạc...</div>;
      }
      if (!tracks || tracks.length === 0) {
        return <div className="!text-white">Không có file nhạc nào trong thư mục <b>public/music &amp; thumbail</b>.</div>;
      }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-center items-center"
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.95,
        y: isVisible ? 0 : 20,
      }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
    >
      <motion.div
        className={`bg-black border border-white/10 relative inset-0 p-4 w-full h-full ${focusMode ? "overflow-visible" : "overflow-hidden"}`}
        animate={{
          height: expanded ? '100%' : 48,
        }}
        transition={ANIMATION_CONFIG.sweep}
        style={{
          boxShadow: showVideo
            ? "0 0 0 1px rgba(255,255,255,.08)"
            : expanded
            ? "0 0 0 1px rgba(255,255,255,.1), 0 20px 50px -10px rgba(0,0,0,.8)"
            : "0 0 40px rgba(255,255,255,.05), 0 4px 20px -5px rgba(0,0,0,.5)",
        }}
      >
        {displayedThumbnail && (
          <img
            src={displayedThumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-55 blur-3xl scale-125 pointer-events-none"
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-black/45 backdrop-blur-xl pointer-events-none" />

        <motion.div
          className="h-full flex flex-col relative z-10"
          animate={{ padding: expanded ? 16 : 10 }}
          transition={ANIMATION_CONFIG.sweep}
          style={{ padding: expanded ? "clamp(10px, 2.8vw, 16px)" : "clamp(8px, 2vw, 10px)" }}
        >
          <LayoutGroup>
          <AnimatePresence>
            {!expanded ? (
              <motion.div
                key="compact"
                className="flex items-center gap-3 h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.button
                  onClick={player.toggle}
                  className="w-7 h-7 !bg-white !text-black rounded-none flex items-center justify-center flex-shrink-0 hover:!bg-slate-100 transition-transform"
                  whileTap={{ scale: 0.95 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {player.playing ? (
                      <motion.span
                        key="compact-pause"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                      >
                        <Pause className="w-3 h-3" fill="currentColor" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="compact-play"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                      >
                        <Play className="w-3 h-3" fill="currentColor" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                {/* Tên bài hát chạy marquee nếu quá dài, với hiệu ứng sp khi đổi bài */}
                <div className="min-w-0 flex-1 relative">
                  <div className="relative inline-block">
                    <AnimatePresence>
                      {nameSweep && (
                        <motion.div
                          className="absolute inset-0 !bg-white z-0 pointer-events-none"
                          initial={{ x: "-100%" }}
                          animate={nameControls}
                          exit={{ opacity: 0, transition: { duration: 0 } }}
                        />
                      )}
                    </AnimatePresence>
                    <p className="text-[clamp(16px,4.2vw,22px)] font-semibold !text-white truncate leading-tight relative z-10">
                      {displayed.title}
                    </p>
                  </div>
                </div>

                <AudioBars playing={player.playing} />
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <AnimatePresence initial={false} mode="popLayout">
                {showPlaylistPopup ? (
                  <motion.div
                    key="mini-header"
                    className="flex items-center gap-3 border-b border-white/10 pb-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.button
                      type="button"
                      onClick={() => setShowPlaylistPopup(false)}
                      layoutId="player-artwork"
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                      className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/10 overflow-hidden flex items-center justify-center shrink-0"
                      title="Quay lại player lớn"
                    >
                      {displayedThumbnail ? (
                        <img
                          src={displayedThumbnail}
                          alt={`${displayed.title} artwork`}
                          className="w-full h-full object-cover"
                          onError={handleDisplayedThumbnailError}
                        />
                      ) : (
                        <Music2 className="w-8 h-8 text-white/70" />
                      )}
                    </motion.button>

                    <motion.div
                      layoutId="player-title-block"
                      className={`min-w-0 flex-1 relative ${isLayoutTransitioning ? "z-[80] overflow-visible" : "z-20 overflow-hidden"}`}
                    >
                      <motion.p
                        layoutId="player-title-text"
                        className={`font-semibold text-white leading-tight text-[clamp(24px,5vw,34px)] relative max-w-full truncate ${isLayoutTransitioning ? "z-[90]" : "z-20"}`}
                      >
                        {displayed.title}
                      </motion.p>
                      <div className="relative mt-1 w-[100px] h-4">
                        <span className="sr-only">{displayed.artist}</span>
                        <motion.div
                          layoutId="player-artist-bar"
                          className={`absolute inset-0 bg-white/90 pointer-events-none ${isLayoutTransitioning ? "z-[90]" : "z-20"}`}
                          aria-hidden="true"
                        />
                      </div>
                    </motion.div>

                    <div className="flex items-center gap-2">
                    <motion.button
                        onClick={handlePrev}
                        disabled={isAnimating}
                        className={`w-16 h-16 sm:w-[72px] sm:h-[72px] text-white hover:text-white hover:bg-white/10 transition-all flex items-center justify-center rounded-none disabled:opacity-50 disabled:cursor-not-allowed relative ${isLayoutTransitioning ? "z-[95]" : "z-20"}`}
                        whileTap={{ scale: 0.9 }}
                      >
                        <SkipBack className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" />
                      </motion.button>
                      <motion.button
                        onClick={player.toggle}
                        className={`w-[52px] h-[52px] sm:w-14 sm:h-14 bg-white text-slate-950 flex items-center justify-center hover:bg-slate-100 transition-transform rounded-none border border-white/10 relative ${isLayoutTransitioning ? "z-[95]" : "z-20"}`}
                        whileTap={{ scale: 0.95 }}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {player.playing ? (
                            <motion.span
                              key="mini-pause"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.16 }}
                            >
                              <Pause className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" />
                            </motion.span>
                          ) : (
                            <motion.span
                              key="mini-play"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.16 }}
                            >
                              <Play className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                      <motion.button
                        onClick={() => handleNext()}
                        disabled={isAnimating}
                        className={`w-16 h-16 sm:w-[72px] sm:h-[72px] text-white hover:text-white hover:bg-white/10 transition-all flex items-center justify-center rounded-none disabled:opacity-50 disabled:cursor-not-allowed relative ${isLayoutTransitioning ? "z-[95]" : "z-20"}`}
                        whileTap={{ scale: 0.9 }}
                      >
                        <SkipForward className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" />
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                <motion.div
                  key="large-header"
                  className="flex flex-col gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className={`min-w-0 w-full relative ${focusMode ? "overflow-visible" : "overflow-hidden"}`}>
                    <div className="relative w-full flex flex-col items-center justify-center gap-3">
                      <div className="mt-12 sm:mt-14 flex items-center justify-center w-full relative">
                        {displayedThumbnail || displayed.video ? (
                          <motion.div
                            layoutId="player-artwork"
                            ref={focusCardRef}
                            className={`w-[min(80vw,390px)] sm:w-[min(74vw,420px)] h-[min(80vw,390px)] sm:h-[min(74vw,420px)] bg-white/5 relative ${
                              focusMode ? "fixed inset-0 m-auto z-[130] shadow-[0_0_0_1px_rgba(255,255,255,.15),0_30px_80px_rgba(0,0,0,.55)]" : ""
                            }`}
                            animate={focusMode ? { scale: 1.06 } : { scale: 1 }}
                            transition={{ duration: 0.25, ease: "easeOut", layout: { type: "spring", stiffness: 360, damping: 32 } }}
                          >
                            <div className="absolute inset-0 overflow-hidden">
                            <button
                              type="button"
                              className="absolute inset-0 z-10"
                              onPointerDown={handleThumbnailPointerDown}
                              onPointerMove={handleThumbnailPointerMove}
                              onPointerUp={handleThumbnailPointerEnd}
                              onPointerCancel={handleThumbnailPointerEnd}
                              onPointerLeave={handleThumbnailPointerEnd}
                              title="Giữ 0.7 giây rồi kéo xuống để xem video, kéo lên để tắt video"
                            />
                            {canUseDisplayedVideo ? (
                              <div
                                className="relative h-full w-full"
                                style={{ contain: "layout paint style", transform: "translateZ(0)" }}
                              >
                                <video
                                  ref={playerVideoRef}
                                  src={player.currentTrack?.src || displayed.src}
                                  className={`h-full w-full object-cover object-center transform-gpu will-change-transform [backface-visibility:hidden] transition-opacity duration-200 ${
                                    showVideo ? "opacity-100" : "opacity-0 pointer-events-none"
                                  }`}
                                  autoPlay
                                  muted={false}
                                  playsInline
                                  preload="auto"
                                  onLoadedData={(event) => {
                                    const el = event.currentTarget
                                    el.defaultPlaybackRate = 1
                                    el.playbackRate = 1
                                    setVideoReady(true)
                                  }}
                                  onCanPlay={(event) => {
                                    const el = event.currentTarget
                                    el.defaultPlaybackRate = 1
                                    el.playbackRate = 1
                                    setVideoReady(true)
                                  }}
                                  onError={() => {
                                    setUnsupportedVideoSources(prev => {
                                      if (prev.has(displayed.src)) return prev
                                      const next = new Set(prev)
                                      next.add(displayed.src)
                                      return next
                                    })
                                    setShowVideo(false)
                                    setVideoReady(false)
                                  }}
                                />
                                {displayedThumbnail && (!showVideo || !videoReady) && (
                                  <img
                                    src={displayedThumbnail}
                                    alt={`${displayed.title} artwork`}
                                    className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
                                    onError={handleDisplayedThumbnailError}
                                  />
                                )}
                              </div>
                            ) : displayedThumbnail ? (
                              <img
                                src={displayedThumbnail}
                                alt={`${displayed.title} artwork`}
                                className="h-full w-full object-cover object-center"
                                onError={handleDisplayedThumbnailError}
                              />
                            ) : (
                              <div className="h-full w-full bg-white/10 flex items-center justify-center">
                                <Music2 className="w-10 h-10 sm:w-12 sm:h-12 text-white/70" />
                              </div>
                            )}
                            <AnimatePresence mode="wait">
                              {thumbSweep && (
                                <motion.div
                                  key="thumb-sweep"
                                  className="absolute inset-x-0 top-0 h-full bg-white z-20 pointer-events-none"
                                  initial={{ y: "-100%" }}
                                  animate={thumbControls}
                                  exit={{ opacity: 0, transition: { duration: 0 } }}
                                  style={{ borderRadius: 0, width: '100%' }}
                                />
                              )}
                            </AnimatePresence>
                            </div>
                            <AnimatePresence>
                              {focusMode && canUseDisplayedVideo && (
                                <motion.button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (showVideo) {
                                      setShowVideo(false)
                                    } else {
                                      setShowVideo(true)
                                    }
                                  }}
                                  className={`absolute left-1/2 top-full -translate-x-1/2 mt-3 z-[140] w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-none border transition-colors ${
                                    showVideo
                                      ? "bg-white text-slate-950 border-white hover:bg-slate-100"
                                      : "bg-black/55 text-white border-white/30 hover:bg-black/75"
                                  }`}
                                  initial={{ opacity: 0, y: 24 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 12 }}
                                  transition={{ duration: 0.25, ease: "easeOut" }}
                                  title={showVideo ? "Hiện ảnh bìa" : "Hiện video"}
                                >
                                  {showVideo ? <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ) : (
                          <div className="w-[min(80vw,390px)] sm:w-[min(74vw,420px)] h-[min(80vw,390px)] sm:h-[min(74vw,420px)] overflow-hidden bg-white/10 flex items-center justify-center">
                            <Music2 className="w-10 h-10 sm:w-12 sm:h-12 text-white/70" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`pt-6 mt-auto pb-12 relative ${showPlaylistPopup ? "min-h-[52vh]" : ""}`}>
              {!showPlaylistPopup && (
                <div>
                  <div className="mb-4 px-1">
                    <div className={`relative px-3 py-2.5 ${isLayoutTransitioning ? "overflow-visible" : "overflow-hidden"}`}>
                      <motion.div
                        layoutId="player-title-block"
                        className={`relative ${isLayoutTransitioning ? "z-[80] overflow-visible" : "z-20 overflow-hidden"}`}
                      >
                        <motion.p
                          layoutId="player-title-text"
                          className={`font-semibold text-white leading-tight text-[clamp(30px,7.2vw,46px)] relative max-w-full truncate ${isLayoutTransitioning ? "z-[90]" : "z-20"}`}
                        >
                          {displayed.title}
                        </motion.p>
                      </motion.div>
                      <div className="relative mt-1 w-[120px] h-5">
                        <span className="sr-only">{displayed.artist}</span>
                        <motion.div
                          layoutId="player-artist-bar"
                          className={`absolute inset-0 bg-white/90 pointer-events-none ${isLayoutTransitioning ? "z-[90]" : "z-20"}`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 flex justify-center">
                    <div className="w-[min(80vw,390px)] sm:w-[min(74vw,420px)]">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={player.progress}
                        onChange={(event) => player.seekToPercent(Number(event.target.value))}
                        className="timeline-slider w-full h-3 cursor-pointer"
                        aria-label="Timeline"
                        style={{ ["--timeline-progress" as string]: `${player.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mx-auto w-[min(76vw,360px)] sm:w-[min(70vw,390px)]">
                    <div className="grid items-center gap-2 sm:gap-3 grid-cols-[1fr_auto_1fr]">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  if (shuffleSweepInProgress.current) return
                  setShuffle(!shuffle)
                  setShuffleSweep(true)
                }}
                disabled={isAnimating || shuffleSweep}
                className={`w-16 h-16 sm:w-[78px] sm:h-[78px] flex items-center justify-center transition-all rounded-none relative overflow-hidden disabled:cursor-not-allowed ${
                  shuffle ? '!bg-white !text-slate-950 hover:bg-slate-100' : '!text-white'
                }`}
                title="Shuffle"
              >
                <AnimatePresence mode="wait">
                  {shuffleSweep && (
                    <motion.div
                      className="absolute inset-0 bg-white z-30 pointer-events-none rounded-none"
                      initial={{ x: "-100%" }}
                      animate={shuffleControls}
                      exit={{ opacity: 0, transition: { duration: 0 } }}
                    />
                  )}
                </AnimatePresence>
                <Shuffle className="w-8 h-8 sm:w-11 sm:h-11 relative z-10" />
                {shuffle && (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-[4px] h-[4px] bg-black rounded-none z-20"></div>
                )}
              </button>

              <motion.button
                onClick={handlePrev}
                disabled={isAnimating}
                className={`w-16 h-16 sm:w-[78px] sm:h-[78px] text-white hover:text-white hover:bg-white/10 transition-all flex items-center justify-center rounded-none disabled:opacity-50 disabled:cursor-not-allowed relative ${isLayoutTransitioning ? "z-[95]" : "z-20"}`}
                whileTap={{ scale: 0.9 }}
              >
                <SkipBack className="w-8 h-8 sm:w-11 sm:h-11" fill="currentColor" />
              </motion.button>
            </div>

            <motion.button
              onClick={player.toggle}
              className={`w-14 h-14 sm:w-20 sm:h-20 bg-white text-slate-950 flex items-center justify-center hover:bg-slate-100 hover:scale-105 transition-transform rounded-none border border-white/10 relative ${isLayoutTransitioning ? "z-[95]" : "z-20"}`}
              whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {player.playing ? (
                  <motion.span
                    key="main-pause"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <Pause className="w-6 h-6 sm:w-10 sm:h-10" fill="currentColor" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="main-play"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <Play className="w-6 h-6 sm:w-10 sm:h-10" fill="currentColor" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <div className="flex items-center justify-start gap-3">
              <motion.button
                onClick={() => handleNext()}
                disabled={isAnimating}
                className={`w-16 h-16 sm:w-[78px] sm:h-[78px] text-white hover:text-white hover:bg-white/10 transition-all flex items-center justify-center rounded-none disabled:opacity-50 disabled:cursor-not-allowed relative ${isLayoutTransitioning ? "z-[95]" : "z-20"}`}
                whileTap={{ scale: 0.9 }}
              >
                <SkipForward className="w-8 h-8 sm:w-11 sm:h-11" fill="currentColor" />
              </motion.button>

              <button
                onClick={() => {
                  if (repeatSweepInProgress.current) return
                  setRepeat(!repeat)
                  setRepeatSweep(true)
                }}
                disabled={repeatSweep}
                className={`w-16 h-16 sm:w-[78px] sm:h-[78px] flex items-center justify-center transition-all rounded-none relative overflow-hidden disabled:cursor-not-allowed ${
                  repeat ? '!bg-white !text-slate-950 hover:bg-slate-100' : '!text-white'
                }`}
                title="Repeat"
              >
                <AnimatePresence mode="wait">
                  {repeatSweep && (
                    <motion.div
                      className="absolute inset-0 bg-white z-30 pointer-events-none rounded-none"
                      initial={{ x: "-100%" }}
                      animate={repeatControls}
                      exit={{ opacity: 0, transition: { duration: 0 } }}
                    />
                  )}
                </AnimatePresence>
                <Repeat className="w-8 h-8 sm:w-11 sm:h-11 relative z-10" />
                {repeat && (
                  <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/3 w-[4px] h-[4px] bg-black rounded-none z-20"></div>
                )}
              </button>
            </div>
                    </div>
                  </div>
                </div>
              )}

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShowPlaylistPopup((prev) => !prev)}
                className="px-4 py-2 text-sm text-white border border-white/20 hover:bg-white/10 transition-colors rounded-none"
              >
                {showPlaylistPopup ? "Close Playlist" : "Playlist"}
              </button>
            </div>

            {showPlaylistPopup && showPlaylistOverlay && (
              <motion.div
                className="absolute inset-x-0 bottom-0 top-6 bg-black/92 border border-white/15 pt-2 px-1 z-30"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.22 }}
              >
                <div ref={queueRef} className="h-full overflow-y-auto hide-scrollbar">
                  {tracks.map((track, i) => (
                    <button
                      key={`${track.title}-${i}`}
                      onClick={() => handleTrackSelect(i)}
                      className={`w-full flex items-center gap-3 px-2 py-3 text-left transition-colors ${
                        player.trackIndex === i ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <span className={`text-[10px] font-mono ${player.trackIndex === i ? "text-white" : "text-white/40"}`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={`flex-1 truncate text-sm ${player.trackIndex === i ? "text-white" : "text-white/70"}`}>
                        {track.title}
                      </span>
                      <AudioBars playing={player.playing && player.trackIndex === i} />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
          </LayoutGroup>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {focusMode && (
          <motion.button
            type="button"
            className="fixed inset-0 z-[110] bg-transparent pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Đóng chế độ xem nổi bật"
          />
        )}
      </AnimatePresence>

    </motion.div>
  )
}
