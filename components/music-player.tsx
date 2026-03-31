"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, useAnimationControls } from "framer-motion"
import { Play, Pause, SkipBack, SkipForward, Music2 } from "lucide-react"
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
}

function AudioBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0, 1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="w-[3px] bg-white rounded-full origin-bottom"
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


      const [hovered, setHovered] = useState(false)
      const [tracks, setTracks] = useState<Track[]>([])
      const [loading, setLoading] = useState(true)
      const [visibleNow, setVisibleNow] = useState(isVisible)
      const [nameSweep, setNameSweep] = useState(false)
      const [thumbSweep, setThumbSweep] = useState(false)
      const [displayedIndex, setDisplayedIndex] = useState(0)
      const pendingIndex = useRef<number>(0)
      const nameControls = useAnimationControls()
      const titleControls = useAnimationControls()
      const thumbControls = useAnimationControls()
      const sweepToken = useRef(0)
      const isAnimatingRef = useRef(false)
      const skipNextSweepRef = useRef(false)
      const titleContainerRef = useRef<HTMLDivElement | null>(null)
      const titleTextRef = useRef<HTMLDivElement | null>(null)
      const queueRef = useRef<HTMLDivElement | null>(null)
      const expanded = true

      useEffect(() => {
        async function fetchTracks() {
          setLoading(true)
          try {
            const res = await fetch("/api/music-list")
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
      })

      const mountedRef = useRef(false)
      const initialLoadRef = useRef(true)
      useEffect(() => {
        mountedRef.current = true
        return () => {
          mountedRef.current = false
        }
      }, [])

      useEffect(() => {
        setDisplayedIndex(player.trackIndex)
        pendingIndex.current = player.trackIndex
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
        player.prev()
        if (!player.playing) {
          player.play()
        }
      }

      function handleTrackSelect(index: number) {
        player.setTrack(index)
        if (!player.playing) {
          player.play()
        }
      }

      useEffect(() => {
        const handler = () => player.play()
        const started = () => setVisibleNow(true)
        window.addEventListener("unlockAudio", handler)
        window.addEventListener("musicStarted", started)

        if ((typeof window !== "undefined") && (window as any).__musicStarted) setVisibleNow(true)

        return () => {
          window.removeEventListener("unlockAudio", handler)
          window.removeEventListener("musicStarted", started)
        }
      }, [player])

      useEffect(() => {
        if (!isVisible) setVisibleNow(false)
      }, [isVisible])

      useEffect(() => {
        const el = queueRef.current
        if (!el) return
        const top = player.trackIndex * 48
        el.scrollTo({ top, behavior: "smooth" })
      }, [player.trackIndex])

      async function runSweep(requestedIndex: number) {
        const myToken = ++sweepToken.current
        
        if (!mountedRef.current || isAnimatingRef.current) {
          return
        }

        isAnimatingRef.current = true

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        if (myToken !== sweepToken.current || !mountedRef.current) {
          isAnimatingRef.current = false
          return
        }

        setNameSweep(true)
        setThumbSweep(true)

        nameControls.stop()
        thumbControls.stop()
        nameControls.set({ x: "-100%" })
        thumbControls.set({ y: "-100%" })

        const D = ANIMATION_CONFIG.sweep.duration
        const half = D / 2

        try {
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

      async function performAnimatedTrackSwitch(action: () => void) {
        const myToken = ++sweepToken.current
        
        if (!mountedRef.current || isAnimatingRef.current) {
          return
        }

        isAnimatingRef.current = true

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        if (myToken !== sweepToken.current || !mountedRef.current) {
          isAnimatingRef.current = false
          return
        }

        setNameSweep(true)
        setThumbSweep(true)

        nameControls.stop()
        thumbControls.stop()
        nameControls.set({ x: "-100%" })
        thumbControls.set({ y: "-100%" })

        const D = ANIMATION_CONFIG.sweep.duration
        const half = D / 2

        try {
          // Phase 1: Sweep in to cover
          await Promise.all([
            nameControls.start({ x: "0%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
            thumbControls.start({ y: "0%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } }),
          ])
          
          // Phase 2: Confirm coverage
          await new Promise<void>(resolve => setTimeout(resolve, 150))

          if (myToken !== sweepToken.current) return

          // Phase 3: Execute track change while covered
          skipNextSweepRef.current = true
          action()

          // Phase 4: Sweep out to reveal new track
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

      // Shuffle logic: randomize next track without repeating until all tracks are played
      function handleNext() {
        let action: () => void

        if (shuffle && tracks.length > 1) {
          const queue = shuffleQueue.length > 0 ? shuffleQueue : createShuffleQueue(player.trackIndex)
          const [nextIdx, ...rest] = queue
          action = () => player.setTrack(nextIdx)
          setShuffleQueue(rest)
        } else if (repeat) {
          action = () => player.setTrack(player.trackIndex)
        } else {
          action = () => player.next()
        }

        if (!player.playing) {
          player.play()
        }

        performAnimatedTrackSwitch(action)
      }

      const displayed = tracks[displayedIndex] ?? player.currentTrack ?? { title: '', artist: '', duration: '', src: '' }

      useEffect(() => {
        const container = titleContainerRef.current
        const text = titleTextRef.current
        if (!container || !text) {
          titleControls.set({ x: 0 })
          return
        }

        const containerWidth = container.offsetWidth
        const textWidth = text.scrollWidth
        if (textWidth <= containerWidth) {
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

      if (loading) {
        return <div className="text-white">Đang tải danh sách nhạc...</div>;
      }
      if (!tracks || tracks.length === 0) {
        return <div className="text-white">Không có file nhạc nào trong thư mục <b>public/music</b>.</div>;
      }

      // Chiều cao cố định để chạy gần full viewport
      const FIXED_HEIGHT = 'calc(100vh - 32px)'

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        className="bg-[#0a0a0a]/95 border border-white/10 overflow-hidden backdrop-blur-xl relative inset-0 p-4 w-full h-full"
        animate={{
          height: expanded ? '100%' : 48,
        }}
        transition={ANIMATION_CONFIG.sweep}
        style={{
          boxShadow: expanded
            ? "0 0 0 1px rgba(255,255,255,.1), 0 20px 50px -10px rgba(0,0,0,.8)"
            : "0 0 40px rgba(255,255,255,.05), 0 4px 20px -5px rgba(0,0,0,.5)",
        }}
      >
        <motion.div
          className="h-[2px] bg-white/5 relative overflow-hidden"
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 bg-white"
            animate={{ width: `${player.progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </motion.div>

        <motion.div
          className="h-full flex flex-col"
          animate={{ padding: expanded ? 16 : 10 }}
          transition={ANIMATION_CONFIG.sweep}
        >
          <AnimatePresence mode="wait">
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
                  className="w-7 h-7 bg-white text-black rounded-none flex items-center justify-center flex-shrink-0 hover:bg-slate-100 transition-transform"
                  whileTap={{ scale: 0.95 }}
                >
                  {player.playing ? (
                    <Pause className="w-3 h-3" fill="currentColor" />
                  ) : (
                    <Play className="w-3 h-3" fill="currentColor" />
                  )}
                </motion.button>

                <div className="min-w-0 flex-1 relative">
                  <div className="relative inline-block">
                    <AnimatePresence>
                      {nameSweep && (
                        <motion.div
                          className="absolute inset-0 bg-white z-0 pointer-events-none"
                          initial={{ x: "-100%" }}
                          animate={nameControls}
                        />
                      )}
                    </AnimatePresence>
                    <p className="text-[11px] font-medium text-white truncate leading-tight relative z-10">
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
                <div className="flex flex-col gap-3">
                  <div className="min-w-0 w-full relative overflow-hidden">
                    <div className="relative w-full flex flex-col items-center justify-center gap-3">
                      <div className="flex items-center justify-center w-full relative">
                        {displayed.thumbnail ? (
                          <div className="w-[min(88vw,360px)] h-[min(88vw,360px)] overflow-hidden bg-white/5 relative">
                            <img
                              src={displayed.thumbnail}
                              alt={`${displayed.title} artwork`}
                              className="h-full w-full object-cover object-center"
                            />
                            <AnimatePresence mode="wait">
                              {thumbSweep && (
                                <motion.div
                                  key={`thumb-sweep-${player.trackIndex}`}
                                  className="absolute inset-x-0 top-0 h-full bg-white z-20 pointer-events-none"
                                  initial={{ y: "-100%" }}
                                  animate={thumbControls}
                                  style={{ borderRadius: 0, width: '100%' }}
                                />
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <div className="w-[min(88vw,360px)] h-[min(88vw,360px)] overflow-hidden bg-white/10 flex items-center justify-center">
                            <Music2 className="w-12 h-12 text-white/70" />
                          </div>
                        )}
                      </div>

                      <div className="relative inline-block w-full max-w-full text-center">
                        <AnimatePresence mode="wait">
                          {nameSweep && (
                            <motion.div
                              key={`sweep-${player.trackIndex}`}
                              className="absolute inset-0 bg-white z-10 pointer-events-none"
                              initial={{ x: "-100%" }}
                              animate={nameControls}
                              style={{ borderRadius: 0, height: '100%', width: '100%' }}
                            />
                          )}
                        </AnimatePresence>
                        <div ref={titleContainerRef} className="relative w-full overflow-hidden">
                          <motion.div
                            ref={titleTextRef}
                            className="inline-block whitespace-nowrap relative z-20"
                            animate={titleControls}
                          >
                            <p className="font-semibold text-white leading-tight text-[22px] mx-auto" style={{ lineHeight: '28px', fontSize: 22 }}>
                              {displayed.title}
                            </p>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="flex-1 overflow-hidden"
            animate={{ marginTop: expanded ? 16 : 0, opacity: expanded ? 1 : 0 }}
            transition={ANIMATION_CONFIG.sweep}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-white/10 pt-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-[.15em] font-medium">Queue</p>
                <p className="text-[10px] text-white/30 font-mono">
                  {player.trackIndex + 1}/{tracks.length}
                </p>
              </div>

              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto" ref={queueRef}>
                  <motion.div
                    className="absolute left-0 right-0 flex items-center justify-between pointer-events-none z-10 px-6"
                    animate={{ top: player.trackIndex * 48 }}
                    transition={ANIMATION_CONFIG.sweep}
                    style={{ height: 48 }}
                  >
                    <span className="text-white text-sm font-mono animate-pulse">&gt;</span>
                    <span className="text-white text-sm font-mono animate-pulse">&lt;</span>
                  </motion.div>

                  <div className="flex flex-col pt-1 pb-6">
                    {tracks.map((track, i) => (
                      <button
                        key={`${track.title}-${i}`}
                        onClick={() => handleTrackSelect(i)}
                        className={`w-full flex items-center gap-3 px-6 text-left transition-all duration-300 ${
                          player.trackIndex === i ? "bg-white/5" : "hover:bg-white/5"
                        }`}
                        style={{ height: 48 }}
                      >
                        <span className="text-[10px] font-mono text-white/30 w-4">
                          {String(i + 1).padStart(2, "0")}
                        </span>

                        <span
                          className={`text-sm flex-1 truncate text-center transition-colors ${
                            player.trackIndex === i ? "text-white" : "text-white/50"
                          }`}
                        >
                          {track.title}
                          {player.loadErrors && player.loadErrors[i] && (
                            <span className="ml-2 text-[10px] text-rose-400">(file missing)</span>
                          )}
                        </span>

                        <span className="text-[10px] font-mono text-white/30">{track.duration}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShuffle(s => !s)
                }}
                disabled={isAnimatingRef.current}
                className={`w-10 h-10 flex items-center justify-center text-white ${shuffle ? 'bg-white/10' : 'bg-transparent'} hover:bg-white/10 transition-all rounded-full relative disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Shuffle"
              >
                <Shuffle className="w-6 h-6" />
                {shuffle && (
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-[4px] h-[4px] bg-white rounded-full"></div>
                )}
              </button>

              <motion.button
                onClick={handlePrev}
                disabled={isAnimatingRef.current}
                className="w-10 h-10 text-white hover:text-white hover:bg-white/10 transition-all flex items-center justify-center rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                whileTap={{ scale: 0.9 }}
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </motion.button>
            </div>

            <motion.button
              onClick={player.toggle}
              className="w-12 h-12 bg-white text-slate-950 flex items-center justify-center hover:bg-slate-100 hover:scale-105 transition-transform rounded-none border border-white/10"
              whileTap={{ scale: 0.95 }}
            >
              {player.playing ? (
                <Pause className="w-4 h-4" fill="currentColor" />
              ) : (
                <Play className="w-4 h-4" fill="currentColor" />
              )}
            </motion.button>

            <div className="flex items-center justify-start gap-3">
              <motion.button
                onClick={handleNext}
                disabled={isAnimatingRef.current}
                className="w-10 h-10 text-white hover:text-white hover:bg-white/10 transition-all flex items-center justify-center rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                whileTap={{ scale: 0.9 }}
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </motion.button>

              <button
                onClick={() => {
                  setRepeat(r => !r)
                }}
                className={`w-10 h-10 flex items-center justify-center text-white ${repeat ? 'bg-white/10' : 'bg-transparent'} hover:bg-white/10 transition-all rounded-full`}
                title="Repeat"
              >
                <Repeat className="w-6 h-6" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
