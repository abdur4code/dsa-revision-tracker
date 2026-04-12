import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isToday, startOfDay } from 'date-fns'
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  LayoutGrid,
  LayoutList,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { calculateRevisionDates, getNextRevisionDate, isOverdue } from '../utils/revisionUtils'
import { deleteProblem, getProblems, saveProblem, updateProblem } from '../utils/storage'

const TOPICS = [
  'Arrays',
  'Strings',
  'Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Recursion',
  'Linked List',
  'Stack',
  'Queue',
  'Trees',
  'Graphs',
  'Dynamic Programming',
]

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
const STATUSES = ['Unsolved', 'Attempted', 'Solved', 'Mastered']
const PLATFORMS = ['LeetCode', 'GeeksForGeeks', 'Other']

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

const DIFFICULTY_STYLES = {
  Easy: 'border-emerald-400/60 text-emerald-200 bg-emerald-500/10',
  Medium: 'border-amber-400/60 text-amber-200 bg-amber-500/10',
  Hard: 'border-rose-400/60 text-rose-200 bg-rose-500/10',
}

const STATUS_STYLES = {
  Unsolved: 'bg-slate-500',
  Attempted: 'bg-amber-400',
  Solved: 'bg-cyan-400',
  Mastered: 'bg-emerald-400',
}

const PLATFORM_BADGES = {
  LeetCode: { label: 'LC', color: '#f59e0b' },
  GeeksForGeeks: { label: 'GFG', color: '#22c55e' },
  Other: { label: 'Other', color: '#6b7280' },
}

const PLATFORM_TOGGLES = {
  LeetCode: 'bg-orange-500/20 text-orange-200 border-orange-400/50',
  GeeksForGeeks: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50',
  Other: 'bg-slate-500/20 text-slate-200 border-slate-400/50',
}

const PLATFORM_LINK_PLACEHOLDERS = {
  LeetCode: 'https://leetcode.com/problems/two-sum/',
  GeeksForGeeks: 'https://geeksforgeeks.org/problems/...',
  Other: 'Paste problem URL here',
}

const emptyFormState = {
  platform: 'LeetCode',
  problemLink: '',
  problemNumber: '',
  title: '',
  topic: 'Arrays',
  difficulty: '',
  status: 'Unsolved',
  solvedDate: format(new Date(), 'yyyy-MM-dd'),
  confidenceRating: 0,
  striverSheet: false,
  notes: '',
}

const buildRevisions = (solvedDate, confidenceRating) => {
  const dueDates = calculateRevisionDates(solvedDate)
  return [1, 7, 30, 60].map((day, index) => ({
    day,
    dueDate: dueDates[index],
    completedDate: null,
    confidence: confidenceRating,
  }))
}

const formatShortDate = (dateValue) => {
  if (!dateValue) {
    return '—'
  }
  return format(new Date(dateValue), 'MMM d')
}

const getNextRevisionMeta = (problem) => {
  const nextRevision = getNextRevisionDate(problem)
  if (!nextRevision) {
    return { label: 'Completed', state: 'done' }
  }

  const date = new Date(nextRevision)
  if (isOverdue(nextRevision)) {
    return { label: formatShortDate(date), state: 'overdue' }
  }
  if (isToday(date)) {
    return { label: formatShortDate(date), state: 'today' }
  }

  return { label: formatShortDate(date), state: 'future' }
}

function Problems() {
  const [problems, setProblems] = useState([])
  const [viewMode, setViewMode] = useState('table')
  const [search, setSearch] = useState('')
  const [topicFilter, setTopicFilter] = useState('All Topics')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [striverOnly, setStriverOnly] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProblem, setEditingProblem] = useState(null)
  const [formState, setFormState] = useState(emptyFormState)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const toastTimerRef = useRef(null)

  const refreshProblems = () => {
    setProblems(getProblems())
  }

  useEffect(() => {
    refreshProblems()
  }, [])

  const filteredProblems = useMemo(() => {
    const query = search.trim().toLowerCase()

    return problems.filter((problem) => {
      const numberValue = problem.problemNumber || problem.leetcodeNumber || ''
      const matchesSearch =
        !query ||
        problem.title.toLowerCase().includes(query) ||
        numberValue.toLowerCase().includes(query) ||
        (problem.problemLink || '').toLowerCase().includes(query)
      const matchesTopic = topicFilter === 'All Topics' || problem.topic === topicFilter
      const matchesDifficulty = !difficultyFilter || problem.difficulty === difficultyFilter
      const matchesStatus = statusFilter === 'All' || problem.status === statusFilter
      const matchesStriver = !striverOnly || problem.striverSheet

      return matchesSearch && matchesTopic && matchesDifficulty && matchesStatus && matchesStriver
    })
  }, [problems, search, topicFilter, difficultyFilter, statusFilter, striverOnly])

  const openModalForNew = () => {
    setEditingProblem(null)
    setFormState(emptyFormState)
    setFormError('')
    setIsModalOpen(true)
  }

  const openModalForEdit = (problem) => {
    setEditingProblem(problem)
    setFormState({
      platform: problem.platform || (problem.leetcodeNumber ? 'LeetCode' : 'Other'),
      problemLink: problem.problemLink || '',
      problemNumber: problem.problemNumber || problem.leetcodeNumber || '',
      title: problem.title,
      topic: problem.topic,
      difficulty: problem.difficulty,
      status: problem.status,
      solvedDate: format(new Date(problem.solvedDate), 'yyyy-MM-dd'),
      confidenceRating: problem.confidenceRating || 0,
      striverSheet: Boolean(problem.striverSheet),
      notes: problem.notes || '',
    })
    setFormError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProblem(null)
    setFormError('')
  }

  const showToast = (message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }

    setToast({ message, visible: true })
    toastTimerRef.current = setTimeout(() => {
      setToast({ message, visible: false })
    }, 2600)

    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 3200)
  }

  const handleSave = () => {
    if (!formState.title.trim() || !formState.difficulty) {
      setFormError('Please provide at least a title and difficulty.')
      return
    }

    if (!formState.platform) {
      setFormError('Please select a platform for the problem.')
      return
    }

    if (formState.problemLink && !formState.problemLink.startsWith('http')) {
      setFormError('Problem link must start with http.')
      return
    }

    const confidenceRating = formState.confidenceRating || 3
    const solvedDateIso = new Date(formState.solvedDate).toISOString()

    const basePayload = {
      title: formState.title.trim(),
      platform: formState.platform,
      problemLink: formState.problemLink.trim(),
      problemNumber: formState.problemNumber.trim(),
      topic: formState.topic,
      difficulty: formState.difficulty,
      status: formState.status,
      solvedDate: solvedDateIso,
      confidenceRating,
      striverSheet: formState.striverSheet,
      notes: formState.notes.trim(),
    }

    if (editingProblem) {
      const shouldRecalculate =
        format(new Date(editingProblem.solvedDate), 'yyyy-MM-dd') !== formState.solvedDate
      const revisions = shouldRecalculate
        ? buildRevisions(solvedDateIso, confidenceRating)
        : editingProblem.revisions

      updateProblem(editingProblem.id, {
        ...basePayload,
        revisions,
      })
    } else {
      saveProblem({
        ...basePayload,
        revisions: buildRevisions(solvedDateIso, confidenceRating),
      })
    }

    refreshProblems()
    closeModal()
    showToast('Problem saved! Revisions scheduled.')
  }

  const handleDelete = () => {
    if (!deleteTarget) {
      return
    }

    deleteProblem(deleteTarget.id)
    setDeleteTarget(null)
    refreshProblems()
  }

  const markRevised = (problem) => {
    const revisions = [...(problem.revisions || [])].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )

    const targetIndex = revisions.findIndex((revision) => !revision.completedDate)
    if (targetIndex === -1) {
      return
    }

    revisions[targetIndex] = {
      ...revisions[targetIndex],
      completedDate: new Date().toISOString(),
    }

    const nextStatus = revisions.every((revision) => revision.completedDate) ? 'Mastered' : 'Solved'

    updateProblem(problem.id, {
      revisions,
      status: nextStatus,
    })

    refreshProblems()
  }

  const isEmpty = problems.length === 0

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen size={28} color="#58a6ff" />
            <h1 className="text-3xl font-bold text-white">Problems</h1>
          </div>
          <p className="mt-1 text-sm text-[#8b949e]">Track every problem. Miss nothing.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openModalForNew}
            className="inline-flex items-center gap-2 rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(88,166,255,0.5)] transition hover:shadow-[0_0_22px_rgba(88,166,255,0.8)]"
          >
            <Plus size={16} />
            Add Problem
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-[#21262d] bg-[#0d1117] p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-md px-2 py-1 text-sm transition ${
                viewMode === 'table' ? 'bg-[#161b22] text-white' : 'text-[#8b949e]'
              }`}
              aria-label="Table view"
            >
              <LayoutList size={18} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`rounded-md px-2 py-1 text-sm transition ${
                viewMode === 'card' ? 'bg-[#161b22] text-white' : 'text-[#8b949e]'
              }`}
              aria-label="Card view"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 md:items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search problems..."
            className="w-full rounded-md border border-[#21262d] bg-[#0d1117] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#8b949e]"
          />
        </div>

        <select
          value={topicFilter}
          onChange={(event) => setTopicFilter(event.target.value)}
          className="min-w-[160px] rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
        >
          <option>All Topics</option>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {DIFFICULTIES.map((difficulty) => {
            const isActive = difficultyFilter === difficulty
            const baseClass = DIFFICULTY_STYLES[difficulty]

            return (
              <button
                key={difficulty}
                type="button"
                onClick={() => setDifficultyFilter(isActive ? '' : difficulty)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive ? baseClass : 'border-[#21262d] text-[#8b949e]'
                }`}
              >
                {difficulty}
              </button>
            )
          })}
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="min-w-[150px] rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
        >
          <option>All</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <div className="flex min-w-[140px] items-center gap-3">
          <span className="text-xs text-[#8b949e]">Striver A2Z</span>
          <button
            type="button"
            onClick={() => setStriverOnly((prev) => !prev)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
              striverOnly ? 'border-[#1f6feb] bg-[#1f6feb]' : 'border-[#30363d] bg-[#30363d]'
            }`}
            aria-pressed={striverOnly}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                striverOnly ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#21262d] bg-[#0d1117] p-10 text-center">
          <span className="text-5xl text-[#58a6ff]">&lt;/&gt;</span>
          <p className="mt-4 text-xl font-semibold text-white">No problems tracked yet.</p>
          <p className="mt-2 text-sm text-[#8b949e]">
            Add your first problem and start your revision journey.
          </p>
          <button
            type="button"
            onClick={openModalForNew}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#58a6ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_rgba(88,166,255,0.6)] transition hover:shadow-[0_0_26px_rgba(88,166,255,0.85)]"
          >
            <Plus size={16} />
            Add Your First Problem
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-lg border border-[#21262d]">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#0d1117] text-xs uppercase text-[#8b949e]">
              <tr>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Problem</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Solved Date</th>
                <th className="px-4 py-3 font-medium">Next Revision</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProblems.map((problem) => {
                const nextRevision = getNextRevisionMeta(problem)
                const platformValue = problem.platform || (problem.leetcodeNumber ? 'LeetCode' : 'Other')
                const platformBadge = PLATFORM_BADGES[platformValue] || PLATFORM_BADGES.Other
                const problemLink = problem.problemLink || ''

                return (
                  <tr
                    key={problem.id}
                    className="group border-t border-[#21262d] transition hover:bg-[rgba(88,166,255,0.05)]"
                  >
                    <td className="border-l-4 border-transparent px-4 py-3 text-xs text-[#8b949e] group-hover:border-l-[#58a6ff]">
                      <span
                        className="rounded-full px-2 py-1 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: platformBadge.color }}
                      >
                        {platformBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">
                      {problemLink ? (
                        <a
                          href={problemLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onMouseEnter={() => setHoveredId(problem.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            textDecoration: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              color: hoveredId === problem.id ? '#58a6ff' : '#e6edf3',
                              transition: 'color 150ms ease',
                            }}
                          >
                            {problem.title}
                          </span>
                          <ExternalLink
                            size={12}
                            style={{
                              flexShrink: 0,
                              opacity: hoveredId === problem.id ? 1 : 0,
                              color: '#58a6ff',
                              transition: 'opacity 150ms ease',
                            }}
                          />
                        </a>
                      ) : (
                        <span style={{ color: '#e6edf3' }}>{problem.title}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-1 text-xs text-white"
                        style={{ backgroundColor: TOPIC_COLORS[problem.topic] }}
                      >
                        {problem.topic}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${DIFFICULTY_STYLES[problem.difficulty]}`}
                      >
                        {problem.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-white">
                        <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[problem.status]}`} />
                        {problem.status}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#8b949e]">{formatShortDate(problem.solvedDate)}</td>
                    <td className="px-4 py-3 text-xs">
                      {nextRevision.state === 'overdue' && (
                        <span className="flex items-center gap-1 text-rose-300">
                          <AlertCircle size={14} />
                          {nextRevision.label}
                        </span>
                      )}
                      {nextRevision.state === 'today' && (
                        <span className="flex items-center gap-1 text-amber-300">
                          <Clock size={14} />
                          {nextRevision.label}
                        </span>
                      )}
                      {nextRevision.state === 'future' && (
                        <span className="flex items-center gap-1 text-emerald-300">
                          <CheckCircle size={14} />
                          {nextRevision.label}
                        </span>
                      )}
                      {nextRevision.state === 'done' && (
                        <span className="text-[#8b949e]">Completed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={star <= problem.confidenceRating ? 'text-yellow-300' : 'text-[#21262d]'}
                          >
                            {star <= problem.confidenceRating ? '★' : '☆'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openModalForEdit(problem)}
                          className="rounded-md border border-[#21262d] p-2 text-[#8b949e] transition hover:text-white"
                          aria-label="Edit problem"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(problem)}
                          className="rounded-md border border-[#21262d] p-2 text-[#8b949e] transition hover:text-rose-300"
                          aria-label="Delete problem"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => markRevised(problem)}
                          className="rounded-md border border-[#21262d] p-2 text-[#8b949e] transition hover:text-emerald-300"
                          aria-label="Mark revised"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProblems.map((problem) => {
            const nextRevision = getNextRevisionMeta(problem)
            const platformValue = problem.platform || (problem.leetcodeNumber ? 'LeetCode' : 'Other')
            const platformBadge = PLATFORM_BADGES[platformValue] || PLATFORM_BADGES.Other
            const displayNumber = problem.problemNumber || problem.leetcodeNumber || '—'

            return (
              <article
                key={problem.id}
                className="rounded-xl border border-[#21262d] bg-[#0d1117] p-4 transition hover:border-[#58a6ff]"
              >
                <div className="flex items-center justify-between text-xs text-[#8b949e]">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: platformBadge.color }}
                    >
                      {platformBadge.label}
                    </span>
                    <span className="font-mono">#{displayNumber}</span>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] ${
                      DIFFICULTY_STYLES[problem.difficulty]
                    }`}
                  >
                    {problem.difficulty}
                  </span>
                </div>
                {problem.problemLink ? (
                  <a
                    href={problem.problemLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => setHoveredId(problem.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        color: hoveredId === problem.id ? '#58a6ff' : '#e6edf3',
                        transition: 'color 150ms ease',
                      }}
                    >
                      {problem.title}
                    </span>
                    <ExternalLink
                      size={12}
                      style={{
                        flexShrink: 0,
                        opacity: hoveredId === problem.id ? 1 : 0,
                        color: '#58a6ff',
                        transition: 'opacity 150ms ease',
                      }}
                    />
                  </a>
                ) : (
                  <span style={{ color: '#e6edf3' }}>{problem.title}</span>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="rounded-full px-2 py-1 text-white"
                    style={{ backgroundColor: TOPIC_COLORS[problem.topic] }}
                  >
                    {problem.topic}
                  </span>
                  <span className="rounded-full border border-[#21262d] px-2 py-1 text-[#8b949e]">
                    {problem.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[#8b949e]">Solved {formatShortDate(problem.solvedDate)}</p>
                <div className="mt-2 text-xs">
                  {nextRevision.state === 'overdue' && (
                    <span className="flex items-center gap-1 text-rose-300">
                      <AlertCircle size={14} />
                      {nextRevision.label}
                    </span>
                  )}
                  {nextRevision.state === 'today' && (
                    <span className="flex items-center gap-1 text-amber-300">
                      <Clock size={14} />
                      {nextRevision.label}
                    </span>
                  )}
                  {nextRevision.state === 'future' && (
                    <span className="flex items-center gap-1 text-emerald-300">
                      <CheckCircle size={14} />
                      {nextRevision.label}
                    </span>
                  )}
                  {nextRevision.state === 'done' && (
                    <span className="text-[#8b949e]">Completed</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1 text-sm">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= problem.confidenceRating ? 'text-yellow-300' : 'text-[#21262d]'}
                    >
                      {star <= problem.confidenceRating ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openModalForEdit(problem)}
                    className="rounded-md border border-[#21262d] px-3 py-2 text-xs text-[#8b949e] transition hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(problem)}
                    className="rounded-md border border-[#21262d] px-3 py-2 text-xs text-[#8b949e] transition hover:text-rose-300"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => markRevised(problem)}
                    className="rounded-md border border-[#21262d] px-3 py-2 text-xs text-[#8b949e] transition hover:text-emerald-300"
                  >
                    Mark Revised
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex w-full max-w-[560px] flex-col rounded-xl border border-[#21262d] bg-[#161b22] p-6" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingProblem ? 'Edit Problem' : 'Add New Problem'}
              </h2>
              <button type="button" onClick={closeModal} className="text-[#8b949e] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div
              className="mt-4 space-y-4"
              style={{
                maxHeight: 'calc(90vh - 130px)',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: '#30363d #161b22',
              }}
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <label className="text-xs text-[#8b949e]">Platform *</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {PLATFORMS.map((platform) => {
                      const isActive = formState.platform === platform
                      const activeClass = PLATFORM_TOGGLES[platform]

                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => setFormState((prev) => ({ ...prev, platform }))}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                            isActive ? activeClass : 'border-[#21262d] text-[#8b949e]'
                          }`}
                        >
                          {platform}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="w-36">
                  <label className="text-xs text-[#8b949e]">Problem # (optional)</label>
                  <input
                    type="text"
                    value={formState.problemNumber}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, problemNumber: event.target.value }))
                    }
                    placeholder="#26"
                    className="mt-1 w-full rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">Problem Link</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={formState.problemLink}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, problemLink: event.target.value }))
                    }
                    placeholder={PLATFORM_LINK_PLACEHOLDERS[formState.platform]}
                    className="w-full rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 pr-10 text-sm text-white"
                  />
                  <a
                    href={formState.problemLink || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] ${
                      formState.problemLink ? 'hover:text-[#58a6ff]' : 'pointer-events-none opacity-40'
                    }`}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">Problem Title *</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">Topic</label>
                <select
                  value={formState.topic}
                  onChange={(event) => setFormState((prev) => ({ ...prev, topic: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
                >
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">Difficulty *</label>
                <div className="mt-2 flex items-center gap-2">
                  {DIFFICULTIES.map((difficulty) => {
                    const isActive = formState.difficulty === difficulty
                    return (
                      <button
                        key={difficulty}
                        type="button"
                        onClick={() => setFormState((prev) => ({ ...prev, difficulty }))}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                          isActive ? DIFFICULTY_STYLES[difficulty] : 'border-[#21262d] text-[#8b949e]'
                        }`}
                      >
                        {difficulty}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">Status</label>
                <select
                  value={formState.status}
                  onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">Solved Date</label>
                <input
                  type="date"
                  value={formState.solvedDate}
                  onChange={(event) => setFormState((prev) => ({ ...prev, solvedDate: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">How confident are you? (1-5)</label>
                <div className="mt-2 flex items-center gap-1 text-lg">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= formState.confidenceRating
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormState((prev) => ({ ...prev, confidenceRating: star }))}
                        className={active ? 'text-yellow-300' : 'text-[#21262d]'}
                      >
                        {active ? '★' : '☆'}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-[#8b949e]">Part of Striver's A2Z Sheet</label>
                <button
                  type="button"
                  onClick={() => setFormState((prev) => ({ ...prev, striverSheet: !prev.striverSheet }))}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${
                    formState.striverSheet ? 'border-[#58a6ff] bg-[#58a6ff]/30' : 'border-[#21262d] bg-[#0d1117]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                      formState.striverSheet ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-xs text-[#8b949e]">Notes</label>
                <textarea
                  value={formState.notes}
                  maxLength={1000}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, notes: event.target.value.slice(0, 1000) }))
                  }
                  placeholder="Key insight: ... Pattern: ... Watch out for: ..."
                  className="mt-1 h-28 w-full rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2 text-sm text-white"
                />
                <p className="mt-1 text-right text-xs text-[#8b949e]">
                  {formState.notes.length}/1000
                </p>
              </div>

              {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-[#21262d] px-4 py-2 text-sm text-[#8b949e]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(88,166,255,0.5)]"
              >
                Save Problem
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#21262d] bg-[#161b22] p-5">
            <h3 className="text-lg font-semibold text-white">Delete this problem?</h3>
            <p className="mt-2 text-sm text-[#8b949e]">
              This will remove all revision history too.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-[#21262d] px-4 py-2 text-sm text-[#8b949e]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border-l-4 border-emerald-400 bg-[#0d1117] px-4 py-3 text-sm text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all duration-300 ${
            toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          }`}
        >
          <CheckCircle size={16} className="text-emerald-300" />
          {toast.message}
        </div>
      )}
    </section>
  )
}

export default Problems
