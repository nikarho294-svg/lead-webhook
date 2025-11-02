import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { Telegraf } from 'telegraf'

const { BOT_TOKEN, PUBLIC_URL, CHATTERFY_WEBHOOK, PORT = 10000 } = process.env

if (!BOT_TOKEN || !PUBLIC_URL || !CHATTERFY_WEBHOOK) {
  console.error('❌ Missing env vars. Check BOT_TOKEN, PUBLIC_URL, CHATTERFY_WEBHOOK.')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)

function parseLead(text) {
  const parts = text.split(/[\|\;\,]\s*/).map(v => v.trim()).filter(Boolean)
  if (parts.length < 5) return null
  const [name, phoneRaw, idRaw, amountRaw, bank] = parts
  const phone = phoneRaw.replace(/[^\d\+]/g, '')
  const id = String(idRaw).trim()
  const amount = Number(String(amountRaw).replace(',', '.'))
  if (!name || !phone || Number.isNaN(amount) || !bank) return null
  return { name, phone, id, amount, bank }
}

bot.start(ctx => {
  ctx.reply(
    'Привет! Отправь данные в формате:\n' +
    'Имя | Номер | ID | Сумма | Банк\n\n' +
    'Пример:\nИван Иванов | +79998887766 | 102 | 270 | Сбербанк'
  )
})

bot.on('text', async ctx => {
  const parsed = parseLead(ctx.message.text)
  if (!parsed) {
    return ctx.reply('Формат неверный. Пример:\nИван Иванов | +79998887766 | 102 | 270 | Сбербанк')
  }
  const { name, phone, id, amount, bank } = parsed
  const payload = {
    name,
    phone,
    custom_fields: { id, amount, bank }
  }
  try {
    await axios.post(CHATTERFY_WEBHOOK, payload, { timeout: 10000 })
    await ctx.reply('✅ Данные отправлены в Chatterfy.')
  } catch (err) {
    console.error('Ошибка при отправке:', err.message)
    await ctx.reply('❌ Не удалось передать данные в Chatterfy.')
  }
})

const app = express()
app.use(bot.webhookCallback('/telegram-webhook'))
app.get('/', (_, res) => res.send('OK'))

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)
  const webhookUrl = `${PUBLIC_URL}/telegram-webhook`
  try {
    await bot.telegram.setWebhook(webhookUrl)
    console.log('Telegram webhook установлен:', webhookUrl)
  } catch (err) {
    console.error('Ошибка при установке webhook:', err.message)
  }
})
