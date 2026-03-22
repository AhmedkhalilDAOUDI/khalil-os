import express from 'express'
import cors from 'cors'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

// Read key from .env
const envPath = path.join(__dirname, '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const API_KEY = envContent.match(/GROQ_API_KEY=(.+)/)?.[1]?.trim()

if (!API_KEY) {
  console.error('No API key found in .env')
  process.exit(1)
}

app.post('/api/messages', (req, res) => {
  // Convert Anthropic format to Groq/OpenAI format
  const { system, messages, max_tokens } = req.body
  const groqBody = {
    model: 'llama-3.3-70b-versatile',
    max_tokens: max_tokens || 1000,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages
    ]
  }
  const body = JSON.stringify(groqBody)

  const options = {
    hostname: 'api.groq.com',
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': `Bearer ${API_KEY}`,
    },
  }

  const proxyReq = https.request(options, (proxyRes) => {
    let data = ''
    proxyRes.on('data', chunk => { data += chunk })
    proxyRes.on('end', () => {
      console.log('STATUS:', proxyRes.statusCode)
      console.log('RESPONSE:', data)
      try {
        const groqData = JSON.parse(data)
        // Convert OpenAI format back to Anthropic format the app expects
        const anthropicFormat = {
          content: [{ type: 'text', text: groqData.choices?.[0]?.message?.content || '' }]
        }
        res.status(proxyRes.statusCode).json(anthropicFormat)
      } catch(e) {
        res.status(proxyRes.statusCode).send(data)
      }
    })
  })

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err)
    res.status(500).json({ error: err.message })
  })

  proxyReq.write(body)
  proxyReq.end()
})

app.listen(3001, () => {
  console.log('Proxy server running on http://localhost:3001')
})
