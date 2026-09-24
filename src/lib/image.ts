const PHOTO_EDGE = 960
const LOGO_EDGE = 512

export function readImageFile(file: File, kind: 'photo' | 'logo' = 'photo'): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Escolha um arquivo de imagem.'))
  }
  if (file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error('A imagem precisa ter no máximo 8 MB.'))
  }

  const maxEdge = kind === 'logo' ? LOGO_EDGE : PHOTO_EDGE
  const mime = kind === 'logo' ? 'image/png' : 'image/jpeg'
  const quality = kind === 'logo' ? 0.92 : 0.82

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'))
          return
        }
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, width, height)
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL(mime, quality))
      }
      img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'))
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
