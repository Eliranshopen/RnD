# Sandbox worker: run the portal's build jobs in Vercel Sandbox, not on the laptop
<!-- filed: 2026-11-04 · session rnd-9d · state: BUILT + PROVEN for the trace stage (2026-11-05, fork E): the dispatcher runs on a PREVIEW deploy and boots a sandbox per job; nothing is in production (Eliran's own deploy go) · code + evidence: worktree .wt/sandbox-worker (branch sandbox-worker) -->

## The ask
Eliran, 2026-11-04: "שרת העבודה ירוץ ב-VERCEL", "אני רוצה את זה מוכן"; 2026-11-05: "אתה יכול להמשיך עם הכל". The portal at `habait-flow.vercel.app/studio/` queues build jobs (job.v1 contract: `Habait/studio-web/CLAUDE.md`). Until 2026-11-05 the executor `run-job.mjs` + `run-project.mjs` (branch `project-runner`) ran only on the laptop, by hand — Eliran's own project (`pmw25zqqf4bb478`) sat in the queue until a human ran it.

## 0. As built (2026-11-05, fork E) — what exists and what is proven
| Piece | File (worktree `.wt/sandbox-worker`) | State |
|---|---|---|
| Dispatcher | `Habait/studio-web/api/_dispatch.mjs` — `dispatch(job, path, {stage, store, Sandbox?})`, `needsDispatch`, `stageOf`, `stopFinished`, `sandboxEnv`, `jobCommand`, `STAGES` | **built, proven on a preview deploy** |
| Trigger | `Habait/studio-web/api/studio-projects.mjs` — after `enqueue` in POST build (stage `trace`), POST approveTrace (stage `build`) and POST traceCorrection (stage `trace`); GET `?id` re-dispatches a `queued` job whose sandbox never started or is over, and stops a finished job's idle VM | built; **build trigger proven**, approve/correction triggers coded, not run |
| Executor in the VM | `Habait/tour360/tools/run-job.mjs` — the watchdog (`HABAIT_JOB_DEADLINE_MS`: 3 min before the session cap the job goes back to `queued`, attempt+1, pointer re-added, exit 75) and the sandbox record closed on the job (`sandbox.ended`, `minutes`) | built; watchdog not exercised (no job ran long enough) |
| Snapshot + CLI | `Habait/tour360/tools/sandbox-worker/worker.mjs` — `build-snapshot [--go] [--with-blender]`, `dispatch`, `status`, `vm-log`, `stop`, `test-job` | built; snapshot proven 3× (31–37 s each) |
| Snapshot id | Blob `studio/worker/snapshot.json` (`snap_DXWv2R1bYGj8Q9ItGqBhsfg3UkQc`, key `e3df3be+…+py5`, 147 files / 5.4 MB, no Blender) | live in the store |
| Deploy stage | `scratchpad/deploy-E-1` (stage_flow.py `--edit-api --studio --studio-src <worktree>`; `functions["api/studio-projects.mjs"].maxDuration = 60` added to `stage_flow.py`); preview `habait-flow-omt28skwt-eliran-5390.vercel.app` | **preview deployed**, production NOT |
| Evidence | `Habait/tour360/tools/sandbox-worker/evidence/2026-11-05-snapshot/` — `snapshot.json`, `test-job*-status.json`, `test-job*-vmlog*.txt`, `preview-trigger-response.json`, `preview-trigger-job-card.png`, `preview-trigger-e2e.log`, `preview-job-status.json`, the two proof scripts | on disk, committed |

**The proof (root §3, hand-proved before any wrapping):**
1. `worker.mjs build-snapshot --go` under `vercel env run`: a 2-vCPU sandbox installs the python venv (numpy, opencv-headless, pymupdf, shapely, scikit-image), `@vercel/blob` (run-job's store), `appdeps` (sharp + playwright-core — `app-require.mjs` resolves `$HABAIT_APP_DIR` by the presence of playwright-core), uploads 147 code files (`tour360/{tools,server,viewer,catalog,copy}`, `engine/intake`, `360walkaround/pipeline`, the catalog JSONs), smoke-loads auto-trace's module graph and the python trace modules, snapshots. 31–37 s.
2. Three laptop-dispatched test jobs (`forke-test` prefix, the 846 PDF, the apt846-auto spec) found three runtime gaps, each fixed in the snapshot: sharp/appdeps (job 1), `engine/intake/rasterize.py` (job 2), and `FAL_KEY` — the laptop's `vercel env run` pulls the *development* env, which has no FAL_KEY (job 3: the VM rasterised page 1 and stopped at the first vision call). The CLI now documents `-e preview`.
3. **The real trigger:** `studio-e2e-build.cjs` signs up a Clerk test user on prod, creates a project, uploads the 846 PDF, runs the reading, approves, then POSTs `{build:true, consent:true}` with the page's own session token to the **preview's** `/api/studio-projects` (deployment protection passed with `x-vercel-trusted-oidc-idp-token` under `vercel env run`; `vercel curl` replaced the Authorization header and the app answered `login`). Result: HTTP 200, `job jmw3feujnf27718` queued **and** `הבנייה הופעלה בשרת (שרטוט ובדיקה, ניסיון 1)`; 5 s later the prod page's job card read `הורדו 1 קבצים והקריאה המאושרת` — the VM had claimed the job and downloaded its inputs. The trace stage's outcome is in `preview-job-status.json`.
4. `sudo poweroff` inside the VM does **not** end the session (probe `sbx-poweroff-probe.mjs`): a finished job's VM would idle to its cap and count against Hobby's 10 concurrent sandboxes. Hence `stopFinished` on the next page load and before any re-dispatch, and `worker.mjs stop`.

**Spend of the proof (ledger `development/tasks/studio-agent-fal/logs/spend-ledger.txt`, rows 12:20–13:08):** four portal readings ≈ $0.20, the preview job's auto-trace (≤ $1 cap, ≈ $0.10–0.15 expected), sandbox minutes inside Hobby's included hours (estimates ledgered as upper bounds at Pro rates). Eliran's go: «יש לך אישור חופשי לתקציב» (cap $10, report at $7).

**Not proven / out of scope here:** the build stage in a sandbox (Blender + assets; `build-snapshot --with-blender` is coded on the spike's recipe, not run — the spike proved the render itself); the approve and correction triggers (same code path as build); the watchdog at the cap; `/p/<id>` publishing (fork F's publish route in `studio-web/api` — the worker calls run-job for every stage and never publishes itself).

## 1. What the spike proved (2026-11-04; evidence, not a summary)
Evidence: `.wt/sandbox-worker/Projects/Habait/habait-walkaround/Habait/tour360/tools/sandbox-worker/evidence/2026-11-04-c1/spike-report.json`, `spike.log` and `files/`. Ledger: `360walkaround/pipeline/RENDER-LEDGER.md` §2, row C1.

**Yes: Blender 4.5.10 LTS renders the real pipeline in Vercel Sandbox.** `render_tour.mjs` (build_scene.py + render_pano.py) on apt846 `cp-kitchen` at the draft setting (1024x512 @ 16 spp): PASS (nadir 0 cm, depth 3/3 within 2 cm, scene 192/0 checks, 38 catalog pieces); Cycles on CPU (no GPU). 4 vCPU / 8 GB: apt 10.5 s, Blender download 12.1 s (OCF mirror; download.blender.org answers 403), extract 16 s, venv 17 s, upload of 294 MB of assets 144 s, scene build 11.1 s, **render 87.5 s**, session 307 s. Blender max RSS 1.84 GB; VM peak 2.05 of 8.4 GB. The team refused 8 vCPU (`resources.vcpus should be <= 4`) → Hobby: 45-minute sessions, cron once a day. Spike cost $0.031 at Pro rates, $0 inside Hobby's quota. Pricing (read 2026-11-04): Pro $0.128 per active vCPU-hour + $0.0212 per GB-hour; Hobby includes 5 active-CPU hours and 420 GB-hours a month, then creation pauses.

## 2. Cost and time per 11-room apartment (from the measurements)
| Setting | Render (4 vCPU) | At Pro rates | On Hobby |
|---|---|---|---|
| draft 1024x512 @ 16 spp (`--draft`, the build stage's setting) | 11 × ~88 s + 11 s ≈ 16.5 min (the laptop GPU: 713 s) | ≈ $0.20 per apartment | free; ≈ 4 apartments a month before the quota pauses creation |
| production 2048x1024 @ 32 spp (extrapolated ×8, not measured) | ≈ 2.1 h on 4 vCPU | ≈ $1.50 per apartment | does not fit a 45-min session: chunked resumable sessions or Pro |

Plus the fal legs that already run today (auto-trace ≤ $1 cap, markers ≈ $0.02): I/O waits, little active CPU.

## 3. The design, as built
```
portal POST build / approveTrace / traceCorrection   (api/studio-projects.mjs)
   writes job.json + studio/queue/<jobId>.json (as before), then in the SAME request:
   _dispatch.dispatch(job, jobPath, { stage })
     1. reads studio/worker/snapshot.json (the id of the worker snapshot — a release writes a new one, no env change)
     2. stops the previous attempt's sandbox if it is still up
     3. Sandbox.create({ name: `job-<id>-<attempt>` (unique, immutable = the atomic claim per attempt), source: snapshot,
                         resources: { vcpus }, timeout: stage cap, persistent: false, env: sandboxEnv(), tags })
        STAGES: trace = 30 min / 2 vCPU · build = 40 min / 4 vCPU, --draft (inside Hobby's 45)
     4. runCommand(detached): run-job.mjs --sweep-only --stale-min 50 ; run-job.mjs --once --job <id> [--draft]  (log: /vercel/sandbox/job.log)
     5. writes job.sandbox { name, stage, vcpus, timeoutMin, started, snapshot, estUsd } + dispatches, log «הבנייה הופעלה בשרת», returns
   a dispatch failure (no snapshot, quota paused, SDK error) → log «השרת לא הופעל … ממתינה בתור»; the job stays queued
portal GET ?id (every page load of the project)
   needsDispatch(job): queued + (no sandbox | sandbox session over) → dispatch(stageOf(job))      ← the retry, no cron
   else a finished job with an unstopped sandbox → stopFinished (Sandbox.get(name).stop())       ← no idle VMs
inside the VM (run-job.mjs, unchanged contract): claim → download → trace (auto-trace + trace-check + judge) → waiting/review,
   or build (apartment … package → store) → done; heartbeat every 60 s; the watchdog at cap−3 min → queued, attempt+1, exit 75;
   the sandbox record closed on the job (ended, minutes)
```
- **Trigger choice:** Hobby cron runs once a day, so the portal's own request is the trigger and the developer's page load is the retry. A Vercel Queue topic remains the durable upgrade (retries, at-least-once) once Queues is confirmed on this plan.
- **Secrets by name:** `sandboxEnv()` copies `BLOB_READ_WRITE_TOKEN`, `FAL_KEY` (and `OPENROUTER_API_KEY` if set) from the function's env into the VM's env — never a file, never printed. `file-ledger.mjs loadEnv()` reads `process.env` first; the VM has no `.env`. The SDK authenticates with the deployment's OIDC token (automatic on Vercel). **Phase 2 hardening (not built):** inject the fal `Authorization` at the sandbox firewall (`networkPolicy.allow[].transform`) so FAL_KEY never enters the VM, and allow-list egress (fal, Blob) — developer PDFs are untrusted input.
- **Runner paths in the VM** (`sandboxEnv`): `HABAIT_PY=/vercel/sandbox/venv/bin/python`, `HABAIT_BLOB_DIR=/vercel/sandbox/blobdeps`, `HABAIT_APP_DIR=/vercel/sandbox/appdeps`, `HABAIT_ENV_ROOT=/vercel/sandbox/hw`, `BLENDER=/vercel/sandbox/blender/blender`, `HABAIT_BLENDER_LOCK=/tmp/blender.lock`. Every Windows default in run-job / run-project / auto-trace / render_tour is env-overridable (checked 2026-11-05).
- **The snapshot** (`worker.mjs build-snapshot`): key = git HEAD + file-list hash + python deps (+ Blender version); the id in Blob `studio/worker/snapshot.json`; `--with-blender` adds the apt libs, Blender 4.5.10 (sha256-verified, mirror list) and the 294 MB of render assets on the spike's recipe. A code or style release = a new snapshot (one command, ~35 s without Blender).
- **Time limits:** trace 30 min, build 40 min (draft). A production-setting render does not fit Hobby's 45 min: the watchdog + `queued` + the renders' skip-if-clean make a resumed attempt continue; after Pro the caps can rise.
- **On timeout:** run-job's watchdog (above). A `running` job with no heartbeat for 50 min (a killed VM) is swept by the next sandbox's `--sweep-only --stale-min 50`: first time back to `queued`, second time `failed`. A gate refusal stays `review`.

## 4. Owed before this ships to production
1. **Eliran's deploy go** for the stage `deploy-E-1` (content: live main + the worktree's studio-web: `_dispatch.mjs`, `studio-projects.mjs`, `package.json` with `@vercel/sandbox`) — and Hobby vs Pro remains his cost call (§1–2).
2. **The build stage in a sandbox:** `build-snapshot --with-blender --go` (≈ 4 min, 300 MB upload), then one approved trace through `approveTrace` on the preview; expect ≈ 21 min at the draft setting. Needs a PASS trace first (fork B's auto-trace; 846 passed round-check on the laptop runs, the real Maale Efraim job is in review).
3. **Merge order:** `project-runner` (fork F: skin + gate, finishes, rings, film, the `/p/<id>` publish route) is merged into this branch at the end of fork E; re-merge before main so the worker calls the latest run-job for every stage.
4. **The QA cards (root §8.9):** a real portal job end-to-end in a sandbox on the deployed site, after the deploy go.
5. **Optional env:** `HABAIT_WORKER_VCPUS` is not read yet (STAGES is a constant); `CRON_SECRET` only if a sweep cron is ever added (none today).
