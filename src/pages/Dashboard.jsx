import { useEffect, useMemo, useRef, useState } from "react";
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    return "#161c24";
  }
  if (entry.problems >= 4) {
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
  return "#2d333b";
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

function Dashboard() {
  const [problems, setProblems] = useState([]);
  const [selectedConfidence, setSelectedConfidence] = useState({});
  const [activeRevisionCard, setActiveRevisionCard] = useState("");
  const calendarContainerRef = useRef(null);
  const [cellSize, setCellSize] = useState(13);

  const notifyTrackerDataUpdated = () => {
    window.dispatchEvent(new CustomEvent("trackerDataUpdated"));
  };

  useEffect(() => {
    setProblems(getProblems());
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const target = calendarContainerRef.current;
    if (!target) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? 0;
      const labelCol = 32;
      const gap = 3;
      const weeks = 53;
      const size = Math.floor((width - labelCol - gap * weeks) / weeks);
      setCellSize(Math.max(10, Math.min(16, size)));
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (calendarContainerRef.current) {
        const width = calendarContainerRef.current.offsetWidth;
        const labelCol = 32;
        const gap = 3;
        const weeks = 53;
        const size = Math.floor((width - labelCol - gap * weeks) / weeks);
        setCellSize(Math.max(10, Math.min(16, size)));
      }
    }, 100);

    return () => clearTimeout(timeoutId);
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

    let lastLabeledWeek = -99;
    const monthLabels = weeks.map((week, weekIndex) => {
      const monthStart = week.find((date) => date.getDate() === 1);
      if (!monthStart) {
        return "";
      }

      if (weekIndex - lastLabeledWeek < 3) {
        return "";
      }

      lastLabeledWeek = weekIndex;
      return format(monthStart, "MMM");
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
    const masteredCount = problems.filter(
      (problem) =>
        problem.revisions &&
        problem.revisions.length > 0 &&
        problem.revisions.every((revision) => revision.completedDate !== null),
    ).length;
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
    notifyTrackerDataUpdated();
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
    notifyTrackerDataUpdated();
  };

  const calendarGap = 3;

  return (
    <section
      className="page-content mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8"
      style={{
        backgroundImage: "radial-gradient(circle, rgba(33, 38, 45, 0.3) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <header
        className="rounded-2xl border border-[#21262d] bg-[linear-gradient(135deg,rgba(22,27,34,0.9)_0%,rgba(28,33,40,0.9)_100%)] px-6 py-6 shadow-[0_16px_36px_rgba(0,0,0,0.35)] md:px-8"
        style={{ borderLeft: "4px solid #58a6ff" }}
      >
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#58a6ff]">Developer Dashboard</p>
        <h1 className="mt-3 text-[clamp(18px,5vw,28px)] font-extrabold leading-tight text-white md:text-[clamp(22px,3vw,32px)]">
          {greeting.line} <span className="ml-2 inline-block">{greeting.emoji}</span>
        </h1>
        <p className="mt-3 text-sm font-medium text-[#58a6ff] md:text-base">{greeting.subtext}</p>
        <p className="mt-3 font-mono text-xs text-[#8b949e] md:text-sm">{todayLabel}</p>
      </header>

      <div className="grid grid-cols-4 gap-3 max-[1024px]:grid-cols-2">
        <article className="relative overflow-hidden rounded-2xl border border-[#21262d] bg-[linear-gradient(135deg,#161b22_0%,#1c2128_100%)] p-5 transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-[#58a6ff]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-[1280px]:px-4 max-[1280px]:py-[14px]">
          <div className="flex items-center justify-between">
            <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[#8b949e]">Total Problems Solved</p>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: "rgba(241, 196, 15, 0.15)" }}>
              <Trophy size={18} style={{ color: "#f1c40f" }} />
            </span>
          </div>
          <p className="my-[8px] font-mono text-[40px] font-bold leading-none text-white max-[1280px]:text-[34px]">
            {topStats.solvedCount}
          </p>
          <p className="text-xs text-[#8b949e]">
            {topStats.solvedCount === 0 ? "no problems solved yet" : "problems solved"}
          </p>
          <Trophy
            size={72}
            className="pointer-events-none absolute -bottom-2 -right-2 opacity-[0.04]"
            style={{ color: "#f1c40f" }}
          />
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, #f1c40f, transparent)" }}
          />
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-[#21262d] bg-[linear-gradient(135deg,#161b22_0%,#1c2128_100%)] p-5 transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-[#58a6ff]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-[1280px]:px-4 max-[1280px]:py-[14px]">
          <div className="flex items-center justify-between">
            <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[#8b949e]">Due Today</p>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: "rgba(210, 153, 34, 0.15)" }}>
              <Bell size={18} style={{ color: "#d29922" }} />
            </span>
          </div>
          <p className="my-[8px] font-mono text-[40px] font-bold leading-none text-white max-[1280px]:text-[34px]">
            {topStats.dueTodayCount}
          </p>
          <p className="text-xs" style={{ color: topStats.dueTodayCount === 0 ? "#3fb950" : "#d29922" }}>
            {topStats.dueTodayCount === 0 ? "all caught up ✓" : "need revision"}
          </p>
          <Bell
            size={72}
            className="pointer-events-none absolute -bottom-2 -right-2 opacity-[0.04]"
            style={{ color: "#d29922" }}
          />
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, #d29922, transparent)" }}
          />
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-[#21262d] bg-[linear-gradient(135deg,#161b22_0%,#1c2128_100%)] p-5 transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-[#58a6ff]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-[1280px]:px-4 max-[1280px]:py-[14px]">
          <div className="flex items-center justify-between">
            <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[#8b949e]">Current Streak</p>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: "rgba(249, 115, 22, 0.15)" }}>
              <Flame size={18} style={{ color: "#f97316" }} />
            </span>
          </div>
          <p
            className="my-[8px] font-mono text-[40px] font-bold leading-none text-white max-[1280px]:text-[34px]"
            style={
              topStats.streak > 0
                ? {
                    color: "#f97316",
                    textShadow: "0 0 20px rgba(249,115,22,0.6)",
                  }
                : undefined
            }
          >
            {topStats.streak}
            <span className="ml-1 text-[24px]">🔥</span>
          </p>
          <p className="text-xs" style={{ color: topStats.streak === 0 ? "#f85149" : "#8b949e" }}>
            {topStats.streak === 0 ? "start today →" : "day streak"}
          </p>
          <Flame
            size={72}
            className="pointer-events-none absolute -bottom-2 -right-2 opacity-[0.04]"
            style={{ color: "#f97316" }}
          />
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, #f97316, transparent)" }}
          />
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-[#21262d] bg-[linear-gradient(135deg,#161b22_0%,#1c2128_100%)] p-5 transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-[#58a6ff]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-[1280px]:px-4 max-[1280px]:py-[14px]">
          <div className="flex items-center justify-between">
            <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[#8b949e]">Mastered Problems</p>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: "rgba(88, 166, 255, 0.15)" }}>
              <Star size={18} style={{ color: "#58a6ff" }} />
            </span>
          </div>
          <p className="my-[8px] font-mono text-[40px] font-bold leading-none text-white max-[1280px]:text-[34px]">
            {topStats.masteredCount}
          </p>
          <p className="text-xs" style={{ color: topStats.masteredCount === 0 ? "#8b949e" : "#3fb950" }}>
            {topStats.masteredCount === 0 ? "none mastered yet" : "all revisions cycle done"}
          </p>
          <Star
            size={72}
            className="pointer-events-none absolute -bottom-2 -right-2 opacity-[0.04]"
            style={{ color: "#58a6ff" }}
          />
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, #58a6ff, transparent)" }}
          />
        </article>
      </div>

      <section
        ref={calendarContainerRef}
        className="hidden w-full flex-col overflow-hidden rounded-2xl border border-[#21262d] bg-[#0d1117] p-4 md:flex md:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-[0.02em] text-white">
            <Flame size={16} className="text-[#58a6ff]" />
            Your Grind Calendar
          </h2>
          <p className="font-mono text-[11px] text-[#8b949e]">Last 52 weeks</p>
        </div>

        <div className="flex w-full flex-1 flex-col overflow-hidden">
          <div className="mb-3 flex items-center" style={{ gap: `${calendarGap}px` }}>
            <span className="block shrink-0" style={{ width: "32px" }} />
            <div className="flex w-full flex-1" style={{ gap: `${calendarGap}px` }}>
              {calendarData.monthLabels.map((label, index) => (
                <span
                  key={`month-${index}`}
                  className="block text-[11px] leading-none text-[#8b949e]"
                  style={{ width: `${cellSize}px` }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex w-full" style={{ gap: `${calendarGap}px` }}>
            <div className="flex shrink-0 flex-col">
              {WEEKDAY_LABELS.map((day) => (
                <span
                  key={day}
                  style={{
                    width: "30px",
                    textAlign: "right",
                    paddingRight: "6px",
                    fontSize: "9px",
                    color: "#8b949e",
                    height: `${cellSize + calendarGap}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  {day}
                </span>
              ))}
            </div>

            <div className="flex w-full flex-1" style={{ gap: `${calendarGap}px` }}>
              {calendarData.weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="flex flex-col" style={{ gap: `${calendarGap}px` }}>
                  {week.map((date) => {
                    const key = toLocalDayKey(date);
                    const entry = calendarData.activityMap.get(key);

                    return (
                      <span
                        key={key}
                        className="group relative"
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                        }}
                      >
                        <span
                          className="block"
                          style={{
                            width: `${cellSize}px`,
                            height: `${cellSize}px`,
                            backgroundColor: getActivityColor(entry),
                            borderRadius: "2px",
                          }}
                        />
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden w-max -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded bg-[#161b22] px-2 py-1 text-[12px] text-white group-hover:block">
                          {getActivityTooltip(date, entry)}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              <span className="font-semibold text-white">{yearlyCalendarStats.submissions} submissions</span>
              <span className="text-[#8b949e]"> in the past one year</span>
            </p>
            <p className="text-[#8b949e]">
              Total active days: {yearlyCalendarStats.activeDays} Max streak: {yearlyCalendarStats.maxStreak}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-[#8b949e]">
            <span>Less</span>
            <span
              className="block"
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                backgroundColor: "#2d333b",
                outline: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "3px",
              }}
            />
            <span
              className="block"
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                backgroundColor: "#0e4429",
                outline: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "3px",
              }}
            />
            <span
              className="block"
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                backgroundColor: "#006d32",
                outline: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "3px",
              }}
            />
            <span
              className="block"
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                backgroundColor: "#26a641",
                outline: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "3px",
              }}
            />
            <span
              className="block"
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                backgroundColor: "#39d353",
                outline: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "3px",
              }}
            />
            <span>More</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#21262d] bg-[rgba(22,27,34,0.8)] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-[0.02em] text-white">
            <Bell size={16} className="text-[#58a6ff]" />
            Today&apos;s Revision Queue
          </h2>
          <p className="font-mono text-xs text-[#8b949e]">{revisionQueue.length} pending</p>
        </div>

        {noProblems ? (
          <div className="rounded-xl border border-dashed border-[#58a6ff]/35 bg-[#58a6ff]/5 p-5 text-center">
            <p className="text-3xl">🚀</p>
            <p className="mt-2 text-lg font-semibold text-cyan-100">Your journey starts here.</p>
            <p className="mt-1 text-sm text-slate-300">Add your first solved problem and let the tracker do the rest.</p>
            <Link
              to="/problems"
              className="mt-4 inline-flex rounded-lg border border-[#58a6ff]/45 bg-[#58a6ff]/15 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-[#58a6ff]/25"
            >
              Add First Problem →
            </Link>
          </div>
        ) : revisionQueue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-emerald-400/35 bg-emerald-500/5 p-5 text-center">
            <p className="text-sm font-medium text-emerald-200">You&apos;re all caught up. Go solve a new problem.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {revisionQueue.map((problem) => {
              const dueDate = new Date(problem.pendingDueRevision.dueDate);
              const overdue = isOverdue(problem.pendingDueRevision.dueDate);
              const daysOverdue = overdue
                ? differenceInCalendarDays(startOfDay(new Date()), startOfDay(dueDate))
                : 0;
              const selected = Number(selectedConfidence[problem.id] ?? problem.confidenceRating ?? 3);
              const revisionLabel = `Day ${problem.pendingDueRevision.day} Revision`;
              const isDueToday = isToday(dueDate);
              const leftAccent = overdue ? "#f85149" : isDueToday ? "#d29922" : "#58a6ff";
              const leetcodeHref = `https://leetcode.com/problemset/all/?search=${encodeURIComponent(
                problem.leetcodeNumber || problem.title,
              )}`;

              return (
                <article
                  key={problem.id}
                  className="rounded-[10px] border bg-[#0d1117] p-4 transition duration-200 hover:bg-[#10161f] hover:border-[#58a6ff]/35"
                  style={{
                    borderColor: activeRevisionCard === problem.id ? "rgba(88,166,255,0.55)" : "#21262d",
                    borderLeft: `3px solid ${leftAccent}`,
                  }}
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

      <section className="rounded-2xl border border-[#21262d] bg-[rgba(22,27,34,0.8)] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-[0.02em] text-white">
            <Check size={16} className="text-[#58a6ff]" />
            Recently Solved
          </h2>
          <p className="font-mono text-xs text-[#8b949e]">Last 5</p>
        </div>

        {recentSolved.length === 0 ? (
          <p className="text-sm text-[#8b949e]">No solved problems yet. Start with one clean implementation today.</p>
        ) : (
          <ul className="divide-y divide-[#21262d] overflow-hidden rounded-xl border border-[#21262d] bg-[#0d1117]">
            {recentSolved.map((problem) => {
              const nextRevision = getNextRevisionDate(problem);
              return (
                <li
                  key={problem.id}
                  className="flex h-10 items-center justify-between gap-3 px-3 text-sm transition duration-200 hover:bg-[rgba(88,166,255,0.04)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">
                      {problem.title}
                      <span className="ml-2 text-[11px] text-[#8b949e]">{problem.topic}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-xs text-slate-200">
                      Next Revision: {nextRevision ? format(new Date(nextRevision), "MMM d, yyyy") : "Completed"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#21262d] bg-[rgba(22,27,34,0.8)] p-4 text-center">
        <p className="font-mono text-sm text-[#8b949e]">{motivationalQuote}</p>
      </section>

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
            event.target.style.textDecoration = 'underline';
          }}
          onMouseLeave={(event) => {
            event.target.style.textDecoration = 'none';
          }}
        >
          Abdur Rahim
        </a>
      </div>
    </section>
  );
}

export default Dashboard;
