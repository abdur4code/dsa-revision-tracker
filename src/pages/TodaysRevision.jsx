import { useEffect, useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, isToday, startOfDay } from 'date-fns'
import { Check, ExternalLink, RefreshCcw, Star, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getTodaysDueRevisions, isOverdue } from '../utils/revisionUtils'
import { getProblems, updateProblem } from '../utils/storage'

const toDayKey = (dateValue) => format(startOfDay(new Date(dateValue)), 'yyyy-MM-dd')

const calculateCurrentStreak = (problems) => {
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

  let streak = 0
  let cursor = startOfDay(new Date())

  while (activeDays.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

const getEarliestPendingDueRevision = (problem) => {
  const today = startOfDay(new Date())
  const revisions = Array.isArray(problem?.revisions) ? problem.revisions : []

  return (
    revisions
      .filter((revision) => !revision?.completedDate)
      .map((revision) => ({
        ...revision,
        dueDateObj: startOfDay(new Date(revision.dueDate)),
      }))
      .filter((revision) => revision.dueDateObj <= today)
      .sort((a, b) => a.dueDateObj.getTime() - b.dueDateObj.getTime())[0] ?? null
  )
}

const difficultyClass = (difficulty) => {
  if (difficulty === 'Easy') {
    return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
  }

  if (difficulty === 'Hard') {
    return 'border-rose-400/40 bg-rose-400/10 text-rose-300'
  }

  return 'border-amber-400/40 bg-amber-400/10 text-amber-300'
}

const PLATFORM_BADGES = {
  LeetCode: {
    label: 'LC',
    style: {
      background: '#2d1f00',
      color: '#f97316',
      border: '1px solid #f97316',
      borderRadius: '6px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: '700',
    },
  },
  GeeksForGeeks: {
    label: 'GFG',
    style: {
      background: '#0d2b1a',
      color: '#3fb950',
      border: '1px solid #3fb950',
      borderRadius: '6px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: '700',
    },
  },
  Other: {
    label: 'Other',
    style: {
      background: '#1c2128',
      color: '#8b949e',
      border: '1px solid #30363d',
      borderRadius: '6px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: '700',
    },
  },
}

const getNumberBadge = (problem) => {
  const numberValue = problem?.problemNumber
  if (!numberValue) {
    return null
  }

  const platform = problem?.platform
  const prefix = platform === 'LeetCode' ? 'LC' : platform === 'GeeksForGeeks' ? 'GFG' : '#'
  const label = platform ? `${prefix} ${numberValue}` : `#${numberValue}`
  const style = PLATFORM_BADGES[platform]?.style ?? PLATFORM_BADGES.Other.style

  return { label, style }
}

const buildProblemLink = (problem) => {
  const href = problem?.problemLink
  if (!href) {
    return null
  }

  const platform = problem?.platform
  const label =
    platform === 'LeetCode'
      ? 'Open on LeetCode'
      : platform === 'GeeksForGeeks'
        ? 'Open on GFG'
        : 'Open Problem'

  return { href, label }
}

function TodaysRevision() {
  const [problems, setProblems] = useState([])
  const [selectedConfidence, setSelectedConfidence] = useState({})
  const [sessionRevisedCount, setSessionRevisedCount] = useState(0)

  const notifyTrackerDataUpdated = () => {
    window.dispatchEvent(new CustomEvent('trackerDataUpdated'))
  }

  useEffect(() => {
    setProblems(getProblems())
  }, [])

  const todayLabel = useMemo(() => format(new Date(), 'EEEE, MMMM d, yyyy'), [])

  const dueRevisions = useMemo(() => {
    return getTodaysDueRevisions(problems)
      .map((problem) => {
        const pendingDueRevision = getEarliestPendingDueRevision(problem)
        return {
          ...problem,
          pendingDueRevision,
        }
      })
      .filter((problem) => Boolean(problem.pendingDueRevision))
      .sort(
        (a, b) =>
          new Date(a.pendingDueRevision.dueDate).getTime() -
          new Date(b.pendingDueRevision.dueDate).getTime(),
      )
  }, [problems])

  const dueToday = useMemo(
    () => dueRevisions.filter((problem) => isToday(new Date(problem.pendingDueRevision.dueDate))),
    [dueRevisions],
  )

  const overdue = useMemo(
    () => dueRevisions.filter((problem) => isOverdue(problem.pendingDueRevision.dueDate)),
    [dueRevisions],
  )

  const currentStreak = useMemo(() => calculateCurrentStreak(problems), [problems])
  const totalCount = useMemo(
    () => dueRevisions.length + sessionRevisedCount,
    [dueRevisions.length, sessionRevisedCount],
  )
  const progressPercent = totalCount
    ? Math.min(100, Math.round((sessionRevisedCount / totalCount) * 100))
    : 0

  const allDone = dueToday.length === 0 && overdue.length === 0 && problems.length > 0
  const noProblems = problems.length === 0

  const markRevisionDone = (problemId) => {
    const currentProblem = problems.find((problem) => problem.id === problemId)
    if (!currentProblem) {
      return
    }

    const confidence = Number(selectedConfidence[problemId])
    if (!confidence) {
      return
    }

    const todayIso = new Date().toISOString()
    let marked = false

    const updatedRevisions = (currentProblem.revisions ?? []).map((revision) => {
      if (marked || revision?.completedDate) {
        return revision
      }

      const dueDate = startOfDay(new Date(revision.dueDate))
      if (dueDate <= startOfDay(new Date())) {
        marked = true
        return {
          ...revision,
          completedDate: todayIso,
          confidence,
        }
      }

      return revision
    })

    if (!marked) {
      return
    }

    const nextStatus = updatedRevisions.every((revision) => Boolean(revision.completedDate))
      ? 'Mastered'
      : 'Solved'

    const updatedProblem = updateProblem(problemId, {
      revisions: updatedRevisions,
      confidenceRating: confidence,
      status: nextStatus,
    })

    if (!updatedProblem) {
      return
    }

    setProblems((prev) => prev.map((problem) => (problem.id === problemId ? updatedProblem : problem)))
    setSessionRevisedCount((prev) => prev + 1)
    notifyTrackerDataUpdated()
  }

  const markStruggled = (problemId) => {
    const currentProblem = problems.find((problem) => problem.id === problemId)
    if (!currentProblem) {
      return
    }

    const baseConfidence = Number(selectedConfidence[problemId] ?? currentProblem.confidenceRating ?? 3)
    const confidence = Math.max(1, baseConfidence - 1)
    let rescheduled = false

    const updatedRevisions = (currentProblem.revisions ?? []).map((revision) => {
      if (rescheduled || revision?.completedDate) {
        return revision
      }

      const dueDate = startOfDay(new Date(revision.dueDate))
      if (dueDate <= startOfDay(new Date())) {
        rescheduled = true
        const bumpedDate = startOfDay(addDays(dueDate, 7))
        return {
          ...revision,
          dueDate: bumpedDate.toISOString(),
          confidence,
        }
      }

      return revision
    })

    if (!rescheduled) {
      return
    }

    const updatedProblem = updateProblem(problemId, {
      revisions: updatedRevisions,
      confidenceRating: confidence,
      status: 'Attempted',
    })

    if (!updatedProblem) {
      return
    }

    setSelectedConfidence((prev) => ({
      ...prev,
      [problemId]: confidence,
    }))
    setProblems((prev) => prev.map((problem) => (problem.id === problemId ? updatedProblem : problem)))
    notifyTrackerDataUpdated()
  }

  return (
    <section className="page-content mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8">
      <header className="rounded-3xl border border-slate-700/70 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_55%),rgba(15,23,42,0.88)] px-6 py-5 shadow-[0_0_0_1px_rgba(148,163,184,0.08)] md:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Today&apos;s revision</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100 md:text-4xl">{todayLabel}</h1>
            <p className="mt-2 text-base text-slate-300">
              {dueToday.length} problem{dueToday.length === 1 ? '' : 's'} due today
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Progress</p>
            <p className="mt-2 font-mono text-lg text-slate-100">
              {sessionRevisedCount}/{totalCount}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">Revised {progressPercent}% of today&apos;s queue</p>
        </div>
      </header>

      {noProblems ? (
        <section className="rounded-2xl border border-dashed border-cyan-400/35 bg-cyan-500/5 p-8 text-center">
          <p className="text-lg font-semibold text-cyan-100">No problems tracked yet.</p>
          <p className="mt-2 text-sm text-slate-300">Add your first solved problem to start the daily flow.</p>
          <Link
            to="/problems"
            className="mt-6 inline-flex rounded-xl border border-cyan-300/50 bg-cyan-400/15 px-6 py-3 font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-300/25"
          >
            Add your first problem
          </Link>
        </section>
      ) : allDone ? (
        <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-500/15">
            <Trophy size={26} className="text-emerald-200" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-emerald-100">All revisions cleared.</h2>
          <p className="mt-2 text-sm text-emerald-200/80">Take a breath. You earned the calm.</p>
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-5 py-2">
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Streak updated</span>
            <span className="font-mono text-lg font-semibold text-emerald-100 animate-pulse">
              {currentStreak} days
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce" />
          </div>
        </section>
      ) : null}

      {dueToday.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Focus list</h2>
          {dueToday.map((problem) => {
            const dueDate = new Date(problem.pendingDueRevision.dueDate)
            const overdueCount = isOverdue(problem.pendingDueRevision.dueDate)
              ? differenceInCalendarDays(startOfDay(new Date()), startOfDay(dueDate))
              : 0
            const revisionLabel = `Day ${problem.pendingDueRevision.day}`
            const platformBadge = PLATFORM_BADGES[problem.platform] ?? PLATFORM_BADGES.Other
            const numberBadge = getNumberBadge(problem)
            const problemLink = buildProblemLink(problem)
            const confidenceValue = selectedConfidence[problem.id] ?? 0
            const readyToMark = confidenceValue > 0

            return (
              <article
                key={problem.id}
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/55 p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.7)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span style={platformBadge.style}>{platformBadge.label}</span>
                      <h3 className="text-xl font-semibold text-slate-100">{problem.title}</h3>
                      {numberBadge ? <span style={numberBadge.style}>{numberBadge.label}</span> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1 text-cyan-200">
                        {problem.topic}
                      </span>
                      <span className={`rounded-full border px-3 py-1 ${difficultyClass(problem.difficulty)}`}>
                        {problem.difficulty}
                      </span>
                      <span className="rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1 text-violet-200">
                        {revisionLabel}
                      </span>
                      {overdueCount > 0 ? (
                        <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-rose-300">
                          {overdueCount} day{overdueCount === 1 ? '' : 's'} overdue
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {problemLink ? (
                    <a
                      href={problemLink.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] text-[#58a6ff] transition hover:underline"
                    >
                      <ExternalLink size={14} />
                      {problemLink.label}
                    </a>
                  ) : null}
                </div>

                <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Notes</p>
                  <p className="mt-2 text-sm text-slate-200">
                    {problem.notes ? problem.notes : 'No notes saved yet.'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Confidence</p>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const active = star <= confidenceValue
                        return (
                          <button
                            key={star}
                            type="button"
                            aria-label={`Set confidence ${star}`}
                            onClick={() =>
                              setSelectedConfidence((prev) => ({
                                ...prev,
                                [problem.id]: star,
                              }))
                            }
                            className="transition duration-200"
                          >
                            <Star
                              size={18}
                              className={
                                active
                                  ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]'
                                  : 'text-slate-600 hover:text-amber-200'
                              }
                              fill={active ? 'currentColor' : 'none'}
                            />
                          </button>
                        )
                      })}
                    </div>
                    {!readyToMark ? (
                      <p className="mt-2 text-xs text-amber-200/80">Select a confidence rating to enable.</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300/70 hover:bg-rose-400/20"
                      onClick={() => markStruggled(problem.id)}
                    >
                      <RefreshCcw size={14} />
                      Struggled — Reschedule +7 days
                    </button>

                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        readyToMark
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/70 hover:bg-emerald-400/20'
                          : 'cursor-not-allowed border-slate-700/60 bg-slate-900/40 text-slate-500'
                      }`}
                      onClick={() => markRevisionDone(problem.id)}
                      disabled={!readyToMark}
                    >
                      <Check size={14} />
                      Mark as Revised
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      ) : null}

      {overdue.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Overdue</h2>
            <span className="rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">
              OVERDUE
            </span>
          </div>

          {overdue.map((problem) => {
            const dueDate = new Date(problem.pendingDueRevision.dueDate)
            const overdueCount = differenceInCalendarDays(startOfDay(new Date()), startOfDay(dueDate))
            const revisionLabel = `Day ${problem.pendingDueRevision.day}`
            const platformBadge = PLATFORM_BADGES[problem.platform] ?? PLATFORM_BADGES.Other
            const numberBadge = getNumberBadge(problem)
            const problemLink = buildProblemLink(problem)
            const confidenceValue = selectedConfidence[problem.id] ?? 0
            const readyToMark = confidenceValue > 0

            return (
              <article
                key={problem.id}
                className="w-full rounded-2xl border border-rose-400/30 bg-slate-950/60 p-5 shadow-[0_18px_40px_-30px_rgba(190,18,60,0.4)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span style={platformBadge.style}>{platformBadge.label}</span>
                      <h3 className="text-xl font-semibold text-slate-100">{problem.title}</h3>
                      {numberBadge ? <span style={numberBadge.style}>{numberBadge.label}</span> : null}
                      <span className="rounded-full border border-rose-400/50 bg-rose-500/15 px-2 py-0.5 text-xs text-rose-200">
                        OVERDUE
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1 text-cyan-200">
                        {problem.topic}
                      </span>
                      <span className={`rounded-full border px-3 py-1 ${difficultyClass(problem.difficulty)}`}>
                        {problem.difficulty}
                      </span>
                      <span className="rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1 text-violet-200">
                        {revisionLabel}
                      </span>
                      <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-rose-300">
                        {overdueCount} day{overdueCount === 1 ? '' : 's'} overdue
                      </span>
                    </div>
                  </div>

                  {problemLink ? (
                    <a
                      href={problemLink.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] text-[#58a6ff] transition hover:underline"
                    >
                      <ExternalLink size={14} />
                      {problemLink.label}
                    </a>
                  ) : null}
                </div>

                <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Notes</p>
                  <p className="mt-2 text-sm text-slate-200">
                    {problem.notes ? problem.notes : 'No notes saved yet.'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Confidence</p>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const active = star <= confidenceValue
                        return (
                          <button
                            key={star}
                            type="button"
                            aria-label={`Set confidence ${star}`}
                            onClick={() =>
                              setSelectedConfidence((prev) => ({
                                ...prev,
                                [problem.id]: star,
                              }))
                            }
                            className="transition duration-200"
                          >
                            <Star
                              size={18}
                              className={
                                active
                                  ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]'
                                  : 'text-slate-600 hover:text-amber-200'
                              }
                              fill={active ? 'currentColor' : 'none'}
                            />
                          </button>
                        )
                      })}
                    </div>
                    {!readyToMark ? (
                      <p className="mt-2 text-xs text-amber-200/80">Select a confidence rating to enable.</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300/70 hover:bg-rose-400/20"
                      onClick={() => markStruggled(problem.id)}
                    >
                      <RefreshCcw size={14} />
                      Struggled — Reschedule +7 days
                    </button>

                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        readyToMark
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/70 hover:bg-emerald-400/20'
                          : 'cursor-not-allowed border-slate-700/60 bg-slate-900/40 text-slate-500'
                      }`}
                      onClick={() => markRevisionDone(problem.id)}
                      disabled={!readyToMark}
                    >
                      <Check size={14} />
                      Mark as Revised
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      ) : null}

      <div
        style={{
          textAlign: 'center',
          padding: '24px 16px 8px 16px',
          fontSize: '11px',
          color: '#484f58',
          marginTop: '32px',
        }}
      >
        Built by{' '}
        <a
          href="https://www.linkedin.com/in/abdur4code"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#58a6ff',
            textDecoration: 'none',
            fontWeight: '500',
          }}
          onMouseEnter={(event) => {
            event.target.style.textDecoration = 'underline'
          }}
          onMouseLeave={(event) => {
            event.target.style.textDecoration = 'none'
          }}
        >
          Abdur Rahim
        </a>
      </div>
    </section>
  )
}

export default TodaysRevision
