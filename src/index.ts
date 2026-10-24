import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import { RowDataPacket } from 'mysql2'
import { pool } from './db'
import { uploadImage, deleteImage, imageUrl } from './s3'

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

app.delete('/api/messages/:id', async (req, res) => {
  // 沒設 ADMIN_KEY 也一律擋，不然誰都能刪
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey || req.get('x-admin-key') !== adminKey) {
    res.status(403).json({ error: true, message: '管理密碼錯誤' })
    return
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT image_key FROM messages WHERE id = ?',
    [req.params.id]
  )
  if (rows.length === 0) {
    res.status(404).json({ error: true, message: '找不到這則留言' })
    return
  }

  // 先刪資料再刪圖，S3 失敗頂多留一張沒人看得到的圖
  await pool.query('DELETE FROM messages WHERE id = ?', [req.params.id])
  if (rows[0].image_key) {
    await deleteImage(rows[0].image_key)
  }

  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`伺服器已啟動：http://localhost:${port}`)
})
