const REVISION_DAYS = [1, 7, 30, 60];

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }
  return date;
};

const startOfDay = (dateInput) => {
  const date = toDate(dateInput);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toIsoAtStartOfDay = (dateInput) => startOfDay(dateInput).toISOString();

export const calculateRevisionDates = (solvedDate) => {
  const baseDate = startOfDay(solvedDate);

  return REVISION_DAYS.map((day) => {
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + day);
    return toIsoAtStartOfDay(dueDate);
  });
};

export const isOverdue = (dueDate) => {
  const due = startOfDay(dueDate);
  const today = startOfDay(new Date());
  return due < today;
};

export const getTodaysDueRevisions = (problems = []) => {
  const today = startOfDay(new Date());

  return problems.filter((problem) => {
    const revisions = Array.isArray(problem?.revisions) ? problem.revisions : [];

    return revisions.some((revision) => {
      if (revision?.completedDate) {
        return false;
      }

      const dueDate = startOfDay(revision?.dueDate);
      return dueDate <= today;
    });
  });
};

export const getNextRevisionDate = (problem) => {
  const revisions = Array.isArray(problem?.revisions) ? problem.revisions : [];

  const nextRevision = revisions
    .filter((revision) => !revision?.completedDate)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  return nextRevision?.dueDate ?? null;
};

export const getMasteryStatus = (problem) => {
  const revisions = Array.isArray(problem?.revisions) ? problem.revisions : [];

  if (revisions.length === 0) {
    return 0;
  }

  const completedCount = revisions.filter((revision) => Boolean(revision?.completedDate)).length;
  return Math.round((completedCount / revisions.length) * 100);
};

export { REVISION_DAYS };
