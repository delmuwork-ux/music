"use client"

import { MusicPlayer } from "@/components/music-player"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
      <MusicPlayer isVisible={true} />
    </main>
  )
}
