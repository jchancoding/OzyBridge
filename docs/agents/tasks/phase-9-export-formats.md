Read AGENTS.md first.

Task: Add an "Export other format" dropdown to OzyEQ with two text formats: Wavelet GraphicEQ and EqualizerAPO.
Phase: 9

Work only in /Users/jasper/Documents/GitHub/OzyBridge-9x (branch 9-export-formats). Do not commit or push.

Files you may change:
- src/core/graphicEq.ts, src/core/graphicEq.test.ts (new)
- src/ui/OzyEq.tsx

Files to read for context (nothing else): src/core/response.ts, src/core/autoeq.ts, src/core/eq.ts, src/ui/download.ts.

Requirements:
1. `exportGraphicEq(profile): string` in src/core/graphicEq.ts returns one line: `GraphicEQ: 20 -1.2; 21 -1.3; ...`. Frequencies are AutoEQ's fixed 127-point GraphicEQ list (AutoEQ, MIT, credit in a one-line comment). Gains come from `profileResponseDb` plus the preamp, rounded to 0.1 dB.
2. EqualizerAPO uses the existing `exportAutoEq` text unchanged. It is only a new label.
3. OzyEQ export panel: next to the current Download .txt button, a select labelled "Export other format" with "Wavelet GraphicEQ (.txt)" and "EqualizerAPO (.txt)", plus Download and Copy buttons. File names: `<name>-wavelet.txt`, `<name>-equalizerapo.txt`.
4. Tests: a flat profile gives 127 zeros; a single PK +6 dB at 1 kHz Q 1 peaks near 1000 Hz at about +6 dB; preamp shifts every value; output has exactly 127 pairs.

Not included: PipeWire filter-chain. It needs a config file path and a service restart on the user's machine, which we cannot check. PipeWire users can point its `param_eq` at the EqualizerAPO export.

Out of scope: device export, new import formats, styling beyond tokens.

Done when:
- npm test and npm run typecheck pass in the worktree
- The Wavelet file imports into Wavelet on an Android phone (owner check)

Hardware: none. Owner check on a phone: download the Wavelet file, import it in Wavelet, and confirm the curve looks like OzyEQ's graph.

Reply with: files changed, test results, open issues. No explanations.
