import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import {
  Bell,
  Check,
  ExternalLink,
  Flame,
  RefreshCcw,
  Star,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getMasteryStatus, getNextRevisionDate, getTodaysDueRevisions, isOverdue } from "../utils/revisionUtils";
import { getProblems, updateProblem } from "../utils/storage";

const QUOTES = [
  "Consistency beats talent. Show up every day.",
  "One more problem. That's all. One more.",
  "The grind you put in today is the gap you create tomorrow.",
  "MAANG isn't a dream. It's a deadline. Act like it.",
  "Revision is where amateurs skip and champions are made.",
];

const greetingByHour = (hour) => {
  if (hour < 12) {
    return {
      line: "Good morning, keep grinding.",
      subtext: "Your competitors are already coding. Are you?",
      emoji: "⚡",
    };
  }
  if (hour < 18) {
    return {
      line: "Good afternoon, keep grinding.",
      subtext: "Afternoon grind hits different. Let's go.",
      emoji: "🔥",
    };
  }
  return {
    line: "Good evening, keep grinding.",
    subtext: "Evening session. This is where champions are made.",
    emoji: "🔥",
  };
};

const toLocalDayKey = (dateValue) => format(startOfDay(new Date(dateValue)), "yyyy-MM-dd");

const buildYearCalendarWeeks = () => {
  const today = startOfDay(new Date());
  const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const startDate = subDays(thisWeekMonday, 51 * 7);

  return Array.from({ length: 52 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => addDays(startDate, weekIndex * 7 + dayIndex)),
  );
};

const buildActivityMap = (problems) => {
  const map = new Map();

  const ensureEntry = (key) => {
    if (!map.has(key)) {
      map.set(key, {
        problems: 0,
        revisions: 0,
        titles: [],
      });
    }
    return map.get(key);
  };

  problems.forEach((problem) => {
    if (problem?.solvedDate) {
      const dayKey = toLocalDayKey(problem.solvedDate);
      const entry = ensureEntry(dayKey);
      entry.problems += 1;
      entry.titles.push(`Solved: ${problem.title}`);
    }

    (problem?.revisions ?? []).forEach((revision) => {
      if (!revision?.completedDate) {
        return;
      }

      const dayKey = toLocalDayKey(revision.completedDate);
      const entry = ensureEntry(dayKey);
      entry.revisions += 1;
      entry.titles.push(`Revision: ${problem.title} (Day ${revision.day})`);
    });
  });

  return map;
};

const getActivityColor = (entry) => {
  if (!entry) {
    return "#161b22";
  }
  if (entry.problems >= 5) {
    return "#39d353";
  }
  if (entry.problems >= 3) {
    return "#26a641";
  }
  if (entry.problems === 2) {
    return "#006d32";
  }
  if (entry.problems === 1) {
    return "#0e4429";
  }
  if (entry.revisions > 0) {
    return "#1f6feb";
  }
  return "#161b22";
};

const getActivityTooltip = (date, entry) => {
  const formattedDate = format(date, "MMM d");
  if (!entry) {
    return `${formattedDate} — No activity`;
  }

  const parts = [];
  if (entry.problems > 0) {
    parts.push(`${entry.problems} problem${entry.problems === 1 ? "" : "s"} solved`);
  }
  if (entry.revisions > 0) {
    parts.push(`${entry.revisions} revised`);
  }

  return `${formattedDate} — ${parts.join(", ")}`;
};

const buildActivityDateSet = (problems) => {
  const activeDays = new Set();

  problems.forEach((problem) => {
    if (problem?.solvedDate) {
      activeDays.add(toLocalDayKey(problem.solvedDate));
    }

    (problem?.revisions ?? []).forEach((revision) => {
      if (revision?.completedDate) {
        activeDays.add(toLocalDayKey(revision.completedDate));
      }
    });
  });

  return activeDays;
};

const calculateCurrentStreak = (problems) => {
  const activityDays = buildActivityDateSet(problems);
  let streak = 0;
  let cursor = startOfDay(new Date());

  while (activityDays.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
};

const getEarliestPendingDueRevision = (problem) => {
  const today = startOfDay(new Date());
  const revisions = Array.isArray(problem?.revisions) ? problem.revisions : [];

  return revisions
    .filter((revision) => !revision?.completedDate)
    .map((revision) => ({ ...revision, dueDateObj: startOfDay(new Date(revision.dueDate)) }))
    .filter((revision) => revision.dueDateObj <= today)
    .sort((a, b) => a.dueDateObj.getTime() - b.dueDateObj.getTime())[0] ?? null;
};

const difficultyClass = (difficulty) => {
  if (difficulty === "Easy") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }

  if (difficulty === "Hard") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-300";
  }

  return "border-amber-400/40 bg-amber-400/10 text-amber-300";
};

const cardShellClassName =
  "group rounded-2xl bg-gradient-to-r from-cyan-500/0 via-amber-500/0 to-violet-500/0 p-[1px] transition duration-300 hover:from-cyan-400/45 hover:via-amber-400/35 hover:to-violet-400/45";

function Dashboard() {
  const [problems, setProblems] = useState([]);
  const [selectedConfidence, setSelectedConfidence] = useState({});
  const [activeRevisionCard, setActiveRevisionCard] = useState("");

  useEffect(() => {
    setProblems(getProblems());
  }, []);

  const greeting = useMemo(() => greetingByHour(new Date().getHours()), []);
  const motivationalQuote = useMemo(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    [],
  );
  const todayLabel = useMemo(() => format(new Date(), "EEEE, MMMM d, yyyy"), []);
  const noProblems = problems.length === 0;

  const calendarData = useMemo(() => {
    const weeks = buildYearCalendarWeeks();
    const activityMap = buildActivityMap(problems);

    const monthLabels = weeks.map((week, weekIndex) => {
      const monthStart = week.find((date) => date.getDate() === 1);
      if (!monthStart) {
        return { label: "", offset: 0 };
      }

      const previousWeek = weeks[weekIndex - 1];
      const previousHadLabel = previousWeek?.some((date) => date.getDate() === 1);

      return {
        label: format(monthStart, "MMM"),
        offset: previousHadLabel ? 6 : 0,
      };
    });

    return {
      weeks,
      monthLabels,
      activityMap,
    };
  }, [problems]);

  const yearlyCalendarStats = useMemo(() => {
    const today = startOfDay(new Date());
    const flatDays = calendarData.weeks.flat().filter((day) => day <= today);

    let submissions = 0;
    let activeDays = 0;
    let maxStreak = 0;
    let runningStreak = 0;

    flatDays.forEach((day) => {
      const entry = calendarData.activityMap.get(toLocalDayKey(day));
      const problemsSolved = entry?.problems ?? 0;
      const revisionsDone = entry?.revisions ?? 0;
      const active = problemsSolved + revisionsDone > 0;

      submissions += problemsSolved;

      if (active) {
        activeDays += 1;
        runningStreak += 1;
        maxStreak = Math.max(maxStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    });

    return {
      submissions,
      activeDays,
      maxStreak,
    };
  }, [calendarData]);

  const revisionQueue = useMemo(() => {
    return getTodaysDueRevisions(problems)
      .map((problem) => {
        const pendingDueRevision = getEarliestPendingDueRevision(problem);
        return {
          ...problem,
          pendingDueRevision,
        };
      })
      .filter((problem) => Boolean(problem.pendingDueRevision))
      .sort(
        (a, b) =>
          new Date(a.pendingDueRevision.dueDate).getTime() -
          new Date(b.pendingDueRevision.dueDate).getTime(),
      );
  }, [problems]);

  const topStats = useMemo(() => {
    const solvedCount = problems.filter((problem) => ["Solved", "Mastered"].includes(problem.status)).length;
    const masteredCount = problems.filter((problem) => getMasteryStatus(problem) === 100).length;
    const dueTodayCount = revisionQueue.filter((problem) => isToday(new Date(problem.pendingDueRevision.dueDate))).length;
    const streak = calculateCurrentStreak(problems);

    return {
      solvedCount,
      dueTodayCount,
      streak,
      masteredCount,
    };
  }, [problems, revisionQueue]);

  const recentSolved = useMemo(() => {
    return [...problems]
      .sort((a, b) => new Date(b.solvedDate).getTime() - new Date(a.solvedDate).getTime())
      .slice(0, 5);
  }, [problems]);

  const markRevisionDone = (problemId) => {
    const currentProblem = problems.find((problem) => problem.id === problemId);
    if (!currentProblem) {
      return;
    }

    const confidence = Number(selectedConfidence[problemId] ?? currentProblem.confidenceRating ?? 3);
    const todayIso = new Date().toISOString();

    let marked = false;
    const updatedRevisions = (currentProblem.revisions ?? []).map((revision) => {
      if (marked || revision?.completedDate) {
        return revision;
      }

      const dueDate = startOfDay(new Date(revision.dueDate));
      if (dueDate <= startOfDay(new Date())) {
        marked = true;
        return {
          ...revision,
          completedDate: todayIso,
          confidence,
        };
      }

      return revision;
    });

    if (!marked) {
      return;
    }

    const nextStatus = updatedRevisions.every((revision) => Boolean(revision.completedDate))
      ? "Mastered"
      : "Solved";

    const updatedProblem = updateProblem(problemId, {
      revisions: updatedRevisions,
      confidenceRating: confidence,
      status: nextStatus,
    });

    if (!updatedProblem) {
      return;
    }

    setProblems((prev) => prev.map((problem) => (problem.id === problemId ? updatedProblem : problem)));
  };

  const markStruggled = (problemId) => {
    const currentProblem = problems.find((problem) => problem.id === problemId);
    if (!currentProblem) {
      return;
    }

    const confidence = Math.max(1, Number(selectedConfidence[problemId] ?? currentProblem.confidenceRating ?? 3) - 1);
    const updatedProblem = updateProblem(problemId, {
      confidenceRating: confidence,
      status: "Attempted",
    });

    if (!updatedProblem) {
      return;
    }

    setSelectedConfidence((prev) => ({
      ...prev,
      [problemId]: confidence,
    }));
    setProblems((prev) => prev.map((problem) => (problem.id === problemId ? updatedProblem : problem)));
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 md:px-8">
      <header className="rounded-3xl border border-slate-700/70 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.2),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.15),transparent_40%),rgba(15,23,42,0.85)] p-6 shadow-[0_0_0_1px_rgba(148,163,184,0.1)] backdrop-blur-sm md:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Developer Dashboard</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight text-slate-100 md:text-5xl">
          {greeting.line} <span className="ml-2 inline-block">{greeting.emoji}</span>
        </h1>
        <p className="mt-3 text-sm font-medium text-cyan-200/90 md:text-base">{greeting.subtext}</p>
        <p className="mt-3 font-mono text-xs text-slate-500 md:text-sm">{todayLabel}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className={cardShellClassName}>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/65 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-24px_rgba(34,211,238,0.7)]">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Total Problems Solved</p>
              <Trophy size={18} className="text-amber-300" />
            </div>
            <p className="mt-4 font-mono text-4xl font-bold text-slate-100">{topStats.solvedCount}</p>
          </div>
        </article>

        <article className={cardShellClassName}>
          <div
            className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-24px_rgba(167,139,250,0.8)] ${
              topStats.dueTodayCount > 0
                ? "border-amber-300/60 bg-amber-500/10 shadow-[0_18px_44px_-24px_rgba(245,158,11,0.85)]"
                : "border-slate-700/80 bg-slate-900/65 hover:border-amber-300/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Due Today</p>
              <Bell size={18} className="text-amber-300" />
            </div>
            <p className="mt-4 font-mono text-4xl font-bold text-slate-100">{topStats.dueTodayCount}</p>
          </div>
        </article>

        <article className={cardShellClassName}>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/65 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-24px_rgba(251,146,60,0.8)]">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Current Streak</p>
              <Flame size={18} className={topStats.streak > 3 ? "text-orange-300" : "text-slate-300"} />
            </div>
            <p
              className={`mt-4 font-mono text-4xl font-bold ${
                topStats.streak > 3 ? "animate-pulse text-orange-300" : "text-slate-100"
              }`}
            >
              {topStats.streak} days
            </p>
          </div>
        </article>

        <article className={cardShellClassName}>
          <div
            className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-24px_rgba(74,222,128,0.8)] ${
              topStats.masteredCount > 0
                ? "border-yellow-300/50 bg-yellow-400/10 shadow-[0_18px_44px_-24px_rgba(234,179,8,0.85)]"
                : "border-slate-700/80 bg-slate-900/65 hover:border-yellow-300/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Mastered Problems</p>
              <Star size={18} className="text-yellow-300" />
            </div>
            <p className="mt-4 font-mono text-4xl font-bold text-slate-100">{topStats.masteredCount}</p>
          </div>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-100">Your Grind Calendar</h2>
          <p className="text-[11px] font-mono text-[#8b949e]">Last 52 weeks</p>
        </div>

        <div className="w-full overflow-x-auto" style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ minWidth: "900px" }}>
            <div className="mb-3 flex items-center" style={{ gap: "3px" }}>
              <span className="block w-[36px]" />
              <div className="flex" style={{ gap: "3px" }}>
                {calendarData.monthLabels.map((month, index) => {
                  const label = month.label;
                  const offset = month.offset;
                  const addGap = index > 0 && index % 4 === 0;

                  return (
                    <span
                      key={`month-${index}`}
                      className="block"
                      style={{
                        width: "13px",
                        marginRight: addGap ? "2px" : "0px",
                      }}
                    >
                      {label ? (
                        <span
                          className="font-mono text-[13px] leading-[13px] text-[#8b949e]"
                          style={{ marginLeft: `${offset}px` }}
                        >
                          {label}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex" style={{ gap: "3px" }}>
              <div className="flex w-[36px] flex-col" style={{ gap: "3px" }}>
                <span className="h-[13px] text-[10px] leading-[13px] text-[#8b949e]" >MON</span>
                <span className="h-[13px] text-[10px] leading-[13px] text-[#8b949e]">TUE</span>
                <span className="h-[13px] text-[10px] leading-[13px] text-[#8b949e]" >WED</span>
                <span className="h-[13px] text-[10px] leading-[13px] text-[#8b949e]">THU</span>
                <span className="h-[13px] text-[10px] leading-[13px] text-[#8b949e]" >FRI</span>
                <span className="h-[13px] text-[10px] leading-[13px] text-[#8b949e]">SAT</span>
                <span className="h-[13px] text-[10px] leading-[13px] text-[#8b949e]" >SUN</span>
              </div>

              <div className="flex" style={{ gap: "3px" }}>
                {calendarData.weeks.map((week, weekIndex) => {
                  const addGap = weekIndex > 0 && weekIndex % 4 === 0;

                  return (
                    <div
                      key={`week-${weekIndex}`}
                      className="flex flex-col"
                      style={{
                        gap: "3px",
                        width: "13px",
                        marginRight: addGap ? "2px" : "0px",
                      }}
                    >
                      {week.map((date) => {
                        const key = toLocalDayKey(date);
                        const entry = calendarData.activityMap.get(key);

                        return (
                          <span key={key} className="group relative h-[13px] w-[13px]">
                            <span
                              className="block h-[13px] w-[13px] border border-black/25"
                              style={{
                                backgroundColor: getActivityColor(entry),
                                borderRadius: "3px",
                              }}
                            />
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden w-max -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded bg-[#161b22] px-2 py-1 text-[12px] text-white group-hover:block">
                              {getActivityTooltip(date, entry)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-semibold text-slate-100">{yearlyCalendarStats.submissions} submissions</span>
                <span className="text-[#8b949e]"> in the past one year</span>
              </p>
              <p className="text-sm text-[#8b949e]">
                Total active days: {yearlyCalendarStats.activeDays}   Max streak: {yearlyCalendarStats.maxStreak}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-[#8b949e]">
              <span>Less</span>
              <span className="h-[13px] w-[13px] border border-black/25" style={{ backgroundColor: "#161b22", borderRadius: "3px" }} />
              <span className="h-[13px] w-[13px] border border-black/25" style={{ backgroundColor: "#0e4429", borderRadius: "3px" }} />
              <span className="h-[13px] w-[13px] border border-black/25" style={{ backgroundColor: "#006d32", borderRadius: "3px" }} />
              <span className="h-[13px] w-[13px] border border-black/25" style={{ backgroundColor: "#26a641", borderRadius: "3px" }} />
              <span className="h-[13px] w-[13px] border border-black/25" style={{ backgroundColor: "#39d353", borderRadius: "3px" }} />
              <span>More</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-100">Today&apos;s Revision Queue</h2>
          <p className="font-mono text-sm text-slate-400">{revisionQueue.length} pending</p>
        </div>

        {noProblems ? (
          <div className="rounded-2xl border border-dashed border-cyan-400/35 bg-cyan-500/5 p-8 text-center">
            <p className="text-4xl">🚀</p>
            <p className="mt-3 text-2xl font-semibold text-cyan-100">Your journey starts here.</p>
            <p className="mt-2 text-sm text-slate-300">
              Add your first solved problem and let the tracker do the rest.
            </p>
            <Link
              to="/problems"
              className="mt-6 inline-flex rounded-xl border border-cyan-300/50 bg-cyan-400/15 px-6 py-3 font-semibold text-cyan-100 shadow-[0_0_30px_-10px_rgba(56,189,248,0.8)] transition hover:-translate-y-0.5 hover:bg-cyan-300/25"
            >
              Add First Problem →
            </Link>
          </div>
        ) : revisionQueue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-emerald-400/35 bg-emerald-500/5 p-8 text-center">
            <p className="text-lg font-medium text-emerald-200">You&apos;re all caught up. Go solve a new problem.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {revisionQueue.map((problem) => {
              const dueDate = new Date(problem.pendingDueRevision.dueDate);
              const overdue = isOverdue(problem.pendingDueRevision.dueDate);
              const daysOverdue = overdue
                ? differenceInCalendarDays(startOfDay(new Date()), startOfDay(dueDate))
                : 0;
              const selected = Number(selectedConfidence[problem.id] ?? problem.confidenceRating ?? 3);
              const revisionLabel = `Day ${problem.pendingDueRevision.day} Revision`;
              const isDueToday = isToday(dueDate);
              const cardBorder = overdue
                ? "border-l-4 border-l-rose-400"
                : isDueToday
                  ? "border-l-4 border-l-amber-400"
                  : "border-l-4 border-l-cyan-400";
              const leetcodeHref = `https://leetcode.com/problemset/all/?search=${encodeURIComponent(
                problem.leetcodeNumber || problem.title,
              )}`;

              return (
                <article
                  key={problem.id}
                  className={`rounded-xl border bg-slate-950/55 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 ${cardBorder} ${
                    activeRevisionCard === problem.id ? "border-cyan-300/55" : "border-slate-700/80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-100">{problem.title}</h3>
                        <a
                          href={leetcodeHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 transition hover:text-cyan-200"
                          title="Open on LeetCode"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1 text-cyan-200">
                          {problem.topic}
                        </span>
                        <span className={`rounded-full border px-3 py-1 ${difficultyClass(problem.difficulty)}`}>
                          {problem.difficulty}
                        </span>
                        <span className="rounded-full border border-violet-300/35 bg-violet-400/15 px-3 py-1 text-violet-200">
                          {revisionLabel}
                        </span>
                        <span className="font-mono text-slate-400">Due {format(dueDate, "MMM d, yyyy")}</span>
                        {overdue && (
                          <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-rose-300">
                            {daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-lg border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/20"
                      onClick={() => setActiveRevisionCard(problem.id)}
                    >
                      Revise Now
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/70 pt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Confidence</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = star <= selected;
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
                              className={`text-xl leading-none transition duration-200 ${
                                active
                                  ? "scale-110 text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.9)]"
                                  : "text-slate-500 hover:scale-105 hover:text-amber-200"
                              }`}
                            >
                              {active ? "★" : "☆"}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300/70 hover:bg-rose-400/20"
                        onClick={() => markStruggled(problem.id)}
                      >
                        <RefreshCcw size={14} />
                        Struggled
                      </button>

                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-400/20"
                        onClick={() => markRevisionDone(problem.id)}
                      >
                        <Check size={14} />
                        Mark Done
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-100">Recently Solved</h2>
          <p className="font-mono text-sm text-slate-400">Last 5</p>
        </div>

        {recentSolved.length === 0 ? (
          <p className="text-sm text-slate-400">No solved problems yet. Start with one clean implementation today.</p>
        ) : (
          <ul className="grid gap-3">
            {recentSolved.map((problem) => {
              const nextRevision = getNextRevisionDate(problem);
              return (
                <li
                  key={problem.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-950/45 px-4 py-3 transition duration-300 hover:border-slate-500/80"
                >
                  <div>
                    <p className="font-medium text-slate-100">{problem.title}</p>
                    <p className="text-xs text-slate-400">{problem.topic}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Next Revision</p>
                    <p className="font-mono text-sm text-slate-200">
                      {nextRevision ? format(new Date(nextRevision), "MMM d, yyyy") : "Completed"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-4 text-center">
        <p className="font-mono text-sm text-slate-400">{motivationalQuote}</p>
      </section>
    </section>
  );
}

export default Dashboard;
