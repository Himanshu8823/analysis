# Diagram Notation Notes — Resultiq Final-Year Project Report

**Purpose.** Drawing specification for the eight diagram families in the Black Book report. Follow literally.
**Authority.** Wikipedia (DFD, ER model, Class/Sequence/Activity diagrams, UML, Flowchart), uml-diagrams.org, Sparx Systems UML 2 tutorials, ISO 5807, NIST FIPS PUB 24, IEEE figure guidelines.
**Precedence.** If the college's own report template contradicts this file, the template wins.

---

## 0. Global conventions for every diagram

**Figure numbering.** Chapter-wise: `Figure <chapter>.<n>`, `n` restarting at 1 each chapter (Figure 3.1, 3.2 … Figure 4.1, 4.2). Same for tables (`Table 4.1`). Confirmed by UNB ETD, Flinders, UAA thesis guides.

**Captions.** Below the figure, centred, body font: `Figure 4.1: Level-1 Data Flow Diagram for the marks processing subsystem`. Colon after the number is the dominant convention (UBC/Overleaf, IUB).

**Referencing.** Every figure is cited in body text before it appears: *"The Level-1 DFD is shown in Figure 4.2."* Examiners check for orphaned figures and dangling references. Include a List of Figures in front matter (Word: References → Insert Table of Figures → label "Figure").

**Font.** Diagram internal labels at **12 pt Times New Roman**, matching body text — never smaller. If density forces crowding, split the diagram rather than shrink type. (IEEE's 8–10 pt rule is for two-column journal papers, not a bound thesis.)

**Format.** Vector (PDF/EPS/SVG) or raster ≥300 dpi (600 dpi for line art). Must be legible in black-and-white print — no colour-only meaning; distinguish by shape and label.

**Orientation.** Landscape figures may sit on a landscape page or rotate 90°, caption rotating with it. Keep under ~80% of page width; reduce or split rather than shrink type.

**Drawing hygiene (checked on every diagram).**
- **No crossing lines.** Where connectors must cross, use a line-jump hop or re-route. Crossings are the most common deduction.
- **Consistent direction:** top-to-bottom, left-to-right.
- **Consistent line weight:** 1 pt shapes, 1 pt connectors, 0.75 pt dashed for `include`/`extend`/dependency.
- Arrowhead on every directional edge. Bidirectional association = plain line or double-headed arrow, never two overlapping arrows.
- 8–10 mm whitespace; grid-aligned shapes; equal size for equal-class shapes.
- Legend box if any non-standard symbol is used.
- No big bold title inside the image duplicating the caption.

---

## 1. Data Flow Diagram (DFD) — Levels 0, 1, 2

### 1.1 Notation family

Two families; an examiner accepts either, but **pick one and use it across all three levels**:

| Element | Yourdon / DeMarco (1979) | Gane-Sarson |
|---|---|---|
| Process | Circle (or oval / plain rectangle) | Rounded rectangle |
| Data store | Two parallel horizontal lines, name between them | Rectangle with an open side |
| External entity | Square / rectangle | Square / rectangle |
| Data flow | Named arrow | Named arrow |

**Use Yourdon/DeMarco.** It is the notation on Wikipedia's DFD page and taught in most Indian SA courses; the open-ended two-line data store reads cleanly; Gane-Sarson's open-sided rectangle is frequently mis-drawn. If the college brief names a notation, obey it.

**A DFD is not a flowchart.** No decision diamonds, no loops, no control flow. Branching belongs in an Activity Diagram (section 6).

### 1.2 Symbols

- **External entity:** square. Capital letters for roles (`TEACHER`, `PRINCIPAL`, `STUDENT`) or external systems (`OCR ENGINE`, `EMAIL SERVICE`). Lies outside the boundary.
- **Process:** circle (Yourdon). Two-line label — **`1.0`** above, Title Case name below (`Enter Marks`, `Calculate Results`). Must have ≥1 input and ≥1 output.
- **Data store:** two parallel horizontal lines, **plural lowercase noun** between them: `Students`, `Marks`, `Subjects`, `Allocations`, `AuditLogs`.
- **Data flow:** arrow with a **noun phrase**: `Marks Entry`, `Student List`, `Report File`. Not verbs.

### 1.3 Numbering and levelling

- **Level 0 (context):** exactly **one** process numbered **`0`**. Every external entity around it; every flow enters or leaves through it. **A context diagram with 5 processes is wrong.**
- **Level 1:** decomposes `0` into **3–9** processes (minimum 3 — never 2). Number `1.0`, `2.0`, `3.0`.
- **Level 2:** decomposes one Level-1 process into `1.1`, `1.2`, `1.3`. Hierarchical under the parent number, never a fresh `1.0, 2.0` run.
- **Consistency:** the process labelled `3.0` on Level 1 is the one expanded on Level 2. State the mapping in body text.
- **One Level-2 diagram only.** Pick the parent carrying the arithmetic (`2.0 Marks Processing` or `4.0 Result Computation`) — accuracy is the headline claim.

### 1.4 Expected layout

**Level 0** — one central process, all entities around it:

```
   TEACHER ──Marks Entry──▶ ┌───────────────┐ ◀──Result Report── PRINCIPAL
   STUDENT ──Student Det.─▶│      0        │
   OCR ENGINE ─Parsed Marks─▶│ Result Analysis│
                            └───────────────┘
```

**Level 1** — processes in a row, stores below:

```
 TEACHER   ADMIN   PRINCIPAL   STUDENT
    │         │         │          │
    ▼         ▼         ▼          │
 (1.0)      (2.0)     (5.0)      (6.0)
 Enter      Manage    View       View Own
 Marks      Students  Analytics  Result
    │         │         │          │
    ▼         ▼         │          │
 ══════    ══════       │          │
 Marks    Students      │          │
 ══════    ══════       │          │
    │                     │          │
    └────▶ (3.0) Calculate Results ◀┘
             │    │
             ▼    ▼
        ══════ ══════
         Results AuditLogs
        ══════ ══════
```

**The most important DFD rule: no direct flow between two external entities**, and none between two data stores. A data store never sends to a data store.

### 1.5 Rules an examiner checks

1. Every flow has ≥1 process endpoint. Entity→entity and Store→Store are errors.
2. Every process has ≥1 input and ≥1 output.
3. **Balanced parent/child** — the inputs and outputs of parent `2.0` exactly equal the flows entering/leaving the Level-2 diagram that decomposes it. Nothing appears "from nowhere" at the child; nothing is lost at the parent. Hardest thing to get right: draw the child, list the parent's flows on paper, tick each off.
4. Data stores appear at the highest level where first used, and at every lower level as well.
5. One data type per flow. "Marks and Students" is two flows.
6. Every flow named (except where self-evident). Names understandable without commentary.
7. 3–9 processes per diagram.
8. Consistent with ERD, Activity diagrams and data dictionary — same names everywhere.

### 1.6 Common mistakes

- Multiple processes in the context diagram.
- Mixing Yourdon circles with Gane-Sarson rounded rectangles across levels.
- Decision diamonds in a DFD.
- Verb labels on arrows (`enters marks`) instead of nouns (`Marks Entry`).
- Singular or snake_case store names (`Student`, `student_records`).
- Unbalanced parent/child — the most fatal error.
- "Black hole" (inputs, no outputs), "miracle" (outputs, no inputs), "grey hole" (only outputs).
- Using DFD for control flow instead of data transformation.

---

## 2. Use Case Diagram (UML 2.x)

### 2.1 Symbols

```
   ┌──────────────────────────────────────────────┐
   │         Result Analysis System              │ ← boundary rectangle,
   │  (Enter Marks)        (Generate Report)      │   name bold at top edge
   │  (View Result)        (Manage Users)         │
   └────────────────┬─────────────────────────────┘
                    │
                  ──┴──  Actor (stick figure)
```

- **Actor:** stick figure for a human role; **filled rectangle** with `«...»` for an external system (`«OCR Engine»`). Name by **role**, not person: `Teacher`, `HOD`, `Principal`, `Admin`, `Student` — never "Mr. Sharma".
- **Use case:** ellipse, **verb phrase, Title Case, no article**: `Enter Marks`, `Generate Report`, `Approve Result`, `Manage Students`, `View Analytics`, `Login`.
- **System boundary:** rectangle, system name bold at top-left or top-centre. One per diagram.
- **Association:** plain solid line, **no arrowhead**.
- **`«include»`:** dashed arrow, open (stick) head, labelled `«include»`, pointing **from base → included**. Mandatory reuse.
- **`«extend»`:** dashed arrow, open head, labelled `«extend»`, pointing **from extending → base**. Optional/conditional behaviour.
- **Generalization:** solid line, **hollow triangle** at the parent end.
- **System actor:** the boundary rectangle itself; use `«system»` where a use case is a black box (pairs with a system sequence diagram).

### 2.2 Naming and structure conventions

- Use case names start with a verb: `Manage Students`, not `Students Management`.
- No actor connected to more than ~8 use cases on one diagram — split by role group if dense. A good report draws **two or three** use case diagrams (academic staff, administration, student self-service).
- `Login`/`Logout` are valid use cases associated with every actor, usually drawn in a corner.
- 8–15 ellipses per diagram maximum. Never one mega-diagram.

### 2.3 What a high-quality example looks like

5–6 actors around one boundary; 10–14 verb-phrase ellipses inside; `«include»` from `Generate Report` to `Compute Result` (mandatory); `«extend»` from `Publish Result` to `Generate Report` (conditional on approval); generalization from `Super Admin` to `Admin` if the seed supports it; no crossed lines.

### 2.4 Rules an examiner checks

1. `«include»` arrow points **towards the included** use case; `«extend»` points **towards the extended (base)** use case. Reversed directions are the classic error.
2. Every use case has ≥1 actor association (unless reachable only via include/extend).
3. Actors named as roles.
4. System boundary present and labelled.
5. No actor-to-actor lines.
6. Consistent `«include»`/`«extend»` labelling style throughout.
7. No crossed lines.

### 2.5 Common mistakes

- Reversed include/extend arrows.
- Noun-named use cases.
- Mixing stick-figure and rectangle actors inconsistently.
- Treating a use case diagram as a DFD.
- Drawing internal classes inside the boundary.

---

## 3. Entity Relationship Diagram (ERD)

### 3.1 Choosing between Chen and Crow's Foot

Both acceptable. **Draw Crow's Foot (Martin / IE) as the primary ERD** — directly mappable to the Prisma schema, unambiguous to an examiner — and optionally a small Chen-notation ERD as a supplementary figure if the brief asks for both. Never mix notations in one diagram.

### 3.2 Crow's Foot symbols

- **Entity:** rectangle. Title Case, consistent with schema: `Student`, `Subject`, `Marks`, `Branch`, `Scheme`, `AcademicYear`, `SubjectOffering`, `Allocation`, `User`, `Role`, `AuditLog`, `Exam`.
- **Primary key:** underlined attribute name (carried over from Chen); mark FKs with an `FK` suffix.
- **Relationship:** a **line** between two boxes, named with a lowercase verb phrase: `belongs to`, `is offered in`, `has marks in`, `is allocated to`.
- **Cardinality glyphs** at each end, read as a pair — **inner = minimum, outer = maximum**:

| Glyph pair | Meaning | Example |
|---|---|---|
| Ring `o` + dash `\|` | zero or one (optional) | a student has *at most one* login account |
| Dash `\|` + dash `\|` | exactly one (mandatory) | every allocation **must** have one teacher |
| Ring `o` + crow's foot `<` | zero or many (optional) | a branch has *zero or many* subjects |
| Dash `\|` + crow's foot `<` | one to many (mandatory) | one student **has one or many** marks records |

- Tool-specific optionality marker (small circle on the line) is fine — just don't mix it with Chen's double line.

### 3.3 Chen notation symbols (supplementary figure)

- **Entity set:** rectangle. **Relationship set:** **diamond**. **Attribute:** **oval** on a line to exactly one entity or relationship.
- **Primary key:** attribute name **underlined**.
- **Total participation:** **double line**. **Key constraint:** **arrow** toward the relationship. **Both:** **thick line**.
- Chen's original convention is **look-across** — cardinality on the far end.

```
   ┌──────────┐        ◇         ┌──────────┐
   │ Student  │◄───────┤         │  Branch  │
   └────┬─────┘   has  │         └──────────┘
        │
     ( ─── )        ( ··· )       ( o─── )   ← attribute ovals
      rollNo(PK)     name          code
```

### 3.4 Naming and structure conventions

- ERD entity names **singular** (`Student`); DFD data store **plural** (`Students`). Standard, not a contradiction — the store is the collection, the entity is the type. **State this once in body text** so the examiner doesn't flag it.
- Relationship names lowercase verb phrases.
- **Role names** where both ends are the same entity (e.g. `manager`/`report` on a self-referencing `User` tree): concise nouns, not sentences.
- Don't model every relationship — model the ones carrying the business rules the report claims (allocation scoping, pending-vs-failed, scheme-specific calculation).
- **Never model computed values as entities.** `SGPA`, `Percentage`, `Total Marks`, `Result Verdict` are derived attributes of `Marks` — show as `/sgpa` or omit.

### 3.5 Rules an examiner checks

1. Correct cardinality glyph pairs, from the four rows above — no ad-hoc symbols.
2. Mandatory vs optional correct. The distinction between "a student may have zero marks records" and "every marks record belongs to exactly one student" is exactly where the business rules live.
3. Every entity has a primary key.
4. No orphan relationships; every line touches two entity boxes.
5. Chen: attribute ovals attach to exactly one entity.
6. No crossing lines.
7. ERD names match DFD stores and the schema.

### 3.6 Common mistakes

- Mixing Chen and crow's foot in one diagram.
- Reversed cardinality (glyph on the wrong end).
- Many-to-many modelled without a junction entity (`Student` ↔ `Subject` needs `Marks`).
- Audit log modelled as a plain attribute.
- 1:1 where 1:N is true (`User`↔`Student` is optional 1:1 → ring+dash).
- Diagram so dense it needs an A3 page.

---

## 4. Class Diagram (UML 2.x)

### 4.1 Symbols

```
  ┌───────────────────────────┐
  │        Student            │  ← name: BOLD, centred
  ├───────────────────────────┤
  │ - id: String              │  ← attributes: left-aligned, lowercase
  │ - rollNo: String          │
  │ + name: String            │
  │ + sgpa: Float             │
  ├───────────────────────────┤
  │ + enroll(): void          │  ← operations: left-aligned, lowercase
  │ + hasPassed(sub): Bool    │
  └───────────────────────────┘
```

- **Three compartments:** name / attributes / operations.
- **Visibility (mandatory on every member):** `+` public, `-` private, `#` protected, `~` package.
- **Static member:** underlined name. **Abstract:** italic name. **Derived:** `/` prefix.
- **Interface:** lollipop (circle on a stick); implementer connects by **dashed line with hollow triangle** at the interface end. Or `«interface»` stereotype on a class box.
- **Relationships:**
  - **Generalization (is-a):** solid line, **hollow triangle** at the superclass end.
  - **Association (has-a):** solid plain line, **no arrowhead**, with **multiplicity** at both ends and optional role name.
  - **Dependency (uses):** **dashed** line, **open arrowhead** at the supplier.
  - **Aggregation:** solid line, **hollow diamond** at the owner end.
  - **Composition:** solid line, **filled black diamond** at the owner end (owner controls part lifecycle).
- **Multiplicity:** `0`, `1`, `0..1`, `1..1`, `0..*` (or `*`), `1..*`.

### 4.2 Naming and structure conventions

- Class names **Title Case, singular, no underscores**: `MarksRecord`, `ResultCalculator`, `AuditService`.
- Methods **lowerCamelCase with a verb**: `calculateSgpa`, `publishResult`.
- Attributes **lowerCamelCase**; `?` for nullable/optional (Prisma convention) — state the convention in a note if used.
- **Don't populate all four compartments.** An over-populated class diagram is a schema dump and scores worse than a focused one.
- Max 12–15 classes per diagram; split into "domain entities" and "services/controllers" if needed.
- **Stereotypes** `«entity»`, `«service»`, `«controller»`, `«repository»` encouraged — they mirror the NestJS module structure and show architectural discipline.

### 4.3 Rules an examiner checks

1. Visibility markers on every attribute and operation.
2. Multiplicities at both ends of every association.
3. Generalization triangle **hollow**, pointing at the parent.
4. Composition diamond **filled**, aggregation **hollow**. Filled diamond on a plain association is an error.
5. Dependencies **dashed** with open arrowhead.
6. Consistent naming and casing across the whole report.
7. Classes correspond to real things in the system — the examiner may compare against the code or ERD.

### 4.4 Common mistakes

- Missing visibility markers (very common deduction).
- Directionless association where a dependency is meant.
- Bidirectional associations where the code is one-way.
- Modelling DTOs and Prisma internals instead of domain classes.
- Copying the schema 1:1 with 60 columns.

---

## 5. Sequence Diagram (UML 2.x)

### 5.1 Symbols

- **Lifeline:** vertical **dashed** line headed by a box (stick figure for an actor). Label **`instanceName : ClassName`** (`teacher : Teacher`, `marksController : MarksController`) or plain `ClassName` for a stateless service. `«actor»` for humans.
- **Activation bar:** thin **filled vertical rectangle** on the lifeline showing work in progress.
- **Messages:** horizontal arrows, name **above** the arrow, verb phrase with parameters: `submitMarks(entry)`.
  - Synchronous call: **filled arrowhead**. Asynchronous: **open (stick) arrowhead**.
  - Return/reply: **dashed line, open arrowhead**, returning rightward.
  - Creation: dashed line, open head, `<<create>>` label.
  - Destruction: **X** at the bottom of the lifeline; the dashed line stops there.
  - Found message: originates from a **filled small circle** at the top of the lifeline.
- **Combined fragments:** rectangular frame around the lifelines, **small pentagon tab in the top-left corner** with the operator keyword, **guard in square brackets**:
  - `alt` — alternatives; mutually exclusive branches, one per guard.
  - `opt` — optional; single branch with a guard.
  - `loop` — iteration; count/condition in the tab or as a guard.
  - `break` — early exit. `par` — concurrent branches. `ref` — reference another diagram.
- **Note:** rectangle with folded corner, **dashed** line to the element it annotates.

```
 Teacher      MarksController   ResultCalculator   Repository
   |                |                   |                |
   |--submitMarks()->|                   |                |
   |                |--calculateResult()->|                |
   |                |                   |--save(marks)--->|
   |                |<--resultSummary----|                |
   |<--marksSaved----|                   |                |
```

### 5.2 Naming and structure conventions

- **Lifelines left-to-right in message-flow order.** Initiating actor leftmost; data stores last.
- Message names are verb phrases with parameters; returns named `resultSummary`, `savedMarks`, `error`.
- **Time flows downward.** A response always sits below its request.
- 4–7 lifelines ideal; 12 is unreadable. Show only objects that matter.
- Guards in square brackets next to the message: `[role = TEACHER]`.
- Prefer `alt` with two operands over nested if-logic.

### 5.3 Rules an examiner checks

1. Messages ordered top-to-bottom; every return below its request.
2. Correct arrowheads: filled synchronous, open asynchronous, dashed return.
3. **No arrow pointing up** (no message crossing backwards in time).
4. Activation bars present where an object works.
5. `alt`/`opt`/`loop` frames have operator tab and guards.
6. The scenario matches the use case diagram — same actors, same use case name.
7. Lifelines vertical and parallel, so no crossings.
8. `instance : Class` where instances matter; class name where stateless.

### 5.4 Common mistakes

- Solid arrows for return messages.
- Loops drawn as a loop-back arrow instead of a `loop` fragment.
- Missing activation bars.
- A "sequence" diagram that is really a flowchart with vertical boxes.

---

## 6. Activity Diagram (UML 2.x)

### 6.1 Symbols

- **Action / activity:** **rounded rectangle** (stadium). Verb phrase label.
- **Initial node:** **filled black circle** ●.
- **Final node:** **filled black circle inside a ring** ◉. Use several finals for alternative end states.
- **Decision / merge:** **diamond**. Decisions branch on guards; merges recombine. Label outgoing edges with conditions.
- **Fork / join:** **thick black bar**. Fork = one in, many out; join = many in, one out. Only for genuine concurrency.
- **Object node / data store:** rectangle with `«dataStore»`; cylinder for a database.
- **Swimlanes:** parallel vertical (or horizontal) partitions with a **bold** role header (`Teacher`, `System`, `Admin`). Flow crosses lanes; each action sits in the lane of whoever performs it.
- **Control flow:** solid arrow. **Object flow:** dashed arrow.

### 6.2 Conventions and rules an examiner checks

- Exactly **one initial node**, ≥1 final node, start at the top.
- Action labels are verb phrases: `Validate marks`, `Select scheme`, `Check completeness`, `Compute SGPA`, `Publish result`.
- **Every decision branch labelled** in square brackets: `[marks complete]`, `[scheme = 2024]`. Every branch has a path to the end.
- Fork/join used correctly (1-in/many-out vs many-in/1-out). A simple if/else is a diamond, not a fork.
- Swimlane headers bold; actions correctly placed in lanes.
- Control flow strictly top-to-bottom / left-to-right.
- **The logic the project is proud of must be visible** — for Resultiq, pending-vs-failed handling and scheme-specific calculation. A diagram that hides those branches does not earn its place.

**Role separation from section 8.** In UML 2 the activity diagram absorbed the flowchart role. For this report: the **Activity Diagram models one subsystem's internal algorithm** (result computation with scheme branching); the **Overall Flowchart models the end-to-end system workflow** (section 8). One scenario per activity diagram.

### 6.3 Common mistakes

- Using an activity diagram as a DFD (data stores drawn as swimlanes).
- Unlabelled decision branches.
- Fork used for a simple if/else.
- Multiple initial nodes.
- Non-bold swimlane headers.

---

## 7. System Architecture / Layered Architecture Diagram

### 7.1 Notation family

The one diagram type with **no single standard** — it is an architecture/deployment view, not a language-defined notation. Two acceptable renderings: the **UML component diagram** (strict, defensible) or the **layered/stacked-rectangle block diagram** (the industry convention for three-tier systems and what most examiners expect from a B.Tech report).

**Use the layered block diagram as the main architecture figure**, with component names inside each band — it communicates the structure instantly. Use UML 2.x component notation only if the brief explicitly asks for "component diagram".

### 7.2 Layered block diagram — expected layout

```
 ┌───────────────────────────────────────────────────────────────┐
 │  PRESENTATION LAYER                                          │
 │  ┌──────────┐┌───────────┐┌────────────┐┌──────────┐        │
 │  │ React UI ││Components ││   State    ││  Charts  │        │
 │  │  Views   ││  Library  ││  (TanStack)││ (Recharts│        │
 │  └──────────┘└───────────┘└────────────┘└──────────┘        │
 └──────────────────────────┬────────────────────────────────────┘
                            │  HTTPS / JSON
 ┌──────────────────────────▼────────────────────────────────────┐
 │  APPLICATION / API LAYER  (NestJS)                           │
 │  ┌─────────┐┌──────────┐┌───────────┐┌──────────────────────┐ │
 │  │ Guards  ││Intercept.││Controllers││      Services       │ │
 │  │ (RBAC)  ││ (Audit)  ││           ││  (business logic)   │ │
 │  └─────────┘└──────────┘└───────────┘└──────────────────────┘ │
 │  ┌─────────────┐┌──────────────┐┌───────────────────────────┐ │
 │  │   Modules   ││  Calculators ││  Jobs / OCR Processor     │ │
 │  │  (domain)   ││(scheme strat)││      (BullMQ)             │ │
 │  └─────────────┘└──────────────┘└───────────────────────────┘ │
 └──────────────────────────┬────────────────────────────────────┘
                            │  Prisma ORM
 ┌──────────────────────────▼────────────────────────────────────┐
 │  DATA ACCESS LAYER                                           │
 │  ┌──────────────┐┌──────────┐┌────────────────┐              │
 │  │ Repositories ││ Mappers  ││ Prisma Client  │              │
 │  └──────────────┘└──────────┘└────────────────┘              │
 └──────────────────────────┬────────────────────────────────────┘
                            │
           ╔═════════════════▼══════════════════╗
           ║  PostgreSQL (Neon)   Database         ║  ← cylinder
           ║  Redis (cache / queue)                 ║
           ╚═══════════════════════════════════════╝
```

- Layers: **Presentation** → **Application/API** → **Data Access**. Arrows point **downward** only (upper calls lower; lower never calls up).
- **External dependencies sit beside the stack**, not inside a tier: `Redis`, `PostgreSQL`, `OCR engine`, `SMTP/Email`.
- **Cross-cutting concerns** shown as a **vertical band beside the stack** spanning the layers they affect: `Cross-cutting: JWT Auth · RBAC Guards · Audit Interceptor`. The project makes a strong security/audit claim — it must be visible here.
- If you show the response path, add one upward arrow labelled "response" and keep it visually distinct; otherwise keep the stack one-directional and note it in the caption.

### 7.3 UML component diagram alternative

- **Component:** rectangle with **two small tabs on the left edge**.
- **Dependency:** **dashed** line with an **open arrowhead** at the depended-upon component.
- **Port:** small square on a component edge; **provided interface:** lollipop (filled circle); **required interface:** socket (half circle).
- **Node** (deployment): 3-D box; **artifact:** component with `«artifact»` stereotype.

### 7.4 Rules an examiner checks

1. Every layer has a clear label and a single clear responsibility.
2. Arrows flow one direction (top-down); **no upward dependency arrows**.
3. External systems visually distinguished from internal layers.
4. Cross-cutting concerns visible.
5. Layer names match the code structure described elsewhere in the report.
6. No empty layer; no grab-bag layer.

### 7.5 Common mistakes

- Database drawn inside the data access layer instead of below/beside it.
- Upward arrows implying a cycle.
- Listing 30 module names at 6 pt.
- Omitting external services, making the diagram look like a monolith.
- Confusing this with a deployment diagram (servers/VMs — unnecessary here).

---

## 8. Overall System Flowchart

### 8.1 Notation family

**ANSI/ISO flowchart symbol set** — ISO 5807:1985 (superseded ISO 1028:1973; NIST FIPS PUB 24 is the US federal counterpart). This is a **flowchart**, distinct from the DFD (section 1) and Activity Diagram (section 6): it shows the **chronological, decision-laden operation** of the whole system start to finish. Keep the symbol sets of the three diagram types strictly separate.

### 8.2 Symbols

| Meaning | Symbol |
|---|---|
| Terminator (start/end) | **Stadium** (rounded rectangle / oval) |
| Process / operation | **Rectangle** |
| Decision | **Diamond** |
| Input / output | **Parallelogram** |
| Document / report | Rectangle with **wavy base** |
| Data store / database | **Cylinder** |
| Manual operation | Trapezoid (long parallel side on top) |
| Manual input | Irregular quadrilateral, sloping top edge |
| On-page connector | Small **circle**, labelled |
| Off-page connector | **Pentagon** (home-plate) pointing off page |
| Predefined process | Rectangle with **double-struck vertical edges** |
| Preparation | Elongated **hexagon** |
| Annotation | Open rectangle, dashed connector |
| Parallel processing | **Thick bar** (fork 1-in/many-out, join many-in/1-out) |

### 8.3 Expected flow for Resultiq

```
 START(stadium)
   ▼
 Login & Authenticate [rect]
   ▼
 Upload Result Statement [parallelogram] ──▶ Parse PDF / Extract Rows [rect]
   ▼ (join)
 Rows valid? [diamond]
   ├─[no]─▶ Show Parse Errors & Re-upload [rect] ──┐ (loop back)
   └─[yes]▶ Confirm & Write Marks (1 txn) [rect]    │
                    ▼                                │
              Compute Result (scheme-specific) [rect]│
                    ▼                                │
              All marks present? [diamond]           │
                    ├─[no]─▶ Block Publish (pending) ─┤
                    └─[yes]▶ Generate Report (Excel/PDF) [rect]
                                        ▼
                                 HOD/Admin Approve [rect]
                                        ▼
                              Publish Result + Audit Log [rect]
                                        ▼
                                   END (stadium) ◀───┘
```

### 8.4 Rules an examiner checks

1. **One start and one end** (or clearly labelled alternative end states).
2. Flow top-to-bottom, left-to-right.
3. **Every decision diamond has all outgoing branches labelled**, each with a defined path to the end. A decision with one arrow out is an error.
4. **No crossing lines** — re-route, or use a labelled on-page connector where a line must jump.
5. Arrowhead on every arrow.
6. **Input/output uses the parallelogram**, never a plain rectangle.
7. **Database is a cylinder**, not a rectangle.
8. The chart covers the **real complete flow** — login → upload → parse → validate → compute → approve → publish → report — not a toy path.

### 8.5 Common mistakes

- Unlabelled decision branches.
- Same symbol for "process" and "input/output".
- Loops drawn as an arrow flying back across the page; use a proper backward edge or connector.
- Multiple unexplained end points.
- Flowchart shapes leaking into the DFD (section 1).

---

## 9. Cross-diagram consistency checklist (run before finalising)

- [ ] Same capability named the same way everywhere: `Generate Report` (use case), `Generate Report` (DFD process), `ReportService` (class), `generateReport()` (sequence message).
- [ ] DFD store names correspond to ERD entities (plural store ↔ singular entity — state the convention once).
- [ ] Every diagram numbered, captioned, and referenced in body text before it appears.
- [ ] Figure numbers unique, chapter-wise, sequential.
- [ ] Legible in black-and-white at printed size.
- [ ] No crossing lines, floating labels, stray arrowheads.
- [ ] 12 pt diagram font (or the college template's), never below body text size.
- [ ] **No source code, file paths, function names, endpoint URLs, or credentials** in any diagram (project style rule: the audience is not developers).
- [ ] System boundary drawn consistently in the DFD context diagram, use case diagram and architecture diagram — the same "Resultiq / Result Analysis System" scope.

---

## 10. Sources

- Wikipedia — [Data-flow diagram](https://en.wikipedia.org/wiki/Data-flow_diagram) (Yourdon/DeMarco symbols, levelling, store naming, process count, rules)
- Wikipedia — [Entity–relationship model](https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model) (Chen and crow's foot symbols, cardinality pairs, key-constraint notation, role naming)
- Wikipedia — [Class diagram](https://en.wikipedia.org/wiki/Class_diagram) (compartments, visibility markers, relationship and multiplicity notation)
- Wikipedia — [Sequence diagram](https://en.wikipedia.org/wiki/Sequence_diagram) (lifelines, activation bars, message types, combined fragments)
- Wikipedia — [Activity diagram](https://en.wikipedia.org/wiki/Activity_diagram) (node shapes, start/end/decision/fork/join symbols)
- Wikipedia — [Unified Modeling Language](https://en.wikipedia.org/wiki/Unified_Modeling_Language) (UML 2.x diagram taxonomy)
- Wikipedia — [Flowchart](https://en.wikipedia.org/wiki/Flowchart) (ANSI/ISO symbol set, construction rules)
- Wikipedia — [Multitier architecture](https://en.wikipedia.org/wiki/Multitier_architecture)
- uml-diagrams.org — [Use case diagrams reference](https://www.uml-diagrams.org/use-case-reference.html), [Sequence diagrams reference](https://www.uml-diagrams.org/sequence-diagrams-reference.html)
- Sparx Systems — [UML 2 Tutorial: Use Case Diagram](https://sparxsystems.com/resources/tutorials/uml2/use-case-diagram.html), [Sequence Diagram](https://sparxsystems.com/resources/tutorials/uml2/sequence-diagram.html)
- Visual Paradigm — [What is Use Case Diagram?](https://www.visual-paradigm.com/guide/uml-unified-modeling-language/what-is-use-case-diagram/), [Mastering UML 2.0 Sequence Diagrams](https://www.visual-paradigm.com/guide/mastering-uml-2-0-sequence-diagrams-a-comprehensive-guide-to-modeling-time-ordered-interactions/), [DFD Balancing guide](https://guides.visual-paradigm.com/mastering-data-flow-diagram-balancing-a-comprehensive-guide/)
- Lucidchart — [Data Flow Diagram Symbols](https://lucid.co/diagram/dfd/symbols-and-notation), [Flowchart Symbols](https://lucid.co/diagram/flowchart/symbols)
- SoftwareIdeas — [Data Flow Diagram (DFD)](https://www.softwareideas.net/dfd-data-flow-diagram) (side-by-side notation comparison)
- ISO — [ISO 5807:1985 Information processing — Documentation symbols and conventions for data, program and system flowcharts](https://www.iso.org/standard/11955.html) (ISO 1028:1973 superseded and withdrawn)
- NIST — [FIPS PUB 24: Flowchart symbols and their usage in information processing](https://nvlpubs.nist.gov/nistpubs/Legacy/FIPS/fipspub24.pdf)
- IEEE — [Guidelines for Figures and Tables](https://proceedingsoftheieee.ieee.org/resources/guidelines-for-figures-and-tables/)
- University of New Brunswick — [Images & Captions (ETD FAQ)](https://lib.unb.ca/etd/faq/q2) (chapter-wise figure numbering)
- Flinders University — [Thesis formatting and long documents](https://staff.flinders.edu.au/content/dam/staff/documents/ienrol/long-docs-thesis-format.pdf) (Figure 4.1 = first figure in Chapter 4)
- University of Alaska Anchorage — [Thesis Formatting Handbook](https://www.uaa.alaska.edu/academics/graduate-school/students/_documents/Thesis%20Formatting%20Handbook_AY%202022-2023.docx.pdf)
- Utah State University — [Tables and Figures](https://engineering.usu.edu/students/engineering-writing-center/writing-resources/tables-figures) (serif font guidance, caption placement)
- Ibrahim, R. — [Formalization of the Data Flow Diagram Rules for Automated Checking](https://arxiv.org/pdf/1011.0278) (balancing and consistency rules)
- University of Kentucky — [Systems Analysis lecture notes](https://www.uky.edu/~dsianita/390A&D/lecture3.html) (DFD consistency "check for errors" rules)
