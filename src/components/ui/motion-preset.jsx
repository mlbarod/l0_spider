'use client';
import * as React from 'react'

import { AnimatePresence, motion, useInView } from 'motion/react';

const motionComponents = motion

function MotionPreset({
  ref,
  children,
  className,
  component = 'div',
  transition = { type: 'spring', stiffness: 200, damping: 20 },
  delay = 0,
  inView = true,
  inViewMargin = '0px',
  inViewOnce = true,
  blur = false,
  slide = false,
  fade = false,
  zoom = false,
  motionProps = {}
}) {
  const localRef = React.useRef(null)

  React.useImperativeHandle(ref, () => localRef.current)

  const inViewResult = useInView(localRef, {
    once: inViewOnce,
    margin: inViewMargin
  })

  const isInView = !inView || inViewResult

  const hiddenVariant = {}
  const visibleVariant = {}

  if (blur) {
    hiddenVariant.filter = blur === true ? 'blur(10px)' : `blur(${blur})`
    visibleVariant.filter = 'blur(0px)'
  }

  if (slide) {
    const offset = slide === true ? 100 : (slide.offset ?? 100)
    const direction = slide === true ? 'left' : (slide.direction ?? 'left')
    const axis = direction === 'up' || direction === 'down' ? 'y' : 'x'

    hiddenVariant[axis] = direction === 'left' || direction === 'up' ? -offset : offset
    visibleVariant[axis] = 0
  }

  if (fade) {
    hiddenVariant.opacity = fade === true ? 0 : (fade.initialOpacity ?? 0)
    visibleVariant.opacity = fade === true ? 1 : (fade.opacity ?? 1)
  }

  if (zoom) {
    hiddenVariant.scale = zoom === true ? 0.5 : (zoom.initialScale ?? 0.5)
    visibleVariant.scale = zoom === true ? 1 : (zoom.scale ?? 1)
  }

  const MotionComponent = motionComponents[component] || motion.div

  return (
    <AnimatePresence>
      <MotionComponent
        ref={localRef}
        initial='hidden'
        animate={isInView ? 'visible' : 'hidden'}
        exit='hidden'
        variants={{
          hidden: hiddenVariant,
          visible: visibleVariant
        }}
        transition={{
          ...transition,
          delay: (transition?.delay ?? 0) + delay
        }}
        className={className}
        {...motionProps}>
        {children}
      </MotionComponent>
    </AnimatePresence>
  );
}

export { MotionPreset };
