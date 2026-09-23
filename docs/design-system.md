# FormPilot interface system

## Scope and constraints

The product is a Manifest V3 side-panel utility: local facts → explicit scan → sourced suggestions → edit/select → explicit fill → per-field results. The optional model proposes field-to-fact mappings; it does not establish truth. The UI must preserve no-submit behavior, sensitive/manual-only exclusions, existing-value protection, document/field revalidation, local-only storage, and explicit model opt-in. No marketing site, remote fonts, remote UI assets, or additional runtime permissions.

## Skill installation and search verification

- Official source: [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). Upstream README and `.claude/skills/ui-ux-pro-max/SKILL.md` were read before installation; upstream and npm package report MIT licensing.
- Installed CLI: **ui-ux-pro-max-cli 2.15.0**. Exact command, run from the FormPilot project root: `npx --yes ui-ux-pro-max-cli@2.15.0 init --ai codex`. No global install, premium product, `--ai all`, or stale `uipro-cli` package.
- This release installs Codex support at **`.agents/skills/ui-ux-pro-max/SKILL.md`**, not `.codex/skills`. The actual installed skill was read. Its `data` and `scripts` entries are real directories, not Windows pointer files. No duplicate install or repair was needed.
- Python **3.11.15** executed the installed `scripts/search.py` successfully using its fully resolved Windows path. From the project root, resolve that path first: `$skillSearch = (Resolve-Path '.agents/skills/ui-ux-pro-max/scripts/search.py').Path`, then `python $skillSearch '<query>' <flags>`.
- The installed Codex template embeds its quick reference/professional rules; it does not ship a separate `references` folder. The embedded guidance was read.
- Skill assets/caches are excluded via this checkout's `.git/info/exclude`. They are not application dependencies or committed assets. A fresh clone needs the local install command above. Normal skill discovery is available on a subsequent Codex turn; this work read and executed the installed skill directly.

| Search query | Flags | Result used / fit decision |
| --- | --- | --- |
| `form assistant productivity accessible` | `--design-system -p FormPilot -f markdown` | Flat Design was relevant; Product Demo + Features landing pattern was not. |
| `browser extension productivity` | same | One narrower retry still returned a landing pattern. No verified extension-layout match; retain the actual three-step product flow as a documented fallback. |
| `error summary validation` | `--domain ux -n 3` | Focusable errors, inline placement, linked descriptions. |
| `focus not obscured` | `--domain ux -n 3` | Keep controls unobscured; avoid fixed overlays for main actions. |
| `loading progress feedback` | `--domain ux -n 3` | Real operation text, busy semantics, stable content; no fabricated percentage. |
| `confirmation destructive action` | `--domain ux -n 3` | Cancellable confirmation for deleting/replacing saved facts. |
| `long label overflow reflow` | `--domain ux -n 3` | Wrap long tokens; do not hide essential text. |
| `form labels keyboard responsive` | `--stack html-tailwind -n 3` | Native HTML semantics, focus-visible, shrinkable/wrapping layout. Actual stack is vanilla TypeScript + CSS; no exact vanilla stack exists in the database. Only framework-neutral HTML advice was used; Tailwind was not added. |

All queries were generic product/UX descriptions, without private code, tokens, or profile data. Recommendations are guidance, not authority. The suggested teal/orange brand change, remote font import, video hero, and native-mobile-only behavior were rejected as inappropriate for this existing extension.

## Tokens

| Role | Value |
| --- | --- |
| Canvas / surface | `#f6f8fc` / `#ffffff` |
| Text / secondary text | `#14233e` / `#516079` |
| Primary / hover / tint | `#2458db` / `#1944ae` / `#edf2ff` |
| Divider / control boundary | `#dce3ef` / `#7d8ca4` |
| Success text / background | `#245b3c` / `#edf7f1` |
| Warning text / background | `#705016` / `#fff7e4` |
| Error text / background | `#a32432` / `#fff0f1` |
| Spacing | 4, 8, 12, 16, 24, 32px |
| Corners | 6px controls; 8px action sections; 12px dialogs |

Typography uses the local Segoe UI/system sans-serif stack. Body/inputs 15px, field labels 14px, source/help text 13px, compact statuses 12px, section headings 17px, main headings 28–32px (25px at very narrow widths). Body line height 1.55. Values retain whitespace; labels/URLs wrap instead of ellipsizing. No remote font requests.

## Structure and states

- **Profile:** contact, background, custom facts, optional local model disclosure, privacy/deletion. One primary Scan action; Save explicitly persists edits. Unsaved state is visible. Invalid email/custom facts retain their values and show inline descriptions. Replace/delete uses native dialog with Cancel autofocus, Escape dismissal, and focus return.
- **Suggestions:** actual scan URL/counts; clear distinction between exact rules, model proposals, absent evidence, existing values, and manual-only fields. No model proposal is preselected. Review is disabled with an explanation when no answers are available.
- **Review:** selected counts, editable answers with attached source descriptions, clear Edited by you labeling, empty-answer blocking, explicit Fill selected, autosave warning beside approval. Deselect never discards the draft answer.
- **Results:** actual filled/skipped counts and row reasons; no claim that a website cannot autosave/submit itself. No automatic retry. Rescan remains explicit.
- **Loading:** visible operation text and `aria-busy`; mutation controls locked during requests. No fake progress or network call on navigation.
- **Errors/empty states:** nearby persistent feedback, announced errors, focus after failure, recovery actions to rescan or edit profile/model setup. No bottom-of-page-only toast.

## Responsive and accessibility rules

At 375px, use a single column with action context above the answer list; retain 16–24px gutters. At 768px and desktop, the actual same panel uses a bounded two-column work area; the action region has 280px width and fields take remaining space. Cap the overall shell at 1120px; two-column profile fields begin at 1000px. At 280px all essential labels still wrap. No sticky action overlay or nested scrolling.

Buttons have at least 44px height, review checkbox labels enlarge the target, and all inputs have visible labels. Text contrast target is 4.5:1; meaningful boundaries/focus 3:1. The 3px focus ring is blue with offset. Status meaning always includes text. Use one contextual live feedback region; preserve current input state and focus intentionally. Native dialogs supply keyboard containment. Reduced-motion disables transitions/animations; forced colors retain state boundaries. Do not claim complete WCAG compliance from automated checks alone.

## Verification contract

Build and existing security/matching tests must pass. Exercise the built native extension in Chromium through profile → scan → edit/deselect → fill/results. Inspect Profile, Suggestions, Review, results, empty, validation, loading, model-setup error, and deletion confirmation. Check 375px, 768px, and 1280px layouts, plus 280px regression. Test keyboard navigation, Escape/cancel, focus visibility, long labels, no horizontal overflow, reduced motion, and at least one real recoverable error. Preserve existing adversarial field-change tests and zero-submission assertions. See the verification report for observed results and limitations.
