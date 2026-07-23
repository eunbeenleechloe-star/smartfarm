"use client";

import { motion } from "framer-motion";

export default function RotatingBadge({ text }: { text: string }) {
  const id = "rotating-badge-path";

  return (
    <motion.div
      className="relative h-28 w-28 shrink-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <path
          id={id}
          d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
          fill="none"
        />
        <text fontSize="8.6" fill="currentColor" className="text-primary">
          <textPath href={`#${id}`} startOffset="0%">
            {text} · {text} ·
          </textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="h-3 w-3 rounded-full bg-accent" aria-hidden="true" />
      </div>
    </motion.div>
  );
}
