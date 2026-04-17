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

const DIFFICULTY_COLORS = {
  Easy: '#3fb950',
  Medium: '#d29922',
  Hard: '#f85149',
}

const DIFFICULTY_PROGRESS_GRADIENTS = {
  Easy: 'linear-gradient(90deg, #0e4429 0%, #3fb950 100%)',
  Medium: 'linear-gradient(90deg, #2d1f00 0%, #d29922 100%)',
  Hard: 'linear-gradient(90deg, #2d0f0f 0%, #f85149 100%)',
}

const REPORT_ROW_ICONS = {
  'Problems Solved': Target,
  'Revision Rate': RefreshCw,
  'Topics Covered': BookOpen,
  'Current Streak': Flame,
  'Avg Confidence': Star,
}

const cardClassName = 'stats-card stats-card-fade p-5'

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
    return { label: 'Solid 💪', color: '#3fb950' }
  }
  if (percent >= 50) {
    return { label: 'Needs work', color: '#d29922' }
  }
  return { label: 'Danger zone ⚠️', color: '#f85149' }
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
        bg: '#0d1f3c',
        border: '#58a6ff',
        icon: Rocket,
        iconColor: '#58a6ff',
      }
    }

    if (stats.overdueCount > 5) {
      return {
        title: "You're falling behind.",
        text: `You have ${stats.overdueCount} overdue revisions. Every day you skip, the pattern fades. Fix this today — not tomorrow.`,
        bg: 'linear-gradient(135deg, #2d0f0f 0%, #1a0808 100%)',
        border: '#f85149',
        icon: AlertTriangle,
        iconColor: '#f85149',
      }
    }

    if (stats.overdueCount > 0) {
      return {
        title: 'Almost on track.',
        text: `${stats.overdueCount} revisions slipping. You're close to your rhythm — don't break it now.`,
        bg: '#2d1f00',
        border: '#d29922',
        icon: Clock,
        iconColor: '#d29922',
      }
    }

    if (stats.currentStreak > 0) {
      return {
        title: "You're locked in. 🔥",
        text: `${stats.currentStreak} day streak. Zero overdue. This is exactly how MAANG is cracked. Keep going.`,
        bg: '#0d2b1a',
        border: '#3fb950',
        icon: TrendingUp,
        iconColor: '#3fb950',
      }
    }

    return {
      title: 'Almost on track.',
      text: `${stats.overdueCount} revisions slipping. You're close to your rhythm — don't break it now.`,
      bg: '#2d1f00',
      border: '#d29922',
      icon: Clock,
      iconColor: '#d29922',
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
        color: '#f85149',
        verdict:
          'You are solving but not retaining. Revisions matter more than new problems right now.',
      }
    }
    if (stats.revisionCompletionRate < 80) {
      return {
        color: '#d29922',
        verdict: 'Decent but not enough for MAANG. Aim for 80%+ revision consistency.',
      }
    }
    return {
      color: '#3fb950',
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
      return { color: '#f85149' }
    }
    if (stats.averageConfidence <= 3.5) {
      return { color: '#d29922' }
    }
    return { color: '#3fb950' }
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
          color: '#f85149',
          bg: 'rgba(248,81,73,0.05)',
          border: 'rgba(248,81,73,0.3)',
        }
      : reportToneColor.green >= 3
        ? {
            icon: Trophy,
            color: '#3fb950',
            bg: 'rgba(63,185,80,0.05)',
            border: 'rgba(63,185,80,0.3)',
          }
        : {
            icon: TrendingUp,
            color: '#d29922',
            bg: 'rgba(210,153,34,0.05)',
            border: 'rgba(210,153,34,0.3)',
          }
  const ReportVerdictIcon = reportVerdictMeta.icon

  return (
    <section
      className="stats-surface relative mx-auto w-full max-w-6xl space-y-8 px-4 py-6 md:px-8"
      style={{
        backgroundImage: 'radial-gradient(#21262d 1px, transparent 1px)',
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
            <BarChart2 size={28} color="#58a6ff" className="section-icon" />
            <h1 className="text-3xl font-bold text-white tracking-[0.02em]">Your Stats</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[#8b949e]">
            Raw numbers. No sugarcoating. This is where you really stand.
          </p>
        </div>
        <div className="stats-card stats-card-fade px-4 py-3 text-right text-xs font-mono text-[#8b949e]">
          <p>Last updated</p>
          <p className="mt-1 text-sm text-[#c9d1d9]">
            {format(lastUpdated, 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </header>

      <section
        className="stats-card stats-card-fade border-l-[4px] px-5 py-4"
        style={{ background: banner.bg, borderColor: banner.border }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <BannerIcon size={26} color={banner.iconColor} className="pulse-icon" />
            <div>
              <h2 className="text-lg font-semibold text-white">{banner.title}</h2>
              <p className="mt-1 text-sm text-[#c9d1d9]">{banner.text}</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-stretch">
            <div className="banner-stat-card">
              <p className="text-xl font-mono font-semibold text-white">
                {animateValue(stats.dueTodayCount)}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e]">Due today</p>
            </div>
            <span className="hidden h-10 w-px bg-white/10 md:block" />
            <div className="banner-stat-card">
              <p className="text-xl font-mono font-semibold text-white">
                {animateValue(stats.overdueCount)}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e]">Overdue</p>
            </div>
            <span className="hidden h-10 w-px bg-white/10 md:block" />
            <div className="banner-stat-card">
              <p className="text-xl font-mono font-semibold text-white">
                {animateValue(stats.revisionCompletionRate)}%
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e]">Due completion</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className={`${cardClassName} ${
            stats.currentStreak > 7
              ? 'border-orange-400/40'
              : ''
          }`}
          style={{ '--delay': '100ms' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white tracking-[0.02em]">Current Streak</h3>
            <Flame size={18} color={stats.currentStreak > 0 ? '#f97316' : '#6b7280'} />
          </div>
          <p
            className="mt-6 text-[48px] font-mono font-bold"
            style={{
              color: stats.currentStreak > 0 ? '#ffffff' : '#9ca3af',
              textShadow:
                stats.currentStreak > 0 ? '0 0 20px rgba(249,115,22,0.5)' : 'none',
            }}
          >
            {animateValue(stats.currentStreak)}
          </p>
          <p className="text-sm text-[#8b949e]">day streak</p>
          {stats.currentStreak === 0 ? (
            <p className="mt-2 text-sm text-rose-300">Start today.</p>
          ) : null}
          <div
            className="mt-5 h-[2px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #f97316 0%, transparent 70%)' }}
          />
        </div>

        <div className={cardClassName} style={{ '--delay': '200ms' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white tracking-[0.02em]">Longest Streak</h3>
            <Trophy size={18} color="#e3b341" />
          </div>
          <p
            className="mt-6 text-[48px] font-mono font-bold text-white"
            style={{ textShadow: '0 0 20px rgba(212,175,55,0.4)' }}
          >
            {animateValue(stats.longestStreak)}
          </p>
          <p className="text-sm text-[#8b949e]">best streak</p>
          <p className="mt-2 text-sm text-[#8b949e]">Personal best</p>
          <div
            className="mt-5 h-[2px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #d4af37 0%, transparent 70%)' }}
          />
        </div>

        <div className={cardClassName} style={{ '--delay': '300ms' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white tracking-[0.02em]">Total Active Days</h3>
            <Calendar size={18} color="#58a6ff" />
          </div>
          <p
            className="mt-6 text-[48px] font-mono font-bold text-white"
            style={{ textShadow: '0 0 20px rgba(88,166,255,0.4)' }}
          >
            {animateValue(stats.activeDaysCount)}
          </p>
          <p className="text-sm text-[#8b949e]">active days</p>
          <p className="mt-2 text-sm text-[#8b949e]">
            {stats.daysSinceStart
              ? `${animateValue(stats.activeDaysCount)} out of ${stats.daysSinceStart} days since you started (${animateValue(stats.consistencyPercent)}%)`
              : 'No data yet.'}
          </p>
          <div
            className="mt-5 h-[2px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #58a6ff 0%, transparent 70%)' }}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={cardClassName} style={{ '--delay': '400ms' }}>
          <div className="flex items-center gap-3">
            <Target size={20} color="#58a6ff" className="section-icon" />
            <h3 className="text-lg font-semibold text-white tracking-[0.02em]">Where You Stand</h3>
          </div>
          <div className="section-underline" />

          <div className="mt-4 space-y-3">
            {difficultyRows.map((row) => (
              <div key={row.level} className="difficulty-mini-card">
                <p
                  className="text-[48px] font-mono font-bold leading-none"
                  style={{
                    color: row.color,
                    textShadow:
                      row.level === 'Easy'
                        ? '0 0 16px rgba(63,185,80,0.4)'
                        : row.level === 'Medium'
                          ? '0 0 16px rgba(210,153,34,0.4)'
                          : '0 0 16px rgba(248,81,73,0.4)',
                  }}
                >
                  {animateValue(row.count)}
                </p>

                <div className="min-w-0 flex-1">
                  <span
                    className="text-[14px] font-bold text-white"
                  >
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

                <p className="w-[56px] text-right font-mono text-sm text-[#8b949e]">
                  {row.percent}%
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-[13px] italic text-[#8b949e]">{difficultyVerdict}</p>
        </div>

        <div className={cardClassName} style={{ '--delay': '500ms' }}>
          <div className="flex items-center gap-3">
            <BookOpen size={20} color="#58a6ff" className="section-icon" />
            <h3 className="text-lg font-semibold text-white tracking-[0.02em]">Topic Coverage</h3>
          </div>
          <div className="section-underline" />

          {topicRows.length === 0 ? (
            <p className="mt-4 text-sm text-[#8b949e]">No topics covered yet.</p>
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
                  <span className="text-xs font-semibold">{row.topic}</span>
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

          <div className="mt-5 text-sm text-[#8b949e]">
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
              <RefreshCw size={20} color="#58a6ff" className="section-icon" />
              <h3 className="text-lg font-semibold text-white tracking-[0.02em]">Revision Health</h3>
            </div>
            <p className="mt-1 text-sm text-[#8b949e]">This is where most people silently fail.</p>
            <div className="section-underline" />
          </div>
          <div className="stats-card px-3 py-2 text-xs font-mono text-[#8b949e]">
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
                ? 'border-[#30363d] bg-[#21262d] text-[#8b949e]'
                : verdict === 'Solid 💪'
                  ? 'border-[#3fb95066] bg-[#3fb9501a] text-[#3fb950]'
                  : verdict === 'Needs work'
                    ? 'border-[#d2992266] bg-[#d299221a] text-[#d29922]'
                    : 'border-[#f8514966] bg-[#f851491a] text-[#f85149]'

            return (
              <div
                key={checkpoint.day}
                className="stats-card p-6 text-center"
                style={{ borderTop: `3px solid ${progressColor}` }}
              >
                <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#8b949e]">
                  DAY {checkpoint.day}
                </p>
                <p
                  className="mt-4 text-[52px] font-mono font-bold leading-none"
                  style={{
                    color: progressColor,
                    textShadow: `0 0 18px ${progressColor}88`,
                  }}
                >
                  {checkpoint.total === 0
                    ? '—'
                    : `${animateValue(checkpoint.percent)}%`}
                </p>
                <div
                  className="mx-auto mt-2 h-[2px] w-10 rounded-full"
                  style={{ background: progressColor }}
                />

                <div className="mt-5 flex justify-center">
                  <svg viewBox="0 0 72 72" className="h-[72px] w-[72px]">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#21262d" strokeWidth="6" />
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
                      style={{ filter: `drop-shadow(0 0 6px ${progressColor})` }}
                    />
                  </svg>
                </div>

                <p className="mt-4 text-xs text-[#8b949e]">
                  {checkpoint.completed} of {checkpoint.total} completed
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${verdictPillClass}`}
                >
                  {verdict}
                </span>
              </div>
            )
          })}
        </div>

        <div className="revision-summary-card mt-6 rounded-xl border px-5 py-4 text-center">
          <p className="text-[15px] text-white">
            Your overall revision rate is {animateValue(stats.revisionCompletionRate)}%.
          </p>
          <p
            className="mt-1 text-[15px] font-bold"
            style={{ color: revisionSummaryTone.color }}
          >
            {revisionSummaryTone.verdict}
          </p>
        </div>
      </section>

      <section className={cardClassName} style={{ '--delay': '700ms' }}>
        <div className="flex items-center gap-3">
          <TrendingUp size={20} color="#58a6ff" className="section-icon" />
          <h3 className="text-lg font-semibold text-white tracking-[0.02em]">Confidence Over Time</h3>
        </div>
        <div className="section-underline" />

        {stats.recentRevisions.length === 0 ? (
          <p className="mt-4 text-sm text-[#8b949e]">
            No revisions completed yet. Come back after your first revision session.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="confidence-hero-card flex flex-col gap-6 rounded-2xl border p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-end gap-2">
                  <span
                    className="text-[64px] font-mono font-bold leading-none"
                    style={{ color: '#f1c40f', textShadow: '0 0 22px rgba(241,196,15,0.45)' }}
                  >
                    {animatedAverage.toFixed(1)}
                  </span>
                  <span className="mb-2 text-2xl font-mono text-[#8b949e]">/ 5</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const filled = index < Math.round(stats.averageConfidence)
                    return (
                      <Star
                        key={index}
                        size={26}
                        className={filled ? 'text-[#f1c40f] star-glow-strong' : 'text-[#30363d]'}
                        fill={filled ? 'currentColor' : 'transparent'}
                      />
                    )
                  })}
                </div>
                <p className="text-sm font-semibold" style={{ color: confidenceTone.color }}>
                  {confidenceVerdict}
                </p>
              </div>
            </div>

            <p className="text-xs uppercase tracking-[0.16em] text-[#8b949e]">Recent Revisions</p>

            {stats.recentRevisions.map((revision) => (
              <div
                key={`${revision.problemId}-${revision.completedDateObj.toISOString()}`}
                className="timeline-item flex flex-col gap-2 rounded-xl p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="max-w-[320px] truncate text-sm font-semibold text-white">
                    {revision.title}
                  </p>
                  <p className="mt-1 text-xs text-[#8b949e]">
                    {format(revision.completedDateObj, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
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
          <FileText size={20} color="#58a6ff" className="section-icon" />
          <h3 className="text-lg font-semibold text-white tracking-[0.02em]">Your DSA Report Card</h3>
        </div>
        <p className="mt-2 text-sm italic text-[#8b949e]">
          Benchmarked against MAANG internship standards
        </p>
        <div className="section-underline" />

        <div className="mt-5 text-sm">
          <div className="report-premium-header grid grid-cols-[2fr,1fr,1fr] border-b border-[#30363d] pb-2 text-[11px] uppercase tracking-[0.1em] text-[#8b949e]">
            <span>Metric</span>
            <span>Your Number</span>
            <span>Target for MAANG</span>
          </div>

          <div className="mt-3 space-y-2">
            {reportRows.map((row) => {
              const toneColor =
                row.tone === 'green' ? '#3fb950' : row.tone === 'amber' ? '#d29922' : '#f85149'
              const toneClass =
                row.tone === 'green'
                  ? 'report-premium-row report-premium-row-green'
                  : row.tone === 'amber'
                    ? 'report-premium-row report-premium-row-amber'
                    : 'report-premium-row report-premium-row-red'
              const progressPillLabel =
                row.tone === 'green' ? '✓ Met' : row.tone === 'amber' ? 'Close' : 'Gap'
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
                  className={`grid grid-cols-[2fr,1fr,1fr] items-center rounded-xl border px-6 py-4 ${toneClass}`}
                  style={{ borderLeftColor: toneColor }}
                >
                  <div className="flex items-center gap-3">
                    <MetricIcon size={18} color="#58a6ff" className="section-icon" />
                    <span className="font-semibold text-white">{row.label}</span>
                  </div>

                  <span className="text-2xl font-mono font-bold" style={{ color: toneColor }}>
                    {animatedReportValue}
                  </span>

                  <div className="flex flex-col items-start gap-2">
                    <span className="text-sm text-[#8b949e]">{row.targetLabel}</span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        row.tone === 'green'
                          ? 'border-[#3fb95066] bg-[#3fb9501a] text-[#3fb950]'
                          : row.tone === 'amber'
                            ? 'border-[#d2992266] bg-[#d299221a] text-[#d29922]'
                            : 'border-[#f8514966] bg-[#f851491a] text-[#f85149]'
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
          className="report-verdict-card mt-6 flex items-center justify-center gap-3 rounded-xl border px-5 py-5 text-center"
          style={{
            color: reportVerdictMeta.color,
            background: reportVerdictMeta.bg,
            borderColor: reportVerdictMeta.border,
          }}
        >
          <ReportVerdictIcon size={20} color={reportVerdictMeta.color} />
          <p className="text-[16px] italic">{reportTone}</p>
        </div>
      </section>

      <style>{`
        .stats-card {
          background: rgba(22, 27, 34, 0.8);
          border: 1px solid rgba(48, 54, 61, 0.8);
          border-radius: 16px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 8px 32px rgba(0, 0, 0, 0.4);
          transition: all 200ms ease;
        }

        .stats-card:hover {
          border-color: rgba(88, 166, 255, 0.3);
          box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(88, 166, 255, 0.05);
          transform: translateY(-2px);
        }

        .stats-card-fade {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 400ms ease-out forwards;
          animation-delay: var(--delay, 0ms);
        }

        .banner-stat-card {
          min-width: 120px;
          border-radius: 12px;
          border: 1px solid rgba(48, 54, 61, 0.7);
          background: rgba(13, 17, 23, 0.55);
          padding: 10px 14px;
          text-align: center;
        }

        .section-icon {
          filter: drop-shadow(0 0 8px rgba(88, 166, 255, 0.6));
        }

        .section-underline {
          height: 1px;
          margin-top: 10px;
          margin-bottom: 16px;
          background: linear-gradient(90deg, rgba(88, 166, 255, 0.5) 0%, transparent 60%);
        }

        .pulse-icon {
          animation: pulseGlow 2s ease-in-out infinite;
        }

        .difficulty-mini-card {
          display: flex;
          align-items: center;
          gap: 16px;
          border-radius: 12px;
          border: 1px solid rgba(48, 54, 61, 0.8);
          background: rgba(22, 27, 34, 0.9);
          padding: 16px 20px;
        }

        .topic-chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          border-radius: 20px;
          border: 1px solid var(--topic-border);
          background: var(--topic-bg-default);
          color: var(--topic-color);
          padding: 8px 14px;
          transition: all 200ms ease;
        }

        .topic-chip:hover {
          background: var(--topic-bg-hover);
          box-shadow: 0 0 0 1px var(--topic-border), 0 0 14px var(--topic-bg-hover);
        }

        .topic-chip-count {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(13, 17, 23, 0.7);
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
        }

        .timeline-item {
          border: 1px solid rgba(48, 54, 61, 0.8);
          border-left: 3px solid rgba(88, 166, 255, 0.3);
          background: rgba(13, 17, 23, 0.6);
          transition: all 200ms ease;
        }

        .timeline-item:hover {
          border-left-color: #58a6ff;
          background: rgba(88, 166, 255, 0.03);
        }

        .star-glow {
          filter: drop-shadow(0 0 4px rgba(234, 179, 8, 0.6));
        }

        .star-glow-strong {
          filter: drop-shadow(0 0 8px rgba(241, 196, 15, 0.75));
        }

        .revision-summary-card {
          background: rgba(88, 166, 255, 0.05);
          border-color: rgba(88, 166, 255, 0.2);
        }

        .confidence-hero-card {
          background: rgba(241, 196, 15, 0.05);
          border-color: rgba(241, 196, 15, 0.2);
        }

        .report-premium-row {
          background: rgba(22, 27, 34, 0.9);
          border: 1px solid rgba(48, 54, 61, 0.8);
          border-left-width: 3px;
          transition: background 200ms ease;
        }

        .report-premium-row:hover {
          background: rgba(48, 54, 61, 0.55);
        }

        .report-premium-row-green {
          border-left-color: #3fb950;
        }

        .report-premium-row-amber {
          border-left-color: #d29922;
        }

        .report-premium-row-red {
          border-left-color: #f85149;
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
