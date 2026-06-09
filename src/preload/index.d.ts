import type { RoboNeoBridge } from '../shared/types'

declare global {
  interface Window {
    roboneo: RoboNeoBridge
  }
}

export {}
