"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface StoryImageProps {
  src: string;
  dimmed?: boolean;
}

export function StoryImage({ src, dimmed = false }: StoryImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset loaded state when src changes
  useEffect(() => {
    setImageLoaded(false);
  }, [src]);

  return (
    <motion.div
      className="relative z-10 w-full h-full flex items-center justify-center p-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: dimmed ? 0.3 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glow effect behind image */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: imageLoaded ? 0.6 : 0 }}
        transition={{ duration: 1.2, delay: 0.2 }}
      >
        <div
          className="w-[50%] h-[70%] rounded-3xl"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </motion.div>

      {/* Image container with reveal animation */}
      <motion.div
        className="relative"
        initial={{ scale: 0.95, filter: 'blur(20px) brightness(0.3)' }}
        animate={{
          scale: imageLoaded ? 1 : 0.95,
          filter: imageLoaded ? 'blur(0px) brightness(1)' : 'blur(20px) brightness(0.3)'
        }}
        transition={{
          duration: 1.2,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      >
        <Image
          src={src}
          alt="Story visualization"
          className="rounded-lg shadow-2xl object-contain max-h-[85vh] max-w-[90%]"
          width={360}
          height={960}
          quality={85}
          onLoad={() => setImageLoaded(true)}
        />
      </motion.div>
    </motion.div>
  );
}
