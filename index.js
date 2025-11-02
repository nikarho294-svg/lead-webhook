import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { Telegraf } from 'telegraf'
import { google } from 'googleapis'

const {
  BOT_TOKEN,
  PUBLIC_URL,
  CHATTERFY_WEBHOOK,
  PORT = 10000,
  SPREADSHEET_ID,
  GOOGLE_CREDENTIALS
} = process.env

if (!BOT_TOKEN || !PUBLIC_URL || !CHATTERFY_WEBHOOK || !SPREADSHEET_ID) {
  console.error('❌ Missing env vars. Check BOT_TOKEN, PUBLIC_URL, CHATTERFY_WEBHOOK, SPREADSHEET_ID.')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)
const app = express()

// === Авторизация Google Sheets ===
let auth
try {
  const credentials = GOOGLE_CREDENTIALS
    ? JSON.parse(GOOGLE_CREDENTIALS)
    : JSON.parse(await import('fs').then(fs => fs.readFileSync('./service-account.json', 'utf8')))

  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })
  console.log('✅ Авторизация Google API успешна')
} catch (err) {
  console.error('❌ Ошибка при инициализации Google API:', err.message)
}
const sheets = google.sheets({ version: 'v4', auth })

// === Получение chatId из таблицы (колонка C) ===
async function getAllChatIds() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'C:C'
    })

    const validIds = (res.data.values || [])
      .flat()
      .map(id => parseInt(id))
      .filter(id => !isNaN(id) && id > 100000)

    console.log('📋 Найдено chatId в таблице:', validIds)
    return validIds
  } catch (err) {
    console.error('❌ Ошибка при чтении Google Sheets:', err.message)
    return []
  }
}

// === Разбор входного текста ===
function parseLead(text) {
  const parts = text.split(/[\|\;\,]\s*/).map(v => v.trim()).filter(Boolean)
  if (parts.length < 4) return null
  const [bank, phoneRaw, account, sumRaw] = parts
  const phone = phoneRaw.replace(/
