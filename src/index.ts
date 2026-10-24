import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import { RowDataPacket } from 'mysql2'
import { pool } from './db'
import { uploadImage, imageUrl } from './s3'

const app = express()
const port = 8000

// 圖片先放記憶體再轉傳 S3，上限 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

app.use(express.static('public'))

app.get('/api/messages', async (req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, content, image_key, created_at FROM messages ORDER BY id DESC'
  )
  const messages = rows.map((row) => ({
    id: row.id,
    content: row.content,
    imageUrl: row.image_key ? imageUrl(row.image_key) : null,
    createdAt: row.created_at,
  }))
  res.json({ data: messages })
})

app.post('/api/messages', upload.single('image'), async (req, res) => {
  const content = req.body?.content?.trim()
  if (!content) {
    res.status(400).json({ error: true, message: '留言內容不能空白' })
    return
  }

  const imageKey = req.file ? await uploadImage(req.file) : null

  await pool.query('INSERT INTO messages (content, image_key) VALUES (?, ?)', [
    content,
    imageKey,
  ])

  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`伺服器已啟動：http://localhost:${port}`)
})
