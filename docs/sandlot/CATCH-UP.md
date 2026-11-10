# Catch-up with upstream (siteboon/claudecodeui)

The `sandlot` branch starts at `origin/main` (= `stefan/main`, `1b1a376`), which was 95 commits ahead of
and 162 behind `upstream/main` (`4e20c29c`, v1.37.8).

## How it was merged

Upstream restructured the client (`src/components` -> `src/modules`, #1206) and the provider runtimes
(#1600, #1698) after the fork point. A file-by-file merge of the fork's 95 commits gave 148 conflicts
(53 both-modified, 46 modified-here/deleted-there, 40 added-here, 9 added-both), and cherry-picking the 162
onto the fork conflicts on nearly every commit after #1206. So the merge commit (`Merge upstream/main ...`,
first parent `main`, second parent `upstream/main`) takes **upstream's tree as is**, and the strip commits that
follow remove what Sandlot does not ship. "Taken" below means the change is in the `sandlot` tree and active;
"skipped" means its code was removed (or never applied, for release chores) by the strip commits; "taken
(inert)" is a translation-only change: the locale files are in the tree, but they change no behaviour.

Counts: **98 taken, 53 skipped, 11 taken (inert, i18n only)** = 162.

## The 162 upstream commits

| # | commit | subject | status | reason |
|---|---|---|---|---|
| 1 | `4e20c29c` | fix(chat): report a background task stop that does not take (#1762) | taken | chat: background-task stop reporting (Claude runtime, chat UI) |
| 2 | `a8c78139` | feat(desktop): add Linux .deb build (#1092) | skipped | desktop .deb build; electron/ removed |
| 3 | `fe5b2e71` | fix(side-questions): keep reasoning out of answers and break between messages (#1767) | taken | side questions: Claude part kept; its Codex/OpenCode parts removed with those providers |
| 4 | `a306d01c` | fix(scheduled-messages): stop one held-open turn from blocking every queued message (#1763) | taken | scheduled messages: one held turn no longer blocks the queue |
| 5 | `62cfa8e5` | feat(i18n): complete Turkish translation and add Turkish git namespace (#1768) | taken (inert) | i18n only (Turkish); translation files, no runtime effect |
| 6 | `8b46503e` | fix(agent): let an API caller run Claude attended for MCP forms (#1766) | skipped | agent API (/api/agent) removed: it is a second, API-key auth path |
| 7 | `2053f3d7` | chore(release): v1.37.8 | skipped | release chore (version bump, CHANGELOG); the tree is at 1.37.8, which names the tag |
| 8 | `624da21b` | feat(chat): steer a message into the running Claude turn at its next tool call (#1760) | taken | chat: steer a message into the running Claude turn |
| 9 | `2c49a4a1` | feat(browser-use): add browser_upload_file MCP tool (#1704) | skipped | browser-use removed |
| 10 | `dcc0bfbc` | feat(chat): side questions answered by each provider's own session (#1673) | taken | side questions for Claude; other providers' parts removed |
| 11 | `ca95ec4c` | feat(code-editor): download the original file from the binary viewer (#1759) | taken | code editor: download the original from the binary viewer |
| 12 | `b994762e` | feat(sidebar): separate Archive and Delete in the session menu (#1758) | taken | sidebar: Archive and Delete separated |
| 13 | `58a28e04` | fix(chat): decode Unicode file link paths before opening (#1711) | taken | chat: Unicode file link paths decoded |
| 14 | `c6d6668d` | fix(chat): show MCP elicitation requests instead of declining them unseen (#1725) | taken | chat: MCP elicitation requests shown (agent-API half removed with the agent API) |
| 15 | `1ee69d08` | Feat/codex gpt 6.1 models (#1739) | skipped | Codex models; Codex removed |
| 16 | `1e580f1e` | fix(file-tree): fall back when Copy Path cannot use the Clipboard API (#1719) | taken | file tree: Copy Path clipboard fallback |
| 17 | `0b581d4c` | feat(notifications): add an opt-in webhook channel for run lifecycle events (#1714) | skipped | notifications webhook (outbound call); notifications removed |
| 18 | `7c1a631f` | docs(plugins): list the ccx plugin (#1718) | skipped | plugins docs; plugin system removed |
| 19 | `0bd1b79b` | fix(opencode): read only the requested page of a session's history (#1722) | skipped | OpenCode; removed |
| 20 | `b28a767c` | fix(opencode): list the user's OpenCode models on slow or busy hosts (#1724) | skipped | OpenCode; removed |
| 21 | `7288d194` | chore(deps): upgrade Codex CLI and SDK to 0.166.0 (#1738) | skipped | Codex CLI/SDK upgrade; Codex removed |
| 22 | `13e9ef64` | chore(release): v1.37.7 | skipped | release chore |
| 23 | `7e745221` | Feat/opencode sdk runtime (#1698) | skipped | OpenCode SDK runtime; removed |
| 24 | `a3a51d90` | feat(browser-use): let the user click and type in the Browser panel (#1571) | skipped | browser-use removed |
| 25 | `154b3b14` | fix(claude): label SDK sessions as claudecodeui (#1677) | taken | Claude: SDK sessions labelled claudecodeui (CLAUDE_CODE_ENTRYPOINT) |
| 26 | `3491cf9f` | fix(sidebar): offer session forking in the mobile options sheet (#1597) | taken | sidebar: session fork in the mobile sheet |
| 27 | `a11e469a` | fix(chat): keep Enter a newline on on-screen keyboards (#1602) | taken | chat: Enter is a newline on on-screen keyboards |
| 28 | `383e4f1a` | fix(chat): keep the composer buttons on one row as the token count grows (#1683) | taken | chat: composer buttons stay on one row |
| 29 | `fc2de9ff` | feat(sidebar): rename sessions by double-clicking their title (#1693) | taken | sidebar: rename by double-click |
| 30 | `c17c2f6d` | chore(release): v1.37.6 | skipped | release chore |
| 31 | `bfb53197` | feat(providers): show installed CLI versions and update a CLI from Settings (#1609) | skipped | CLI version display and "update CLI" from Settings: an update path; removed |
| 32 | `7ccd6ab9` | refactor(claude): migrate the runtime provider to TypeScript (#1600) | taken | Claude runtime migrated to TypeScript (the runtime the hardening edits) |
| 33 | `4edd7e94` | fix(scheduled-messages): take a sent message's banner down without a reload (#1613) | taken | scheduled messages: banner removed after send |
| 34 | `3fe5aaa3` | fix(chat): clear a background task chip whose task already ended (#1657) | taken | chat: stale background task chip cleared |
| 35 | `cbdf8a41` | fix(claude): type buildClaudeSdkEnv so the server build passes (#1674) | taken | Claude: buildClaudeSdkEnv typed |
| 36 | `ba51f627` | feat(i18n): add Simplified and Traditional Chinese Git namespace (#1653) | taken (inert) | i18n only (Chinese git namespace) |
| 37 | `80fbeac1` | fix(file-tree): let the viewer read any file under the workspace root (#1622) | taken | file tree: viewer reads any file under the workspace root |
| 38 | `e66cafcb` | fix(sessions): make the session watcher's ignore list take effect again (#1638) | taken | sessions watcher ignore list fixed |
| 39 | `6780c084` | fix(sessions): skip malformed JSONL lines instead of dropping the rest of the file (#1643) | taken | sessions: malformed JSONL lines skipped |
| 40 | `8d9bfbcd` | fix(sidebar): make "Load more sessions" fetch every time it is clicked (#1629) | taken | sidebar: Load more sessions fixed |
| 41 | `09e61067` | fix(claude): keep the Artifact tools in SDK-driven sessions (#1647) | taken | Claude: Artifact tools kept in SDK sessions |
| 42 | `97560f12` | feat(sidebar): optionally remember expanded projects (#1648) | taken | sidebar: remember expanded projects |
| 43 | `7238368f` | feat(i18n): complete Spanish translations (#1624) | taken (inert) | i18n only (Spanish) |
| 44 | `a82918ca` | feat(chat): name the permission mode in the composer (#1631) | taken | chat: permission mode named in the composer (modes limited to default/acceptEdits/plan) |
| 45 | `527d2ea8` | fix(chat): keep every follow-up queued while a turn runs (#1634) | taken | chat: follow-ups queued while a turn runs |
| 46 | `0ce5630f` | chore(release): v1.37.5 | skipped | release chore |
| 47 | `16311b63` | fix(sessions): stop showing logged API requests as repeated messages (#1596) | taken | sessions: logged API requests not shown as repeats |
| 48 | `02e44b01` | feat(opencode): show task calls as subagents (#1443) | skipped | OpenCode; removed |
| 49 | `0753fc6b` | fix(sessions): show pasted text instead of raw <pasted_content> tags (#1504) | taken | sessions: pasted text instead of <pasted_content> tags |
| 50 | `6c506597` | fix(opencode): discover models for connected providers (#1578) | skipped | OpenCode; removed |
| 51 | `d1a49297` | fix(commands): keep multi-line slash command arguments in $ARGUMENTS (#1581) | taken | commands: multi-line $ARGUMENTS |
| 52 | `82a2b62a` | feat(chat): offer to queue a message behind a session's background work (#1583) | taken | chat: offer to queue behind background work |
| 53 | `92ccebc6` | fix(codex): read inherited history in reference-backed forks (#1530) | skipped | Codex; removed |
| 54 | `b26207ac` | fix(auth): ignore auth headers replayed by cached responses (#1549) | taken | auth: cached responses no longer replay auth headers (token refresh itself later removed) |
| 55 | `abc14eb2` | feat(providers): let a provider list only its custom models (#1561) | taken | providers: custom-models-only catalog (Claude) |
| 56 | `5d76a2d8` | fix(claude): measure the context window against the SDK-reported window (#1557) | taken | Claude: context window from the SDK-reported window |
| 57 | `94da1c22` | fix(plugins): explain why a plugin git clone or pull failed (#1562) | skipped | plugins (git clone/pull); plugin system removed |
| 58 | `cfd2cc02` | docs(plugins): drop the Claude Watch plugin whose repository is gone (#1577) | skipped | plugins docs; removed |
| 59 | `7c3049fe` | chore(release): v1.37.4 | skipped | release chore |
| 60 | `272a1088` | fix(cursor): stop reporting fresh logins as "Command timeout" (#1494) | skipped | Cursor; removed |
| 61 | `6b2fdd8e` | feat(i18n): add Brazilian Portuguese language support (#1518) | taken (inert) | i18n only (Brazilian Portuguese) |
| 62 | `5fd3de63` | docs: add Indonesian README (#1468) | skipped | localized README (docs); not part of the build |
| 63 | `dc946830` | feat(plugins): recommend Agent Monitor plugin (#1474) | skipped | plugin recommendation; plugins removed |
| 64 | `d4dd34da` | fix(chat): show when the chat connection is lost (#1485) | taken | chat: lost connection shown |
| 65 | `45677008` | feat(settings): show the permission rules from Claude's settings files (read-only) (#1492) | taken | settings: Claude settings-file permission rules shown read-only |
| 66 | `d392d9eb` | fix(chat): show what a Bash command changed under its command row (#1483) | taken | chat: Bash command changes shown |
| 67 | `80dd5c29` | fix(chat): keep a queued message waiting while background work runs (#1434) | taken | scheduled messages: queued message waits for background work |
| 68 | `b9d3d129` | fix(claude): stop a held run's background tasks before a new turn takes over (#1395) | taken | Claude: held run background tasks stopped before a new turn |
| 69 | `51fb5757` | feat(providers): let custom models declare reasoning-effort levels (#1418) | taken | providers: custom models declare effort levels |
| 70 | `6c8e8be7` | fix(chat): stop lazy transcript rows flickering at the band edge (#1421) | taken | chat: lazy transcript rows no longer flicker |
| 71 | `bb81d0b0` | fix(chat): send a new chat's first message to one session only (#1420) | taken | chat: first message goes to one session |
| 72 | `f24fa191` | fix(auth): render the message of a structured error envelope (#1425) | taken | auth: structured error envelope rendered |
| 73 | `68283131` | fix(shell): make the shell tab follow the light/dark theme (#1428) | taken | shell: tab follows light/dark theme |
| 74 | `6f579b5c` | feat(i18n): add Hebrew language support (#1509) | taken (inert) | i18n only (Hebrew) |
| 75 | `dc7cb6c6` | fix(auth): stop token refreshes and language changes from remounting the app (#1408) | taken | auth: no remount on language change (token refresh part later removed) |
| 76 | `fce5c2e7` | fix(chat): refetch the @ file list each time the dropdown opens (#1411) | taken | chat: @ file list refetched |
| 77 | `05b63060` | fix(code-editor): confirm before discarding unsaved changes (#1409) | taken | code editor: confirm before discarding (electron part removed) |
| 78 | `4cd470fa` | fix(desktop): keep the app view sized to the window after maximize (#1405) | skipped | desktop (electron) only |
| 79 | `f34ac834` | feat(sidebar): select and delete several of a project's sessions at once (#1404) | taken | sidebar: bulk select and delete sessions |
| 80 | `3cc73ede` | feat(sessions): report turns driven by the Claude CLI as running (#1394) | taken | sessions: CLI-driven turns reported running |
| 81 | `87c44f58` | feat(settings): let the theme follow the operating system appearance (#1393) | taken | settings: theme follows the OS |
| 82 | `7f4eba78` | feat(chat): label each assistant reply with the model that answered it (#1391) | taken | chat: model label on each reply |
| 83 | `3576232e` | perf(chat): keep collapsed tool groups memoized across stream ticks (#1386) | taken | chat: tool groups memoized (perf) |
| 84 | `de0908b0` | fix(chat): render LaTeX \(…\) and \[…\] math in assistant messages (#1385) | taken | chat: LaTeX \( \) and \[ \] math |
| 85 | `eef9791e` | fix(chat): Tab completes a slash command instead of running it (#1380) | taken | chat: Tab completes a slash command |
| 86 | `d1b09330` | fix(sessions): show the Claude branch a resume will replay (#1148) (#1378) | taken | sessions: Claude branch shown on resume |
| 87 | `c6468e13` | fix(settings): warn when an api key is bypassing the claude subscription login (#1375) | taken | settings: warn when an API key bypasses the subscription login |
| 88 | `09892b57` | feat(workspace): rename a session by double-clicking its title in the chat header (#1374) | taken | workspace: rename session in the chat header |
| 89 | `9212ee33` | feat(quick-settings): add Settings/Commands tabs and pin-to-dock to the right panel (#1371) | taken | quick settings: tabs and pin-to-dock |
| 90 | `a2ed7f3c` | feat(git): compare the working copy against any branch in Source Control (#1369) | taken | git: compare against any branch |
| 91 | `48c8ae4c` | feat(codex): add GPT-6 Sol and GPT-6 Luna models (#1435) | skipped | Codex models; removed |
| 92 | `7fb91f00` | feat(i18n): add Czech language support (#1384) | taken (inert) | i18n only (Czech) |
| 93 | `6c51fcaa` | feat(1188): let the sidebar be resized (#1189) | taken | sidebar: resizable |
| 94 | `557109a2` | fix: recover background-agent results and status, read-only temp browsing, clone-token redaction (#1347) | taken | background-agent results, read-only temp browsing (clone-token redaction moot: clone removed) |
| 95 | `fd424f3f` | fix(chat): Enter that confirms an IME candidate must not send on Safari (#1332) | taken | chat: IME Enter on Safari |
| 96 | `3ed3be5a` | feat(settings): close settings modal with escape and backdrop click (#1164) | taken | settings: Escape and backdrop close |
| 97 | `580be52d` | fix(chat): make in-chat file references land where they point (#1256) | taken | chat: in-chat file references land where they point |
| 98 | `208c7156` | fix(claude): hold the CLI open for backgrounded agents and workflows (#1291) | taken | Claude: CLI held open for backgrounded agents |
| 99 | `7704a905` | fix(claude): show session titles instead of prompts in the sidebar (#1258) | taken | Claude: session titles in the sidebar |
| 100 | `ed3f0bfc` | fix(opencode): hide child sessions (#1344) | skipped | OpenCode; removed |
| 101 | `a6d50c84` | fix(codex): support image-only prompts (#1346) | skipped | Codex; removed |
| 102 | `7090a5db` | fix(sidebar): let Running collapse project groups (#1166) | taken | sidebar: Running collapses project groups |
| 103 | `d450ed85` | feat(chat): say a compaction out loud, as one row with its summary folded in (#1295) | taken | chat: compaction shown as one row |
| 104 | `4b98d2ea` | feat(chat): render workspace image paths in markdown (#1307) | taken | chat: workspace image paths rendered |
| 105 | `f3620803` | fix(providers): strip ANSI escapes from OpenCode and Cursor stderr (#1303) | taken | shared stripAnsiSequences kept; the OpenCode/Cursor callers removed |
| 106 | `544baffe` | fix(opencode): compose the provider prefix into session model ids (#1333) | skipped | OpenCode; removed |
| 107 | `5ce8ed45` | fix(codex): restore user prompts from canonical typed rollout rows (#1277) | skipped | Codex; removed |
| 108 | `b028e0d8` | feat(sidebar): pin expanded project header while sessions scroll (#1312) | taken | sidebar: pinned project header |
| 109 | `f05ba1fd` | feat(plugins): recommend GLM Usage plugin (#1323) | skipped | plugin recommendation; removed |
| 110 | `b8e572bd` | feat(i18n): add Indonesian language support (#1328) | taken (inert) | i18n only (Indonesian) |
| 111 | `5e73a49b` | fix: upstream electron build bug | skipped | electron build fix |
| 112 | `70e57859` | chore(release): v1.37.3 | skipped | release chore |
| 113 | `e2b1eb07` | Fix/upgrade codex sdk (#1290) | skipped | Codex SDK upgrade; removed |
| 114 | `4e1190cc` | feat(codex): expose GPT-6 Astra model (#1289) | skipped | Codex model; removed |
| 115 | `d27062ed` | fix: npm release it and README | skipped | release-it and docs chore |
| 116 | `125a293f` | fix: npm release-it and README | skipped | README release chore |
| 117 | `7015ffc8` | feat(sidebar): draw a Conversations row the way a Projects row is drawn (#1157) | taken | sidebar: Conversations row |
| 118 | `7b52e3ce` | fix(claude): ignore <synthetic> model placeholder when resolving session model (#1207) | taken | Claude: <synthetic> model placeholder ignored |
| 119 | `25ddd768` | fix(agent): read the model catalog's own shape, not a wrapper (#1159) | skipped | agent API; removed |
| 120 | `b6083e0b` | fix(skills): a plugin that ships commands keeps its skills too (#1274) | taken | skills: plugin commands keep their skills (Claude plugins, not CloudCLI plugins) |
| 121 | `1c61dc30` | fix(i18n): add missing delete-dialog archive keys to all locales (#1162) | taken (inert) | i18n only (missing keys) |
| 122 | `5af09903` | feat(i18n): connect remaining hardcoded UI strings to translations (#1192) | taken | UI strings connected to translations (touches UI code) |
| 123 | `bfe7c495` | fix(sessions): keep an archived session archived across a rescan (#1220) | taken | sessions: archived stays archived across a rescan |
| 124 | `aa2755b8` | fix(editor): syntax highlighting for .mts, .cts, .mjs and .cjs (#1223) | taken | editor: .mts/.cts/.mjs/.cjs highlighting |
| 125 | `66c0e4df` | Collapsible branches in the model picker (#1229) | taken | chat: collapsible branches in the model picker |
| 126 | `8f9a2e43` | feat(chat): recall sent messages with arrow keys in the composer (#1238) | taken | chat: recall sent messages with arrow keys |
| 127 | `61af3295` | fix(chat): keep an option label containing ", " as one answer (#1249) | taken | chat: option label with ", " kept whole |
| 128 | `b7320c91` | fix(opencode): list OpenCode Go models with reasoning variants (#1265) | skipped | OpenCode; removed |
| 129 | `46973fc9` | fix(release): expose npm publish failures (#1271) | skipped | release chore |
| 130 | `c1be241b` | fix(scheduled-messages): interrupt a busy run instead of failing to send (#1239) | taken | scheduled messages: interrupt a busy run |
| 131 | `99ea0525` | feat(chat): unify provider workflows and improve transcript performance (#1206) | taken | chat: unified provider workflows and transcript performance (the restructure the tree is built on); non-Claude parts removed |
| 132 | `677b7ba4` | chore(release): v1.37.2 | skipped | release chore |
| 133 | `0a2ad343` | fix: improve chat view and resolve bandwidth issue (#1153) | taken | chat view and bandwidth fixes (CLI and browser-use parts removed) |
| 134 | `0d517749` | fix: introduce fallback for update build failures | skipped | update build fallback: an update path |
| 135 | `9c48092a` | chore(release): v1.37.1 | skipped | release chore |
| 136 | `95076941` | fix(search): match Claude transcripts by provider_session_id (#1078) | taken | search: Claude transcripts by provider_session_id |
| 137 | `0f67810c` | Fix/update codex sdk and fix data usage (#1095) | taken | data-usage fixes kept; the Codex SDK update removed with Codex |
| 138 | `015e892c` | feat(sidebar): add recent conversation feed (#1041) | taken | sidebar: recent conversation feed |
| 139 | `ef3f7980` | fix(claude): remove dead CLAUDE_CODE_STREAM_CLOSE_TIMEOUT workaround (#1115) | taken | Claude: dead stream-close workaround removed |
| 140 | `ca92373d` | feat(plugins): recommend Codex Usage plugin (#1114) | skipped | plugin recommendation; removed |
| 141 | `f0dca2d5` | fix: tolerate client clock skew before treating an auth token as expired (#1085) | taken | auth: client clock skew tolerated |
| 142 | `74d3f8ff` | fix: resolve @/ path aliases so the server test suite can load (#1084) | taken | test: @/ aliases resolve in the server suite |
| 143 | `5fa87dda` | feat(i18n): add complete Spanish (es) translation (#1090) | taken (inert) | i18n only (Spanish) |
| 144 | `59472c07` | feat(i18n): complete Korean (ko) translation (#997) | taken (inert) | i18n only (Korean) |
| 145 | `badad381` | i18n: complete Simplified Chinese (zh-CN) translation (#1020) | taken (inert) | i18n only (Simplified Chinese) |
| 146 | `428b1052` | feat: add provider session ID copy actions (#1040) | taken | provider session id copy actions |
| 147 | `c2408f0f` | fix: update stale Sonnet 4.6 labels to Sonnet 5 in the Claude model picker (#1036) | taken | Claude model picker labels |
| 148 | `753a8c04` | fix: don't recurse into system directories when building file trees (#1074) | taken | file tree: system directories not recursed |
| 149 | `264e0946` | chore(release): v1.37.0 | skipped | release chore |
| 150 | `06e7ee9f` | feat: numerous bugfixes and features (#1037) | taken | numerous fixes (worktrees, providers, websocket); plugin and other-provider parts removed |
| 151 | `75ff8a5d` | fix: check CLAUDE_CODE_OAUTH_TOKEN in checkCredentials() (#979) | taken | Claude: CLAUDE_CODE_OAUTH_TOKEN in checkCredentials |
| 152 | `27eaf014` | chore(release): v1.36.3 | skipped | release chore |
| 153 | `31645e3f` | chore: refresh better-sqlite3 lock (#1027) | taken | better-sqlite3 lock refresh (lockfile since regenerated) |
| 154 | `f2a95d64` | fix: remove node_env from electron | skipped | electron only |
| 155 | `283b5586` | fix: codex subagents should not appear in the sidebar | skipped | Codex; removed |
| 156 | `615e2ca2` | chore(release): v1.36.2 | skipped | release chore |
| 157 | `038d960c` | fix: bump @openai/codex-sdk to ^0.144.0 to support newer Codex models (#1001) | skipped | Codex SDK bump; removed |
| 158 | `5884573a` | fix: validate X-Refreshed-Token before storing it as the auth token (#971) | taken | auth: X-Refreshed-Token validated (refresh later removed in Sandlot) |
| 159 | `123d244a` | fix: harden docker cloudcli install | skipped | docker install image; docker/ removed |
| 160 | `4fff0ff9` | chore(release): v1.36.1 | skipped | release chore |
| 161 | `4cee5e72` | Fix/resolve different bugs (#964) | taken | bug fixes across chat, websocket and providers; the Gemini and OpenCode parts removed |
| 162 | `41e0d309` | feat(redesign): skills and MCP action controls in settings (#942) | taken | settings: skills and MCP action controls |

## The fork's own 95 commits (stefanriegel/claudecodeui)

Not carried over: the merge keeps upstream's tree, and these were written against the pre-#1206 layout.
Several are superseded by upstream (mermaid diagrams, worktree sidebar, session bookmarks, URL `?token=`
fix-ups); others are removed by Sandlot on purpose (`?token=` URL login, trusted-proxy auth, GitLab and GitHub
project creation, Codex features, the "Restart server" button and the self-update release path). The
composer "Spec A" work (attachment persistence, context health bar, model-picker chip), the agent todo strip
and artifact preview links are candidates to port onto the new layout later.

- `1b1a376a` feat(chat): merge composer & markdown enhancements (Spec A)
- `11860966` fix(chat): evict image drafts first on localStorage quota overflow
- `54cd0bd4` feat(chat): render mermaid diagrams in markdown
- `40398b8d` feat(chat): add model-picker chip to composer
- `6e9e4188` fix(chat): bucket context level on raw percent so 69.99% stays ok
- `43aae7a2` feat(chat): add context health bar to token usage summary
- `67bc78a6` fix(chat): guard attachment persist until restore hydrates
- `f1cf8282` fix(chat): persist image attachments across tab switches
- `fd4d4bfe` feat(chat): add attachment storage helper with quota guard
- `04f19378` docs: implementation plan for chat composer enhancements (Spec A)
- `838db14d` docs: spec for chat composer & markdown enhancements (Spec A)
- `02566c8e` chore(release): v1.37.7
- `62a1a3ec` fix: surface silently-dropped chat runs instead of forcing a resend
- `855b7c40` chore(release): v1.37.6
- `e63f0259` fix: render interactive tool panels in auto and bypass permission modes
- `e2cc30cd` chore(release): v1.37.5
- `a4647cc2` fix: resolve session model change by app session id
- `c9119730` fix: preserve selected permission mode across session establishment
- `a49b99d7` chore(release): v1.37.4
- `40d5b295` fix: codex subagents should not appear in the sidebar
- `c05361d8` fix: remove node_env from electron
- `caf86ce8` fix: bump @openai/codex-sdk to ^0.144.0 to support newer Codex models (#1001)
- `b92a20b1` fix: validate X-Refreshed-Token before storing it as the auth token (#971)
- `219fc653` chore(release): v1.37.3
- `ff00a03d` chore: ship cloudcli updates via github release
- `daa38fb1` chore: read ship github token from store
- `379a16d4` chore: add ship release command
- `e08f3539` chore(release): v1.37.2
- `d5c4aea0` fix: gate app bootstrap behind auth
- `0b1086b3` chore: release 1.37.1
- `9aa40ab1` feat: add sidebar worktree redesign
- `2633d17c` feat: add claude worktree setting
- `2a615089` chore: release 1.37.0
- `90309ff2` feat: support gitlab project creation
- `b3db2c87` docs: design gitlab project creation
- `f9b684c5` chore: release 1.36.9
- `160dc7b4` chore: ignore sdd scratch files
- `c3738870` chore: ignore sdd scratch files
- `25431a27` Fix codex update_plan plan item narrowing for strict null checks
- `a52ebbda` test: cover claude subagent transcript skip
- `a73bc64f` test: cover grouped codex subagent todos
- `469ad0f2` test: cover codex parent subagent history loading
- `5c0527c3` feat: group codex subagents in parent chat
- `dfe133e2` fix: skip codex subagent sessions in sidebar
- `5f3cc9dd` fix: close codex transcript metadata streams
- `d537585c` test: cover codex subagent transcript metadata
- `98955b57` docs: add codex subagent grouping plan
- `c8fcad50` docs: add codex subagent grouping design
- `3a1c9ed0` chore: release 1.36.8
- `81e0ab8c` style(mcp): use purple server icon
- `aac47644` chore: release 1.36.7
- `07f5c4e5` Merge pull request #1 from stefanriegel/codex/release-1.36.6-agent-todo-strip
- `ec51aa9e` chore: release 1.36.6
- `9e1221e4` feat: show agent todo status strip
- `76b09e11` docs: add agent todo status strip design
- `95fbea6d` feat: add artifact preview links
- `6d950268` chore: release 1.36.5
- `d260f87c` fix: keep sidebar content within shell width
- `c360d1e3` fix: avoid shared upload temp root
- `dbae1495` fix: isolate image upload temp directories
- `aaac1410` chore: release 1.36.4
- `54280a2f` fix: keep sidebar from overlapping main content
- `bec766a0` chore: release 1.36.3
- `024dd59b` feat: integrate next upstream workflow fixes
- `918ab42a` feat: integrate upstream session settings queue fixes
- `3685fe02` chore: merge fork main into v1.36.2 release
- `4637f495` chore(release): v1.36.2
- `b81d514f` fix: clean up generated CSS warnings
- `c213dd6c` fix: address upstream CloudCLI issue batch
- `ab291c1e` fix(shell): preserve terminal output on reconnect
- `b693dbff` fix(auth): always consume URL token parameter
- `bc1a8929` feat(sidebar): add local session bookmarks
- `b3b04132` fix(shell): use native mobile terminal scrolling
- `26f1ab75` fix(chat): prevent activity bar overlapping messages
- `372e7c12` fix(chat): keep dollar amounts out of KaTeX
- `9e9e0d25` feat(settings): add verified password change
- `4dfb9810` fix: recover Claude titles without leaking prompts
- `581c25aa` fix: preserve Shell tab scroll position across periodic refresh
- `7b1452ff` fix(settings): address CodeRabbit review on #950
- `1b57835a` feat(settings): add a "Restart server" button in the About tab
- `1403bf25` feat: accept a one-time auth token from the URL (?token=) for tunnel/proxy setups
- `eb82328d` 1.36.1
- `750513bb` feat: add Codex permission env fallback
- `06f6fe6c` fix: use npm ci for git updates
- `39cee440` fix: resolve npm audit vulnerabilities
- `f6804c51` chore: use fork git source for self-hosted updates
- `5445a34f` fix: complete platform auth and session cleanup
- `f5a98865` feat: support custom claude and codex models
- `514673f4` feat: add settings action menus
- `0dd7053b` feat: add proxy auth and signed plugin identity
- `ea24a845` fix: guard claude session lifecycle
- `054ca99f` fix: prune sessions with missing transcripts
- `e4991b6f` fix: keep deleted projects from resurrecting
- `474da1d7` fix: reap stale shell websocket sessions
- `592173f2` fix: normalize provider stream completion events
