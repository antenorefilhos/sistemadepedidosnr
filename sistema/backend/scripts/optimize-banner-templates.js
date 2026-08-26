// One-off: converte as 6 fotos de origem (IA/Gemini, JPG em alta definicao)
// dos banners-modelo em WebP otimizado, no tamanho exato do slot de cada
// template (ver ART_GUIDE em StoreBannersManager.tsx / DIMS em
// seed-banner-templates.js), e salva em assets/banner-templates/ -- de la o
// seed script copia pra uploads/ (nao roda a otimizacao toda vez, so copia).
//
// Uso: node scripts/optimize-banner-templates.js
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(process.cwd(), 'assets', 'banner-templates')

// Fotos de origem geradas por IA (Gemini), uma por template -- caminho fixo
// da sessao em que foram geradas. Rode este script uma vez pra gerar os
// webps commitados; nao precisa rodar de novo em cada deploy.
const JOBS = [
  {
    id: 'seed-banner-hero-lancamento',
    width: 1920,
    height: 720,
    maxKb: 150,
    src: 'C:/Users/Jonathan/.gemini/antigravity-cli/brain/ba455b4c-b2d2-4114-a1b5-81749229d813/banner_hero_novidades_1787743957938.jpg',
  },
  {
    id: 'seed-banner-hero-oferta',
    width: 1920,
    height: 720,
    maxKb: 150,
    src: 'C:/Users/Jonathan/.gemini/antigravity-cli/brain/ba455b4c-b2d2-4114-a1b5-81749229d813/banner_hero_ofertas_1787743977239.jpg',
  },
  {
    id: 'seed-banner-intercalado-destaque',
    width: 850,
    height: 520,
    maxKb: 80,
    src: 'C:/Users/Jonathan/.gemini/antigravity-cli/brain/ba455b4c-b2d2-4114-a1b5-81749229d813/banner_intercalado_destaque_1787743999560.jpg',
  },
  {
    id: 'seed-banner-intercalado-combo',
    width: 850,
    height: 520,
    maxKb: 80,
    src: 'C:/Users/Jonathan/.gemini/antigravity-cli/brain/ba455b4c-b2d2-4114-a1b5-81749229d813/banner_intercalado_combo_1787744025311.jpg',
  },
  {
    id: 'seed-banner-tarja-frete',
    width: 1920,
    height: 420,
    maxKb: 80,
    src: 'C:/Users/Jonathan/.gemini/antigravity-cli/brain/ba455b4c-b2d2-4114-a1b5-81749229d813/banner_tarja_frete_1787744056176.jpg',
  },
  {
    id: 'seed-banner-popup-cupom',
    width: 900,
    height: 600,
    maxKb: 80,
    src: 'C:/Users/Jonathan/.gemini/antigravity-cli/brain/ba455b4c-b2d2-4114-a1b5-81749229d813/banner_popup_cupom_1787744087518.jpg',
  },
]

// Comprime em qualidade decrescente ate caber no orcamento de KB do slot --
// evita adivinhar um numero fixo de qualidade que estoura o limite numa foto
// mais detalhada e desperdica banda numa mais simples.
async function encodeUnderBudget(pipeline, maxKb) {
  const qualities = [82, 75, 68, 60, 52, 45]
  let last = null
  for (const quality of qualities) {
    const buffer = await pipeline.clone().webp({ quality }).toBuffer()
    last = { buffer, quality }
    if (buffer.length <= maxKb * 1024) return last
  }
  return last // menor qualidade tentada, mesmo que ainda acima do orcamento
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const job of JOBS) {
    if (!fs.existsSync(job.src)) {
      console.error(`FALTA  ${job.id}: origem nao encontrada em ${job.src}`)
      process.exitCode = 1
      continue
    }

    const resized = sharp(job.src).resize(job.width, job.height, { fit: 'cover', position: 'attention' })
    const { buffer, quality } = await encodeUnderBudget(resized, job.maxKb)
    const outPath = path.join(OUT_DIR, `${job.id}.webp`)
    fs.writeFileSync(outPath, buffer)

    const kb = (buffer.length / 1024).toFixed(1)
    const overBudget = buffer.length > job.maxKb * 1024 ? '  ATENCAO: acima do orcamento' : ''
    console.log(`OK  ${job.id}.webp  ${job.width}x${job.height}  q${quality}  ${kb}KB${overBudget}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
