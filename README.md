# CEO Me

![Photon](https://img.shields.io/badge/Built%20with-Photon-635BFF?style=for-the-badge)
![iMessage](https://img.shields.io/badge/Interface-iMessage-34C759?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-Node.js-3178C6?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Working%20E2E-00A67E?style=for-the-badge)

> **Your personal board of directors in iMessage.**  
> Turn a messy decision into a verdict, a concrete next move, a deadline, and a proactive accountability check — without leaving Messages.

**Built with Photon.**

---

## The idea

Everyone comes to you for answers. But when the decision is yours, who do you ask?

CEO Me gives one iMessage conversation multiple useful perspectives:

- **CFO** — sees the money, tradeoffs, and downside.
- **Operator** — sees execution, scope, and what the decision will actually take.
- **Future You** — remembers the person and priorities you are trying to become.

The Board does not stop at advice. If you accept its recommendation, CEO Me turns the next action into a commitment, asks for a deadline, and returns proactively in iMessage when that deadline arrives.

```text
VENT → CONVENE → DECIDE → COMMIT → RETURN → REMEMBER
```

## ✦ What works today

CEO Me is a working Photon/iMessage agent, not a simulated chat interface.

1. A real inbound iMessage reaches CEO Me through Photon Spectrum.
2. The message is classified in the context of the current conversation.
3. CEO Me selects the Board seats relevant to the decision.
4. The Board produces a verdict, first action, and suggested commitment.
5. The user can accept, reject, modify, question, or clarify the recommendation naturally.
6. Accepted commitments receive a natural-language deadline.
7. The commitment and iMessage routing identity are persisted.
8. A background scheduler detects when the commitment is due.
9. CEO Me proactively sends a real iMessage follow-up.
10. **DONE**, **BLOCKED**, or **ABANDONED** is persisted as the real outcome.

The core rule is simple: **CEO Me never claims an action happened unless the application actually performed and recorded it.**

## 💬 Why iMessage?

CEO Me is deliberately not a dashboard.

Accountability is most useful where the decision already happens: in conversation. Photon lets the Board live inside iMessage and, critically, lets it return later instead of waiting for the user to reopen an app.

That proactive return is the product.

## Example flow

```text
You
I have a client offering me more money, but they want me
available every weekend. Should I take it?

CEO Me
CFO: ...
Operator: ...
Future You: ...

BOARD VERDICT
Take the client only if weekend work is premium-priced and capped.

FIRST MOVE
Send revised terms with fixed weekend hours and a separate rate.

CEO Me
I can hold you to that if you want.

You
Yeah, hold me to it.

CEO Me
When do you want this done?

You
Give me 3 minutes.

CEO Me
Locked. I'll come back then.

          ↓ real proactive iMessage ↓

CEO Me
BOARD FOLLOW-UP

We voted.
You agreed.

Did you complete: Send revised terms with fixed weekend hours
and a separate rate?

DONE
BLOCKED
ABANDONED
```

## ⚙️ Architecture

```text
                     ┌─────────────────────┐
Real iMessage ──────▶│ Photon / Spectrum   │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ Conversation Router │
                     │ + State Machine     │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ Board Engine        │
                     │ CFO / Operator /    │
                     │ Future You          │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ Commitment +        │
                     │ Deadline Engine     │
                     └──────────┬──────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
        ┌─────────────────┐          ┌──────────────────┐
        │ Persistent JSON │          │ Proactive Worker │
        │ state + routing │          │ due commitments  │
        └─────────────────┘          └────────┬─────────┘
                                             │
                                             ▼
                                      Photon iMessage
                                       follow-up
```

### Main modules

| Module | Responsibility |
| --- | --- |
| `src/photon.ts` | Real Photon Spectrum iMessage transport, routing persistence, inbound replies and proactive sends |
| `src/service.ts` | Conversation state machine and end-to-end product flow |
| `src/board.ts` | Board-seat selection, verdict generation and output validation |
| `src/router.ts` | Context-aware intent routing with deterministic fast paths |
| `src/deadline.ts` | Natural-language deadline parsing and timezone handling |
| `src/scheduler.ts` | Due-commitment detection, proactive follow-up and duplicate-send protection |
| `src/store.ts` | Decisions, commitments, sessions, outcomes and routing persistence |
| `src/llm/ollama.ts` | Optional structured local reasoning provider with validated fallbacks |

## Conversation state

CEO Me preserves the decision rather than treating every message as a fresh prompt.

```text
IDLE
  ↓
DECISION_DISCUSSION
  ↓
AWAITING_COMMITMENT_CONFIRMATION
  ↓
AWAITING_DEADLINE
  ↓
COMMITMENT_ACTIVE
  ↓
FOLLOW_UP_DUE
  ↓
AWAITING_OUTCOME
  ├── COMPLETED
  ├── BLOCKED
  └── ABANDONED
```

The router also handles explanations, deadline changes, commitment modifications, off-script replies, small talk, and recovery from ambiguous language.

## 🛡️ Reliability and proof boundaries

CEO Me is intentionally strict about proof:

- no fabricated message delivery;
- no fake proactive follow-ups;
- no hardcoded demo history presented as real;
- no commitment marked scheduled until it is persisted;
- no outcome marked complete until the user reports it;
- proactive follow-ups are deduplicated with `followUpSentAt`;
- failed transport attempts are recorded instead of reported as success;
- model-produced structured outputs are validated before use;
- deterministic fallbacks keep core flows working when an optional reasoning provider is unavailable.

## ✅ Tests

The test suite covers the original decision/commitment loop plus the real conversation state machine, deadline handling, proactive follow-up behavior, off-script recovery, Board quality validation, deterministic routing, and optional structured-reasoning fallbacks.

```bash
npm install
npm test
```

## Run locally

### 1. Install

```bash
git clone https://github.com/0xaje/ceo-me.git
cd ceo-me
npm install
```

### 2. Configure Photon

Copy `.env.example` to `.env` and provide your Photon Spectrum credentials:

```env
SPECTRUM_PROJECT_ID=your-project-id
SPECTRUM_PROJECT_SECRET=your-project-secret
USER_TIMEZONE=Africa/Lagos
```

Local `.env` files and runtime data are ignored by Git.

### 3. Start the iMessage agent

```bash
npm run photon
```

Send `ping` to the connected Photon iMessage line. CEO Me should reply:

```text
CEO Me is online.
```

Then send a real decision and continue naturally.

### Optional terminal harness

The same core service can be exercised without the transport:

```bash
npm run dev
```

## Optional local reasoning

The deterministic product loop works without a model. CEO Me can also use a local Ollama-compatible structured reasoning provider for unfamiliar decisions while validating its output and falling back safely when the provider is unavailable.

See `.env.example` for the optional configuration.

## Repository structure

```text
src/        CEO Me application
tests/      product and reliability tests
film/       demo-film production project and media
data/       local runtime state (gitignored)
```

The `film/` directory is submission/demo production material. It is separate from the application runtime; you do **not** need it to run CEO Me.

## ✨ Built for Photon Muse

CEO Me explores a slightly unhinged but useful premise:

**What if your CFO, your Operator, and your future self lived in a group chat — and came back later to make sure you actually did what you said?**

The result is not another assistant waiting for prompts. It is a decision-and-accountability loop that lives where the user already communicates.

---

**CEO Me** — *Your personal board of directors in iMessage.*

Built with Photon.
