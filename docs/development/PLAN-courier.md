# Courier — Interface Plan

**Status:** Interface contract · Last updated 2026-07-21

**courier will be implemented in a separate repository.** This document
exists here only to pin the interface contract that Residents must honor,
so both integrations stay aligned while Residents is built first.

## 1. Vision (one page)

courier is a notification layer that knows people: it decides _who_ gets
a message, _where_, _how insistently_, and _what happens when nobody
reacts_ — instead of every automation hard-coding `notify.*` targets.

Core concepts (fixed at planning level):

- **Channels with scope:**

  | Scope        | Examples                    | Addressing           |
  | ------------ | --------------------------- | -------------------- |
  | `personal`   | phone, watch, private mail  | follows the person   |
  | `area_bound` | speaker, display, TV, light | reaches who is there |
  | `household`  | all speakers, siren         | everyone             |

  Area-bound channels are defined by **area + tag**, never by entity IDs,
  so configuration survives device replacement. Follow-me is therefore
  the only way personal addressing reaches shared channels.
  Shared channels get three extra properties: **discretion**
  (confidential → personal channels only), **consideration** (silence in
  areas that need quiet), and **arbitration** (serializing competing
  messages).

- **Preference matrix:** recipient state (5 buckets) × urgency (4 levels)
  → ordered channel list + behavior (_immediate · silent · collect ·
  discard_). Acknowledgement requirement is an **independent flag**, not
  an urgency level.

- **Delivery ledger:** one lifecycle per message × recipient:

  ```text
  open → delivered → seen → acknowledged
                  ↘ done      (condition met)
                  ↘ expired   (validity elapsed)
                  ↘ withdrawn (someone else acknowledged)
     ↘ deferred (quiet hours / absent) → delivered
  ```

  Queueing and group acknowledgement are the same table with different
  triggers. Push can be retracted; spoken audio cannot.

## 2. Interface contract: what courier reads from Residents

| Value                             | Used for                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| presence + activity axes          | selecting the preference-matrix row                                                                                                                               |
| focus                             | overriding the matrix row                                                                                                                                         |
| membership + life stage           | role addressing ("all adults"), starter profiles                                                                                                                  |
| capabilities/limitations (cat. E) | precedence rule 1 (can the person receive/read at all)                                                                                                            |
| escalation contact                | escalation path                                                                                                                                                   |
| current area of a person          | follow-me                                                                                                                                                         |
| `needs_quiet` per area            | precedence rule 3 (silence in quiet areas)                                                                                                                        |
| area relationships                | which area belongs to whom; the effective `responsible` (explicit, else implied by `own_room`; `rank`/`exclusive` = first vs. sole) routes "something in area X"  |
| zone role of current location     | discretion away from home (workplace ≠ visiting)                                                                                                                  |
| home mode (all three axes)        | `guests_only` forces discretion on shared channels; `vulnerable_only` shifts recipients to the escalation contact; `vacation` changes the whole delivery strategy |

Everything above already exists in the Residents model — **no
courier-specific field is needed**, and none may be added.

## 3. Recipient-source abstraction

courier is **softly coupled**: it must work with bare `person.*` entities
and get better with Residents (HACS cannot resolve inter-integration
dependencies; a hard dependency would halve the audience).

- Provider interface "recipient source" with two implementations:
  full Residents provider, fallback `person.*` provider.
- Recipient _lists_ resolve early (needed for group acknowledgement);
  _channel_ choice resolves late, at delivery time.
- Role addressing ("all adults") exists only with the Residents provider.

### Degradation without Residents

| Without Residents         | Replacement                              |
| ------------------------- | ---------------------------------------- |
| state axes for the matrix | only `home` / `not_home` from `person.*` |
| `needs_quiet`             | fixed quiet hours per person             |
| capabilities, escalation  | manual per-recipient configuration       |
| follow-me                 | unavailable                              |
| role addressing           | unavailable; direct persons only         |

## 4. Obligations this imposes on Residents

This section is the reason this document lives in the Residents repo:

1. **Stable entity IDs and attribute names** — frozen at the end of
   Residents Phase 3, changed only with a deprecation window
   (see PLAN.md §9).
2. **Machine-readable values** — enumerated state values and typed
   attributes; no display-only strings in the contract surface.
3. **Documented enumerations** — presence/activity/context/mode values
   listed in user docs so courier can validate against them.
4. **No courier special-casing** — if courier needs something new, it is
   added as a general model feature or not at all.
5. **Detection hook** — a documented, cheap way for courier to detect
   Residents and enumerate members (entity naming convention or a small
   WS/helper API; decided together with the entity-ID scheme).

## 5. Sequencing

- **Residents first** — without the state space, courier would be a fifth
  dispatcher next to four existing ones.
- courier v1 is unblocked after **Residents Phase 4** (state axes, home
  mode, and `needs_quiet` exist).
- The interface freeze point is the Residents Phase 3/4 boundary; from
  then on this contract is versioned alongside PLAN.md §9.
- courier v1 scope (planned in its own repository): channel model with
  scopes, modality, urgency + acknowledgement flag, admin-configured
  preference matrix, delivery ledger, group acknowledgement via
  `tag`/`clear_notification`, store-and-forward with validity, dry-run.
