'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { listSchedules, getSchedule, getScheduleLogs, pauseSchedule, resumeSchedule, cronToHuman, updateScheduleMessage } from '@/lib/scheduler'
import type { Schedule, ExecutionLog } from '@/lib/scheduler'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FiTrendingUp, FiTrendingDown, FiRefreshCw, FiSettings, FiClock, FiMail, FiX, FiPlus, FiChevronDown, FiChevronUp, FiActivity, FiBarChart2, FiSearch, FiCheck, FiAlertCircle, FiPlay, FiPause, FiCalendar } from 'react-icons/fi'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANAGER_AGENT_ID = '699da8a84d9b8b973a73e428'
const INITIAL_SCHEDULE_ID = '699da8ae399dfadeac390fb8'

const ALL_SECTORS = [
  'Technology', 'Healthcare', 'Energy', 'Financials',
  'Consumer Discretionary', 'Consumer Staples', 'Industrials',
  'Materials', 'Real Estate', 'Utilities', 'Communication Services'
]

const SAMPLE_REPORT: ParsedReport = {
  report_title: 'Daily Market Analysis Report',
  report_date: 'February 24, 2026',
  executive_summary: 'Markets showed **mixed signals** today with the S&P 500 gaining modestly while tech stocks pulled back on profit-taking. The Federal Reserve\'s latest minutes suggest a hawkish tone going forward, and bond yields rose accordingly.\n\n- Cyclical sectors outperformed defensive ones\n- Earnings season continues with strong beats from financials\n- Commodities remained stable with oil hovering near $78/barrel',
  market_sentiment: 'Cautiously Bullish',
  top_insights: [
    { insight: 'Federal Reserve minutes indicate potential rate pause, boosting growth sectors', priority: 'High' },
    { insight: 'Tech earnings season starts next week with AAPL and MSFT reporting', priority: 'High' },
    { insight: 'Small-cap rotation continues as Russell 2000 outperforms large-caps', priority: 'Medium' },
    { insight: 'International markets showing weakness, particularly European indices', priority: 'Medium' },
    { insight: 'VIX remains subdued below 15, indicating complacency', priority: 'Low' }
  ],
  portfolio_summary: 'Your watchlist portfolio gained **+0.45%** today, outperforming the benchmark. AAPL and MSFT led gains while NVDA pulled back slightly on profit-taking after a strong run. Overall portfolio beta remains at 1.12.',
  portfolio_change_percent: '+0.45%',
  sp500_summary: 'The S&P 500 closed higher by 12 points, driven by financials and industrials. Breadth was positive with advancers outnumbering decliners 3:2. Volume was slightly below average.',
  sp500_level: '5,842.50',
  sp500_change: '+0.21%',
  tech_summary: 'The technology sector experienced a slight pullback as investors rotated into cyclical names. **Semiconductor stocks** were the weakest sub-sector, while software names held up relatively well. AI-related names saw mixed performance.',
  top_tech_mover: 'NVDA (-2.3%)',
  sector_summary: 'Financials led all sectors on rising yields and strong earnings from regional banks. Healthcare also outperformed on positive clinical trial data from several biotech firms. Energy was flat despite stable oil prices.',
  best_sector: 'Financials (+1.8%)',
  worst_sector: 'Utilities (-0.9%)',
  recommendations: [
    { action: 'BUY', ticker: 'JPM', reasoning: 'Strong earnings beat, benefiting from higher rates and robust trading revenue. Price target raised by multiple analysts.' },
    { action: 'HOLD', ticker: 'AAPL', reasoning: 'Trading near all-time highs. Earnings report next week could be a catalyst. Wait for results before adding.' },
    { action: 'SELL', ticker: 'XLU', reasoning: 'Utilities sector facing headwinds from rising rates. Rotate into cyclical exposure for better risk-adjusted returns.' }
  ],
  email_sent: 'Report delivered successfully via Gmail',
  full_report: '# Comprehensive Daily Market Report\n\n## Executive Overview\n\nMarkets showed mixed signals today with cautiously bullish sentiment prevailing.\n\n## Portfolio Analysis\n\nYour watchlist gained +0.45% today, outperforming the S&P 500 benchmark of +0.21%.\n\n## S&P 500 Analysis\n\nThe index closed at 5,842.50, up 12 points. Breadth was positive.\n\n## Technology Sector\n\nTech pulled back slightly with semiconductors leading the decline. AI names were mixed.\n\n## Sector Rotation\n\n- **Best:** Financials (+1.8%)\n- **Worst:** Utilities (-0.9%)\n\n## Recommendations\n\n1. **BUY JPM** - Strong earnings, benefiting from rate environment\n2. **HOLD AAPL** - Wait for earnings next week\n3. **SELL XLU** - Rotate out of defensive positioning'
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface ParsedReport {
  report_title?: string
  report_date?: string
  executive_summary?: string
  market_sentiment?: string
  top_insights?: Array<{ insight?: string; priority?: string }>
  portfolio_summary?: string
  portfolio_change_percent?: string
  sp500_summary?: string
  sp500_level?: string
  sp500_change?: string
  tech_summary?: string
  top_tech_mover?: string
  sector_summary?: string
  best_sector?: string
  worst_sector?: string
  recommendations?: Array<{ action?: string; ticker?: string; reasoning?: string }>
  email_sent?: string
  full_report?: string
}

interface StoredReport {
  id: string
  date: string
  data: ParsedReport
  sentiment: string
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium">{part}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-medium text-sm mt-3 mb-1 tracking-wide">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-medium text-base mt-3 mb-1 font-serif tracking-wide">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-medium text-lg mt-4 mb-2 font-serif tracking-wide">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm leading-relaxed">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm leading-relaxed">{formatInline(line)}</p>
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-medium mb-2 font-serif">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-6 py-2 bg-primary text-primary-foreground text-sm tracking-wider uppercase">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <Card className="border border-border rounded-none shadow-none">
      <CardContent className="p-6">
        <p className="text-xs text-muted-foreground uppercase tracking-[0.15em] mb-3">{label}</p>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-light font-mono tracking-tight">{value || '--'}</span>
          {trend === 'up' && <FiTrendingUp className="text-primary mb-1" size={16} />}
          {trend === 'down' && <FiTrendingDown className="text-destructive mb-1" size={16} />}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = (sentiment ?? '').toLowerCase()
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  if (s.includes('bullish') || s.includes('positive')) variant = 'default'
  if (s.includes('bearish') || s.includes('negative')) variant = 'destructive'
  return (
    <Badge variant={variant} className="rounded-none text-xs tracking-wider uppercase font-normal px-3 py-1">
      {sentiment || 'N/A'}
    </Badge>
  )
}

function ExpandableSection({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="border border-border rounded-none">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/50 transition-colors">
        <span className="font-serif text-sm tracking-[0.1em] uppercase font-normal">{title}</span>
        {open ? <FiChevronUp size={16} className="text-muted-foreground" /> : <FiChevronDown size={16} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

function TickerChip({ ticker, onRemove }: { ticker: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-xs font-mono tracking-wider uppercase bg-secondary">
      {ticker}
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground transition-colors">
        <FiX size={12} />
      </button>
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center gap-3 mb-2">
        <FiRefreshCw className="animate-spin text-primary" size={18} />
        <span className="text-sm text-muted-foreground tracking-wider uppercase">Analyzing markets...</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="border border-border p-6">
            <Skeleton className="h-3 w-24 mb-4 rounded-none" />
            <Skeleton className="h-8 w-20 rounded-none" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-48 rounded-none" />
        <Skeleton className="h-3 w-full rounded-none" />
        <Skeleton className="h-3 w-5/6 rounded-none" />
        <Skeleton className="h-3 w-4/6 rounded-none" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-36 rounded-none" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-border p-5">
              <Skeleton className="h-3 w-16 mb-3 rounded-none" />
              <Skeleton className="h-3 w-full rounded-none" />
              <Skeleton className="h-3 w-4/5 mt-2 rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReportView({ report }: { report: ParsedReport }) {
  const insights = Array.isArray(report?.top_insights) ? report.top_insights : []
  const recommendations = Array.isArray(report?.recommendations) ? report.recommendations : []

  const parseTrend = (val?: string): 'up' | 'down' | 'neutral' => {
    if (!val) return 'neutral'
    if (val.includes('+')) return 'up'
    if (val.includes('-')) return 'down'
    return 'neutral'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-light tracking-[0.1em]">{report?.report_title ?? 'Market Report'}</h2>
          <p className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">{report?.report_date ?? ''}</p>
        </div>
        <SentimentBadge sentiment={report?.market_sentiment ?? ''} />
      </div>

      {/* Executive Summary */}
      {report?.executive_summary && (
        <div className="border-l-2 border-primary pl-5">
          {renderMarkdown(report.executive_summary)}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Portfolio" value={report?.portfolio_change_percent ?? '--'} trend={parseTrend(report?.portfolio_change_percent)} />
        <MetricCard label="S&P 500" value={report?.sp500_level ?? '--'} sub={report?.sp500_change ?? ''} trend={parseTrend(report?.sp500_change)} />
        <MetricCard label="Top Tech Mover" value={report?.top_tech_mover ?? '--'} trend={parseTrend(report?.top_tech_mover)} />
        <MetricCard label="Best Sector" value={report?.best_sector ?? '--'} sub={report?.worst_sector ? `Worst: ${report.worst_sector}` : ''} trend="up" />
      </div>

      {/* Top Insights */}
      {insights.length > 0 && (
        <ExpandableSection title="Key Insights" defaultOpen>
          <div className="space-y-3">
            {insights.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <Badge variant={(item?.priority ?? '').toLowerCase() === 'high' ? 'default' : 'secondary'} className="rounded-none text-xs uppercase tracking-wider font-normal mt-0.5 shrink-0">
                  {item?.priority ?? 'Info'}
                </Badge>
                <p className="text-sm leading-relaxed">{item?.insight ?? ''}</p>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Analysis Sections */}
      <ExpandableSection title="Portfolio Analysis" defaultOpen={false}>
        {renderMarkdown(report?.portfolio_summary ?? '')}
      </ExpandableSection>

      <ExpandableSection title="S&P 500 Analysis" defaultOpen={false}>
        {renderMarkdown(report?.sp500_summary ?? '')}
      </ExpandableSection>

      <ExpandableSection title="Technology Sector" defaultOpen={false}>
        {renderMarkdown(report?.tech_summary ?? '')}
      </ExpandableSection>

      <ExpandableSection title="Sector Overview" defaultOpen={false}>
        {renderMarkdown(report?.sector_summary ?? '')}
      </ExpandableSection>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <ExpandableSection title="Recommendations" defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec, idx) => {
              const actionLower = (rec?.action ?? '').toLowerCase()
              let actionColor = 'bg-secondary text-secondary-foreground'
              if (actionLower === 'buy') actionColor = 'bg-primary text-primary-foreground'
              if (actionLower === 'sell') actionColor = 'bg-destructive text-destructive-foreground'
              return (
                <div key={idx} className="border border-border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 text-xs tracking-wider uppercase font-normal ${actionColor}`}>{rec?.action ?? 'N/A'}</span>
                    <span className="font-mono text-sm tracking-wider">{rec?.ticker ?? ''}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{rec?.reasoning ?? ''}</p>
                </div>
              )
            })}
          </div>
        </ExpandableSection>
      )}

      {/* Full Report */}
      {report?.full_report && (
        <ExpandableSection title="Full Report" defaultOpen={false}>
          {renderMarkdown(report.full_report)}
        </ExpandableSection>
      )}

      {/* Email Status */}
      {report?.email_sent && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-4 mt-4">
          <FiMail size={14} />
          <span className="tracking-wider">{report.email_sent}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function Page() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'settings'>('dashboard')

  // Sample data toggle
  const [showSample, setShowSample] = useState(false)

  // Dashboard state
  const [currentReport, setCurrentReport] = useState<ParsedReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Reports history
  const [storedReports, setStoredReports] = useState<StoredReport[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Settings state
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [tickerInput, setTickerInput] = useState('')
  const [selectedSectors, setSelectedSectors] = useState<string[]>(['Technology', 'Healthcare', 'Financials'])
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailStatusMsg, setEmailStatusMsg] = useState('')

  // Schedule state
  const [scheduleId, setScheduleId] = useState(INITIAL_SCHEDULE_ID)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleMsg, setScheduleMsg] = useState('')

  // ---------------------------------------------------------------------------
  // Load from localStorage
  // ---------------------------------------------------------------------------

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stockpulse_reports')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setStoredReports(parsed)
      }
      const savedWatchlist = localStorage.getItem('stockpulse_watchlist')
      if (savedWatchlist) {
        const parsed = JSON.parse(savedWatchlist)
        if (Array.isArray(parsed)) setWatchlist(parsed)
      }
      const savedSectors = localStorage.getItem('stockpulse_sectors')
      if (savedSectors) {
        const parsed = JSON.parse(savedSectors)
        if (Array.isArray(parsed)) setSelectedSectors(parsed)
      }
      const savedEmail = localStorage.getItem('stockpulse_email')
      if (savedEmail) {
        setDeliveryEmail(savedEmail)
        setEmailSaved(true)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  // Persist watchlist and sectors
  useEffect(() => {
    try {
      localStorage.setItem('stockpulse_watchlist', JSON.stringify(watchlist))
    } catch {}
  }, [watchlist])

  useEffect(() => {
    try {
      localStorage.setItem('stockpulse_sectors', JSON.stringify(selectedSectors))
    } catch {}
  }, [selectedSectors])

  // ---------------------------------------------------------------------------
  // Load schedule data
  // ---------------------------------------------------------------------------

  const loadScheduleData = useCallback(async () => {
    setScheduleLoading(true)
    setScheduleError('')
    try {
      const result = await getSchedule(scheduleId)
      if (result.success && result.schedule) {
        setSchedule(result.schedule)
      } else {
        const listResult = await listSchedules()
        if (listResult.success && listResult.schedules.length > 0) {
          const found = listResult.schedules[0]
          setSchedule(found)
          setScheduleId(found.id)
        }
      }
      const logsResult = await getScheduleLogs(scheduleId, { limit: 10 })
      if (logsResult.success) {
        setScheduleLogs(Array.isArray(logsResult.executions) ? logsResult.executions : [])
      }
    } catch {
      setScheduleError('Failed to load schedule data')
    }
    setScheduleLoading(false)
  }, [scheduleId])

  useEffect(() => {
    loadScheduleData()
  }, [loadScheduleData])

  // ---------------------------------------------------------------------------
  // Generate report
  // ---------------------------------------------------------------------------

  const generateReport = async () => {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    setActiveAgentId(MANAGER_AGENT_ID)

    const tickers = watchlist.length > 0 ? watchlist.join(', ') : 'AAPL, MSFT, GOOGL, AMZN, NVDA'
    const sectors = selectedSectors.length > 0 ? selectedSectors.join(', ') : 'Technology, Healthcare, Financials'
    const emailPart = emailSaved && deliveryEmail ? ` Send the report via Gmail to ${deliveryEmail}.` : ''

    const message = `Generate the comprehensive daily market analysis report. Analyze the following watchlist stocks: ${tickers}. Focus on these sectors: ${sectors}.${emailPart}`

    try {
      const result = await callAIAgent(message, MANAGER_AGENT_ID)
      if (result.success) {
        const rawResult = result?.response?.result || {}
        const parsed: ParsedReport = typeof rawResult === 'string' ? parseLLMJson(rawResult) : rawResult

        setCurrentReport(parsed)
        setSuccessMsg('Report generated successfully')

        const reportDate = parsed?.report_date ?? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        const newReport: StoredReport = {
          id: `report_${Date.now()}`,
          date: reportDate,
          data: parsed,
          sentiment: parsed?.market_sentiment ?? 'Neutral'
        }
        const updated = [newReport, ...storedReports].slice(0, 50)
        setStoredReports(updated)
        try {
          localStorage.setItem('stockpulse_reports', JSON.stringify(updated))
        } catch {}
      } else {
        setErrorMsg(result?.error ?? 'Failed to generate report. Please try again.')
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
    }

    setLoading(false)
    setActiveAgentId(null)
  }

  // ---------------------------------------------------------------------------
  // Schedule controls
  // ---------------------------------------------------------------------------

  const handleToggleSchedule = async () => {
    if (!schedule) return
    if (!emailSaved && !schedule.is_active) {
      setScheduleError('Please save a delivery email address before activating the schedule.')
      return
    }
    setScheduleLoading(true)
    setScheduleError('')
    setScheduleMsg('')
    try {
      if (schedule.is_active) {
        await pauseSchedule(schedule.id)
      } else {
        await resumeSchedule(schedule.id)
      }
      const listResult = await listSchedules()
      if (listResult.success) {
        const found = listResult.schedules.find(s => s.id === schedule.id) ?? listResult.schedules[0]
        if (found) {
          setSchedule(found)
          setScheduleId(found.id)
        }
      }
      setScheduleMsg(schedule.is_active ? 'Schedule paused' : 'Schedule activated')
    } catch {
      setScheduleError('Failed to update schedule')
    }
    setScheduleLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Save email
  // ---------------------------------------------------------------------------

  const handleSaveEmail = async () => {
    if (!deliveryEmail || !deliveryEmail.includes('@')) {
      setEmailStatusMsg('Please enter a valid email address')
      return
    }
    setEmailSaving(true)
    setEmailStatusMsg('')

    try {
      localStorage.setItem('stockpulse_email', deliveryEmail)

      const tickers = watchlist.length > 0 ? watchlist.join(', ') : 'AAPL, MSFT, GOOGL, AMZN, NVDA'
      const sectors = selectedSectors.length > 0 ? selectedSectors.join(', ') : 'Technology, Healthcare, Financials'
      const newMessage = `Generate the comprehensive daily market analysis report. Analyze the following watchlist stocks: ${tickers}. Focus on these sectors: ${sectors}. Send the report via Gmail to ${deliveryEmail}.`

      const result = await updateScheduleMessage(scheduleId, newMessage)
      if (result.success && result.newScheduleId) {
        setScheduleId(result.newScheduleId)
        setEmailSaved(true)
        setEmailStatusMsg('Email saved and schedule updated')
        const schedResult = await getSchedule(result.newScheduleId)
        if (schedResult.success && schedResult.schedule) {
          setSchedule(schedResult.schedule)
        }
      } else {
        setEmailSaved(true)
        setEmailStatusMsg(result?.error ? `Email saved locally. Schedule sync: ${result.error}` : 'Email saved locally')
      }
    } catch {
      setEmailSaved(true)
      setEmailStatusMsg('Email saved locally')
    }
    setEmailSaving(false)
  }

  // ---------------------------------------------------------------------------
  // Ticker management
  // ---------------------------------------------------------------------------

  const addTicker = () => {
    const t = tickerInput.trim().toUpperCase()
    if (t && !watchlist.includes(t) && t.length <= 6) {
      setWatchlist(prev => [...prev, t])
      setTickerInput('')
    }
  }

  const removeTicker = (ticker: string) => {
    setWatchlist(prev => prev.filter(t => t !== ticker))
  }

  // ---------------------------------------------------------------------------
  // Sector toggle
  // ---------------------------------------------------------------------------

  const toggleSector = (sector: string) => {
    setSelectedSectors(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    )
  }

  // ---------------------------------------------------------------------------
  // Reports filtering
  // ---------------------------------------------------------------------------

  const displayReport = showSample ? SAMPLE_REPORT : currentReport
  const filteredReports = storedReports.filter(r => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (r.date?.toLowerCase()?.includes(q)) ||
      (r.sentiment?.toLowerCase()?.includes(q)) ||
      (r.data?.report_title?.toLowerCase()?.includes(q)) ||
      (r.data?.executive_summary?.toLowerCase()?.includes(q))
  })
  const selectedReport = storedReports.find(r => r.id === selectedReportId)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Navigation */}
        <header className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-10">
                <h1 className="font-serif text-lg tracking-[0.2em] uppercase font-light">StockPulse</h1>
                <nav className="hidden md:flex items-center gap-8">
                  {([
                    { key: 'dashboard' as const, label: 'Dashboard', icon: FiBarChart2 },
                    { key: 'reports' as const, label: 'Reports', icon: FiCalendar },
                    { key: 'settings' as const, label: 'Settings', icon: FiSettings }
                  ]).map(item => (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key)}
                      className={`flex items-center gap-2 text-xs tracking-[0.15em] uppercase py-1 border-b-2 transition-colors ${activeTab === item.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                      <item.icon size={14} />
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground tracking-wider uppercase cursor-pointer">Sample Data</Label>
                  <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
                </div>
              </div>
            </div>

            {/* Mobile nav */}
            <div className="flex md:hidden border-t border-border -mx-6 px-6">
              {([
                { key: 'dashboard' as const, label: 'Dashboard' },
                { key: 'reports' as const, label: 'Reports' },
                { key: 'settings' as const, label: 'Settings' }
              ]).map(item => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex-1 text-xs tracking-[0.15em] uppercase py-3 border-b-2 transition-colors ${activeTab === item.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          {/* ============================================================ */}
          {/* DASHBOARD */}
          {/* ============================================================ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Greeting banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
                <div>
                  <h2 className="font-serif text-2xl font-light tracking-[0.08em]">Market Overview</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Your daily market intelligence, on demand</p>
                  {activeAgentId && (
                    <div className="flex items-center gap-2 mt-2">
                      <FiActivity size={12} className="text-primary animate-pulse" />
                      <span className="text-xs text-primary tracking-wider">Market Analysis Coordinator active</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={generateReport}
                  disabled={loading}
                  className="rounded-none tracking-[0.15em] uppercase text-xs px-8 py-5 bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-none"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><FiRefreshCw className="animate-spin" size={14} /> Generating...</span>
                  ) : (
                    <span className="flex items-center gap-2"><FiBarChart2 size={14} /> Generate Report Now</span>
                  )}
                </Button>
              </div>

              {/* Messages */}
              {errorMsg && (
                <div className="flex items-center gap-3 border border-destructive/30 bg-destructive/5 p-4">
                  <FiAlertCircle className="text-destructive shrink-0" size={16} />
                  <p className="text-sm text-destructive">{errorMsg}</p>
                </div>
              )}
              {successMsg && !loading && (
                <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 p-4">
                  <FiCheck className="text-primary shrink-0" size={16} />
                  <p className="text-sm text-primary">{successMsg}</p>
                </div>
              )}

              {/* Loading */}
              {loading && <LoadingSkeleton />}

              {/* Report Content */}
              {!loading && displayReport && (
                <ReportView report={displayReport} />
              )}

              {/* Empty state */}
              {!loading && !displayReport && (
                <div className="text-center py-20 border border-dashed border-border">
                  <FiBarChart2 className="mx-auto text-muted-foreground mb-4" size={32} />
                  <h3 className="font-serif text-lg font-light tracking-wide mb-2">No Report Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Click &quot;Generate Report Now&quot; to run a comprehensive analysis of your watchlist,
                    or enable the Sample Data toggle to preview the interface.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* REPORTS HISTORY */}
          {/* ============================================================ */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="font-serif text-2xl font-light tracking-[0.08em]">Report History</h2>
                <div className="relative w-full md:w-64">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input
                    placeholder="Search reports..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-none text-sm border-border"
                  />
                </div>
              </div>

              {showSample && storedReports.length === 0 && (
                <div className="border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    Sample data is active on Dashboard. Generate a real report to populate your history.
                  </p>
                </div>
              )}

              {filteredReports.length === 0 && (
                <div className="text-center py-20 border border-dashed border-border">
                  <FiCalendar className="mx-auto text-muted-foreground mb-4" size={32} />
                  <h3 className="font-serif text-lg font-light tracking-wide mb-2">No Reports Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Your first report will appear here after generation. Daily reports will arrive every morning once the schedule is activated.
                  </p>
                </div>
              )}

              {filteredReports.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Report List */}
                  <div className="lg:col-span-1">
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-3 pr-4">
                        {filteredReports.map(report => (
                          <button
                            key={report.id}
                            onClick={() => setSelectedReportId(report.id)}
                            className={`w-full text-left border p-4 transition-colors ${selectedReportId === report.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-foreground tracking-wider uppercase">{report.date}</span>
                              <SentimentBadge sentiment={report.sentiment} />
                            </div>
                            <p className="text-sm line-clamp-2 leading-relaxed">{(report.data?.executive_summary ?? 'No summary available').slice(0, 120)}...</p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Report Detail */}
                  <div className="lg:col-span-2">
                    {selectedReport ? (
                      <Card className="border border-border rounded-none shadow-none">
                        <CardContent className="p-6">
                          <ScrollArea className="h-[580px]">
                            <ReportView report={selectedReport.data} />
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="flex items-center justify-center h-[600px] border border-dashed border-border">
                        <p className="text-sm text-muted-foreground tracking-wider">Select a report to view details</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* SETTINGS */}
          {/* ============================================================ */}
          {activeTab === 'settings' && (
            <div className="space-y-10">
              <h2 className="font-serif text-2xl font-light tracking-[0.08em]">Settings</h2>

              {/* Watchlist */}
              <section className="space-y-4">
                <div>
                  <h3 className="font-serif text-sm tracking-[0.1em] uppercase font-normal">Watchlist</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Add stock tickers to track in your daily reports</p>
                </div>
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter ticker (e.g. AAPL)"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTicker() }}
                    className="rounded-none max-w-xs font-mono text-sm border-border"
                    maxLength={6}
                  />
                  <Button onClick={addTicker} variant="outline" className="rounded-none tracking-wider uppercase text-xs border-border">
                    <FiPlus size={14} className="mr-1" /> Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {watchlist.length === 0 && (
                    <p className="text-xs text-muted-foreground">No tickers added. Default watchlist: AAPL, MSFT, GOOGL, AMZN, NVDA</p>
                  )}
                  {watchlist.map(t => (
                    <TickerChip key={t} ticker={t} onRemove={() => removeTicker(t)} />
                  ))}
                </div>
              </section>

              <Separator className="bg-border" />

              {/* Sectors */}
              <section className="space-y-4">
                <div>
                  <h3 className="font-serif text-sm tracking-[0.1em] uppercase font-normal">Sectors</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Select sectors to monitor in your analysis</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ALL_SECTORS.map(sector => (
                    <button
                      key={sector}
                      onClick={() => toggleSector(sector)}
                      className={`flex items-center justify-between p-3 border text-xs tracking-wider transition-colors ${selectedSectors.includes(sector) ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-primary/30'}`}
                    >
                      <span>{sector}</span>
                      {selectedSectors.includes(sector) && <FiCheck size={14} className="text-primary shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              </section>

              <Separator className="bg-border" />

              {/* Email Delivery */}
              <section className="space-y-4">
                <div>
                  <h3 className="font-serif text-sm tracking-[0.1em] uppercase font-normal">Email Delivery</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Set the email address where daily reports will be delivered via Gmail</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex-1 max-w-md space-y-1">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={deliveryEmail}
                      onChange={(e) => {
                        setDeliveryEmail(e.target.value)
                        setEmailSaved(false)
                        setEmailStatusMsg('')
                      }}
                      className="rounded-none text-sm border-border"
                    />
                    {emailStatusMsg && (
                      <p className={`text-xs ${emailStatusMsg.includes('error') || emailStatusMsg.includes('valid') ? 'text-destructive' : 'text-primary'}`}>
                        {emailStatusMsg}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSaveEmail}
                    disabled={emailSaving || !deliveryEmail}
                    variant="outline"
                    className="rounded-none tracking-wider uppercase text-xs border-border"
                  >
                    {emailSaving ? (
                      <span className="flex items-center gap-1"><FiRefreshCw className="animate-spin" size={12} /> Saving...</span>
                    ) : emailSaved ? (
                      <span className="flex items-center gap-1"><FiCheck size={12} /> Saved</span>
                    ) : (
                      <span className="flex items-center gap-1"><FiMail size={12} /> Save</span>
                    )}
                  </Button>
                </div>
                {emailSaved && (
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <FiCheck size={12} />
                    <span>Reports will be sent to {deliveryEmail}</span>
                  </div>
                )}
              </section>

              <Separator className="bg-border" />

              {/* Schedule Management */}
              <section className="space-y-6">
                <div>
                  <h3 className="font-serif text-sm tracking-[0.1em] uppercase font-normal">Schedule Management</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Configure automatic daily report generation and delivery</p>
                </div>

                {scheduleError && (
                  <div className="flex items-center gap-3 border border-destructive/30 bg-destructive/5 p-4">
                    <FiAlertCircle className="text-destructive shrink-0" size={14} />
                    <p className="text-sm text-destructive">{scheduleError}</p>
                  </div>
                )}

                {scheduleMsg && (
                  <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 p-4">
                    <FiCheck className="text-primary shrink-0" size={14} />
                    <p className="text-sm text-primary">{scheduleMsg}</p>
                  </div>
                )}

                {/* Schedule Status Card */}
                <Card className="border border-border rounded-none shadow-none">
                  <CardContent className="p-6 space-y-5">
                    {scheduleLoading && !schedule && (
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-full rounded-none" />
                        <Skeleton className="h-8 w-48 rounded-none" />
                      </div>
                    )}

                    {schedule && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${schedule.is_active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            <span className="text-sm tracking-wider uppercase">{schedule.is_active ? 'Active' : 'Paused'}</span>
                          </div>
                          <Button
                            onClick={handleToggleSchedule}
                            disabled={scheduleLoading || (!emailSaved && !schedule.is_active)}
                            variant={schedule.is_active ? 'outline' : 'default'}
                            className="rounded-none tracking-wider uppercase text-xs"
                          >
                            {schedule.is_active ? (
                              <span className="flex items-center gap-2"><FiPause size={12} /> Pause Schedule</span>
                            ) : (
                              <span className="flex items-center gap-2"><FiPlay size={12} /> Activate Schedule</span>
                            )}
                          </Button>
                        </div>

                        {!emailSaved && !schedule.is_active && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border p-3">
                            <FiAlertCircle size={14} className="shrink-0" />
                            <span>Please save a delivery email address before activating the schedule.</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">Frequency</p>
                            <p className="text-sm font-mono">{schedule.cron_expression ? cronToHuman(schedule.cron_expression) : 'Every day at 7:00'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">Timezone</p>
                            <p className="text-sm font-mono">{schedule.timezone ?? 'America/New_York'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">Next Run</p>
                            <p className="text-sm font-mono">
                              {schedule.next_run_time
                                ? new Date(schedule.next_run_time).toLocaleString()
                                : schedule.is_active ? 'Calculating...' : 'Schedule is paused'}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {!schedule && !scheduleLoading && (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">Unable to load schedule. The schedule may not exist yet.</p>
                        <Button onClick={loadScheduleData} variant="outline" className="rounded-none mt-3 text-xs tracking-wider uppercase">
                          <FiRefreshCw size={12} className="mr-1" /> Retry
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Run History */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Execution History</h4>
                    <Button variant="ghost" size="sm" onClick={loadScheduleData} disabled={scheduleLoading} className="rounded-none text-xs tracking-wider">
                      <FiRefreshCw size={12} className={`mr-1 ${scheduleLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                  </div>

                  {scheduleLogs.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-border">
                      <FiClock className="mx-auto text-muted-foreground mb-2" size={20} />
                      <p className="text-xs text-muted-foreground">No executions yet. History will appear here after the schedule runs.</p>
                    </div>
                  )}

                  {scheduleLogs.length > 0 && (
                    <div className="border border-border divide-y divide-border overflow-x-auto">
                      <div className="grid grid-cols-4 gap-4 p-3 bg-secondary/50 min-w-[500px]">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Date</span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Attempt</span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Details</span>
                      </div>
                      {scheduleLogs.map(log => (
                        <div key={log.id} className="grid grid-cols-4 gap-4 p-3 min-w-[500px]">
                          <span className="text-xs font-mono">{new Date(log.executed_at).toLocaleString()}</span>
                          <span className="text-xs">
                            {log.success ? (
                              <span className="flex items-center gap-1 text-primary"><FiCheck size={12} /> Success</span>
                            ) : (
                              <span className="flex items-center gap-1 text-destructive"><FiAlertCircle size={12} /> Failed</span>
                            )}
                          </span>
                          <span className="text-xs font-mono">{log.attempt}/{log.max_attempts}</span>
                          <span className="text-xs text-muted-foreground truncate">{log.error_message ?? 'OK'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>

        {/* Agent Info Footer */}
        <footer className="border-t border-border bg-card mt-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Powered by</p>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${activeAgentId ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                  <span className="text-xs tracking-wider">Market Analysis Coordinator</span>
                  <span className="text-xs text-muted-foreground font-mono hidden md:inline">Orchestrates sub-agents for portfolio, S&P 500, tech, and sector analysis</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground tracking-wider">
                {schedule?.is_active ? (
                  <span className="flex items-center gap-2"><FiClock size={12} /> Next report: {schedule?.next_run_time ? new Date(schedule.next_run_time).toLocaleString() : 'Scheduled'}</span>
                ) : (
                  <span className="flex items-center gap-2"><FiPause size={12} /> Schedule paused</span>
                )}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
