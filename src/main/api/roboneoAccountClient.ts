import { net } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const CLIENT_ID = '1189857647'
const TOKEN_INFO_URL = 'https://api.account.meitu.com/oauth/get_token_info'
const CREDIT_URL = 'https://ai-engine-gateway-roboneo.meitu.com/roboneo/sync/request/vipshow'

type JsonObject = Record<string, unknown>

function findValue(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as JsonObject
  for (const key of keys) {
    const candidate = record[key]
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate)
  }
  for (const child of Object.values(record)) {
    const match = findValue(child, keys)
    if (match !== undefined) return match
  }
  return undefined
}

function errorMessage(payload: JsonObject, fallback: string): string {
  return findValue(payload, ['error_msg', 'error_message', 'message', 'msg', 'error']) || fallback
}

function assertApiSuccess(payload: JsonObject): void {
  const meta = payload.meta
  if (!meta || typeof meta !== 'object') return
  const code = findValue(meta, ['code', 'error_code', 'errorCode'])
  if (code && code !== '0' && code !== '200') {
    throw new Error(errorMessage(payload, `RoboNeo account API error ${code}`))
  }
}

async function readJsonResponse(response: Response): Promise<JsonObject> {
  const text = await response.text()
  let payload: JsonObject
  try {
    payload = JSON.parse(text) as JsonObject
  } catch {
    throw new Error(`RoboNeo account API returned invalid JSON (${response.status})`)
  }
  if (!response.ok) throw new Error(errorMessage(payload, `RoboNeo account API failed (${response.status})`))
  assertApiSuccess(payload)
  const errorCode = findValue(payload, ['error_code', 'errorCode'])
  if (errorCode && errorCode !== '0') throw new Error(errorMessage(payload, `RoboNeo account API error ${errorCode}`))
  return payload
}

export class RoboNeoAccountClient {
  private async getTokenInfo(accessToken: string): Promise<JsonObject> {
    const url = new URL(TOKEN_INFO_URL)
    url.searchParams.set('client_id', CLIENT_ID)
    url.searchParams.set('client_language', 'en')
    url.searchParams.set('overseas', '1')
    url.searchParams.set('client_type', '2')
    url.searchParams.set('web_version', '4.9.0')
    url.searchParams.set('is_web', '1')
    url.searchParams.set('client_accept_cookies', '1')
    url.searchParams.set('country_code', 'VN')

    const response = await net.fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Access-Token': accessToken,
        Origin: 'https://www.roboneo.com',
        Referer: 'https://www.roboneo.com/'
      }
    })
    return readJsonResponse(response)
  }

  async validateToken(accessToken: string): Promise<void> {
    const payload = await this.getTokenInfo(accessToken)
    const uid = findValue(payload, ['uid', 'user_id', 'userId'])
    if (!uid) throw new Error(errorMessage(payload, 'Token info response does not contain uid'))
  }

  private async getGid(): Promise<string> {
    try {
      const storage = JSON.parse(await readFile(path.join(os.homedir(), '.roboneo', 'storage.json'), 'utf8')) as JsonObject
      return findValue(storage, ['gid']) || randomUUID()
    } catch {
      return randomUUID()
    }
  }

  async getCredit(accessToken: string): Promise<string> {
    const tokenInfo = await this.getTokenInfo(accessToken)
    const uid = findValue(tokenInfo, ['uid', 'user_id', 'userId'])
    if (!uid) throw new Error('Token info response does not contain uid')

    const requestToken = findValue(tokenInfo, ['token', 'request_token', 'requestToken']) || accessToken
    const gid = await this.getGid()
    const response = await net.fetch(CREDIT_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'access-token': accessToken,
        'client-id': CLIENT_ID,
        Origin: 'https://www.roboneo.com',
        Referer: 'https://www.roboneo.com/'
      },
      body: JSON.stringify({
        parameter: {
          token: requestToken,
          gid,
          uid,
          trace_id: randomUUID(),
          client_id: CLIENT_ID,
          app_scene: 'roboneo',
          area_code: 'VN',
          lang: 'en',
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
          first_url: 'https://www.roboneo.com/home',
          page_url: 'https://www.roboneo.com/home',
          referrer: 'https://www.roboneo.com/',
          pixel_ready: 1,
          extra: { big_data_patch: { position_type: '/home' } },
          path_scene: 'vipshow',
          features: '',
          later_face: 0
        }
      })
    })
    const payload = await readJsonResponse(response)
    const parameter = payload.parameter
    if (parameter && typeof parameter === 'object') {
      const total = (parameter as JsonObject).total_amount
      if (typeof total === 'string' || typeof total === 'number') return String(total)
    }
    const total = findValue(payload, ['total_amount'])
    if (total === undefined) throw new Error('Credit response does not contain parameter.total_amount')
    return total
  }
}
