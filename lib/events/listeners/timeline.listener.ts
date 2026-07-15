import type { ERPEventListener } from '../types'
import { registrarTimelineGlobal } from '@/lib/platform/timeline/timelineService'

export const timelineListener: ERPEventListener = async evento => {
  await registrarTimelineGlobal(evento)
}
