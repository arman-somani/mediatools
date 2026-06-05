'use client';

import { motion } from 'framer-motion';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        bounce: 0.4,
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
