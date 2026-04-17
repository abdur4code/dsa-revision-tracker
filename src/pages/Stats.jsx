import { useEffect, useMemo, useState } from 'react'
import {
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns'
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Calendar,
  Clock,
  FileText,
  Flame,
  RefreshCw,
  Rocket,
  Target,
  TrendingUp,
  Trophy,
  Star,
} from 'lucide-react'
import { getProblems, getSettings, TOPICS } from '../utils/storage'
import { REVISION_DAYS } from '../utils/revisionUtils'

const TOPIC_COLORS = {
  Arrays: '#1f6feb',
  Strings: '#8957e5',
  Hashing: '#d29922',
  'Two Pointers': '#3fb950',
  'Sliding Window': '#58a6ff',
  'Binary Search': '#f78166',
  Recursion: '#bc8cff',
  'Linked List': '#ff7b72',
  Stack: '#ffa657',
  Queue: '#79c0ff',
  Trees: '#56d364',
  Graphs: '#e3b341',
  'Dynamic Programming': '#f85149',
}

const SEMANTIC_COLORS = {
  info: '#5ba4ff',
  success: '#3fb950',
  warn: '#d29922',
  danger: '#f16b6b',
  muted: '#8b949e',
}

const DIFFICULTY_COLORS = {
  Easy: SEMANTIC_COLORS.success,
  Medium: SEMANTIC_COLORS.warn,
  Hard: SEMANTIC_COLORS.danger,
}

const DIFFICULTY_PROGRESS_GRADIENTS = {
  Easy: 'linear-gradient(90deg, #0e4429 0%, #3fb950 100%)',
  Medium: 'linear-gradient(90deg, #2d1f00 0%, #d29922 100%)',
  Hard: 'linear-gradient(90deg, #2a1212 0%, #f16b6b 100%)',
}

const REPORT_ROW_ICONS = {
  'Problems Solved': Target,
  'Revision Rate': RefreshCw,
  'Topics Covered': BookOpen,
  'Current Streak': Flame,
  'Avg Confidence': Star,
}

const cardClassName = 'stats-card stats-card-fade p-4'

const toDayKey = (dateValue) => format(startOfDay(new Date(dateValue)), 'yyyy-MM-dd')

const fromDayKey = (dayKey) => {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const buildActivityDateSet = (problems) => {
  const activeDays = new Set()

  problems.forEach((problem) => {
    if (problem?.solvedDate) {
      activeDays.add(toDayKey(problem.solvedDate))
    }

    ;(problem?.revisions ?? []).forEach((revision) => {
      if (revision?.completedDate) {
        activeDays.add(toDayKey(revision.completedDate))
      }
    })
  })

  return activeDays
}

const calculateCurrentStreak = (activityDays) => {
  let streak = 0
  let cursor = startOfDay(new Date())

  while (activityDays.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1
    cursor = subDays(cursor, 1)
  }

  return streak
}

const calculateLongestStreak = (activityDays) => {
  const sortedKeys = Array.from(activityDays).sort()
  if (sortedKeys.length === 0) {
    return 0
  }

  let longest = 1
  let current = 1
  let previousDate = fromDayKey(sortedKeys[0])

  sortedKeys.slice(1).forEach((dayKey) => {
    const nextDate = fromDayKey(dayKey)
    const diff = differenceInCalendarDays(nextDate, previousDate)

    if (diff === 1) {
      current += 1
    } else {
      current = 1
    }

    longest = Math.max(longest, current)
    previousDate = nextDate
  })

  return longest
}

const getFirstProblemDate = (problems) => {
  const dates = problems
    .map((problem) => (problem?.solvedDate ? startOfDay(new Date(problem.solvedDate)) : null))
    .filter(Boolean)

  if (dates.length === 0) {
    return null
  }

  return dates.reduce((earliest, current) =>
    current.getTime() < earliest.getTime() ? current : earliest,
  )
}

const buildRevisionEntries = (problems) => {
  const entries = []

  problems.forEach((problem) => {
    ;(problem?.revisions ?? []).forEach((revision) => {
      if (!revision?.dueDate) {
        return
      }

      const dueDateObj = startOfDay(new Date(revision.dueDate))
      const completedDateObj = revision?.completedDate ? new Date(revision.completedDate) : null
      const confidence = Number(revision?.confidence ?? problem?.confidenceRating ?? 0)

      entries.push({
        problemId: problem.id,
        title: problem.title,
        topic: problem.topic,
        day: Number(revision?.day ?? 0),
        dueDateObj,
        completedDateObj,
        confidence,
      })
    })
  })

  return entries
}

const getPercentTone = (percent) => {
  if (percent >= 80) {
    return { label: 'Solid 💪', color: SEMANTIC_COLORS.success }
  }
  if (percent >= 50) {
    return { label: 'Needs work', color: SEMANTIC_COLORS.warn }
  }
  return { label: 'Danger zone ⚠️', color: SEMANTIC_COLORS.danger }
}

const getPerformanceTone = (value, target) => {
  if (value >= target) {
    return 'green'
  }
  if (value >= target * 0.5) {
    return 'amber'
  }
  return 'red'
}

function Stats() {
  const [problems, setProblems] = useState([])
  const [settings, setSettings] = useState(() => getSettings())
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [animationProgress, setAnimationProgress] = useState(0)

  useEffect(() => {
    setProblems(getProblems())
    setSettings(getSettings())
    setLastUpdated(new Date())
  }, [])

  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    const totalProblems = problems.length

    const activityDays = buildActivityDateSet(problems)
    const currentStreak = calculateCurrentStreak(activityDays)
    const longestStreak = calculateLongestStreak(activityDays)
    const activeDaysCount = activityDays.size

    const firstProblemDate = getFirstProblemDate(problems)
    const daysSinceStart = firstProblemDate
      ? differenceInCalendarDays(today, firstProblemDate) + 1
      : 0
    const consistencyPercent = daysSinceStart
      ? Math.round((activeDaysCount / daysSinceStart) * 100)
      : 0

    const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 }
    const topicCounts = TOPICS.reduce((acc, topic) => {
      acc[topic] = 0
      return acc
    }, {})

    problems.forEach((problem) => {
      if (difficultyCounts[problem?.difficulty] !== undefined) {
        difficultyCounts[problem.difficulty] += 1
      }

      if (topicCounts[problem?.topic] !== undefined) {
        topicCounts[problem.topic] += 1
      }
    })

    const topicsCovered = Object.values(topicCounts).filter((count) => count > 0).length

    const revisionEntries = buildRevisionEntries(problems)
    const dueTotal = revisionEntries.filter((entry) => entry.dueDateObj <= today).length
    const dueCompleted = revisionEntries.filter(
      (entry) => entry.dueDateObj <= today && entry.completedDateObj,
    ).length
    const revisionCompletionRate = dueTotal
      ? Math.round((dueCompleted / dueTotal) * 100)
      : 0

    const dueTodayCount = revisionEntries.filter(
      (entry) => !entry.completedDateObj && isSameDay(entry.dueDateObj, today),
    ).length

    const overdueCount = revisionEntries.filter(
      (entry) => !entry.completedDateObj && entry.dueDateObj < today,
    ).length

    const checkpointStats = REVISION_DAYS.map((day) => {
      const scoped = revisionEntries.filter(
        (entry) => entry.day === day && entry.dueDateObj <= today,
      )
      const total = scoped.length
      const completed = scoped.filter((entry) => Boolean(entry.completedDateObj)).length
      const percent = total ? Math.round((completed / total) * 100) : 0

      return { day, total, completed, percent }
    })

    const completedRevisions = revisionEntries
      .filter((entry) => entry.completedDateObj)
      .sort((a, b) => b.completedDateObj.getTime() - a.completedDateObj.getTime())

    const recentRevisions = completedRevisions.slice(0, 10)
    const averageConfidence = completedRevisions.length
      ? Math.round(
          (completedRevisions.reduce((sum, entry) => sum + (entry.confidence || 0), 0) /
            completedRevisions.length) *
            10,
        ) / 10
      : 0

    return {
      totalProblems,
      dueTodayCount,
      overdueCount,
      revisionCompletionRate,
      currentStreak,
      longestStreak,
      activeDaysCount,
      daysSinceStart,
      consistencyPercent,
      difficultyCounts,
      topicCounts,
      topicsCovered,
      checkpointStats,
      recentRevisions,
      averageConfidence,
    }
  }, [problems])

  useEffect(() => {
    setAnimationProgress(0)
    const durationMs = 800
    const intervalMs = 30
    const totalSteps = Math.ceil(durationMs / intervalMs)
    let step = 0

    const intervalId = setInterval(() => {
      step += 1
      setAnimationProgress(Math.min(step / totalSteps, 1))
      if (step >= totalSteps) {
        clearInterval(intervalId)
      }
    }, intervalMs)

    return () => clearInterval(intervalId)
  }, [stats])

  const animateValue = (value, decimals = 0) => {
    const safeValue = Number.isFinite(value) ? value : 0
    const scaled = safeValue * animationProgress

    if (decimals === 0) {
      return Math.round(scaled)
    }

    const factor = 10 ** decimals
    return Math.round(scaled * factor) / factor
  }

  const banner = useMemo(() => {
    if (stats.totalProblems === 0) {
      return {
        title: 'Nothing tracked yet.',
        text:
          'Your stats are empty because your tracker is empty. Add your first problem and come back here.',
        bg: 'linear-gradient(180deg, rgba(17,24,39,0.9) 0%, rgba(12,16,23,0.9) 100%)',
        border: SEMANTIC_COLORS.info,
        icon: Rocket,
        iconColor: SEMANTIC_COLORS.info,
      }
    }

    if (stats.overdueCount > 5) {
      return {
        title: "You're falling behind.",
        text: `You have ${stats.overdueCount} overdue revisions. Every day you skip, the pattern fades. Fix this today — not tomorrow.`,
        bg: 'linear-gradient(180deg, rgba(60,24,24,0.8) 0%, rgba(20,12,12,0.9) 100%)',
        border: SEMANTIC_COLORS.danger,
        icon: AlertTriangle,
        iconColor: SEMANTIC_COLORS.danger,
      }
    }

    if (stats.overdueCount > 0) {
      return {
        title: 'Almost on track.',
        text: `${stats.overdueCount} revisions slipping. You're close to your rhythm — don't break it now.`,
        bg: 'linear-gradient(180deg, rgba(61,46,18,0.75) 0%, rgba(20,16,12,0.9) 100%)',
        border: SEMANTIC_COLORS.warn,
        icon: Clock,
        iconColor: SEMANTIC_COLORS.warn,
      }
    }

    if (stats.currentStreak > 0) {
      return {
        title: "You're locked in. 🔥",
        text: `${stats.currentStreak} day streak. Zero overdue. This is exactly how MAANG is cracked. Keep going.`,
        bg: 'linear-gradient(180deg, rgba(20,43,30,0.75) 0%, rgba(12,18,14,0.9) 100%)',
        border: SEMANTIC_COLORS.success,
        icon: TrendingUp,
        iconColor: SEMANTIC_COLORS.success,
      }
    }

    return {
      title: 'Almost on track.',
      text: `${stats.overdueCount} revisions slipping. You're close to your rhythm — don't break it now.`,
      bg: 'linear-gradient(180deg, rgba(61,46,18,0.75) 0%, rgba(20,16,12,0.9) 100%)',
      border: SEMANTIC_COLORS.warn,
      icon: Clock,
      iconColor: SEMANTIC_COLORS.warn,
    }
  }, [stats.currentStreak, stats.overdueCount, stats.totalProblems])

  const difficultyVerdict = useMemo(() => {
    if (stats.difficultyCounts.Hard === 0 && stats.difficultyCounts.Medium === 0) {
      return 'Only Easy problems. Time to level up.'
    }
    if (stats.difficultyCounts.Hard === 0 && stats.difficultyCounts.Medium > 0) {
      return "No Hard problems yet. That's okay for now."
    }
    return 'Tackling Hard problems. Respect. 💪'
  }, [stats.difficultyCounts])

  const topicVerdict = useMemo(() => {
    if (stats.topicsCovered < 4) {
      return 'Explore more topics to build well-rounded skills.'
    }
    if (stats.topicsCovered < 10) {
      return 'Good spread. Keep diversifying.'
    }
    return 'Impressive topic coverage. 🎯'
  }, [stats.topicsCovered])

  const revisionSummaryTone = useMemo(() => {
    if (stats.revisionCompletionRate < 50) {
      return {
        color: SEMANTIC_COLORS.danger,
        verdict:
          'You are solving but not retaining. Revisions matter more than new problems right now.',
      }
    }
    if (stats.revisionCompletionRate < 80) {
      return {
        color: SEMANTIC_COLORS.warn,
        verdict: 'Decent but not enough for MAANG. Aim for 80%+ revision consistency.',
      }
    }
    return {
      color: SEMANTIC_COLORS.success,
      verdict: 'Elite revision discipline. This is exactly how patterns stick long term.',
    }
  }, [stats.revisionCompletionRate])

  const confidenceVerdict = useMemo(() => {
    if (stats.averageConfidence === 0) {
      return null
    }
    if (stats.averageConfidence < 2.5) {
      return 'Low confidence. You might be moving too fast. Slow down and master each pattern.'
    }
    if (stats.averageConfidence <= 3.5) {
      return "Average. You understand but don't own it yet."
    }
    return 'Strong confidence. The patterns are sticking.'
  }, [stats.averageConfidence])

  const reportRows = useMemo(() => {
    const rows = [
      {
        label: 'Problems Solved',
        value: stats.totalProblems,
        targetLabel: '150-200',
        target: 150,
      },
      {
        label: 'Revision Rate',
        value: `${stats.revisionCompletionRate}%`,
        numericValue: stats.revisionCompletionRate,
        targetLabel: '80%+',
        target: 80,
      },
      {
        label: 'Topics Covered',
        value: `${stats.topicsCovered}/13`,
        numericValue: stats.topicsCovered,
        targetLabel: '10+',
        target: 10,
      },
      {
        label: 'Current Streak',
        value: `${stats.currentStreak} days`,
        numericValue: stats.currentStreak,
        targetLabel: '30+ days',
        target: 30,
      },
      {
        label: 'Avg Confidence',
        value: `${stats.averageConfidence.toFixed(1)}/5`,
        numericValue: stats.averageConfidence,
        targetLabel: '4+/5',
        target: 4,
      },
    ]

    return rows.map((row) => {
      const numeric = row.numericValue ?? Number(row.value)
      return { ...row, tone: getPerformanceTone(numeric, row.target) }
    })
  }, [stats.averageConfidence, stats.currentStreak, stats.revisionCompletionRate, stats.totalProblems, stats.topicsCovered])

  const reportTone = useMemo(() => {
    const toneCounts = reportRows.reduce(
      (acc, row) => {
        acc[row.tone] += 1
        return acc
      },
      { green: 0, amber: 0, red: 0 },
    )

    if (toneCounts.red >= 3) {
      return 'You have a lot of ground to cover. Start today. The clock is ticking.'
    }
    if (toneCounts.green >= 3) {
      return "You're ahead of the curve. Don't slow down now."
    }
    return "You're building momentum. Stay consistent and the numbers will follow."
  }, [reportRows])

  const topicRows = useMemo(() => {
    return TOPICS.filter((topic) => stats.topicCounts[topic] > 0).map((topic) => {
      const count = stats.topicCounts[topic]
      const percent = stats.totalProblems
        ? Math.round((count / stats.totalProblems) * 100)
        : 0
      return { topic, count, percent, color: TOPIC_COLORS[topic] || '#30363d' }
    })
  }, [stats.topicCounts, stats.totalProblems])

  const difficultyRows = useMemo(() => {
    return ['Easy', 'Medium', 'Hard'].map((level) => {
      const count = stats.difficultyCounts[level]
      const percent = stats.totalProblems
        ? Math.round((count / stats.totalProblems) * 100)
        : 0
      return { level, count, percent, color: DIFFICULTY_COLORS[level] }
    })
  }, [stats.difficultyCounts, stats.totalProblems])

  const BannerIcon = banner.icon
  const animatedAverage = animateValue(stats.averageConfidence, 1)
  const confidenceTone = useMemo(() => {
    if (stats.averageConfidence < 2.5) {
      return { color: SEMANTIC_COLORS.danger }
    }
    if (stats.averageConfidence <= 3.5) {
      return { color: SEMANTIC_COLORS.warn }
    }
    return { color: SEMANTIC_COLORS.success }
  }, [stats.averageConfidence])
  const reportToneColor = reportRows.reduce(
    (acc, row) => {
      acc[row.tone] += 1
      return acc
    },
    { green: 0, amber: 0, red: 0 },
  )
  const reportVerdictMeta =
    reportToneColor.red >= 3
      ? {
          icon: AlertTriangle,
          color: SEMANTIC_COLORS.danger,
          bg: 'rgba(241,107,107,0.08)',
          border: 'rgba(241,107,107,0.3)',
        }
      : reportToneColor.green >= 3
        ? {
            icon: Trophy,
            color: SEMANTIC_COLORS.success,
            bg: 'rgba(63,185,80,0.08)',
            border: 'rgba(63,185,80,0.3)',
          }
        : {
            icon: TrendingUp,
            color: SEMANTIC_COLORS.warn,
            bg: 'rgba(210,153,34,0.08)',
            border: 'rgba(210,153,34,0.3)',
          }
  const ReportVerdictIcon = reportVerdictMeta.icon

  return (
    <section
      className="stats-surface relative mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8"
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-[300px]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(88,166,255,0.08) 0%, transparent 70%)',
        }}
      />
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BarChart2 size={22} color={SEMANTIC_COLORS.info} className="section-icon" />
            <h1 className="page-title">Your Stats</h1>
          </div>
          <p className="mt-2 max-w-2xl text-[12px] text-[var(--text-secondary)]">
            Raw numbers. No sugarcoating. This is where you really stand.
          </p>
        </div>
        <div className="stats-card stats-card-fade px-3 py-2 text-right text-[11px] font-mono text-[var(--text-muted)]">
          <p className="uppercase tracking-[0.18em]">Last updated</p>
          <p className="mt-1 text-[12px] text-[var(--text-primary)]">
            {format(lastUpdated, 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </header>

      <section
        className="stats-card stats-card-fade border-l-[3px] px-4 py-3"
        style={{ background: banner.bg }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <BannerIcon size={18} color={banner.iconColor} className="section-icon" />
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{banner.title}</h2>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{banner.text}</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-stretch">
            <div className="banner-stat-card" style={{ background: banner.bg, borderColor: banner.border }}>
              <p className="metric-sm text-[var(--text-primary)]">
                {animateValue(stats.dueTodayCount)}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Due today</p>
            </div>
            <div className="banner-stat-card" style={{ background: banner.bg, borderColor: banner.border }}>
              <p className="metric-sm text-[var(--text-primary)]">
                {animateValue(stats.overdueCount)}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Overdue</p>
            </div>
            <div className="banner-stat-card" style={{ background: banner.bg, borderColor: banner.border }}>
              <p className="metric-sm text-[var(--text-primary)]">
                {animateValue(stats.revisionCompletionRate)}%
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Due completion</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          className={`${cardClassName} ${
            stats.currentStreak > 7
              ? 'border-orange-400/40'
              : ''
          }`}
          style={{ '--delay': '100ms' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="section-title">Current Streak</h3>
            <Flame size={16} color={stats.currentStreak > 0 ? '#f59e0b' : '#6b7280'} />
          </div>
          <p className="metric mt-4 text-[var(--text-primary)]">
            {animateValue(stats.currentStreak)}
          </p>
          <p className="text-[12px] text-[var(--text-muted)]">day streak</p>
          {stats.currentStreak === 0 ? (
            <p className="mt-2 text-[12px] text-[var(--danger-text)]">Start today.</p>
          ) : null}
          <div
            className="mt-4 h-[2px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #f59e0b 0%, transparent 70%)' }}
          />
        </div>

        <div className={cardClassName} style={{ '--delay': '200ms' }}>
          <div className="flex items-center justify-between">
            <h3 className="section-title">Longest Streak</h3>
            <Trophy size={16} color="#e3b341" />
          </div>
          <p className="metric mt-4 text-[var(--text-primary)]">
            {animateValue(stats.longestStreak)}
          </p>
          <p className="text-[12px] text-[var(--text-muted)]">best streak</p>
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]">Personal best</p>
          <div
            className="mt-4 h-[2px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #d4af37 0%, transparent 70%)' }}
          />
        </div>

        <div className={cardClassName} style={{ '--delay': '300ms' }}>
          <div className="flex items-center justify-between">
            <h3 className="section-title">Total Active Days</h3>
            <Calendar size={16} color={SEMANTIC_COLORS.info} />
          </div>
          <p className="metric mt-4 text-[var(--text-primary)]">
            {animateValue(stats.activeDaysCount)}
          </p>
          <p className="text-[12px] text-[var(--text-muted)]">active days</p>
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
            {stats.daysSinceStart
              ? `${animateValue(stats.activeDaysCount)} out of ${stats.daysSinceStart} days since you started (${animateValue(stats.consistencyPercent)}%)`
              : 'No data yet.'}
          </p>
          <div
            className="mt-4 h-[2px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #58a6ff 0%, transparent 70%)' }}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={cardClassName} style={{ '--delay': '400ms' }}>
          <div className="flex items-center gap-3">
            <Target size={18} color={SEMANTIC_COLORS.info} className="section-icon" />
            <h3 className="section-heading">Where You Stand</h3>
          </div>
          <div className="section-underline" />

          <div className="mt-4 space-y-3">
            {difficultyRows.map((row) => (
              <div key={row.level} className="difficulty-mini-card">
                <p
                  className="metric-sm leading-none"
                  style={{
                    color: row.color,
                  }}
                >
                  {animateValue(row.count)}
                </p>

                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {row.level} Problems
                  </span>
                  <div className="mt-2 h-[6px] w-full rounded-[3px] bg-[#0d1117]">
                    <div
                      className="h-[6px] rounded-[3px]"
                      style={{
                        width: `${row.percent}%`,
                        backgroundImage: DIFFICULTY_PROGRESS_GRADIENTS[row.level],
                      }}
                    />
                  </div>
                </div>

                <p className="w-[56px] text-right font-mono text-[12px] text-[var(--text-muted)]">
                  {row.percent}%
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-[12px] italic text-[var(--text-secondary)]">{difficultyVerdict}</p>
        </div>

        <div className={cardClassName} style={{ '--delay': '500ms' }}>
          <div className="flex items-center gap-3">
            <BookOpen size={18} color={SEMANTIC_COLORS.info} className="section-icon" />
            <h3 className="section-heading">Topic Coverage</h3>
          </div>
          <div className="section-underline" />

          {topicRows.length === 0 ? (
            <p className="mt-4 text-[12px] text-[var(--text-muted)]">No topics covered yet.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {topicRows.map((row) => (
                <div
                  key={row.topic}
                  className="topic-chip"
                  style={{
                    '--topic-color': row.color,
                    '--topic-bg-default': `${row.color}26`,
                    '--topic-bg-hover': `${row.color}4d`,
                    '--topic-border': `${row.color}80`,
                  }}
                >
                  <span className="text-[12px] font-semibold">{row.topic}</span>
                  <div
                    className="topic-chip-count"
                    style={{ background: row.color }}
                  >
                    {animateValue(row.count)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 text-[12px] text-[var(--text-secondary)]">
            <p>{`${stats.topicsCovered} of 13 topics covered`}</p>
            <div className="mt-2 h-[6px] w-full rounded-[3px] bg-[#0d1117]">
              <div
                className="h-[6px] rounded-[3px]"
                style={{
                  width: `${Math.round((stats.topicsCovered / 13) * 100)}%`,
                  background: 'linear-gradient(90deg, #1f6feb 0%, #58a6ff 100%)',
                }}
              />
            </div>
            <p className="mt-1">{topicVerdict}</p>
          </div>
        </div>
      </section>

      <section className={cardClassName} style={{ '--delay': '600ms' }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <RefreshCw size={18} color={SEMANTIC_COLORS.info} className="section-icon" />
              <h3 className="section-heading">Revision Health</h3>
            </div>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">This is where most people silently fail.</p>
            <div className="section-underline" />
          </div>
          <div className="stats-card px-3 py-2 text-[11px] font-mono text-[var(--text-muted)]">
            Daily target: {settings.dailyRevisionTarget}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {stats.checkpointStats.map((checkpoint) => {
            const tone = getPercentTone(checkpoint.percent)
            const progressColor = checkpoint.total === 0 ? '#30363d' : tone.color
            const verdict = checkpoint.total === 0 ? 'No data yet' : tone.label
            const verdictPillClass =
              checkpoint.total === 0
                ? 'chip-neutral'
                : verdict === 'Solid 💪'
                  ? 'chip-success'
                  : verdict === 'Needs work'
                    ? 'chip-warn'
                    : 'chip-danger'

            return (
              <div
                key={checkpoint.day}
                className="stats-card p-5 text-center"
                style={{ borderTop: `3px solid ${progressColor}` }}
              >
                <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#8b949e]">
                  DAY {checkpoint.day}
                </p>
                <div className="mt-4 flex justify-center">
                  <svg viewBox="0 0 72 72" className="h-[64px] w-[64px]">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                    <circle
                      cx="36"
                      cy="36"
                      r="30"
                      fill="none"
                      stroke={progressColor}
                      strokeWidth="6"
                      strokeDasharray={`${checkpoint.percent * 1.885} 188.5`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                      style={{ filter: `drop-shadow(0 0 4px ${progressColor}55)` }}
                    />
                  </svg>
                </div>

                <p
                  className="mt-4 metric-sm"
                  style={{ color: progressColor }}
                >
                  {checkpoint.total === 0
                    ? '—'
                    : `${animateValue(checkpoint.percent)}%`}
                </p>
                <div
                  className="mx-auto mt-2 h-[2px] w-10 rounded-full"
                  style={{ background: progressColor }}
                />

                <p className="mt-3 text-[12px] text-[var(--text-muted)]">
                  {checkpoint.completed} of {checkpoint.total} completed
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${verdictPillClass}`}
                >
                  {verdict}
                </span>
              </div>
            )
          })}
        </div>

        <div className="revision-summary-card mt-6 rounded-xl border px-5 py-4 text-center">
          <p className="text-[14px] text-[var(--text-primary)]">
            Your overall revision rate is {animateValue(stats.revisionCompletionRate)}%.
          </p>
          <p
            className="mt-1 text-[14px] font-semibold"
            style={{ color: revisionSummaryTone.color }}
          >
            {revisionSummaryTone.verdict}
          </p>
        </div>
      </section>

      <section className={cardClassName} style={{ '--delay': '700ms' }}>
        <div className="flex items-center gap-3">
          <TrendingUp size={18} color={SEMANTIC_COLORS.info} className="section-icon" />
          <h3 className="section-heading">Confidence Over Time</h3>
        </div>
        <div className="section-underline" />

        {stats.recentRevisions.length === 0 ? (
          <p className="mt-4 text-[12px] text-[var(--text-muted)]">
            No revisions completed yet. Come back after your first revision session.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="confidence-hero-card flex flex-col gap-4 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-end gap-2">
                  <span
                    className="text-[32px] font-mono font-semibold leading-none"
                    style={{ color: '#f1c40f', textShadow: '0 0 10px rgba(241,196,15,0.25)' }}
                  >
                    {animatedAverage.toFixed(1)}
                  </span>
                  <span className="mb-1 text-[14px] font-mono text-[var(--text-muted)]">/ 5</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const filled = index < Math.round(stats.averageConfidence)
                    return (
                      <Star
                        key={index}
                        size={20}
                        className={filled ? 'text-[#f1c40f] star-glow-strong' : 'text-[#30363d]'}
                        fill={filled ? 'currentColor' : 'transparent'}
                      />
                    )
                  })}
                </div>
                <p className="text-[12px] font-semibold" style={{ color: confidenceTone.color }}>
                  {confidenceVerdict}
                </p>
              </div>
            </div>

            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Recent Revisions</p>

            {stats.recentRevisions.map((revision) => (
              <div
                key={`${revision.problemId}-${revision.completedDateObj.toISOString()}`}
                className="timeline-item flex flex-col gap-2 rounded-xl p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="max-w-[320px] truncate text-[13px] font-semibold text-[var(--text-primary)]">
                    {revision.title}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {format(revision.completedDateObj, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                    style={{ background: TOPIC_COLORS[revision.topic] || '#30363d' }}
                  >
                    {revision.topic}
                  </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const filled = index < Math.round(revision.confidence || 0)
                      return (
                        <Star
                          key={index}
                          size={14}
                          className={
                            filled ? 'text-amber-400 star-glow' : 'text-[#30363d]'
                          }
                          fill={filled ? 'currentColor' : 'transparent'}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cardClassName} style={{ '--delay': '800ms' }}>
        <div className="flex items-center gap-3">
          <FileText size={18} color={SEMANTIC_COLORS.info} className="section-icon" />
          <h3 className="section-heading">Your DSA Report Card</h3>
        </div>
        <p className="mt-2 text-[12px] italic text-[var(--text-secondary)]">
          Benchmarked against MAANG internship standards
        </p>
        <div className="section-underline" />

        <div className="mt-4 text-[12px]">
          <div className="report-premium-header grid grid-cols-[2fr,1fr,1fr] border-b border-[#30363d] pb-2 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            <span>Metric</span>
            <span>Your Number</span>
            <span>Target for MAANG</span>
          </div>

          <div className="mt-3 space-y-2">
            {reportRows.map((row) => {
              const toneColor =
                row.tone === 'green'
                  ? SEMANTIC_COLORS.success
                  : row.tone === 'amber'
                    ? SEMANTIC_COLORS.warn
                    : SEMANTIC_COLORS.danger
              const toneClass =
                row.tone === 'green'
                  ? 'report-premium-row report-premium-row-green'
                  : row.tone === 'amber'
                    ? 'report-premium-row report-premium-row-amber'
                    : 'report-premium-row report-premium-row-red'
              const progressPillLabel =
                row.tone === 'green' ? 'Great' : row.tone === 'amber' ? 'On Track' : 'Behind'
              const MetricIcon = REPORT_ROW_ICONS[row.label] || FileText

              const animatedReportValue =
                row.label === 'Problems Solved'
                  ? animateValue(stats.totalProblems)
                  : row.label === 'Revision Rate'
                    ? `${animateValue(stats.revisionCompletionRate)}%`
                    : row.label === 'Topics Covered'
                      ? `${animateValue(stats.topicsCovered)}/13`
                      : row.label === 'Current Streak'
                        ? `${animateValue(stats.currentStreak)} days`
                        : row.label === 'Avg Confidence'
                          ? `${animatedAverage.toFixed(1)}/5`
                          : row.value

              return (
                <div
                  key={row.label}
                  className={`grid grid-cols-[2fr,1fr,1fr] items-center rounded-xl border px-4 py-3 ${toneClass}`}
                  style={{ borderLeftColor: toneColor }}
                >
                  <div className="flex items-center gap-3">
                    <MetricIcon size={16} color={SEMANTIC_COLORS.info} className="section-icon" />
                    <span className="font-semibold text-[var(--text-primary)]">{row.label}</span>
                  </div>

                  <span className="text-[20px] font-mono font-semibold tabular-nums" style={{ color: toneColor }}>
                    {animatedReportValue}
                  </span>

                  <div className="flex flex-col items-start gap-2">
                    <span className="text-[12px] text-[var(--text-muted)]">{row.targetLabel}</span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        row.tone === 'green'
                          ? 'chip-success'
                          : row.tone === 'amber'
                            ? 'chip-warn'
                            : 'chip-danger'
                      }`}
                    >
                      {progressPillLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className="report-verdict-card mt-5 flex items-center justify-center gap-3 rounded-xl border px-5 py-4 text-center"
          style={{
            color: reportVerdictMeta.color,
            background: reportVerdictMeta.bg,
            borderColor: reportVerdictMeta.border,
          }}
        >
          <ReportVerdictIcon size={18} color={reportVerdictMeta.color} />
          <p className="text-[14px] italic">{reportTone}</p>
        </div>
      </section>

      <style>{`
        .stats-surface {
          --sp-2: 2px;
          --sp-4: 4px;
          --sp-6: 6px;
          --sp-8: 8px;
          --sp-12: 12px;
          --sp-16: 16px;
          --sp-20: 20px;
          --sp-24: 24px;
          --sp-32: 32px;
          --sp-40: 40px;

          --fs-display: 36px;
          --fs-h1: 24px;
          --fs-h2: 18px;
          --fs-metric: 28px;
          --fs-metric-sm: 20px;
          --fs-body: 14px;
          --fs-body-sm: 12px;
          --fs-micro: 11px;

          --lh-tight: 1.1;
          --lh-snug: 1.2;
          --lh-base: 1.5;

          --r-sm: 10px;
          --r-md: 14px;
          --r-lg: 18px;

          --bg-page: #0b0f14;
          --bg-card: #121821;
          --bg-card-2: #0f141b;

          --border-soft: rgba(255, 255, 255, 0.06);
          --border-strong: rgba(255, 255, 255, 0.1);

          --shadow-1: 0 1px 0 rgba(255, 255, 255, 0.03), 0 8px 20px rgba(0, 0, 0, 0.35);
          --shadow-2: 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 28px rgba(0, 0, 0, 0.45);

          --info: #5ba4ff;
          --info-bg: rgba(91, 164, 255, 0.12);
          --info-text: #8bbcff;

          --success: #3fb950;
          --success-bg: rgba(63, 185, 80, 0.12);
          --success-text: #8fe0a2;

          --warn: #d29922;
          --warn-bg: rgba(210, 153, 34, 0.12);
          --warn-text: #f0c36c;

          --danger: #f16b6b;
          --danger-bg: rgba(241, 107, 107, 0.12);
          --danger-text: #f6a1a1;

          --text-primary: #e6edf3;
          --text-secondary: #9aa6b2;
          --text-muted: #6f7b88;

          color: var(--text-primary);
          background-color: var(--bg-page);
          font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif;
        }

        .page-title {
          font-size: var(--fs-h1);
          line-height: var(--lh-snug);
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--text-primary);
        }

        .section-heading {
          font-size: var(--fs-h2);
          line-height: var(--lh-snug);
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--text-primary);
        }

        .section-title {
          font-size: var(--fs-body-sm);
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.02em;
        }

        .metric {
          font-size: var(--fs-metric);
          line-height: var(--lh-tight);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--text-primary);
        }

        .metric-sm {
          font-size: var(--fs-metric-sm);
          line-height: var(--lh-snug);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--text-primary);
        }

        .stats-card {
          background: var(--bg-card);
          border: 1px solid var(--border-soft);
          border-radius: var(--r-md);
          box-shadow: var(--shadow-1);
          transition: all 200ms ease;
        }

        .stats-card:hover {
          border-color: var(--border-strong);
          box-shadow: var(--shadow-2);
          transform: translateY(-1px);
        }

        .stats-card-fade {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 400ms ease-out forwards;
          animation-delay: var(--delay, 0ms);
        }

        .banner-stat-card {
          min-width: 96px;
          border-radius: var(--r-sm);
          border: 1px solid var(--border-soft);
          background: var(--bg-card-2);
          padding: 8px 10px;
          text-align: center;
        }

        .section-icon {
          opacity: 0.9;
        }

        .section-underline {
          height: 1px;
          margin-top: 8px;
          margin-bottom: 14px;
          background: linear-gradient(90deg, rgba(91, 164, 255, 0.35) 0%, transparent 70%);
        }

        .difficulty-mini-card {
          display: flex;
          align-items: center;
          gap: 16px;
          border-radius: var(--r-sm);
          border: 1px solid var(--border-soft);
          background: var(--bg-card-2);
          padding: 12px 14px;
        }

        .topic-chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          border: 1px solid var(--topic-border);
          background: var(--topic-bg-default);
          color: var(--topic-color);
          padding: 6px 12px;
          transition: all 200ms ease;
        }

        .topic-chip:hover {
          background: var(--topic-bg-hover);
          box-shadow: 0 0 0 1px var(--topic-border), 0 0 14px var(--topic-bg-hover);
        }

        .topic-chip-count {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 16px;
          height: 16px;
          padding: 0 3px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(13, 17, 23, 0.7);
          color: #ffffff;
          font-size: 9px;
          font-weight: 700;
          line-height: 1;
        }

        .timeline-item {
          border: 1px solid var(--border-soft);
          border-left: 3px solid rgba(91, 164, 255, 0.25);
          background: var(--bg-card-2);
          transition: all 200ms ease;
        }

        .timeline-item:hover {
          border-left-color: var(--info);
          background: rgba(91, 164, 255, 0.04);
        }

        .star-glow {
          filter: drop-shadow(0 0 2px rgba(234, 179, 8, 0.35));
        }

        .star-glow-strong {
          filter: drop-shadow(0 0 4px rgba(241, 196, 15, 0.55));
        }

        .revision-summary-card {
          background: rgba(91, 164, 255, 0.06);
          border-color: rgba(91, 164, 255, 0.2);
        }

        .confidence-hero-card {
          background: rgba(241, 196, 15, 0.06);
          border-color: rgba(241, 196, 15, 0.2);
        }

        .chip-neutral {
          border-color: var(--border-soft);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-muted);
        }

        .chip-success {
          border-color: rgba(63, 185, 80, 0.4);
          background: var(--success-bg);
          color: var(--success-text);
        }

        .chip-warn {
          border-color: rgba(210, 153, 34, 0.4);
          background: var(--warn-bg);
          color: var(--warn-text);
        }

        .chip-danger {
          border-color: rgba(241, 107, 107, 0.4);
          background: var(--danger-bg);
          color: var(--danger-text);
        }

        .report-premium-row {
          background: var(--bg-card-2);
          border: 1px solid var(--border-soft);
          border-left-width: 3px;
          transition: background 200ms ease;
        }

        .report-premium-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .report-premium-row-green {
          border-left-color: var(--success);
        }

        .report-premium-row-amber {
          border-left-color: var(--warn);
        }

        .report-premium-row-red {
          border-left-color: var(--danger);
        }

        @keyframes fadeUp {
          0% {
            opacity: 0;
            transform: translateY(16px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.7;
          }
        }
      `}</style>
    </section>
  )
}

export default Stats
