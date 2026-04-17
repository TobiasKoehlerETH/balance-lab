import { describe, it, expect } from 'vitest'
import { parseLine } from '../src/main/parsing'

describe('parseLine — field counts', () => {
  it('accepts 6-field frames', () => {
    const result = parseLine('1000,2000,3000,4000,5000,6000')
    expect(result).not.toBeNull()
  })

  it('accepts 8-field frames', () => {
    const result = parseLine('1000,2000,3000,4000,5000,6000,7000,8000')
    expect(result).not.toBeNull()
  })

  it('accepts 9-field frames', () => {
    const result = parseLine('1000,2000,3000,4000,5000,6000,7000,8000,25000')
    expect(result).not.toBeNull()
  })

  it('rejects 5-field frames', () => {
    expect(parseLine('1,2,3,4,5')).toBeNull()
  })

  it('rejects 7-field frames', () => {
    expect(parseLine('1,2,3,4,5,6,7')).toBeNull()
  })

  it('rejects 10-field frames', () => {
    expect(parseLine('1,2,3,4,5,6,7,8,9,10')).toBeNull()
  })
})

describe('parseLine — /1000 scaling', () => {
  it('divides accelerometer axes by 1000', () => {
    const f = parseLine('1000,2000,3000,0,0,0')!
    expect(f.ax).toBeCloseTo(1.0)
    expect(f.ay).toBeCloseTo(2.0)
    expect(f.az).toBeCloseTo(3.0)
  })

  it('divides gyroscope axes by 1000', () => {
    const f = parseLine('0,0,0,500,750,1000')!
    expect(f.gx).toBeCloseTo(0.5)
    expect(f.gy).toBeCloseTo(0.75)
    expect(f.gz).toBeCloseTo(1.0)
  })

  it('divides firmware roll and pitch by 1000', () => {
    const f = parseLine('0,0,0,0,0,0,15000,8500')!
    expect(f.roll).toBeCloseTo(15.0)
    expect(f.pitch).toBeCloseTo(8.5)
  })

  it('divides temperature by 1000', () => {
    const f = parseLine('0,0,0,0,0,0,0,0,25300')!
    expect(f.temperatureC).toBeCloseTo(25.3)
  })
})

describe('parseLine — malformed input', () => {
  it('rejects non-numeric fields', () => {
    expect(parseLine('abc,2,3,4,5,6')).toBeNull()
  })

  it('rejects mixed numeric/non-numeric', () => {
    expect(parseLine('1,2,3,4,5,NaN')).toBeNull()
  })

  it('rejects empty string', () => {
    expect(parseLine('')).toBeNull()
  })

  it('rejects whitespace-only string', () => {
    expect(parseLine('   ')).toBeNull()
  })

  it('handles leading/trailing whitespace around a valid line', () => {
    const f = parseLine('  1000,2000,3000,4000,5000,6000  ')
    expect(f).not.toBeNull()
    expect(f!.ax).toBeCloseTo(1.0)
  })
})
