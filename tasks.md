# SGP New App Cahier de Charge (Backend .NET 10 + Frontend React)

## 1) Goal
Build a **new application from scratch** (separate repos) that reproduces current business features:
- Complaint management (**Plaintes**)
- Appointment requests (**DemandeRDV**)
- Statistics/reporting (**Statistique**)
- Users/roles/authentication
- Notifications (Email + SMS)
- Exports (Excel/PDF/Word)

This document is task-ready for Jira/Todo tracking.

---

## 2) What must exist in the new app (functional scope)
From legacy behavior, your new app should include:
- Complaint lifecycle: create, edit, assign, classify, track status, close/archive
- Complaint search: by number, citizen, date, status, procedure/reference
- RDV lifecycle: create, confirm, follow-up, cancel, closure, history
- Dashboards/statistics: operational lists + global filtered stats
- Reference data management: source, type, principal/secondary classification, accused profile, etc.
- Admin/security: users, roles, permissions, password reset, audit basics
- Citizen communications: send SMS/email on key workflow events
- Document/report output: Excel exports + PDF/Word generation when needed

---

## 3) Tracker Setup
### Status columns
**Backlog -> To Do -> In Progress -> Review -> Done -> Blocked**

### Priority tags
- `P0` Critical
- `P1` Important
- `P2` Optional

### Work lane tags
- `Backend`
- `Frontend`
- `Shared`

---

## 4) Backlog by Lane (copy directly to Jira/Todo)

## 4.1 Shared / Product Tasks
1. **SGP-001 (P0, Shared) Define MVP scope**  
   Description: Freeze first release scope (must-have screens, endpoints, reports, roles).  
   Done when: Approved MVP checklist exists.

2. **SGP-002 (P0, Shared) Define domain language and contexts (DDD)**  
   Description: Write bounded contexts: Plaintes, RDV, Statistiques, Identity/Admin, ReferenceData, Notifications.  
   Done when: Context map + glossary approved.

3. **SGP-003 (P0, Shared) API contract-first design**  
   Description: Define OpenAPI contracts for MVP endpoints before coding UI.  
   Done when: Versioned API spec published.

4. **SGP-004 (P1, Shared) Data migration strategy**  
   Description: Decide legacy-to-new data import approach (full migration, phased, or hybrid).  
   Done when: Migration runbook drafted.

5. **SGP-005 (P0, Shared) Security and compliance baseline**  
   Description: Password policy, role policy, secret storage, audit fields, PII handling.  
   Done when: Security checklist attached to Definition of Done.

---

## 4.2 Backend Lane (.NET 10, Clean Architecture)
6. **SGP-BE-001 (P0, Backend) Create solution skeleton**  
   Description: Create projects: Domain, Application, Infrastructure, API, Tests.  
   Done when: Solution builds and health endpoint works.

7. **SGP-BE-002 (P0, Backend) Implement authentication and authorization**  
   Description: ASP.NET Core Identity/JWT + role-based policies matching business roles.  
   Done when: Login + protected endpoint checks pass.

8. **SGP-BE-003 (P0, Backend) Model core domain entities**  
   Description: Implement entities/aggregates for Plainte, Justiciable, Dossier, Decision, DemandeRDV, Statut.  
   Done when: Domain model compiles with invariants and unit tests.

9. **SGP-BE-004 (P0, Backend) Implement reference data module**  
   Description: CRUD/read APIs for Source, Type, Classifications, ProfilAccuse, etc.  
   Done when: Frontend can consume reference endpoints for forms.

10. **SGP-BE-005 (P0, Backend) Plainte API v1**  
	Description: Endpoints for create/update/detail/list/search/status changes.  
	Done when: Core plainte workflow test scenarios pass.

11. **SGP-BE-006 (P0, Backend) DemandeRDV API v1**  
	Description: Endpoints for creation, scheduling states, cancellation reason, history.  
	Done when: RDV end-to-end scenarios pass in API tests.

12. **SGP-BE-007 (P1, Backend) Statistique and reporting queries**  
	Description: Build filtered query endpoints for operational and global statistics.  
	Done when: Query contracts validated with sample datasets.

13. **SGP-BE-008 (P1, Backend) Notifications adapters (SMS/Email)**  
	Description: Abstract providers and implement infrastructure adapters for SMTP and SMS gateway.  
	Done when: Notification events send through test/staging providers.

14. **SGP-BE-009 (P1, Backend) Export services**  
	Description: Implement export handlers (Excel first, then PDF/Word) behind interfaces.  
	Done when: At least one export endpoint per module works.

15. **SGP-BE-010 (P0, Backend) Persistence and migrations**  
	Description: EF Core mapping, migrations, indexes, transaction strategy.  
	Done when: Database can be recreated from migrations in CI.

16. **SGP-BE-011 (P0, Backend) Observability and error handling**  
	Description: Structured logging, global exception handling, correlation IDs.  
	Done when: Errors are traceable with actionable logs.

17. **SGP-BE-012 (P0, Backend) Automated tests baseline**  
	Description: Unit tests (domain/application) + integration tests (API + DB).  
	Done when: CI fails on test failures.

---

## 4.3 Frontend Lane (React)
18. **SGP-FE-001 (P0, Frontend) Create React app foundation**  
	Description: Routing, layout shell, state management approach, API client setup.  
	Done when: App runs with env-based API URL.

19. **SGP-FE-002 (P0, Frontend) Auth flow and role guards**  
	Description: Login/logout, token lifecycle, protected routes, role-aware menu.  
	Done when: Unauthorized screens are blocked correctly.

20. **SGP-FE-003 (P0, Frontend) Shared UI components**  
	Description: Data table, filter bar, pagination, modal, form controls, validation messages.  
	Done when: Reusable components used by 2+ features.

21. **SGP-FE-004 (P0, Frontend) Plainte module screens**  
	Description: List/search, create/edit form, detail timeline, status actions.  
	Done when: Main plainte user journey is fully usable.

22. **SGP-FE-005 (P0, Frontend) DemandeRDV module screens**  
	Description: List/search, create form, status updates, cancellation and history display.  
	Done when: RDV user journey is fully usable.

23. **SGP-FE-006 (P1, Frontend) Statistique dashboards**  
	Description: KPI cards, filtered tables/charts, drill-down links.  
	Done when: Priority dashboards match MVP expectations.

24. **SGP-FE-007 (P1, Frontend) Export actions in UI**  
	Description: Trigger and download Excel/PDF/Word exports with progress/error states.  
	Done when: Export UX works on major pages.

25. **SGP-FE-008 (P1, Frontend) Reference data admin screens**  
	Description: Manage source/type/classification/profile master data.  
	Done when: Admin can maintain reference data without DB scripts.

26. **SGP-FE-009 (P0, Frontend) Test coverage baseline**  
	Description: Component tests + critical flow tests (auth, plainte create/search, rdv create).  
	Done when: Frontend CI test job is green.

---

## 5) Suggested execution order
### Sprint 1
- SGP-001, SGP-002, SGP-BE-001, SGP-FE-001, SGP-BE-002, SGP-FE-002

### Sprint 2
- SGP-BE-003, SGP-BE-004, SGP-FE-003, SGP-BE-005, SGP-FE-004

### Sprint 3
- SGP-BE-006, SGP-FE-005, SGP-BE-007, SGP-FE-006, SGP-BE-010

### Sprint 4
- SGP-BE-008, SGP-BE-009, SGP-FE-007, SGP-FE-008, SGP-BE-012, SGP-FE-009

---

## 6) Daily standup format
- Done yesterday:
- Doing today:
- Blockers:
- Need from Backend/Frontend lane:
- Task IDs updated:

---

## 7) Global Definition of Done
A task is Done only if:
1. Code merged
2. Tests pass
3. Tracker updated
4. Security/config impacts documented
5. API/UI docs updated if changed
