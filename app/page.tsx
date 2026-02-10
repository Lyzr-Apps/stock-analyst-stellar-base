'use client'

import { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import {
  FiX,
  FiRefreshCw,
  FiCheck,
  FiSend,
  FiChevronDown,
  FiChevronUp,
  FiAlertCircle,
  FiInfo,
  FiSearch,
  FiSettings,
  FiPlus,
  FiTrash2,
  FiLoader,
  FiTrendingUp,
  FiActivity,
  FiClock,
} from 'react-icons/fi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// Constants
const AGENT_ID = '698b17e3a6240bbb9e1087ef'
const SCHEDULE_ID = '698b1a9bebe6fd87d1dcc0c4'
const SCHEDULER_BASE_URL = 'https://scheduler.studio.lyzr.ai'
const API_KEY = process.env.NEXT_PUBLIC_LYZR_API_KEY || ''

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

const SAMPLE_BRIEFING = `### AAPL Stock Briefing

**Current Price & Movement**
AAPL closed at **$274.62** on February 9, 2026, down **-3.24 (-1.17%)** from the prior day. After-hours trading showed **$274.02**, down an additional **-0.60 (-0.22%)**. Recent intraday open was at **$274.62**. The stock is near its 52-week high of **$288.62** (low: **$169.21**), with monthly performance up from January 2026's **$259.48** and December 2025's **$271.86**.

| Date | Close Price | Change |
|------|-------------|--------|
| Feb 9, 2026 | $274.62 | -1.17% |
| Feb 6, 2026 | $278.12 | N/A |
| Feb 5, 2026 | $275.91 | N/A |
| Feb 4, 2026 | $276.49 | N/A |
| Feb 3, 2026 | $269.48 | N/A |

**Technical Indicators**
- **50-day MA**: **$267.88** (stock trading above, bullish)
- **200-day MA**: **$254.61** (stock well above, strong bullish)
- **RSI, MACD**: Not available in current data (neutral; monitor for overbought signals near 52-week high).
- **Support/Resistance**: Support near **$269** (recent low); resistance at **$288.62** (52-week high).
Market cap: **$4.03T**; P/E: **34.72**; Beta: **1.09**.

| Indicator | Value | Signal |
|-----------|-------|--------|
| 50-day MA | $267.88 | Bullish |
| 200-day MA | $254.61 | Bullish |
| Quick Ratio | 0.94 | Neutral |
| Debt/Equity | 0.87 | Neutral |

**Recent News & Events**
- Q1 FY2026 earnings (ended Dec 27, 2025): EPS **$2.84** (beat $2.67 est.), revenue **$143.76B** (beat $138.25B est., +15.7% YoY). ROE: **159.94%**.
- Quarterly dividend: **$0.26/share** (ex-date Feb 9, pay Feb 12; yield **0.4%**).
- Cairn Investment Group sold shares (minor institutional move).

**Analyst Sentiment**
Consensus: **Moderate Buy** (1 Strong Buy, 23 Buy, 11 Hold, 1 Sell). Average PT: **$291.70**. Recent updates:
- Rosenblatt: PT **$267** (Neutral)
- JPMorgan: PT **$325** (Overweight)
- Loop Capital: **Buy**, PT **$325**
- Barclays: **Underweight**, PT **$239** (Bearish)
FY2026 EPS forecast: **$7.28**.

**Actionable Recommendation: Buy**
AAPL shows strength above key MAs post-earnings beat, with bullish analyst consensus targeting above current price. Hold through dividend payout; target **$290+**. Risks: Recent -1.17% drop may signal short-term pullback -- enter on dip to $270 support.`

// localStorage keys
const LS_WATCHLIST = 'stock_watchlist'
const LS_HISTORY = 'stock_briefing_history'
const LS_SETTINGS = 'stock_settings'

// Timezone options
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Anchorage', label: 'America/Anchorage (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (HT)' },
  { value: 'UTC', label: 'UTC' },
]

const DAY_LABELS = [
  { value: '0', label: 'Sun' },
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
]

// Types
interface BriefingRecord {
  id: string
  date: string
  content: string
  stocks: string[]
}

interface AppSettings {
  email: string
  timezone: string
  analysisPrefs: {
    technical: boolean
    fundamental: boolean
    newsSentiment: boolean
  }
  schedule: {
    days: string[]
    hour: number
    minute: number
    timezone: string
  }
}

interface ScheduleInfo {
  is_active: boolean
  cron_expression: string
  next_run: string
  timezone: string
}

// ---- HTML preprocessing for markdown ----
function preprocessHtml(text: string): string {
  if (!text) return ''
  let result = text
  // Replace <br>, <br/>, <br /> with newlines
  result = result.replace(/<br\s*\/?>/gi, '\n')
  // Convert <strong>...</strong> to **...**
  result = result.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
  // Convert <b>...</b> to **...**
  result = result.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
  // Convert <em>...</em> to *...*
  result = result.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
  // Convert <i>...</i> to *...*
  result = result.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
  // Strip all remaining HTML tags
  result = result.replace(/<[^>]+>/g, '')
  // Decode HTML entities
  result = result.replace(/&amp;/g, '&')
  result = result.replace(/&lt;/g, '<')
  result = result.replace(/&gt;/g, '>')
  result = result.replace(/&quot;/g, '"')
  result = result.replace(/&#39;/g, "'")
  result = result.replace(/&nbsp;/g, ' ')
  return result
}

// ---- Markdown renderer ----
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null
  // Preprocess HTML before splitting into lines
  const processed = preprocessHtml(text)
  // Handle trailing backslash line continuations: replace `\` at end of line with newline
  const withLineBreaks = processed.replace(/\\\n/g, '\n')
  const lines = withLineBreaks.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []
  let tableHeaders: string[] = []
  let inTable = false
  let tableKey = 0

  const flushTable = () => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table-${tableKey++}`} className="my-3 overflow-x-auto">
          <table className="w-full text-sm border border-border">
            {tableHeaders.length > 0 && (
              <thead>
                <tr className="bg-muted">
                  {tableHeaders.map((h, i) => (
                    <th key={i} className="px-3 py-1.5 text-left font-semibold text-foreground border-b border-border">{h.trim()}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 border-b border-border text-card-foreground">{renderInlineMarkdown(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
      tableHeaders = []
    }
    inTable = false
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    // Strip trailing backslash (line continuation marker)
    const line = rawLine.endsWith('\\') ? rawLine.slice(0, -1) : rawLine
    const trimmed = line.trim()

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      // Check if separator row
      if (cells.every(c => /^[\s-:]+$/.test(c))) {
        inTable = true
        continue
      }
      if (!inTable && tableHeaders.length === 0) {
        tableHeaders = cells
        continue
      }
      inTable = true
      tableRows.push(cells)
      continue
    } else if (inTable) {
      flushTable()
    }

    if (trimmed === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />)
      continue
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg font-semibold text-foreground mt-4 mb-2 leading-tight">{renderInlineMarkdown(trimmed.slice(4))}</h3>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl font-semibold text-foreground mt-5 mb-2 leading-tight">{renderInlineMarkdown(trimmed.slice(3))}</h2>
      )
      continue
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl font-bold text-foreground mt-5 mb-3 leading-tight">{renderInlineMarkdown(trimmed.slice(2))}</h1>
      )
      continue
    }
    if (trimmed.startsWith('- ')) {
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 pl-2 py-0.5">
          <span className="text-primary mt-1.5 text-xs">--</span>
          <span className="text-sm text-card-foreground leading-relaxed">{renderInlineMarkdown(trimmed.slice(2))}</span>
        </div>
      )
      continue
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)/)
      if (match) {
        elements.push(
          <div key={`ol-${i}`} className="flex items-start gap-2 pl-2 py-0.5">
            <span className="text-primary font-medium text-sm">{match[1]}.</span>
            <span className="text-sm text-card-foreground leading-relaxed">{renderInlineMarkdown(match[2])}</span>
          </div>
        )
        continue
      }
    }

    elements.push(
      <p key={`p-${i}`} className="text-sm text-card-foreground leading-relaxed py-0.5">{renderInlineMarkdown(trimmed)}</p>
    )
  }

  // Flush any remaining table
  if (inTable || tableHeaders.length > 0) {
    flushTable()
  }

  return <>{elements}</>
}

function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null
  // Preprocess any remaining HTML in inline text
  let cleaned = preprocessHtml(text)
  // Remove citation references like [1]
  cleaned = cleaned.replace(/\[\d+\]/g, '')
  // Process bold text **...**
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

// ---- Extract text from agent response ----
function extractResponseText(result: any): string {
  if (!result?.success) return ''
  const resp = result?.response
  if (!resp) return ''
  if (typeof resp?.message === 'string' && resp.message.length > 20) return resp.message
  if (typeof resp?.result === 'string') return resp.result
  if (typeof resp?.result?.text === 'string') return resp.result.text
  if (typeof resp?.result?.message === 'string') return resp.result.message
  if (typeof resp?.result?.raw_text === 'string') return resp.result.raw_text
  if (typeof result?.raw_response === 'string' && result.raw_response.length > 20) return result.raw_response
  // fallback: try to stringify result
  try {
    const s = JSON.stringify(resp?.result)
    if (s && s !== '{}' && s !== 'null') return s
  } catch { /* ignore */ }
  return ''
}

// ---- Schedule display helper ----
function formatScheduleDisplay(scheduleInfo: ScheduleInfo | null): string {
  if (!scheduleInfo) return 'Loading...'
  const cron = scheduleInfo.cron_expression
  const parts = cron.split(' ')
  if (parts.length < 5) return cron
  const minute = parts[0]
  const hour = parseInt(parts[1])
  const days = parts[4]
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'
  let daysLabel = days
  if (days === '*') {
    daysLabel = 'Daily'
  } else if (days === '1,2,3,4,5' || days === '1-5') {
    daysLabel = 'Weekdays'
  } else if (days === '0,1,2,3,4,5,6') {
    daysLabel = 'Everyday'
  } else {
    daysLabel = `Days: ${days}`
  }
  let tzLabel = scheduleInfo.timezone
  if (scheduleInfo.timezone === 'America/New_York') tzLabel = 'ET'
  else if (scheduleInfo.timezone === 'America/Chicago') tzLabel = 'CT'
  else if (scheduleInfo.timezone === 'America/Los_Angeles') tzLabel = 'PT'
  else if (scheduleInfo.timezone === 'America/Denver') tzLabel = 'MT'
  else if (scheduleInfo.timezone === 'America/Anchorage') tzLabel = 'AKT'
  else if (scheduleInfo.timezone === 'Pacific/Honolulu') tzLabel = 'HT'
  return `${daysLabel} ${h12}:${minute.padStart(2, '0')} ${ampm} ${tzLabel}`
}

// ---- Cron builder helper ----
function buildCronExpression(days: string[], hour: number, minute: number): string {
  const dayStr = days.length === 7 ? '*' : days.join(',')
  return `${minute} ${hour} * * ${dayStr}`
}

// ---- Schedule status fetcher ----
async function fetchScheduleStatus(): Promise<ScheduleInfo | null> {
  try {
    const res = await fetch(`${SCHEDULER_BASE_URL}/schedules/${SCHEDULE_ID}`, {
      headers: { 'x-api-key': API_KEY }
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      is_active: data?.is_active ?? true,
      cron_expression: data?.cron_expression ?? '20 17 * * 1-5',
      next_run: data?.next_run ?? '',
      timezone: data?.timezone ?? 'America/New_York',
    }
  } catch {
    return null
  }
}

async function toggleSchedule(pause: boolean): Promise<boolean> {
  try {
    const endpoint = pause ? 'pause' : 'resume'
    const res = await fetch(`${SCHEDULER_BASE_URL}/schedules/${SCHEDULE_ID}/${endpoint}`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY }
    })
    return res.ok
  } catch {
    return false
  }
}

// ---- generate a simple id ----
function simpleId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---- Dashboard Tab ----
function DashboardTab({
  watchlist,
  latestBriefing,
  setLatestBriefing,
  addToHistory,
  sampleMode,
  activeAgentId,
  setActiveAgentId,
  scheduleInfo,
  scheduleLoading,
}: {
  watchlist: string[]
  latestBriefing: string
  setLatestBriefing: (b: string) => void
  addToHistory: (content: string, stocks: string[]) => void
  sampleMode: boolean
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
  scheduleInfo: ScheduleInfo | null
  scheduleLoading: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingSchedule, setTogglingSchedule] = useState(false)
  const [localScheduleInfo, setLocalScheduleInfo] = useState<ScheduleInfo | null>(scheduleInfo)

  useEffect(() => {
    setLocalScheduleInfo(scheduleInfo)
  }, [scheduleInfo])

  useEffect(() => {
    if (sampleMode && !latestBriefing) {
      setLatestBriefing(SAMPLE_BRIEFING)
    }
  }, [sampleMode, latestBriefing, setLatestBriefing])

  const handleRunAnalysis = async () => {
    if (watchlist.length === 0) {
      setError('Add stocks to your watchlist first.')
      return
    }
    setLoading(true)
    setError(null)
    setActiveAgentId(AGENT_ID)
    const message = `Analyze the following stocks and provide a comprehensive briefing: ${watchlist.join(', ')}. Include price movements, technical indicators, news sentiment, and actionable recommendations.`
    try {
      const result = await callAIAgent(message, AGENT_ID)
      const text = extractResponseText(result)
      if (text) {
        setLatestBriefing(text)
        addToHistory(text, [...watchlist])
      } else {
        setError(result?.error || result?.response?.message || 'No response received from agent.')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to call agent.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  const handleToggleSchedule = async () => {
    if (!localScheduleInfo) return
    setTogglingSchedule(true)
    const success = await toggleSchedule(localScheduleInfo.is_active)
    if (success) {
      setLocalScheduleInfo(prev => prev ? { ...prev, is_active: !prev.is_active } : prev)
    }
    setTogglingSchedule(false)
  }

  const displayBriefing = sampleMode ? (latestBriefing || SAMPLE_BRIEFING) : latestBriefing
  const scheduleDisplay = formatScheduleDisplay(localScheduleInfo)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left column */}
      <div className="lg:col-span-1 space-y-4">
        {/* Portfolio Summary */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">Portfolio Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Stocks Tracked</span>
              <Badge variant="secondary" className="font-mono text-xs">{watchlist.length}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Watchlist</span>
              <span className="text-foreground font-medium text-xs">{watchlist.length > 0 ? watchlist.join(', ') : 'None'}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Briefing Status</span>
              {displayBriefing ? (
                <Badge className="bg-accent text-accent-foreground text-xs">Available</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Schedule Status */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">Schedule Status</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">{scheduleLoading ? 'Loading schedule...' : `Automated briefing: ${scheduleDisplay}`}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {scheduleLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FiLoader className="h-3 w-3 animate-spin" /> Loading schedule...
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Frequency</span>
                  <span className="text-foreground font-medium text-xs">{scheduleDisplay}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${localScheduleInfo?.is_active !== false ? 'bg-accent' : 'bg-destructive'}`} />
                    <span className="text-xs font-medium text-foreground">{localScheduleInfo?.is_active !== false ? 'Active' : 'Paused'}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Schedule ID</span>
                  <span className="text-xs font-mono text-muted-foreground">{SCHEDULE_ID.slice(0, 12)}...</span>
                </div>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSchedule}
                  disabled={togglingSchedule}
                  className="w-full text-xs"
                >
                  {togglingSchedule && <FiLoader className="h-3 w-3 animate-spin mr-1" />}
                  {localScheduleInfo?.is_active !== false ? 'Pause Schedule' : 'Resume Schedule'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Run Analysis */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">Run Analysis</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Get a fresh briefing for your watchlist</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Button
              onClick={handleRunAnalysis}
              disabled={loading || watchlist.length === 0}
              className="w-full bg-primary text-primary-foreground text-sm font-medium"
            >
              {loading ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin mr-2" />
                  Analyzing {watchlist.length} stocks...
                </>
              ) : (
                <>
                  <FiRefreshCw className="h-4 w-4 mr-2" />
                  Run Analysis Now
                </>
              )}
            </Button>
            {error && (
              <div className="mt-2 flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 border border-destructive/20">
                <FiAlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column */}
      <div className="lg:col-span-2">
        <Card className="border border-border bg-card h-full">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">Latest Briefing</CardTitle>
              {loading && (
                <Badge variant="outline" className="text-xs">
                  <FiLoader className="h-3 w-3 animate-spin mr-1" />
                  Updating
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {displayBriefing ? (
              <ScrollArea className="h-[520px] pr-3">
                <div className="space-y-0">
                  {renderMarkdown(displayBriefing)}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <FiInfo className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">No briefing available yet</p>
                <p className="text-xs text-muted-foreground/70">Click "Run Analysis Now" to generate a stock briefing for your watchlist, or wait for the next scheduled run.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---- Watchlist Tab ----
function WatchlistTab({
  watchlist,
  setWatchlist,
  sampleMode,
}: {
  watchlist: string[]
  setWatchlist: (w: string[]) => void
  sampleMode: boolean
}) {
  const [ticker, setTicker] = useState('')

  const COMPANY_NAMES: Record<string, string> = {
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft Corp.',
    GOOGL: 'Alphabet Inc.',
    AMZN: 'Amazon.com Inc.',
    TSLA: 'Tesla Inc.',
    META: 'Meta Platforms',
    NVDA: 'NVIDIA Corp.',
    NFLX: 'Netflix Inc.',
    AMD: 'Advanced Micro Devices',
    CRM: 'Salesforce Inc.',
    INTC: 'Intel Corp.',
    ORCL: 'Oracle Corp.',
    PYPL: 'PayPal Holdings',
    DIS: 'Walt Disney Co.',
    BABA: 'Alibaba Group',
    V: 'Visa Inc.',
    JPM: 'JPMorgan Chase',
    BA: 'Boeing Co.',
    WMT: 'Walmart Inc.',
    PG: 'Procter & Gamble',
  }

  const addTicker = () => {
    const t = ticker.trim().toUpperCase()
    if (t && !watchlist.includes(t)) {
      setWatchlist([...watchlist, t])
    }
    setTicker('')
  }

  const removeTicker = (t: string) => {
    setWatchlist(watchlist.filter(x => x !== t))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTicker()
    }
  }

  return (
    <div className="space-y-4">
      {/* Add stock input */}
      <Card className="border border-border bg-card">
        <CardContent className="p-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Enter ticker symbol (e.g., AAPL)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="pl-8 text-sm bg-background border-border"
              />
            </div>
            <Button onClick={addTicker} disabled={!ticker.trim()} size="sm" className="bg-primary text-primary-foreground text-sm">
              <FiPlus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stock cards grid */}
      {watchlist.length === 0 ? (
        <Card className="border border-border bg-card">
          <CardContent className="p-8 text-center">
            <FiInfo className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Your watchlist is empty.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add your first stock ticker above to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {watchlist.map(t => (
            <Card key={t} className="border border-border bg-card group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground leading-tight">{t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{COMPANY_NAMES[t] || 'Custom Ticker'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTicker(t)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {sampleMode && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tracking</span>
                      <Badge className="bg-accent text-accent-foreground text-xs px-1.5 py-0">Active</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{watchlist.length} stock{watchlist.length !== 1 ? 's' : ''} in watchlist</p>
        {watchlist.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setWatchlist(DEFAULT_WATCHLIST)} className="text-xs text-muted-foreground">
            <FiRefreshCw className="h-3 w-3 mr-1" /> Reset to Default
          </Button>
        )}
      </div>
    </div>
  )
}

// ---- History Tab ----
function HistoryTab({
  history,
  setHistory,
  sampleMode,
}: {
  history: BriefingRecord[]
  setHistory: (h: BriefingRecord[]) => void
  sampleMode: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')

  const displayHistory = sampleMode && history.length === 0
    ? [
        { id: 'sample-1', date: '2026-02-10T07:00:00Z', content: SAMPLE_BRIEFING, stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'] },
        { id: 'sample-2', date: '2026-02-07T07:00:00Z', content: '### Market Summary\n\nAll major indices closed higher. Tech sector led gains with AAPL up 2.1% and MSFT up 1.8%.', stocks: ['AAPL', 'MSFT', 'GOOGL'] },
        { id: 'sample-3', date: '2026-02-06T07:00:00Z', content: '### Market Summary\n\nMixed session with volatility driven by jobs data. TSLA dropped 3.2% on delivery concerns.', stocks: ['TSLA', 'AMZN'] },
      ]
    : history

  const clearHistory = () => {
    setHistory([])
  }

  const removeEntry = (id: string) => {
    setHistory(history.filter(h => h.id !== id))
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <Card className="border border-border bg-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Filter:</span>
            {(['all', 'today', 'week', 'month'] as const).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
                className="text-xs h-7"
              >
                {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
              </Button>
            ))}
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory} className="text-xs h-7 text-destructive ml-auto">
                <FiTrash2 className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {displayHistory.length === 0 ? (
        <Card className="border border-border bg-card">
          <CardContent className="p-8 text-center">
            <FiInfo className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No briefings yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Run an analysis or enable the sample data toggle to see examples.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[520px]">
          <div className="space-y-3 pr-3">
            {displayHistory.map(entry => {
              const isExpanded = expandedId === entry.id
              const preview = (entry.content || '').split('\n').filter(l => l.trim()).slice(0, 3).join(' ').slice(0, 150)
              return (
                <Card key={entry.id} className="border border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{formatDate(entry.date)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(entry.date)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.isArray(entry.stocks) && entry.stocks.map(s => (
                          <Badge key={s} variant="secondary" className="text-xs px-1.5 py-0">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    {!isExpanded && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{preview}...</p>
                    )}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-border">
                        {renderMarkdown(entry.content)}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="text-xs h-7 text-muted-foreground"
                      >
                        {isExpanded ? <FiChevronUp className="h-3 w-3 mr-1" /> : <FiChevronDown className="h-3 w-3 mr-1" />}
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </Button>
                      {!entry.id.startsWith('sample-') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEntry(entry.id)}
                          className="text-xs h-7 text-muted-foreground hover:text-destructive"
                        >
                          <FiTrash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

// ---- Settings Tab ----
function SettingsTab({
  settings,
  setSettings,
  watchlist,
  addToHistory,
  setLatestBriefing,
  activeAgentId,
  setActiveAgentId,
}: {
  settings: AppSettings
  setSettings: (s: AppSettings) => void
  watchlist: string[]
  addToHistory: (content: string, stocks: string[]) => void
  setLatestBriefing: (b: string) => void
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
}) {
  const [saved, setSaved] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)
  const [scheduleUpdating, setScheduleUpdating] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleSuccess, setScheduleSuccess] = useState(false)
  const [frequencyMode, setFrequencyMode] = useState<'weekdays' | 'everyday' | 'custom'>(() => {
    const days = settings.schedule.days
    if (days.length === 7) return 'everyday'
    if (days.length === 5 && ['1','2','3','4','5'].every(d => days.includes(d))) return 'weekdays'
    return 'custom'
  })

  const handleSave = () => {
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ }
  }

  const handleTestBriefing = async () => {
    if (watchlist.length === 0) {
      setTestError('Add stocks to your watchlist first.')
      return
    }
    setTestLoading(true)
    setTestError(null)
    setTestSuccess(false)
    setActiveAgentId(AGENT_ID)
    const prefs = []
    if (settings.analysisPrefs.technical) prefs.push('technical indicators')
    if (settings.analysisPrefs.fundamental) prefs.push('fundamental analysis')
    if (settings.analysisPrefs.newsSentiment) prefs.push('news sentiment')
    const prefsText = prefs.length > 0 ? ` Focus on: ${prefs.join(', ')}.` : ''
    const message = `Analyze the following stocks and provide a comprehensive briefing: ${watchlist.join(', ')}.${prefsText} Include price movements and actionable recommendations.`
    try {
      const result = await callAIAgent(message, AGENT_ID)
      const text = extractResponseText(result)
      if (text) {
        setLatestBriefing(text)
        addToHistory(text, [...watchlist])
        setTestSuccess(true)
        setTimeout(() => setTestSuccess(false), 3000)
      } else {
        setTestError(result?.error || 'No response received.')
      }
    } catch (e: any) {
      setTestError(e?.message || 'Failed to send test briefing.')
    } finally {
      setTestLoading(false)
      setActiveAgentId(null)
    }
  }

  const updatePref = (key: keyof AppSettings['analysisPrefs'], val: boolean) => {
    setSettings({
      ...settings,
      analysisPrefs: { ...settings.analysisPrefs, [key]: val },
    })
  }

  const updateSchedule = (partial: Partial<AppSettings['schedule']>) => {
    setSettings({
      ...settings,
      schedule: { ...settings.schedule, ...partial },
    })
  }

  const handleFrequencyChange = (mode: 'weekdays' | 'everyday' | 'custom') => {
    setFrequencyMode(mode)
    if (mode === 'weekdays') {
      updateSchedule({ days: ['1', '2', '3', '4', '5'] })
    } else if (mode === 'everyday') {
      updateSchedule({ days: ['0', '1', '2', '3', '4', '5', '6'] })
    }
  }

  const toggleDay = (day: string) => {
    const current = settings.schedule.days
    if (current.includes(day)) {
      if (current.length > 1) {
        updateSchedule({ days: current.filter(d => d !== day) })
      }
    } else {
      updateSchedule({ days: [...current, day].sort((a, b) => parseInt(a) - parseInt(b)) })
    }
  }

  const cronExpression = buildCronExpression(settings.schedule.days, settings.schedule.hour, settings.schedule.minute)

  const formatHour12 = (h: number): string => {
    if (h === 0) return '12'
    if (h > 12) return String(h - 12)
    return String(h)
  }
  const getAmPm = (h: number): string => h >= 12 ? 'PM' : 'AM'

  const handleUpdateSchedule = async () => {
    setScheduleUpdating(true)
    setScheduleError(null)
    setScheduleSuccess(false)
    try {
      const { days, hour, minute, timezone } = settings.schedule
      const dayStr = days.length === 7 ? '*' : days.join(',')
      const cronExpr = `${minute} ${hour} * * ${dayStr}`

      // Delete old schedule
      await fetch(`${SCHEDULER_BASE_URL}/schedules/${SCHEDULE_ID}`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_KEY }
      })

      // Create new schedule
      const res = await fetch(`${SCHEDULER_BASE_URL}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({
          agent_id: AGENT_ID,
          cron_expression: cronExpr,
          timezone: timezone,
          message: `Analyze the following stocks and send a comprehensive briefing email. Include current price movements, technical indicators, recent news and events, analyst sentiment, and actionable recommendations. Format as a structured briefing with clear sections and tables.`,
          max_retries: 3,
          retry_delay: 300,
        }),
      })

      if (res.ok) {
        setScheduleSuccess(true)
        setTimeout(() => setScheduleSuccess(false), 3000)
      } else {
        setScheduleError('Failed to update schedule. Please try again.')
      }
    } catch (e: any) {
      setScheduleError(e?.message || 'Failed to update schedule.')
    } finally {
      setScheduleUpdating(false)
    }
  }

  // Generate minute options (increments of 5)
  const minuteOptions: number[] = []
  for (let m = 0; m < 60; m += 5) {
    minuteOptions.push(m)
  }

  // Generate hour options (0-23)
  const hourOptions: number[] = []
  for (let h = 0; h < 24; h++) {
    hourOptions.push(h)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Email Configuration */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">Email Configuration</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Configure briefing delivery</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Recipient Email</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="text-sm bg-background border-border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule Settings - Now interactive */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">
            <span className="flex items-center gap-1.5"><FiClock className="h-3.5 w-3.5" /> Schedule Settings</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Configure your automated briefing schedule</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {/* Frequency selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Frequency</Label>
            <div className="flex gap-1.5">
              {(['weekdays', 'everyday', 'custom'] as const).map(mode => (
                <Button
                  key={mode}
                  variant={frequencyMode === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFrequencyChange(mode)}
                  className="text-xs h-7 flex-1"
                >
                  {mode === 'weekdays' ? 'Weekdays' : mode === 'everyday' ? 'Everyday' : 'Custom'}
                </Button>
              ))}
            </div>
            {frequencyMode === 'custom' && (
              <div className="flex gap-1 flex-wrap pt-1">
                {DAY_LABELS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-2 py-1 text-xs border rounded-sm transition-colors ${settings.schedule.days.includes(day.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-foreground/30'}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Time picker */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Time</Label>
            <div className="flex items-center gap-2">
              <select
                value={settings.schedule.hour}
                onChange={(e) => updateSchedule({ hour: parseInt(e.target.value) })}
                className="flex-1 h-8 px-2 text-sm bg-background border border-border text-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {hourOptions.map(h => (
                  <option key={h} value={h}>{formatHour12(h)} {getAmPm(h)}</option>
                ))}
              </select>
              <span className="text-muted-foreground text-sm">:</span>
              <select
                value={settings.schedule.minute}
                onChange={(e) => updateSchedule({ minute: parseInt(e.target.value) })}
                className="flex-1 h-8 px-2 text-sm bg-background border border-border text-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {minuteOptions.map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Selected: {formatHour12(settings.schedule.hour)}:{String(settings.schedule.minute).padStart(2, '0')} {getAmPm(settings.schedule.hour)}</p>
          </div>

          <Separator />

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Timezone</Label>
            <select
              value={settings.schedule.timezone}
              onChange={(e) => updateSchedule({ timezone: e.target.value })}
              className="w-full h-8 px-2 text-sm bg-background border border-border text-foreground rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Cron preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cron Expression</Label>
            <code className="block text-xs font-mono text-foreground bg-muted px-2.5 py-1.5 border border-border rounded-sm">{cronExpression}</code>
          </div>

          <Separator />

          {/* Update Schedule button */}
          <Button
            onClick={handleUpdateSchedule}
            disabled={scheduleUpdating}
            className="w-full bg-primary text-primary-foreground text-sm"
          >
            {scheduleUpdating ? (
              <><FiLoader className="h-4 w-4 animate-spin mr-2" /> Updating Schedule...</>
            ) : scheduleSuccess ? (
              <><FiCheck className="h-4 w-4 mr-2" /> Schedule Updated</>
            ) : (
              <><FiClock className="h-4 w-4 mr-2" /> Update Schedule</>
            )}
          </Button>
          {scheduleError && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 border border-destructive/20">
              <FiAlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{scheduleError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Preferences */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">Analysis Preferences</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Select analysis types for briefings</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-card-foreground cursor-pointer">Technical Analysis</Label>
            <Switch checked={settings.analysisPrefs.technical} onCheckedChange={(v) => updatePref('technical', v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm text-card-foreground cursor-pointer">Fundamental Analysis</Label>
            <Switch checked={settings.analysisPrefs.fundamental} onCheckedChange={(v) => updatePref('fundamental', v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm text-card-foreground cursor-pointer">News Sentiment</Label>
            <Switch checked={settings.analysisPrefs.newsSentiment} onCheckedChange={(v) => updatePref('newsSentiment', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold tracking-tight text-card-foreground">Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground text-sm">
            {saved ? <><FiCheck className="h-4 w-4 mr-2" /> Saved</> : 'Save Settings'}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestBriefing}
            disabled={testLoading}
            className="w-full text-sm"
          >
            {testLoading ? (
              <><FiLoader className="h-4 w-4 animate-spin mr-2" /> Sending Test Briefing...</>
            ) : testSuccess ? (
              <><FiCheck className="h-4 w-4 mr-2 text-accent" /> Test Sent Successfully</>
            ) : (
              <><FiSend className="h-4 w-4 mr-2" /> Send Test Briefing</>
            )}
          </Button>
          {testError && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 border border-destructive/20">
              <FiAlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{testError}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Main Page ----
export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sampleMode, setSampleMode] = useState(false)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [latestBriefing, setLatestBriefing] = useState('')
  const [history, setHistory] = useState<BriefingRecord[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    email: '',
    timezone: 'America/New_York',
    analysisPrefs: { technical: true, fundamental: true, newsSentiment: true },
    schedule: {
      days: ['1', '2', '3', '4', '5'],
      hour: 17,
      minute: 20,
      timezone: 'America/New_York',
    },
  })
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState('')
  const [mounted, setMounted] = useState(false)
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(true)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const wl = localStorage.getItem(LS_WATCHLIST)
      if (wl) {
        const parsed = JSON.parse(wl)
        if (Array.isArray(parsed)) setWatchlist(parsed)
        else setWatchlist(DEFAULT_WATCHLIST)
      } else {
        setWatchlist(DEFAULT_WATCHLIST)
      }
    } catch {
      setWatchlist(DEFAULT_WATCHLIST)
    }

    try {
      const hist = localStorage.getItem(LS_HISTORY)
      if (hist) {
        const parsed = JSON.parse(hist)
        if (Array.isArray(parsed)) setHistory(parsed)
      }
    } catch { /* ignore */ }

    try {
      const st = localStorage.getItem(LS_SETTINGS)
      if (st) {
        const parsed = JSON.parse(st)
        if (parsed && typeof parsed === 'object') {
          setSettings(prev => ({
            ...prev,
            ...parsed,
            analysisPrefs: { ...prev.analysisPrefs, ...(parsed.analysisPrefs || {}) },
            schedule: { ...prev.schedule, ...(parsed.schedule || {}) },
          }))
        }
      }
    } catch { /* ignore */ }

    setLastSync(new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }))

    // Fetch schedule info
    fetchScheduleStatus().then(info => {
      setScheduleInfo(info)
      setScheduleLoading(false)
    })
  }, [])

  // Persist watchlist
  useEffect(() => {
    if (mounted) {
      try { localStorage.setItem(LS_WATCHLIST, JSON.stringify(watchlist)) } catch { /* ignore */ }
    }
  }, [watchlist, mounted])

  // Persist history
  useEffect(() => {
    if (mounted) {
      try { localStorage.setItem(LS_HISTORY, JSON.stringify(history)) } catch { /* ignore */ }
    }
  }, [history, mounted])

  const addToHistory = useCallback((content: string, stocks: string[]) => {
    const record: BriefingRecord = {
      id: simpleId(),
      date: new Date().toISOString(),
      content,
      stocks,
    }
    setHistory(prev => [record, ...prev].slice(0, 50))
    setLastSync(new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }))
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              {/* Chart icon inline SVG */}
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-tight">Stock Analysis Daily Briefing</h1>
            </div>
            <div className="flex items-center gap-4">
              {lastSync && (
                <span className="text-xs text-muted-foreground hidden sm:inline">Last sync: {lastSync}</span>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
                <Switch id="sample-toggle" checked={sampleMode} onCheckedChange={setSampleMode} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted border border-border mb-4 h-9">
            <TabsTrigger value="dashboard" className="text-xs px-4 data-[state=active]:bg-card data-[state=active]:text-foreground">Dashboard</TabsTrigger>
            <TabsTrigger value="watchlist" className="text-xs px-4 data-[state=active]:bg-card data-[state=active]:text-foreground">Watchlist</TabsTrigger>
            <TabsTrigger value="history" className="text-xs px-4 data-[state=active]:bg-card data-[state=active]:text-foreground">History</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs px-4 data-[state=active]:bg-card data-[state=active]:text-foreground">
              <FiSettings className="h-3 w-3 mr-1" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <DashboardTab
              watchlist={watchlist}
              latestBriefing={latestBriefing}
              setLatestBriefing={setLatestBriefing}
              addToHistory={addToHistory}
              sampleMode={sampleMode}
              activeAgentId={activeAgentId}
              setActiveAgentId={setActiveAgentId}
              scheduleInfo={scheduleInfo}
              scheduleLoading={scheduleLoading}
            />
          </TabsContent>

          <TabsContent value="watchlist" className="mt-0">
            <WatchlistTab
              watchlist={watchlist}
              setWatchlist={setWatchlist}
              sampleMode={sampleMode}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <HistoryTab
              history={history}
              setHistory={setHistory}
              sampleMode={sampleMode}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SettingsTab
              settings={settings}
              setSettings={setSettings}
              watchlist={watchlist}
              addToHistory={addToHistory}
              setLatestBriefing={setLatestBriefing}
              activeAgentId={activeAgentId}
              setActiveAgentId={setActiveAgentId}
            />
          </TabsContent>
        </Tabs>

        {/* Agent Info Section */}
        <div className="mt-6">
          <Card className="border border-border bg-card">
            <CardContent className="p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${activeAgentId ? 'bg-accent animate-pulse' : 'bg-muted-foreground/30'}`} />
                    <span className="text-xs font-medium text-foreground">Stock Analysis Agent</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Perplexity Sonar Pro</span>
                  <span className="text-xs text-muted-foreground font-mono">|</span>
                  <span className="text-xs text-muted-foreground">Web search enabled</span>
                  <span className="text-xs text-muted-foreground font-mono">|</span>
                  <span className="text-xs text-muted-foreground">Gmail integration</span>
                </div>
                <div className="flex items-center gap-2">
                  {activeAgentId && (
                    <Badge variant="outline" className="text-xs animate-pulse">
                      <FiLoader className="h-3 w-3 animate-spin mr-1" /> Processing
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs font-mono">{AGENT_ID.slice(0, 8)}...</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
