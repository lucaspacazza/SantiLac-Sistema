import { Home } from 'lucide-react'
import { useEffect, useRef } from 'react'

type AnimatedHomeIconProps = {
  size?: number
}

export function AnimatedHomeIcon({ size = 16 }: AnimatedHomeIconProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const houseRef = useRef<SVGSVGElement | null>(null)
  const smokeOneRef = useRef<HTMLSpanElement | null>(null)
  const smokeTwoRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const house = houseRef.current
    const smokeOne = smokeOneRef.current
    const smokeTwo = smokeTwoRef.current
    const trigger = root?.closest('button')

    if (!root || !house || !smokeOne || !smokeTwo || !trigger) return
    const houseElement = house
    const smokeOneElement = smokeOne
    const smokeTwoElement = smokeTwo

    function cancelCurrentAnimations() {
      houseElement.getAnimations().forEach((animation) => animation.cancel())
      smokeOneElement.getAnimations().forEach((animation) => animation.cancel())
      smokeTwoElement.getAnimations().forEach((animation) => animation.cancel())
    }

    function play() {
      cancelCurrentAnimations()

      houseElement.animate([
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-3px) scale(1.04)', offset: 0.38 },
        { transform: 'translateY(0) scale(1)' },
      ], {
        duration: 340,
        easing: 'cubic-bezier(0.2, 0.9, 0.24, 1)',
        fill: 'both',
      })

      smokeOneElement.animate([
        { opacity: 0, transform: 'translate(0, 0) scale(0.45)' },
        { opacity: 0.72, transform: 'translate(2px, -5px) scale(0.78)', offset: 0.32 },
        { opacity: 0, transform: 'translate(5px, -12px) scale(1.08)' },
      ], {
        duration: 560,
        delay: 70,
        easing: 'cubic-bezier(0.18, 0.82, 0.28, 1)',
        fill: 'both',
      })

      smokeTwoElement.animate([
        { opacity: 0, transform: 'translate(0, 0) scale(0.38)' },
        { opacity: 0.62, transform: 'translate(-1px, -5px) scale(0.72)', offset: 0.35 },
        { opacity: 0, transform: 'translate(-3px, -10px) scale(0.98)' },
      ], {
        duration: 500,
        delay: 145,
        easing: 'cubic-bezier(0.18, 0.82, 0.28, 1)',
        fill: 'both',
      })
    }

    trigger.addEventListener('pointerenter', play)
    return () => {
      trigger.removeEventListener('pointerenter', play)
      cancelCurrentAnimations()
    }
  }, [])

  return (
    <span className="animated-home-icon" ref={rootRef} style={{ width: size, height: size }}>
      <Home ref={houseRef} className="animated-home-svg" size={size} />
      <span className="animated-home-smoke is-one" ref={smokeOneRef} />
      <span className="animated-home-smoke is-two" ref={smokeTwoRef} />
    </span>
  )
}
