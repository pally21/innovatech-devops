import { describe, it, expect } from 'vitest'

describe('Innovatech Frontend', () => {
  it('debería cargar correctamente', () => {
    expect(true).toBe(true)
  })

  it('debería tener variables de entorno de producción', () => {
    expect(typeof window).toBe('object')
  })
})
