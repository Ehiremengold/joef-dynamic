// The words of every guided tour in the portal, in one place so they can be
// reworded without touching the pages. Each `target` matches a
// data-tour="…" attribute on the page; see components/portal/GuideTour.tsx.
// Steps whose target isn't on screen (a tab someone can't see, an empty
// list) are skipped, so one tour serves teachers and admins alike.
//
// House style: short sentences, no em dashes.
import type { TourStep } from "@/components/portal/GuideTour";
import { isAdmin, isSuperAdmin } from "./roles";
import type { StaffRole } from "./types";

// ------------------------------------------------------------------
// Public pages
// ------------------------------------------------------------------

export const PORTAL_HOME_TOUR: TourStep[] = [
  {
    title: "Welcome to the JDC Portal",
    text: "Tests, results and school records for Joef Dynamic College all live here. There are three areas: one for children applying to join, one for current students and one for staff. This short tour shows you which one is yours.",
  },
  {
    target: "area-entrance",
    title: "Common Entrance, for new applicants",
    text: "Parents and children applying to the school start here. No account is needed. Type the child's name and a parent's phone number, enter the access code the school gives you on test day, and the entrance test begins.",
  },
  {
    target: "area-cbt",
    title: "Student CBT & Results, for current students",
    text: "Students sign in with their admission number (e.g. JDCL-00123) and the 6-digit PIN from the school. Here they sit the class tests their teachers open and see every score they've got.",
  },
  {
    target: "area-staff",
    title: "Staff Section, for teachers and admins",
    text: "Teachers and administrators sign in with their school email and password. This is where exams are set, results are checked, attendance and report cards are filled in, and students are promoted at the end of a session.",
  },
  {
    title: "Need this again?",
    text: "Every page has a “How this page works” button at the top, and every staff tab has a “How this tab works” button. Press one any time to replay its tour.",
  },
];

export const ENTRANCE_TOUR: TourStep[] = [
  {
    title: "Taking the Common Entrance Test",
    text: "This page is for children applying to join the school. It takes about a minute to register, then the test starts straight away on this device.",
  },
  {
    target: "entrance-name",
    title: "The candidate's name",
    text: "Type the child's full name exactly as it should appear on their result.",
  },
  {
    target: "entrance-phone",
    title: "A parent's phone number",
    text: "The school uses this to contact you about the result.",
  },
  {
    target: "entrance-code",
    title: "The access code",
    text: "The school gives you this code on test day. Without it the test will not open.",
  },
  {
    target: "entrance-submit",
    title: "Register & continue",
    text: "You'll be given a candidate number, so write it down. Then choose the test and press Start. A timer runs at the top of the screen and answers save as you go. Press “Submit test” when you are done to see the score.",
  },
];

export const STUDENT_SIGNIN_TOUR: TourStep[] = [
  {
    title: "Student sign in",
    text: "This is the student area for class tests and results. You need two things from the school: your admission number and your PIN.",
  },
  {
    target: "student-admission",
    title: "Your admission number",
    text: "It looks like JDCL-00123. You'll find it on your PIN slip or report card.",
  },
  {
    target: "student-pin",
    title: "Your PIN",
    text: "A 6-digit secret number. Don't share it. If you've forgotten it, ask your class teacher or the school office. Staff can give you a new one in seconds.",
  },
  {
    target: "student-signin",
    title: "Sign in",
    text: "Once you're in, you'll see the tests open for your class and all your past results.",
  },
];

export const STUDENT_AREA_TOUR: TourStep[] = [
  {
    target: "student-tabs",
    title: "Two things you can do",
    text: "“Take a test” shows the tests your teachers have opened for your class. “My results” lists every test you've taken with your score.",
  },
  {
    target: "student-test-picker",
    title: "Choose a test",
    text: "Pick a test from the list. It shows how many questions it has and how many minutes you get. Then press Start test.",
  },
  {
    title: "While you're in a test",
    text: "The clock in the top corner counts down. When it reaches zero your test is submitted automatically. Every answer saves as you go, so if the power or network goes, sign in again and you'll carry on where you stopped. Press “Submit test” at the bottom when you have finished.",
  },
  {
    target: "student-signout",
    title: "Sign out when you're done",
    text: "Always sign out on a shared computer so nobody else can take a test as you.",
  },
];

export const STAFF_SIGNIN_TOUR: TourStep[] = [
  {
    title: "Staff sign in",
    text: "Teachers and administrators sign in here with their school email and password. Accounts are created by an administrator. There is no sign-up form.",
  },
  {
    target: "staff-email",
    title: "Your school email",
    text: "Use the email the administrator set up your account with.",
  },
  {
    target: "staff-password",
    title: "Your password",
    text: "Forgotten it? Ask an administrator. They can set a new temporary password for you from Staff accounts.",
  },
];

// ------------------------------------------------------------------
// Staff dashboard: the tabs at a glance
// ------------------------------------------------------------------

/** The staff dashboard tour; what it says depends on what the viewer can do. */
export function staffDashboardTour(role: StaffRole): TourStep[] {
  const admin = isAdmin(role);
  return [
    {
      title: admin ? "Your staff dashboard" : "Your teacher dashboard",
      text: admin
        ? "As an administrator you can run the whole portal. Each tab at the top is one job. This tour shows what each one is for. Inside every tab, the “How this tab works” button walks you through its buttons in detail."
        : "This is where you set tests, check results and look after your class. Each tab at the top is one job. Inside every tab, the “How this tab works” button walks you through it in detail.",
    },
    {
      target: "current-term",
      title: "The current term",
      text: admin
        ? "Attendance, report cards and results open on this term for everyone. Press “Change” to go to Sessions & terms."
        : "Attendance, report cards and results open on this term. An administrator moves it on at the start of each term.",
    },
    {
      target: "tab-exams",
      title: "Exams & questions",
      text: "Create class tests and entrance tests, add the questions, then open a test so students can sit it. You can watch who is sitting it, give extra time and download the results.",
    },
    {
      target: "tab-results",
      title: "Results",
      text: "Every score from every test in one list, with filters, answer slips and transcripts.",
    },
    {
      target: "tab-students",
      title: "Students",
      text: "The student roster: add students, put them in classes, reset PINs and download transcripts.",
    },
    {
      target: "tab-classes",
      title: "Classes",
      text: "Campuses, classes and arms, each class's class teacher, and the subjects each class takes. A teacher only gets Attendance, Report cards and Promotion for classes they are class teacher of, so assign them here.",
    },
    {
      target: "tab-sessions",
      title: "Sessions & terms",
      text: "The school calendar: sessions, their terms, which term is current, and the “next term begins” date on report sheets.",
    },
    {
      target: "tab-attendance",
      title: "Attendance",
      text: "Each term's total school days and how many days each student was present. These print on the report card.",
    },
    {
      target: "tab-reports",
      title: "Report cards",
      text: "Class teachers rate each student's effective areas and write a comment for the term.",
    },
    {
      target: "tab-promotion",
      title: "Promotion",
      text: "At the end of a session, move a class up to the next class in one go. Any move can be undone.",
    },
    {
      target: "tab-team",
      title: "Staff accounts",
      text: "Add teachers and admins, change roles, fix names and turn accounts off when someone leaves.",
    },
    {
      target: "staff-signout",
      title: "Sign out",
      text: "Sign out when you're finished, especially on a shared school computer.",
    },
  ];
}

// ------------------------------------------------------------------
// One tour per staff tab, from its "How this tab works" button
// ------------------------------------------------------------------

function examsTour(role: StaffRole): TourStep[] {
  const admin = isAdmin(role);
  return [
    {
      title: "Exams & questions",
      text: admin
        ? "Everything about tests happens here. You can add to anyone's exam. Deleting an exam or a question someone else made goes to a super admin for approval."
        : "Everything about tests happens here. You fully control the exams you create. Other teachers' exams are view only, but you can still download their results.",
    },
    {
      target: "exams-entrance",
      title: "Entrance access code",
      text: "Applicants need this code to start the common entrance test. Type a code and press Save code ahead of time. On test day press Activate (release) so candidates can register, and press Deactivate (revoke) when the exam is over.",
    },
    {
      target: "exams-approvals",
      title: "Deletion requests",
      text: isSuperAdmin(role)
        ? "Requests to delete someone else's exam or question wait here with the reason given. Approve deletes it straight away. Reject keeps it."
        : "Your requests to delete someone else's exam or question, and what a super admin decided.",
    },
    {
      target: "exams-new",
      title: "Create an exam",
      text: "Give it a title (e.g. First Term Mathematics), choose Class test for a class or Common entrance for applicants, pick the class and how many minutes students get. New exams start hidden, so students can't see them until you're ready.",
    },
    {
      unless: "exams-list",
      title: "Your exams will appear here",
      text: "Each exam you create gets a card with: an Open/Hidden switch, Questions (paste a whole set from Word or add one at a time), Sittings (who is taking it now, extra time, retakes), Download results and Delete. Create one, then press “How this tab works” again to see each button.",
    },
    {
      target: "exams-list",
      title: "All exams",
      text: "Every exam, newest first. The badge shows the class (or Entrance), with the number of questions and the time allowed.",
    },
    {
      target: "exam-open",
      title: "Open or hidden",
      text: "Tick this to open the test to students. Untick it to hide it again. Only open a test once its questions are ready.",
    },
    {
      target: "exam-questions",
      title: "Questions",
      text: "Opens the question list. Choose “Paste questions” to paste a whole set from Word at once: end every question with an “Answer: B” line, check the preview, then press Add. Or choose “Add one question” and tick the correct option. The correct answer shows in green, and each question has Edit and Remove.",
    },
    {
      target: "exam-sittings",
      title: "Sittings",
      text: "Who is taking the test right now, with their time left and how many they've answered. If someone lost time to a power cut, give them +5 or +10 minutes. Below that is everyone who has finished, with their score. The exam's owner can press “Allow retake”, which deletes that score so the student can sit it again.",
    },
    {
      target: "exam-download",
      title: "Download results",
      text: "A PDF of everyone's scores for this exam, ready to print.",
    },
    {
      target: "exam-delete",
      title: admin ? "Delete or request deletion" : "Delete",
      text: "Deletes the exam and its questions. Results students already got are kept. On an exam that isn't yours this becomes “Request deletion” and a super admin decides.",
    },
    {
      target: "exam-viewonly",
      title: "View only",
      text: "This exam belongs to another teacher. You can look at its questions and download results, but not change it.",
    },
  ];
}

function resultsTour(role: StaffRole): TourStep[] {
  return [
    {
      target: "results-filters",
      title: "Find results",
      text: "Search a student's or candidate's name, or narrow the list by class, year and type (class test or common entrance). The list updates as you type.",
    },
    {
      target: "results-table",
      title: "Every score",
      text: "Each row is one test someone sat: the test, their class, the year, the score and percentage, and when they submitted. Use the page numbers below the table to see more.",
    },
    {
      target: "results-slip",
      title: "Slip",
      text: "A PDF of this one attempt with the student's score, ready to print or send to a parent.",
    },
    {
      target: "results-transcript",
      title: "Transcript",
      text: "A PDF of all the student's results across terms and sessions.",
    },
    ...(isSuperAdmin(role)
      ? [
          {
            title: "Deleting a result",
            text: "A result can only be deleted once its exam has been deleted, and only by a super admin. To clear a single score instead, use “Allow retake” under the exam's Sittings.",
          },
        ]
      : []),
  ];
}

const STUDENTS_TOUR: TourStep[] = [
  {
    target: "students-add",
    title: "Add a student",
    text: "Enter the admission number, full name, class level and entry year, then press Add student. A 6-digit PIN is made for them and shown once at the top of the roster. Write it down and give it to the student with their admission number.",
  },
  {
    target: "students-search",
    title: "Find students",
    text: "Search by name, then narrow the list. Campus and Class: choose a campus to pick one of its classes and arms (e.g. Obalende · JS2A), or leave the campus open to see a level on every campus. Status: active students, or those who have left. Entry year: the year they joined. Had results in: students with marks recorded in that session, or one term of it. The count shows how many match, and “Clear filters” starts again.",
  },
  {
    target: "students-table",
    title: "The roster",
    text: "Admission number, name, class, entry year and whether the student is active.",
  },
  {
    target: "student-class",
    title: "Put a student in a class",
    text: "Choose the exact class and arm (e.g. Obalende · JS1A). This puts them on that class's attendance, report card and promotion lists.",
  },
  {
    target: "student-pin",
    title: "Reset PIN",
    text: "For a student who forgot their PIN. The old one stops working and the new one is shown to you once.",
  },
  {
    target: "student-active",
    title: "Deactivate",
    text: "For a student who has left. They can no longer sign in and drop off class lists, but their results are kept. Reactivate brings them back.",
  },
  {
    target: "student-subjects",
    title: "Subjects",
    text: "Untick any of their class's subjects this student doesn't take, so it is left off their report card. Put them in a class first.",
  },
  {
    target: "student-transcript",
    title: "Transcript",
    text: "A PDF of all the student's results.",
  },
];

const CLASSES_TOUR: TourStep[] = [
  {
    target: "classes-campuses",
    title: "Campuses",
    text: "The school's campuses (Ikoyi, Obalende). Add one with the box below the list. Removing a campus removes its classes too.",
  },
  {
    target: "classes-subjects",
    title: "Subject catalog",
    text: "Every subject the school teaches. Senior subjects can be tagged Science, Art or Commercial. Add a subject here first, then give it to the classes that take it.",
  },
  {
    target: "classes-add",
    title: "Add a class",
    text: "Choose the campus and level, and type an arm if the level has more than one (e.g. A, B, Gold). Leave the arm empty for a single class.",
  },
  {
    target: "class-teacher",
    title: "Class teacher",
    text: "Choose who looks after this class. That teacher can then fill in its attendance, write its report cards and promote it.",
  },
  {
    target: "class-subjects",
    title: "The class's subjects",
    text: "Opens the subjects this class takes. Pick one from “Add a subject” to add it, or press × to take one off. A subject added here prints on the report sheet after the class's existing subjects.",
  },
  {
    target: "class-remove",
    title: "Remove a class",
    text: "Students in it keep their level but are no longer linked to a class. Their past results are kept.",
  },
];

const SESSIONS_TOUR: TourStep[] = [
  {
    title: "The school calendar",
    text: "At the start of each new session, add the session, add its terms, then make First Term current. At the start of every later term, make that term current.",
  },
  {
    target: "sessions-current",
    title: "Where the portal is",
    text: "The current term. Attendance, report cards and results open on it for everyone, and it shows at the top of every staff page.",
  },
  {
    target: "sessions-add",
    title: "Add a session",
    text: "The next session's name is suggested for you (e.g. 2027/2028). Press the button to add it.",
  },
  {
    target: "sessions-add-term",
    title: "Add a term",
    text: "Each session shows its three terms. A term not created yet has an Add button.",
  },
  {
    target: "sessions-date",
    title: "Next term begins",
    text: "The date printed at the bottom of this term's report sheets. Pick it and click away to save.",
  },
  {
    target: "sessions-make-current",
    title: "Make current",
    text: "Moves the whole portal on to this term. Its session becomes the current session too.",
  },
];

function attendanceTour(role: StaffRole): TourStep[] {
  return [
    {
      title: "Attendance",
      text: isAdmin(role)
        ? "Enter attendance for any class. The numbers print on each student's report card for the term."
        : "Enter attendance for the classes you are class teacher of. The numbers print on each student's report card for the term.",
    },
    {
      target: "att-term",
      title: "Term",
      text: "Opens on the current term. Choose an earlier term to correct it.",
    },
    {
      target: "att-class",
      title: "Class",
      text: "The class you are entering attendance for.",
    },
    {
      target: "att-total",
      title: "Total school days",
      text: "How many days the school opened this term. Enter this first, because nobody's days present can go above it.",
    },
    {
      target: "att-table",
      title: "Days present",
      text: "How many days each student came to school.",
    },
    {
      target: "att-save",
      title: "Save attendance",
      text: "Saves the whole class at once. Nothing is saved until you press it.",
    },
  ];
}

const REPORTS_TOUR: TourStep[] = [
  {
    title: "Report cards",
    text: "The class teacher's part of each report sheet. The marks and the principal's comment come from the results by themselves. Only the class's own class teacher can write here. Anyone else can read.",
  },
  {
    target: "rc-term",
    title: "Term",
    text: "Opens on the current term.",
  },
  {
    target: "rc-class",
    title: "Class",
    text: "The class whose reports you are writing.",
  },
  {
    target: "rc-list",
    title: "Students",
    text: "Pick a student to open their report. A green tick means every rating and the comment are done.",
  },
  {
    unless: "rc-ratings",
    title: "Writing a report",
    text: "Once you pick a student, rate each effective area (such as Punctuality and Neatness) as Excellent, Very Good or Good, write a short comment, and press Save report. The comment prints with your name on the report sheet.",
  },
  {
    target: "rc-ratings",
    title: "Effective areas",
    text: "Rate each area, such as Punctuality and Neatness, as Excellent, Very Good or Good.",
  },
  {
    target: "rc-comment",
    title: "Teacher's comment",
    text: "A short comment about the student's term. It prints with your name on the report sheet.",
  },
  {
    target: "rc-save",
    title: "Save report",
    text: "Saves this student's report. Then pick the next student from the list.",
  },
];

export const PROMOTION_TOUR: TourStep[] = [
  {
    title: "Promoting a class",
    text: "Do this once a year, after the Third Term results, attendance and report cards are finished. Past results are kept, and old report sheets still show the class the student was in that term.",
  },
  {
    target: "promo-session",
    title: "1. The new session",
    text: "The session your students are moving into, e.g. 2026/2027. It's chosen for you: during Third Term it's the next session, and once a new session has started it's that session.",
  },
  {
    target: "promo-class",
    title: "2. The class you're promoting",
    text: "Teachers see the classes they are class teacher of. Admins see every class.",
  },
  {
    target: "promo-target",
    title: "3. Where they go",
    text: "The next class on the same campus is picked for you (JS1 A to JS2 A, BS5 to JS1). Change it if the whole class is moving somewhere else.",
  },
  {
    target: "promo-table",
    title: "4. Check each student",
    text: "Everyone is set to Promote. Change a student to Repeat to keep them in this class, choose a different class for a student changing campus or arm, or choose “Not now” to decide later. Students who joined in the new session start on “Not now” because they are already in the right class. SS3 students are set to Graduate, which marks them as having left.",
  },
  {
    target: "promo-submit",
    title: "5. Promote",
    text: "Press the button and confirm. Everyone moves together. If anything goes wrong, nobody is moved.",
  },
  {
    target: "promo-done",
    title: "Made a mistake?",
    text: "Students you've already moved are listed here. Press Undo to put a student back in this class.",
  },
];

function teamTour(role: StaffRole): TourStep[] {
  return [
    {
      target: "team-add",
      title: "Add a staff member",
      text: "Enter their full name, school email, a temporary password (at least 8 characters) and their role. Give them the password privately. They can change it later.",
    },
    {
      title: "Roles",
      text: isSuperAdmin(role)
        ? "Teachers set their own exams and look after their class. Administrators also run students, classes, sessions and accounts. Super admins can do everything, approve deletions and decide who else is a super admin."
        : "Teachers set their own exams and look after their class. Administrators also run students, classes, sessions and accounts. Only a super admin can make or change a super admin.",
    },
    {
      target: "team-search",
      title: "Find someone",
      text: "Search by name or email.",
    },
    {
      target: "team-table",
      title: "Every account",
      text: "Everyone who can sign in, with their role and whether the account is active. The newest accounts are on the last page.",
    },
    {
      target: "team-role",
      title: "Change a role",
      text: "Pick a new role and confirm. Nobody can change their own role.",
    },
    {
      target: "team-rename",
      title: "Edit name",
      text: "Fix a misspelt name. Report cards they sign from now on use the new name. Ones already signed keep the name they were signed with.",
    },
    {
      target: "team-active",
      title: "Deactivate",
      text: "For someone who has left. They can no longer sign in, but their exams and reports are kept. Reactivate turns the account back on.",
    },
  ];
}

export type StaffTab =
  | "exams"
  | "results"
  | "students"
  | "classes"
  | "sessions"
  | "attendance"
  | "reports"
  | "promotion"
  | "team";

/** The "How this tab works" tour for each staff tab. */
export function staffTabTour(tab: StaffTab, role: StaffRole): TourStep[] {
  switch (tab) {
    case "exams":
      return examsTour(role);
    case "results":
      return resultsTour(role);
    case "students":
      return STUDENTS_TOUR;
    case "classes":
      return CLASSES_TOUR;
    case "sessions":
      return SESSIONS_TOUR;
    case "attendance":
      return attendanceTour(role);
    case "reports":
      return REPORTS_TOUR;
    case "promotion":
      return PROMOTION_TOUR;
    case "team":
      return teamTour(role);
  }
}
