# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue

---

## 2026-08-20

### Observation 1: Pin external CLI environment and verify artifacts

**Status:** OPEN
**Date:** 2026-08-20
**Session context:** Fixing a multi-environment deployment script whose backup export used the active CLI profile and consumed a missing archive.
**Skill:** antigravity-protocol
**Type:** open-source
**Phase/Area:** Deployment verification

**Issue:** A deployment script passed the environment to API-based publish steps but omitted it from a CLI export, allowing profile state to redirect one operation. After export failure, the next command consumed the archive path without proving the file existed.

**Suggested improvement:** Add a deployment pre-flight rule requiring every external command to receive an explicit environment and requiring produced artifacts to exist and be non-empty before downstream consumption.

**Principle:** Multi-environment automation must pin target context on every external command and verify each produced artifact before using it.

### Observation 2: Separate administrative and end-user security evidence

**Status:** OPEN
**Date:** 2026-08-27
**Session context:** Replaced a secured Dataverse dismissal-date predicate with the employee business-status predicate and validated a production driver lookup.
**Skill:** database-sentinel
**Type:** open-source
**Phase/Area:** Dataverse authorization validation

**Issue:** Administrative Dataverse queries confirmed the employee row and row-level sharing, but could not prove whether the actual end user could read the field used in the OData predicate; metadata inspection also exceeded a practical output boundary.

**Suggested improvement:** Require a user-context Web API smoke test for every secured-column predicate and report administrative row evidence separately from end-user field-permission evidence.

**Principle:** Database records and row access verified under an elevated context do not prove end-user access to secured columns; validate the exact request as the affected principal.

## 2026-08-31

### Observation 3: Correlate pipeline timeout with late Dataverse import completion

**Status:** OPEN
**Date:** 2026-08-31
**Session context:** Diagnosing repeated downstream solution promotions that timed out with a generic pipeline error while the target environment serialized solution imports.
**Skill:** dataverse:dv-solution
**Type:** open-source
**Phase/Area:** Pipeline failure diagnosis

**Issue:** The pipeline record exposed only a generic timeout error, while the target ImportJob XML contained the actual infrastructure failure and later jobs completed after the pipeline had already marked them failed. Checking only pipeline status would have incorrectly concluded that the solution was not installed.

**Suggested improvement:** Add a diagnosis branch that correlates DeploymentStageRun duration and deployment job ID with target ImportJob XML, active system jobs, and the currently installed solution version before classifying a promotion as failed.

**Principle:** In asynchronous deployment systems, an orchestrator timeout is not proof of deployment rollback; verify the target job log and final installed version independently.
