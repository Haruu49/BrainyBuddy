# Brainy Buddy

**Learn Smarter. Understand Yourself.**

A frontend MVP of an educational platform that helps primary, secondary, college and university students understand their examination behaviour, study habits and learning patterns. It is written in HTML5, CSS3 and vanilla JavaScript, with no framework and no build step.

> **Demo mode.** Sign-in is simulated and every piece of data stays in the browser's `localStorage`. Recommendations come from transparent rules. No AI model or backend is connected yet.

## Run it

Open `index.html` directly in a browser, or serve the folder for the most faithful behaviour:

```bash
cd "Brainy Buddy"
python3 -m http.server 8000
# then open http://localhost:8000
```

Scripts are classic (not ES modules), so the app also works from `file://`. Chart.js 4.4.1 is stored locally in `assets/vendor/`. The Fredoka (headings) and Inter (body) fonts load from Google Fonts and fall back to system fonts when offline.

**Quick start:** on the landing or sign-in page, choose **Open the demo account**. This loads a sample student, *Aisha Rahman*, with realistic demo data. You can also register a new account, which takes you through onboarding.

Demo account: `demo@brainybuddy.app` / `Demo1234`

## Pages

| Page | File |
| --- | --- |
| Landing | `index.html` |
| Sign in / Register / Reset password | `login.html`, `register.html`, `forgot-password.html` |
| Onboarding (5 steps) | `onboarding.html` |
| Dashboard | `app/dashboard.html` |
| My Subjects | `app/subjects.html` |
| Practice Exams (setup, exam, results) | `app/exam.html` |
| Add Past Results (CSV import, PDF placeholder) | `app/upload.html` |
| Exam Patterns (behaviour analytics) | `app/analytics.html` |
| Study Habits | `app/habits.html` |
| Study Planner | `app/planner.html` |
| AI Recommendations (rule-based) | `app/recommendations.html` |
| My Reports (preview and print) | `app/reports.html` |
| Settings | `app/settings.html` |
| Design system (Phase 1 sample page, public) | `app/styleguide.html` |

## Project structure

```
assets/
  css/
    tokens.css        Design tokens: colour, type, spacing, radii, motion; light + dark
    base.css          Reset, typography, focus styles, accessibility helpers
    components.css    Buttons, panels, badges, chips, inputs, alerts, tabs, menus, dialog, toast, insight card…
    layout.css        App shell: sidebar (full / rail / drawer), top bar, page grids
    viz.css           Chart boxes, answer-path arc diagram, exam timeline, heatmap
    pages/*.css       Page-specific styles (landing, auth, exam, habits, upload, planner, reports, settings…)
  js/
    core/             utils, storage, theme, icons, mascot, feedback (toast/dialog/menu), forms, auth, shell, charts, ui
    data/             demo-data (deterministic generator), question-bank, repo (data-access layer)
    lib/              exam-tracker, exam-analytics, study-analytics, academic, recommendation-engine, csv, arc-path
    pages/            One script per page
  img/                favicon.svg, mascot.svg (Buddy)
  vendor/             chart.umd.min.js (Chart.js 4.4.1)
```

Every module attaches to one global namespace, `window.BB`, and is self-contained. Each page loads only the scripts it needs.

## Design decisions

- **Peach and pink palette.** Soft peach `#FFA781` is the brand colour, Buddy is brain pink `#F59AB0`, text is a warm plum `#3B2730` on a blush background `#FFF6F2`, and teal marks written questions and success. All tokens live in `assets/css/tokens.css`. The old `--bb-indigo*` and `--bb-navy` names still exist as aliases that point to the peach and plum values.
- **Colour encodes question type everywhere.** Peach (`#E2652F`) marks objective questions (multiple choice, true/false) and teal marks written ones (short and long answer), on every chart.
- **Accessible colour use.** Primary buttons are peach with dark peach-ink text (7.5:1). Links and peach text use `#B0461C` and checkboxes, switches and chart lines use `#E2652F`, so text meets WCAG AA and controls meet 3:1.
- **Friendly type.** Fredoka, a rounded face, is used for page and section headings and the brand name. Inter stays for body text and numbers, so data stays easy to read.
- **Signature visual: the answer-path arc diagram** (`lib/arc-path.js`). Forward moves arc above the question row and returns to earlier questions arc below it.
- **Buddy, the mascot.** A pink brain, coloured like a real one, with darker pink folds and smart glasses. It's drawn in SVG with four moods (`core/mascot.js`). Buddy breathes, blinks, follows the pointer with its eyes, waves (`BB.mascot.wave`) and hops when clicked (`BB.mascot.bounce`). On the landing, sign-in and register pages Buddy waves and types out "Hi! Get Ready To Brainy!" in a speech bubble, and each click brings a new line (`BB.mascot.interactive`, or `data-mascot-greet="load|view|click"` on a `data-mascot` element). On the sign-in, register and reset pages Buddy also watches the form (`data-mascot-watch`): it walks over to the edge of its panel and reads along through a magnifying glass (which shows the last character you typed) as you type your name or email, and turns away whistling ("I'm not looking, promise!") while you type a password, even when the password is shown. Motion is switched off when the device asks for reduced motion: Buddy stays in place, the face and eyes still turn, and the bubble text appears at once.
- **Responsive layout.** At 1200px and wider there's a full sidebar, which can collapse to a rail. From 768 to 1199px there's an icon rail with tooltips. Below 768px a bottom tab bar (Home, Practise, Study, Planner, More) appears, and "More" opens the full navigation drawer with focus trapping.

## Navigation and interaction

- **Sidebar grouped by what students want to do:** Home, Practise, Study and Understand. Pages use plain names, for example *Practice Exams*, *Add Past Results* and *Exam Patterns*.
- **"Jump to" search.** Use the search button in the top bar, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>, or <kbd>/</kbd> to open a list of every page and the quick actions (start an exam, start a study session, add a task, import results, switch theme, sign out). It uses the ARIA combobox and listbox pattern with arrow-key navigation. It's turned off while an exam is in progress.
- **Dashboard start-here area:**
  - a greeting panel where Buddy gives nudges drawn from your own data (next planned task, upcoming exam, top recommendation, streak); tap Buddy or "Another nudge" to see the next one
  - a ring for today's study goal (weekly goal ÷ 7) with a study streak
  - four "What would you like to do?" tiles, which change to "Resume your exam" or "Back to your session" when something is in progress
- **Buddy's tip card** in the sidebar gives tips for the current page. Choose "Another tip" to see the next one.
- **Small celebrations:**
  - metric numbers count up when the dashboard and exam results first load
  - confetti appears when you score 70% or more on an exam, complete a planner task, or reach today's goal (once per day)
  - all of these respect reduced-motion settings
- `planner.html#new-task` opens the new-task form directly.
- **Light and dark themes**, plus a "match my device" option. Charts re-draw in the right colours when the theme changes.

## Behaviour tracking (Examination Simulator)

`lib/exam-tracker.js` records:

- start time and when each question was first viewed
- the navigation order and time spent on each question
- answer selections and changes
- skipped and revisited questions
- flags and submission time

The timing rules are:

- **Only one question timer runs at a time.** Switching questions always closes the previous visit before opening the next one, so times can't overlap.
- **Hidden-tab time is excluded.** Time while the tab is hidden isn't counted toward any question.
- **Refresh recovery.** Answers autosave. After a refresh, the open visit is closed at the last autosave time, so time while the page was closed is never attributed to a question.

Unit-tested with a fake clock: the sum of active times equals wall time minus hidden and closed time.

## Analytics definitions

- **Accuracy** = correct ÷ answered. A written answer counts as correct when it earns at least half its marks.
- **Time management score (0–100), weighted by marks:**
  - 40% completion: the share of marks attempted.
  - 40% pacing: the share of marks on questions finished within their time budget, where budget = allowed time × that question's share of marks.
  - 20% ending buffer: the share of answers given before the final 10% of the allowed time.
- **Best study time.** Each practice result is compared with the student's own average for the same subject *and* difficulty, then grouped by part of the day:
  - A period needs at least 6 results before it can be compared.
  - A result is "supported" only when both compared periods have 12+ results and differ by 5+ points. Otherwise it's "preliminary" or "insufficient data".
  - Longer sessions are never assumed to be better.
- **Insights describe patterns, not reasons.** No answering order is treated as right or wrong.

## Ready for backend integration

| Swap this | For |
| --- | --- |
| `BB.auth.provider` (`core/auth.js`) | A real provider such as Supabase Auth, using the same methods (`register`, `signIn`, `signOut`, `currentUser`, `updateUser`, `changePassword`, `requestPasswordReset`, `deleteAccount`) |
| `BB.repo` (`data/repo.js`) | API calls returning the same shapes. Pages never touch storage directly |
| `BB.recommend.generate` | A model or service returning `{ id, title, category, pattern, evidence[], confidence, action, target, progress, rule }` |
| PDF tab on Upload Records | Document processing that outputs rows in the CSV record format |
| Planner reminders | Push or email notifications (preferences are already saved in Settings) |

The exam attempt shape is identical for demo and simulator data (see `toAttempt()` in `lib/exam-tracker.js`), which makes it a good starting point for a database schema.

## Quality checks performed

These were automated with headless Chromium:

- every page at 1366px, 900px and 390px, in light and dark themes
- no console errors, failed requests or broken internal links
- no horizontal page overflow at 360px, 390px or 768px
- no unlabelled form controls or unnamed buttons, no duplicate IDs, one `h1` per page, no skipped heading levels
- end-to-end flows:
  - registration and onboarding validation
  - login errors and the auth guard
  - the exam, including a mid-exam reload and resume
  - CSV import with error correction and duplicate detection
  - the study tracker, including persistence across a refresh
  - planner create, edit, complete and delete
  - recommendation status changes
  - settings, including a password change
  - the print layout (exported to PDF)
  - keyboard checks: skip link, drawer focus, arrow-key answers

## Known limitations

- Demo data only: nothing syncs between browsers or devices.
- Long answers get an **estimated** mark from keyword coverage. The UI labels this clearly.
- PDF import and real notifications are placeholders until the backend exists.
