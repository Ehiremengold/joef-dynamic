// Youngest to oldest. Keep in step with the level checks in
// supabase/migrations/0009_whole_school_records.sql.
export const CLASSES = [
  "KG1", "KG2", "NUR1", "NUR2",
  "BS1", "BS2", "BS3", "BS4", "BS5",
  "JS1", "JS2", "JS3", "SS1", "SS2", "SS3",
] as const;
export type ClassName = (typeof CLASSES)[number];

/** How each level is written out on documents that leave the school. */
export const LEVEL_NAMES: Record<ClassName, string> = {
  KG1: "KG 1", KG2: "KG 2", NUR1: "Nursery 1", NUR2: "Nursery 2",
  BS1: "Basic 1", BS2: "Basic 2", BS3: "Basic 3", BS4: "Basic 4", BS5: "Basic 5",
  JS1: "JSS 1", JS2: "JSS 2", JS3: "JSS 3", SS1: "SSS 1", SS2: "SSS 2", SS3: "SSS 3",
};

export type ExamType = "entrance" | "class";
export type TakerType = "student" | "candidate";
export type StaffRole = "admin" | "teacher";

export type Question = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  position: number;
};

export type Exam = {
  id: string;
  type: ExamType;
  className: ClassName | null;
  title: string;
  durationMins: number;
  active: boolean;
  opensAt: string | null;
  closesAt: string | null;
  createdBy: string | null;
  createdAt: string;
  questions: Question[];
};

/** Exam as sent to test takers — correct answers stripped. */
export type PublicExam = Omit<Exam, "questions"> & {
  questions: Omit<Question, "correctIndex">[];
};

export type Attempt = {
  id: string;
  /** Null once the exam has been deleted — the result itself is kept. */
  examId: string | null;
  examTitle: string;
  examType: ExamType;
  takerType: TakerType;
  studentId: string | null;
  candidateId: string | null;
  takerName: string;
  className: string | null;
  year: string;
  answers: (number | null)[];
  score: number;
  total: number;
  submittedAt: string;
};

/** A sitting that has been started but not yet submitted. */
export type AttemptSession = {
  id: string;
  examId: string;
  studentId: string | null;
  candidateId: string | null;
  takerName: string;
  answers: (number | null)[];
  startedAt: string;
  extraSeconds: number;
  lastSeenAt: string;
};

/** What a taker's browser needs to render (or resume) a test. */
export type SittingState = {
  answers: (number | null)[];
  secondsLeft: number;
};

export type Staff = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
};

export type Student = {
  id: string;
  admissionNumber: string;
  fullName: string;
  className: ClassName;
  classId: string | null;
  entryYear: string;
  gender: "male" | "female" | null;
  dateOfBirth: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
};

export type Candidate = {
  id: string;
  candidateNumber: string;
  fullName: string;
  parentPhone: string | null;
  createdAt: string;
};

/** Session payload carried in the taker (student/candidate) cookie. */
export type TakerSession =
  | { kind: "student"; id: string; name: string; className: ClassName }
  | { kind: "candidate"; id: string; name: string };

export type Department = "science" | "art" | "commercial";

export type Campus = {
  id: string;
  name: string;
  createdAt: string;
};

export type Class = {
  id: string;
  campusId: string;
  campusName?: string;
  level: ClassName;
  arm: string | null;
  classTeacherId: string | null;
  classTeacherName?: string | null;
  createdAt: string;
};

export type Subject = {
  id: string;
  name: string;
  code: string | null;
  department: Department | null;
  createdAt: string;
};

export type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  department?: Department | null;
};

export type StudentSubjectExemption = {
  id: string;
  studentId: string;
  subjectId: string;
};

export type AcademicSession = {
  id: string;
  name: string;
  isCurrent: boolean;
  createdAt: string;
};

export type Term = {
  id: string;
  sessionId: string;
  sessionName?: string;
  name: "First Term" | "Second Term" | "Third Term";
  isCurrent: boolean;
  createdAt: string;
};

export type ClassAttendance = {
  id: string;
  classId: string;
  termId: string;
  totalDays: number;
  updatedBy: string | null;
  updatedAt: string;
};

export type StudentAttendance = {
  id: string;
  studentId: string;
  termId: string;
  daysPresent: number;
  updatedBy: string | null;
  updatedAt: string;
};

/** One student's results for one term, as printed on their report sheet. */
export type ReportSheet = {
  sessionName: string;
  termName: Term["name"];
  /** The class they sat in that term, e.g. "Basic 1 (Ikoyi)". */
  classLabel: string | null;
  studentsInClass: number | null;
  /** Mean of the class's term percentages. */
  classAverage: number | null;
  attendance: { totalDays: number; daysPresent: number } | null;
  nextTermBegins: string | null;
  caMax: number;
  examMax: number;
  /** In the class's report order. A mark never entered is null. */
  subjects: { name: string; ca: number | null; exam: number | null }[];
};
