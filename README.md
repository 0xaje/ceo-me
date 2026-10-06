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
