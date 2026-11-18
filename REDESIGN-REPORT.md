# Existing-app redesign ? release checks, 19 November 2026

Specification: codex_daily_english_redesign_spec.md and english_redesign_prototype-1.html supplied on 19 November 2026.

## Implementation

This branch uses the real production app based on commit 448fe16e34ef803af537742e08bf3700cd752503. The temporary preview storage adapter has been removed from the application's entry point. Production storage-service.js, account-ui.js, github-config.js, Empower vocabulary, source vocabulary and PDF parser files are retained unchanged. There is no demo curriculum or demo progress in the application.

The real calendar is a permanent section immediately below the header. Selecting a date displays its existing assignmentForDay/tasksForDate/renderTask output with date-bound completion controls. First opening shows today's actual date, without deleting saved calendar preferences. Calendar browsing and vocabulary use the same active date. Sunday, reserve and checkpoint states retain their original meaning.

Five primary tabs replace the competing navigation. Desktop uses a sidebar; mobile uses a five-item safe-area bottom bar. Existing skill views are reached from Practice. The real Grammar exercise is moved into Practice. Weekly plan, stages, diagnostics, results, error log, Speaking/Writing review and roadmap are accessible under Progress; course notes and unit dates remain in Tutorial. Existing vocabulary workflows are retained.

The palette and layout follow the supplied reference: dark blue surfaces, subtle indigo accents, rounded cards and consistent outline icons. The large brand label is removed; header date, streak and profile remain real app controls. Two direct British Council B1?B2 links are provided beneath the plan and in Practice.

A small existing save bug was corrected: Object.assign(data, latest, data) mutated its own source and could undo mode changes. It now uses a snapshot merge. Storage schema and keys are unchanged. A UI lifecycle hook clears relocated previous-generation elements before the original renderer rebinds form handlers, preventing duplicate IDs and stale handlers.

## Checks actually performed

- Expanded calendar remains visible after selecting a date, checking a task and refreshing.
- Unit 4 on 23 November uses the original lesson and textbook references; completion survives reload and re-selection.
- Five main sections and original Reading, Listening, Writing and Speaking views open.
- A personal vocabulary card with English explanation/Russian translation saves and survives refresh.
- Oxford PDF input, import controls, Cambridge links and word bank remain in the real vocabulary section.
- Unit date form submits; saved Unit 4 start is 23 November.
- Error-log entry and Weekly Test result form save through the original handlers.
- Diagnostic opens and its Later action closes it.
- B2/IELTS mode changes persist, and calendar remains accessible.
- Date picker, calendar date button, next month, Today shortcut and Sunday state checked.
- No duplicate HTML IDs or browser runtime errors in exercised flows.
- Desktop and mobile widths 360, 390, 412 and 1280 px checked for page overflow; desktop screenshot captured at 1440 px.
- Storage, auth, vocabulary source/config files compare byte-for-byte with the working baseline. Textbook assignments, intervals and word-selection algorithms were not replaced.

Screenshots are outside the deployment folder: outputs/redesign-desktop.png and outputs/redesign-mobile.png. Screenshots/tests use isolated sample completion and vocabulary records, not personal cloud data. All lesson text and calendar dates shown are real app assignments.

## Limits

The live personal account was not opened or modified by browser tests. Full Oxford PDF import and every possible exam answer/timer combination were not retested; their existing implementations and bundled parser are retained. These checks do not justify a claim that every possible browser/network scenario is bug-free.

The branch retains real account/cloud functionality. Opening a local copy is a different browser origin: local production progress appears after signing in/synchronizing, or importing a private progress export. The working Pages URL and its existing stored progress have not been changed.

## Deployment

The user authorized publication after retaining the old version and ten verification rounds. The workflow has an explicit main-only guard. New redesign assets are included in service-worker cache daily-english-redesign-v2. The previous production version is retained as tag stable-before-redesign-2026-11-19 (448fe16e34ef803af537742e08bf3700cd752503) and as a local source archive in outputs/versions/stable-before-redesign-2026-11-19/source.zip. Restoring code must not restore or clear personal progress.

## Ten verification rounds

Every round compared the entire existing assignment table, calendar, schedule migration and original vocabulary/auth/storage/PDF files with the working baseline. Each also checked old completion marks, SRS stage/due date, duplicate IDs and runtime errors using isolated test data.

1. Five real sections, chosen-date plan, task checkbox and refresh: PASS.
2. Expanded calendar and page overflow at 320, 360, 390, 412, 768, 900, 901, 1280 and 1440 px: PASS.
3. Added vocabulary survives reload; old review word and due date remain: PASS.
4. Profile dialog, diagnostics and Later control: PASS.
5. B2/IELTS plan isolation and original Reading/Listening/Writing/Speaking views: PASS.
6. Five Sunday dates with no tasks, Unit 12, twelve-unit calendar ending with February review: PASS.
7. Textbook date form and error-log form after UI regeneration: PASS.
8. Cambridge links, Oxford PDF controls, British Council links and keyboard focus: PASS.
9. Coloured SVG flame, reduced-motion setting and desktop screenshot: PASS.
10. Installed PWA cache and offline reload retain completion and review words: PASS.

Corrections made before verification: streak styles previously targeted the level on the wrapper although it is stored on the inner number; the new coloured flame uses the actual level. Remaining light exercise surfaces were aligned with the dark palette. Diagnostic overlays were raised above mobile navigation. Focus outlines, restrained transitions and reduced-motion handling were added.

Additional release test served the old production version and then the redesign at exactly the same local origin, installed the updated service worker and reloaded twice: completion marks, streak, vocabulary/SRS and writing draft were identical before and after. Existing cloud error/restore regression tests passed against the byte-identical storage implementation.

These checks verify preservation of existing material, not a new verification of every textbook exercise against photographs. Unavailable Unit 11 pages 111?117 remain excluded. The existing plan contains some estimates below 90 minutes (for example Unit 1 Thursday: 80?100); these were not inflated or replaced with invented exercises. Full Oxford PDF ingestion and a real personal-cloud login were not exercised during this release.
