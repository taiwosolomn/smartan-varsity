// Prompts that generate the JSON/Markdown files consumed by the two import flows
// (Track detail page's "Import courses & modules" and /import-curriculum). Kept as
// plain exported strings so both "Copy prompt" buttons stay in sync with a single
// source of truth if the prompt text ever needs to change.

export const COURSES_MODULES_IMPORT_PROMPT = `You are converting a written Track breakdown (Courses and Modules) into a JSON file formatted
for bulk import into the Smartanverse LMS.

I will give you a plain-text or loosely structured breakdown of a Track's Courses and Modules.
Your job is to convert it into valid JSON matching this exact structure:

{
  "courses": [
    {
      "name": "Course Name",
      "description": "Short description of what this course covers",
      "modules": [
        {
          "name": "Module Name",
          "description": "Short description of what this module covers"
        }
      ]
    }
  ]
}

Rules:
- Do NOT include any dates, due dates, scheduling info, week numbers, or semester assignments —
  this import is explicitly unscheduled. Leave all of that out entirely.
- Preserve the order of Courses and Modules exactly as I list them — order matters and should be
  implied by array order, not an explicit "order" field, unless I tell you otherwise.
- If a Course or Module has no clear description in what I give you, write a short, accurate one-
  or two-sentence description based on its name and context, don't leave it blank.
- Output ONLY the JSON, no explanation, no markdown code fences, no preamble — just the raw JSON
  so it can be uploaded directly.
- If my breakdown is ambiguous (e.g., unclear whether something is a Course or a Module), make the
  most reasonable structural judgment and proceed — don't ask me to clarify.
Then put the whole thing in a .json file for me to download.

Here is my Track breakdown:

[PASTE YOUR COURSES & MODULES BREAKDOWN HERE]`;

export const CURRICULUM_IMPORT_PROMPT = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SMARTANVERSE CURRICULUM GENERATION PROMPT
Your personal 1-Year Programme, built by you, powered by AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TO USE THIS PROMPT
──────────────────────
1. Read through the entire prompt first before touching anything.
2. Wherever you see a ✏️ FILL IN block, replace the placeholder text with
   your own information.
3. Attach the required documents listed below to your AI conversation.
4. Copy the full prompt (from the line marked COPY FROM HERE) and paste
   it into Claude, ChatGPT, or Gemini along with your documents.
5. The AI will produce your personalized Smartanverse curriculum as a
   Markdown document ready to submit.

DOCUMENTS TO ATTACH TO YOUR AI CONVERSATION
────────────────────────────────────────────
Attach all of the following before sending the prompt:

  [1] SmartanDad's Curriculum Template
      The reference curriculum document SmartanDad designed
      (the Samuel RECOM curriculum PDF)

  [2] The Smartan Builder's Framework (SBF)
      The full SBF document with all 10 competency areas and the
      7-level mastery ladder

  [3] Your Acorn Context Document
      This can be: a case document you wrote, a project brief,
      a notes document, a whitepaper, or even a detailed paragraph
      you paste directly into the chat describing your Acorn.
      The more detail the better. If you have written something
      already, attach it. If not, paste your best description.

  [4] Optional: A Technical Whitepaper or Research Document
      If you have written any deeper technical or conceptual
      document about your Acorn project, attach it here too.
      The AI will use it to deepen the technical accuracy of
      your curriculum.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✏️  FILL IN YOUR DETAILS BELOW BEFORE COPYING THE PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Go through each item below and write your answers. You will paste these
into the prompt where instructed.

  YOUR FULL NAME:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  e.g.  Solomon Oyindamola Taiwo                                      │
  │  Write: ____________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

  YOUR SMARTAN TIER:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Choose one:   Silver   /   SilverPro                                │
  │                                                                      │
  │  Silver = you are newer to self-directed learning and building.      │
  │  SilverPro = you have some foundation and can handle more depth.     │
  │                                                                      │
  │  If you are unsure, ask SmartanDad which tier you are entering at.   │
  │  Write: ____________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

  YOUR ACORN PROJECT NAME:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  e.g.  Tesseract  /  DANFO 2.0  /  RECOM                            │
  │  Write: ____________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

  YOUR ACORN PROJECT — ONE LINE DESCRIPTION:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  e.g.  Post-Quantum, AI-Driven Autonomic Cybersecurity Platform      │
  │  Write: ____________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

  YOUR INDUSTRY / DOMAIN:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  e.g.  Cybersecurity & Quantum Computing  /  Transportation Design   │
  │        /  Cloud Infrastructure & AI                                  │
  │  Write: ____________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

  YOUR CURRENT TECHNICAL STARTING POINT:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Be honest. This tells the AI how deep to go in Semester 1.         │
  │                                                                      │
  │  Examples:                                                           │
  │  "Absolute scratch. I have no prior experience in this field."       │
  │  "I understand the basics of X but have never built anything."       │
  │  "I have done Y course and know Z tool but am not project-ready."   │
  │                                                                      │
  │  Write a sentence or two describing where you actually are:          │
  │  ___________________________________________________________________  │
  │  ___________________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

  YOUR SEMESTER 1 COURSE STRUCTURE:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Based on your Acorn, which courses are you focusing on this         │
  │  semester? All Smartans have:                                        │
  │                                                                      │
  │  - One Smartan Builder Course (SBC 101) — this stays the same       │
  │    for everyone. You do not need to change this.                     │
  │  - AcornLab — tied directly to your Acorn. The AI will define it.   │
  │  - Core Course(s) — these are where your Acorn-specific technical    │
  │    or design learning happens.                                       │
  │                                                                      │
  │  How many Core Courses do you want in Semester 1?                   │
  │  (Choose: ONE core course / TWO core courses)                       │
  │                                                                      │
  │  If TWO: What are the two main subject areas your Acorn needs?      │
  │  (e.g. "Networking & Security" and "Machine Learning" — or          │
  │  "Transportation Design Theory" and "Design Tools like Blender")     │
  │                                                                      │
  │  Write your answer:                                                  │
  │  ___________________________________________________________________  │
  │  ___________________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

  ANY SPECIFIC TOOLS OR SKILLS THAT MUST BE IN YOUR CURRICULUM:
  ┌──────────────────────────────────────────────────────────────────────┐
  │  List any tools, languages, software, or practical skills that       │
  │  must appear in your semester plan.                                  │
  │                                                                      │
  │  e.g.  "Python, Kali Linux, Wireshark"                               │
  │  e.g.  "Blender, Photoshop, Vizcom AI, Sketching"                   │
  │  e.g.  "None — let the AI decide based on my Acorn"                  │
  │                                                                      │
  │  Write: ____________________________________________________________  │
  └──────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COPY FROM HERE — Paste everything below into your AI chat along with your docs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I am giving you the following documents:

  - SmartanDad's Curriculum Template (the reference curriculum he designed)
  - The Smartan Builder's Framework (SBF) with all 10 competency areas
  - My Acorn context document(s)

These give you everything you need to build my personalized Smartanverse
Semester 1 curriculum. Here is exactly what I need you to do.

────────────────────────────────────────────────────────────────
MY DETAILS
────────────────────────────────────────────────────────────────

  My full name:          [PASTE YOUR FULL NAME HERE]
  My tier:               [Silver / SilverPro]
  My Acorn project:      [PASTE YOUR ACORN NAME HERE]
  One-line description:  [PASTE YOUR ONE-LINE DESCRIPTION HERE]
  My domain/industry:    [PASTE YOUR DOMAIN HERE]
  My starting point:     [PASTE YOUR HONEST STARTING POINT HERE]
  Required tools/skills: [PASTE YOUR TOOLS LIST OR WRITE "Let AI decide"]
  Core courses this semester: [ONE / TWO — and describe the subject areas]

────────────────────────────────────────────────────────────────
WHAT TO BUILD
────────────────────────────────────────────────────────────────

Build my complete Smartanverse Semester 1 curriculum as a Markdown document.
Follow the structure and format of SmartanDad's curriculum template exactly,
section by section. Here is what each section must contain and how to handle it.

─── PAGE 1: The Opening Page ──────────────────────────────────────────────────

Replicate the first page of SmartanDad's curriculum template exactly as written,
with only one change: replace the tier label at the top with my tier.

  - If I am SilverPro: use "SilverPro Smartan — Two-Year Intellectual
    Growth Journey"
  - If I am Silver: use "Silver Smartan — Two-Year Intellectual
    Growth Journey"

Then use the Smartan Builder's Framework to find the exact competency description
for my tier level. Replace the SilverPro competency sentence in the template
with the correct sentence for my tier. Everything else on that first page stays
identical.

─── PAGE 2: Personal Header & Acorn Mission ───────────────────────────────────

Header block:
  - Name: my full name
  - Acorn Project: [Acorn name] — [one-line description]
  - Tagline: a single evocative line you write based on my Acorn's purpose

Acorn Mission (two paragraphs):
  - Paragraph 1: The problem my Acorn is solving. Write this emotionally and
    logically, the way you would write it to someone who has never heard of it.
    Make them feel the cost of the problem existing. Pull from my Acorn context
    documents for the real data and human stakes.
  - Paragraph 2: The solution — my Acorn project. Describe it clearly and
    compellingly in one paragraph. A stranger reading this should immediately
    understand what I am building and why it answers the problem above.

Long-term vision: pull from my Acorn documents and write 4 bullet points
describing the long-term capability pillars my Acorn is ultimately building
toward. These should be ambitious but grounded in what the documents describe.

─── PAGE 3: Semester 1 Header & Course Load ───────────────────────────────────

Semester title:
  Give this semester an evocative working title that captures what this
  12-week period is actually about for my Acorn. It should feel like a
  chapter name, not a label.

Semester Objective:
  Based on my starting point and my Acorn's technical or design demands, write
  5 honest bullet points describing exactly what I should be able to do by the
  end of 12 weeks. These must be realistic given where I am starting from.
  Do not overstate. Do not understate.

  TIER CALIBRATION:
  - Silver: objectives should be foundational. Focus on understanding core
    concepts, completing structured learning, and producing one small but real
    proof-of-work artifact by the end of the semester.
  - SilverPro: objectives should reach applied competence. The Smartan should
    be able to build something real, demonstrate it, and defend the decisions
    behind it by Week 12.

Course Load Table:
  Build the course load table based on my details.

  - If I said ONE core course: the table has three rows —
    Core Course A / SBC 101 / AcornLab
  - If I said TWO core courses: the table has four rows —
    Core Course A / Core Course B / SBC 101 / AcornLab

  TIER CALIBRATION for weekly hours:
  - Silver: total hours should sit around 22-25 hours per week.
    Suggested split for one core course: Core A (10h), SBC (5h), AcornLab (7h)
    Suggested split for two core courses: Core A (8h), Core B (6h), SBC (4h), AcornLab (6h)
  - SilverPro: total hours should sit around 28-33 hours per week.
    Suggested split for one core course: Core A (15h), SBC (5h), AcornLab (10h)
    Suggested split for two core courses: Core A (10h), Core B (8h), SBC (5h), AcornLab (10h)

  Give each course its correct code, name, focus area, and weekly hours.
  Name the Core Course(s) using a code built from my Acorn name (e.g. if my
  Acorn is DANFO 2.0, the course might be Danfo101).
  Add a brief italic note below the table explaining the reasoning behind
  the hour distribution.

─── CORE COURSE A (and Core Course B if applicable) ───────────────────────────

For each Core Course, produce:

  Course Header: code and full course name
  Goal: one sentence on what this course achieves for my Acorn

  Weekly Modules with Daily Breakdown:
  12 weekly modules. For each week:
    - Week title: "Week N — [Topic Name]"
    - A Monday-to-Friday daily task table. Each row: Day / Task.
      Each task must be specific, actionable, and directly tied to both the
      week's topic and my Acorn's real needs. Not generic. Not vague.
      The tasks should build week on week — never restart from scratch.

  PRACTICAL SKILLS NOTE: If I listed specific tools or skills, embed them
  naturally into the weekly breakdown at the point where they logically fit.
  Do not stack all tools at the end. Introduce them progressively as the
  learning progresses. For example, a design tool should appear when the
  student has enough conceptual grounding to use it meaningfully.

  Resources section at the end of the course:
    Books, Podcasts, Talks — real, specific, relevant to my Acorn domain.
    Do not list generic titles. Every resource should be something that
    directly feeds the course or the Acorn.

─── SMARTAN BUILDER COURSE (SBC 101) ─────────────────────────────────────────

Keep this section exactly as it appears in SmartanDad's template:
  - Title: "Systems Thinking & Root Cause Analysis"
  - Smartan Builder Alignment: Critical Thinking / Problem Solving /
    Pattern Recognition / Systems Analysis
  - The TIER note for this section:
    If Silver: write a note that the builder course supports foundational
    SilverPro competencies the Smartan is working toward.
    If SilverPro: present it as stated in the template.

Change ONLY the Applied Projects table.
Write 4 projects that are specific to my Acorn's domain.
Each project must:
  - Present a real, named challenge from my industry
  - Have a concrete, named output (Root Cause Report / System Map / etc.)
  - Connect directly to the kind of thinking my Acorn development actually needs

─── ACORN LAB ────────────────────────────────────────────────────────────────

AcornLab Header: use my Acorn's name as the lab name
Goal: one sentence describing what the lab is building this semester

Semester Deliverables table:
  Write 6-8 deliverables that logically progress from research and problem
  framing through to a working first version or first validated concept by
  Week 12. Each deliverable should have a name and a clear description.
  The final deliverable is always the working prototype, first concept
  package, or v0.1 of whatever is appropriate for my Acorn.

Live Industry Experiences table:
  Write 5 real, specific industry experiences that are relevant to my
  Acorn's domain. These are visits, engagements, or events I should
  actually pursue in the next 12 weeks. Name the type of organization,
  not just the category. The final row is always "Smartan Culture Series /
  Public Demonstration."

─── TIMETABLE ────────────────────────────────────────────────────────────────

Standard Weekly Timetable:
  Use the same time mapping as SmartanDad's template:
  7-9am Morning Rituals / 10am-1pm Core Course(s) / 1-2pm Break /
  2-4pm SBC 101 / 4-7pm R&R / AcornLab

  If I have TWO core courses: alternate Core A and Core B across the week.
  Show clearly which days carry which course.

An Ideal Week in Practice:
  Pick one specific week from the semester (any week from Week 3 onwards)
  and build a full Monday-to-Friday day-by-day table showing what I
  actually do each time block that week. Not generic — use the real tasks
  from that week's Core Course breakdown and SBC 101 work and AcornLab
  output to populate every cell. This table should make a complete stranger
  understand exactly what a real week looks like.

─── SEMESTER PROOF OF CAPACITY (POC) ─────────────────────────────────────────

Challenge Theme:
  A compelling question, phrased as a question, that captures what this
  semester is ultimately trying to answer through my Acorn work.

Expected POC Outcome:
  One clear paragraph. What must I demonstrate by the end of Week 12 for
  this POC to be considered complete? Be specific. Name the artifact,
  the demonstration format, and the standard it needs to meet.

Required Deliverables Table:
  Use the same 7-component structure from SmartanDad's template:
  Research / Engineering (or Design / or Building) / AI (if applicable) /
  Validation / Communication / Leadership / Innovation
  Adapt component names where appropriate for my Acorn's domain.

  TIER CALIBRATION:
  - Silver: the deliverables should be more foundational. Research report,
    initial prototype or concept, short presentation, one collaborative task.
  - SilverPro: full working demonstration, documented system, TED-style
    presentation, team leadership, working prototype.

─── CONCLUSION ───────────────────────────────────────────────────────────────

One paragraph. Following the pattern in SmartanDad's template conclusion,
write a closing paragraph that names what this semester represents as a
building block toward my Acorn's long-term vision, ties it to the broader
Smartan philosophy, and closes with a sense of mission rather than summary.

────────────────────────────────────────────────────────────────
FORMAT & OUTPUT INSTRUCTIONS
────────────────────────────────────────────────────────────────

  - Output the entire document as a single Markdown file.
  - Use the same heading hierarchy and section flow as SmartanDad's template.
  - Use clean prose, not AI-formatted bullet dumps.
  - Tables must be properly formatted Markdown tables with headers.
  - No filler phrases. Every sentence must earn its place.
  - If you are uncertain about a domain-specific detail from my Acorn,
    use the Acorn documents I have provided. Do not invent technical claims.
  - Name the output file: [MY FULL NAME]_Smartan_Varsity_1_Year_Programme

Produce the complete document now. Do not summarize it. Do not ask for
confirmation. Output the full Markdown document from start to finish.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK CHECKLIST BEFORE YOU SEND:
  ☐ I have filled in all ✏️ FILL IN sections above
  ☐ I have replaced all [PLACEHOLDERS] in the prompt body with my real info
  ☐ I have attached SmartanDad's curriculum template
  ☐ I have attached the Smartan Builder's Framework
  ☐ I have attached or pasted my Acorn context document
  ☐ I have attached my whitepaper or additional Acorn documents (if I have them)
  ☐ I am using Claude Pro, ChatGPT-4o, or Gemini 1.5 Pro (not a basic model)`;
