import { calculateRevisionDates, REVISION_DAYS } from "./revisionUtils";

const STORAGE_KEYS = {
  problems: "dsa-revision-tracker:problems",
  settings: "dsa-revision-tracker:settings",
};

const TOPICS = [
  "Arrays",
  "Strings",
  "Hashing",
  "Two Pointers",
  "Sliding Window",
  "Binary Search",
  "Recursion",
  "Linked List",
  "Stack",
  "Queue",
  "Trees",
  "Graphs",
  "Dynamic Programming",
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const STATUSES = ["Unsolved", "Attempted", "Solved", "Mastered"];

const DEFAULT_SETTINGS = {
  dailyRevisionTarget: 3,
  includeOverdueInToday: true,
  showStriverSheetOnly: false,
};

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readFromStorage = (key, fallback) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return fallback;
  }

  return safeParse(window.localStorage.getItem(key), fallback);
};

const writeToStorage = (key, value) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeText = (value, maxLength = Infinity) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maxLength);
};

const ensureValidEnum = (value, allowedValues, fieldName) => {
  if (!allowedValues.includes(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
};

const ensureRating = (rating) => {
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error("confidenceRating must be an integer between 1 and 5");
  }
  return numericRating;
};

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildRevisions = (solvedDate, confidenceRating, revisionsOverride) => {
  if (Array.isArray(revisionsOverride) && revisionsOverride.length > 0) {
    return revisionsOverride.map((revision, index) => ({
      day: revision?.day ?? REVISION_DAYS[index] ?? 60,
      dueDate: revision?.dueDate,
      completedDate: revision?.completedDate ?? null,
      confidence: revision?.confidence ?? confidenceRating,
    }));
  }

  const dueDates = calculateRevisionDates(solvedDate);
  return REVISION_DAYS.map((day, index) => ({
    day,
    dueDate: dueDates[index],
    completedDate: null,
    confidence: confidenceRating,
  }));
};

const normalizeProblem = (problem) => {
  const title = normalizeText(problem?.title);
  if (!title) {
    throw new Error("title is required");
  }

  const topic = normalizeText(problem?.topic);
  ensureValidEnum(topic, TOPICS, "topic");

  const difficulty = normalizeText(problem?.difficulty);
  ensureValidEnum(difficulty, DIFFICULTIES, "difficulty");

  const status = normalizeText(problem?.status || "Unsolved");
  ensureValidEnum(status, STATUSES, "status");

  const confidenceRating = ensureRating(problem?.confidenceRating ?? 3);

  const solvedDate = problem?.solvedDate
    ? new Date(problem.solvedDate).toISOString()
    : new Date().toISOString();

  const leetcodeNumber = normalizeText(problem?.leetcodeNumber);
  const notes = normalizeText(problem?.notes, 300);

  return {
    id: normalizeText(problem?.id) || generateId(),
    title,
    leetcodeNumber,
    topic,
    difficulty,
    solvedDate,
    status,
    confidenceRating,
    notes,
    revisions: buildRevisions(solvedDate, confidenceRating, problem?.revisions),
    striverSheet: Boolean(problem?.striverSheet),
  };
};

export const getProblems = () => {
  const storedProblems = readFromStorage(STORAGE_KEYS.problems, []);
  return Array.isArray(storedProblems) ? storedProblems : [];
};

export const saveProblem = (problem) => {
  const normalizedProblem = normalizeProblem(problem);
  const problems = getProblems();

  if (problems.some((entry) => entry.id === normalizedProblem.id)) {
    throw new Error(`Problem with id ${normalizedProblem.id} already exists`);
  }

  const updatedProblems = [...problems, normalizedProblem];
  writeToStorage(STORAGE_KEYS.problems, updatedProblems);
  return normalizedProblem;
};

export const updateProblem = (id, updates) => {
  const problems = getProblems();
  const targetIndex = problems.findIndex((problem) => problem.id === id);

  if (targetIndex === -1) {
    return null;
  }

  const mergedProblem = {
    ...problems[targetIndex],
    ...updates,
    id,
  };

  const normalizedProblem = normalizeProblem(mergedProblem);
  const updatedProblems = [...problems];
  updatedProblems[targetIndex] = normalizedProblem;

  writeToStorage(STORAGE_KEYS.problems, updatedProblems);
  return normalizedProblem;
};

export const deleteProblem = (id) => {
  const problems = getProblems();
  const updatedProblems = problems.filter((problem) => problem.id !== id);
  const deleted = updatedProblems.length !== problems.length;

  if (deleted) {
    writeToStorage(STORAGE_KEYS.problems, updatedProblems);
  }

  return deleted;
};

export const getSettings = () => {
  const settings = readFromStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
};

export const saveSettings = (settings) => {
  const normalizedSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  };

  writeToStorage(STORAGE_KEYS.settings, normalizedSettings);
  return normalizedSettings;
};

export { DIFFICULTIES, STATUSES, STORAGE_KEYS, TOPICS };
