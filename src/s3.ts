import 'dotenv/config'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import path from 'path'

// 金鑰 SDK 會自己從 .env 讀
const s3 = new S3Client({ region: process.env.AWS_REGION })

export async function uploadImage(file: Express.Multer.File) {
  // 檔名用 UUID，同名照片才不會互蓋
  const ext = path.extname(file.originalname)
  const key = `images/${randomUUID()}${ext}`

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  )

  return key
}

// 網址開頭放 .env，之後換 CloudFront 只改那裡
export function imageUrl(key: string) {
  return `${process.env.IMAGE_BASE_URL}/${key}`
}
