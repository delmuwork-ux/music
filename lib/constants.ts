export const ANIMATION_CONFIG = {
  sweep: { duration: 0.8, ease: [0.32, 0.72, 0, 1] as const },
  fade: { duration: 0.3, ease: "easeOut" as const },
  spring: { type: "spring", stiffness: 300, damping: 30 } as const,
}
