export const CLASSES = ["JS1", "JS2", "JS3", "SS1", "SS2", "SS3"] as const;
export type ClassName = (typeof CLASSES)[number];

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
  examId: string;
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
