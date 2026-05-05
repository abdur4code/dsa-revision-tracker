import sharp from 'sharp'

const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" 
  width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0d1117"/>
  <circle cx="256" cy="256" r="200" fill="#161b22" 
    stroke="#21262d" stroke-width="4"/>
  <path 
    d="M290 100 L190 270 L240 270 L220 400 L320 220 L270 220 Z" 
    fill="#58a6ff"
    stroke="#58a6ff"
    stroke-width="4"
    stroke-linejoin="round"
  />
</svg>`

async function generateIcons() {
  const svgBuffer = Buffer.from(svgContent)

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('public/pwa-192.png')
  console.log('pwa-192.png created')

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('public/pwa-512.png')
  console.log('pwa-512.png created')
}

generateIcons()
