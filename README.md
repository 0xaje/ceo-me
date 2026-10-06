# CEO Me

Your personal board of directors in iMessage. Built with Photon.

## Product loop

**VENT → CONVENE → DECIDE → COMMIT → RETURN → REMEMBER**

CEO Me turns a messy decision into one clear verdict, one next action, and—when the user accepts it—a tracked commitment that the system can follow up on later.

## CEO-001

The first milestone proves the core state model before the Photon transport is added.

Current foundation:

- TypeScript/Node project scaffold
- Contextual Board seat selection
- One deterministic verdict path for scope-expansion decisions
- Decision records
- Commitment records
- Commitment outcome updates
- Terminal-first harness
- Vitest coverage for decision → commitment → outcome

### Real-system rule

The application must never claim an action happened unless the code actually performed and persisted it.

That means:

- no fabricated follow-ups
- no fake message sends
- no hardcoded demo history presented as real
- no claiming a commitment was scheduled until a scheduler accepted it
- no claiming iMessage delivery until Photon confirms the transport action

## Next milestone

Complete CEO-001 end to end:

1. Persist decisions and commitments beyond process memory.
2. Add a scheduler for due commitments.
3. Produce a real proactive follow-up event.
4. Connect the same service layer to Photon Spectrum.
5. Receive a real iMessage.
6. Send a real Board verdict.
7. Accept a commitment.
8. Send the scheduled iMessage follow-up.
9. Record the user's real outcome.

## Local development

```bash
npm install
npm test
npm run dev
```

The terminal harness is intentionally the first transport. Photon is added only after the core state transition is proven locally.


## Photon transport

CEO-002 adds the real hosted iMessage transport through Photon Spectrum.

Install dependencies:

```bash
npm install
```

Set the two Photon project credentials in your shell:

```powershell
$env:PROJECT_ID="your-project-id"
$env:PROJECT_SECRET="your-project-secret"
npm run photon
```

Then send `ping` to the Photon iMessage line. A successful transport test replies:

```text
CEO Me is online.
```

After that, send a real decision such as:

```text
Should I add a dashboard and more features before I record the demo?
```

The response is generated through the same persisted CEO Me service used by the local harness.

### Security

Never commit Photon credentials. The repository ignores local `.env` files and contains only `.env.example`.

### CEO-002 boundary

At this stage Photon proves real inbound iMessage + real reply + persisted decision. Proactive iMessage follow-up is wired only after the line/routing identity is verified; we do not fabricate outbound scheduling before that.
