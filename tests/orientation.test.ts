import { describe, it, expect } from 'vitest'
import { parseLine } from '../src/main/parsing'

describe('orientation contract', () => {
  describe('yaw is always 0', () => {
    it('yaw = 0 on 6-field frame', () => {
      const f = parseLine('1,2,3,4,5,6')!
      expect(f.yaw).toBe(0)
    })

    it('yaw = 0 on 8-field frame with firmware angles', () => {
      const f = parseLine('1,2,3,4,5,6,15000,8000')!
      expect(f.yaw).toBe(0)
    })

    it('yaw = 0 on 9-field frame', () => {
      const f = parseLine('1,2,3,4,5,6,15000,8000,25000')!
      expect(f.yaw).toBe(0)
    })
  })

  describe('firmware angles used when present', () => {
    it('uses fields 7 and 8 as roll and pitch (8-field)', () => {
      const f = parseLine('0,0,0,0,0,0,12000,5000')!
      expect(f.roll).toBeCloseTo(12.0)
      expect(f.pitch).toBeCloseTo(5.0)
    })

    it('uses fields 7 and 8 as roll and pitch (9-field)', () => {
      const f = parseLine('0,0,0,0,0,0,-9000,3500,22000')!
      expect(f.roll).toBeCloseTo(-9.0)
      expect(f.pitch).toBeCloseTo(3.5)
    })
  })

  describe('orientation defaults when firmware angles absent', () => {
    it('roll defaults to 0 on 6-field frame', () => {
      const f = parseLine('1000,2000,3000,4000,5000,6000')!
      expect(f.roll).toBe(0)
    })

    it('pitch defaults to 0 on 6-field frame', () => {
      const f = parseLine('1000,2000,3000,4000,5000,6000')!
      expect(f.pitch).toBe(0)
    })
  })

  describe('temperature is optional', () => {
    it('temperatureC present on 9-field frame', () => {
      const f = parseLine('0,0,0,0,0,0,0,0,23700')!
      expect(f.temperatureC).toBeCloseTo(23.7)
    })

    it('temperatureC undefined on 6-field frame', () => {
      const f = parseLine('0,0,0,0,0,0')!
      expect(f.temperatureC).toBeUndefined()
    })

    it('temperatureC undefined on 8-field frame', () => {
      const f = parseLine('0,0,0,0,0,0,0,0')!
      expect(f.temperatureC).toBeUndefined()
    })
  })
})
