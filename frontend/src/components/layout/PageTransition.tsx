import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { pageVariants } from '@/lib/motion'

export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <motion.div key={pathname} variants={pageVariants} initial="initial" animate="animate">
      {children}
    </motion.div>
  )
}
