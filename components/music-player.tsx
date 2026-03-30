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

      const [hovered, setHovered] = useState(false)
      const [tracks, setTracks] = useState<Track[]>([])
      const [loading, setLoading] = useState(true)
      const [visibleNow, setVisibleNow] = useState(isVisible)
      const [nameSweep, setNameSweep] = useState(false)
      const [displayedIndex, setDisplayedIndex] = useState(0)
      const pendingIndex = useRef<number>(0)
      const nameControls = useAnimationControls()
      const sweepToken = useRef(0)
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

      useEffect(() => {
        setDisplayedIndex(player.trackIndex)
        pendingIndex.current = player.trackIndex
        runSweep(player.trackIndex)
      }, [player.trackIndex])

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
        setNameSweep(true)

        nameControls.stop()
        nameControls.set({ x: "-100%" })

        const D = (ANIMATION_CONFIG.sweep.duration || 0.5)
        const half = D / 2

        try {
          await nameControls.start({ x: "0%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } })
          await new Promise<void>(resolve => setTimeout(resolve, 100))

          if (myToken !== sweepToken.current) return

          setDisplayedIndex(requestedIndex)

          await nameControls.start({ x: "100%", transition: { duration: half, ease: ANIMATION_CONFIG.sweep.ease } })
        } finally {
          if (myToken === sweepToken.current) setNameSweep(false)
        }
      }

      // Shuffle logic: randomize next track
      function handleNext() {
        if (shuffle && tracks.length > 1) {
          let nextIdx: number
          do {
            nextIdx = Math.floor(Math.random() * tracks.length)
          } while (nextIdx === player.trackIndex)
          player.setTrack(nextIdx)
        } else if (repeat) {
          player.setTrack(player.trackIndex)
        } else {
          player.next()
        }

        if (!player.playing) {
          player.play()
        }
      }

      if (loading) {
        return <div className="text-white">Đang tải danh sách nhạc...</div>;
      }
      if (!tracks || tracks.length === 0) {
        return <div className="text-white">Không có file nhạc nào trong thư mục <b>public/music</b>.</div>;
      }

  const displayed = tracks[displayedIndex] ?? player.currentTrack ?? { title: '', artist: '', duration: '', src: '' }


  // Chiều cao cố định: header + queue + padding + controls + extra spacing
  const FIXED_HEIGHT = 48 + (48 * 5) + 40 + 80 + 20;

  return (
    <motion.div
      className="fixed bottom-8 left-1/2 z-50"
      initial={{ opacity: 0, scale: 0.5, x: "-50%" }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.5,
        x: "-50%",
      }}
      transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        className="bg-[#0a0a0a]/95 border border-white/10 overflow-hidden backdrop-blur-xl relative"
        animate={{
          width: expanded ? 340 : 180,
          height: expanded ? FIXED_HEIGHT : 48,
        }}
        transition={ANIMATION_CONFIG.sweep}
        style={{
          boxShadow: expanded
            ? "0 0 0 1px rgba(255,255,255,.1), 0 20px 50px -10px rgba(0,0,0,.8)"
            : "0 0 40px rgba(255,255,255,.05), 0 4px 20px -5px rgba(0,0,0,.5)",
        }}
      >
        <AnimatePresence initial={false}>
          {isVisible && (
            <motion.div
              className="absolute inset-0 bg-white z-30 pointer-events-none"
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0 0 100%)" }}
              transition={{ duration: (ANIMATION_CONFIG.sweep.duration || 0.5) * 4.0, ease: ANIMATION_CONFIG.sweep.ease }}
              style={{ borderRadius: "inherit" }}
            />
          )}
        </AnimatePresence>

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
          className="h-full"
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
                  className="w-7 h-7 bg-white flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
                  whileTap={{ scale: 0.95 }}
                >
                  {player.playing ? (
                    <Pause className="text-black w-3 h-3" fill="currentColor" />
                  ) : (
                    <Play className="text-black w-3 h-3 ml-0.5" fill="currentColor" />
                  )}
                </motion.button>

                <div className="min-w-0 flex-1 relative">
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

                  <p className="text-[10px] text-white/40 truncate relative z-10">
                    {displayed.artist}
                  </p>
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
                    <div className="relative w-full flex flex-col justify-center" style={{ minHeight: 32 }}>
                      <AnimatePresence>
                        {nameSweep && (
                          <motion.div
                            key={`sweep-${player.trackIndex}`}
                            className="absolute left-0 top-0 h-full bg-white/90 z-10 pointer-events-none"
                            initial={{ x: "-100%" }}
                            animate={nameControls}
                            exit={{ opacity: 0 }}
                            style={{ borderRadius: 0, height: '100%', width: '100%' }}
                          />
                        )}
                      </AnimatePresence>
                      <p className="font-medium text-white truncate leading-tight text-[15px] relative z-20" style={{ position: 'relative', height: 24, lineHeight: '24px', fontSize: 15 }}>
                        {displayed.title}
                      </p>
                      <p className="text-white/50 truncate text-xs mt-0.5 relative z-20" style={{ fontSize: 12, lineHeight: '16px' }}>{displayed.artist}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={{ height: expanded ? "auto" : 0, marginTop: expanded ? 16 : 0, opacity: expanded ? 1 : 0 }}
            transition={ANIMATION_CONFIG.sweep}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-[.15em] font-medium">Queue</p>
                <p className="text-[10px] text-white/30 font-mono">
                  {player.trackIndex + 1}/{tracks.length}
                </p>
              </div>

              <div className="relative overflow-y-auto" ref={queueRef} style={{ maxHeight: 48 * 5, minHeight: 48 * 5 }}>
                <motion.div
                  className="absolute left-0 right-0 flex items-center justify-between pointer-events-none z-10 px-2"
                  animate={{ top: player.trackIndex * 48 }}
                  transition={ANIMATION_CONFIG.sweep}
                  style={{ height: 48 }}
                >
                  <span className="text-white text-sm font-mono animate-pulse">&gt;</span>
                  <span className="text-white text-sm font-mono animate-pulse">&lt;</span>
                </motion.div>

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
          </motion.div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShuffle(s => !s)}
                className={`w-10 h-10 flex items-center justify-center ${shuffle ? 'text-blue-400' : 'text-white/50'} hover:text-white`}
                title="Shuffle"
              >
                <Shuffle className="w-6 h-6" />
              </button>

              <motion.button
                onClick={handlePrev}
                className="w-10 h-10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </motion.button>
            </div>

            <motion.button
              onClick={player.toggle}
              className="w-12 h-12 bg-white flex items-center justify-center hover:scale-105 transition-transform"
              whileTap={{ scale: 0.95 }}
            >
              {player.playing ? (
                <Pause className="text-black w-4 h-4" fill="currentColor" />
              ) : (
                <Play className="text-black w-4 h-4" fill="currentColor" />
              )}
            </motion.button>

            <div className="flex items-center justify-start gap-3">
              <motion.button
                onClick={handleNext}
                className="w-10 h-10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </motion.button>

              <button
                onClick={() => setRepeat(r => !r)}
                className={`w-10 h-10 flex items-center justify-center ${repeat ? 'text-blue-400' : 'text-white/50'} hover:text-white`}
                title="Loop"
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
