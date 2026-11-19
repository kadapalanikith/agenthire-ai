AgentHire (Agentic-AI Based Recruiter)
Technical Reading Material
Building an AI-Recruitment Agent Platform (AgentHire) with SDD
Table of Contents
Introduction and Session Flow
What Spec Driven Development Means
Why SDD Matters
What You Are Going to Build Today
The Parameters of a Good Specification
Complete Specification - Project Overview and Tech Stack
Complete Specification - Authentication, Jobs, Candidates, and Workflow Orchestration
Complete Specification - AI Agents, RAG, LangGraph, and Email Layer
Complete Specification - Frontend Pages
Complete Specification - Backend Architecture and Database Collections
Complete Specification - API Endpoints
Complete Specification - Folder Structure and Development Phases
Complete Specification - UI, Security, Outcome, and Codex Instructions
Complete Spec
Where Each Specification Parameter Shows Up
Setting Up Codex Chat or GitHub Copilot in VS Code
How to Properly Write Specs for AI Coding Agents
How to Build the Project Using the Specification
Why a Single Spec Is Not Enough
Closing Thought
Introduction and Session Flow
Spec Driven Development
Building an AI Recruitment Agent Platform (AgentHire) with SDD
The aim is practical. After reading this, you should be able to take the project specification provided here, hand it to an AI coding agent inside VS Code, and produce the same kind of working recruitment product with recruiter authentication, public candidate applications, resume parsing, RAG retrieval, AI-driven matching, shortlisting, human approval, interview generation, email output, workflow visualization, and analytics.

AgentHire is not a chatbot project. It is a workflow orchestration platform for recruitment. A recruiter creates a job, a candidate applies through a public page, and a LangGraph-driven AI workflow processes the candidate through a fixed sequence of agents. The system persists workflow state, pauses for a recruiter approval checkpoint, and then continues to interview and email generation - all backed by spec files in /specs.

Session Flow
What Spec Driven Development Means
Why SDD Matters
What You Are Going to Build Today
The Parameters of a Good Specification
Setting Up Codex Chat or GitHub Copilot in VS Code
How to Properly Write Specs for AI Coding Agents
How to Build the Project Using the Specification
Why a Single Spec Is Not Enough
What Spec Driven Development Means
Spec Driven Development, often shortened to SDD, is a development approach where the specification is written before any code is produced. The core principle is simple: Specification first, Code second.

In traditional development, a developer often opens an editor and starts writing code with only a rough idea of the requirements. In SDD, the developer pauses before writing code and writes a complete document that explains what the product does, who it is for, which technologies are being used, which features must exist, which pages and data models are required, how authentication and AI calls should work, how the project should be organized, and how the final product should be verified.

Once this specification is complete, the actual implementation is generated from it. The specification acts as the single source of truth for the entire build. Whenever the agent is unsure, it returns to the spec rather than guessing. For a multi-agent product like AgentHire - where a resume parser, embedding agent, matching agent, shortlisting agent, human approval checkpoint, interview agent, and email agent all need to cooperate - the spec is the only thing that keeps the moving parts coherent.

Why SDD Matters
SDD matters most when you are working with AI coding agents. A vague prompt produces vague code. If you ask an AI to "build me an AI hiring app", the agent has to guess everything, and it usually picks random libraries, mixes TypeScript into a JavaScript project, introduces Prisma or NestJS, hardcodes scoring thresholds, skips the human approval checkpoint, and produces a chatbot instead of a workflow product.

A clear specification eliminates almost all of this. The agent has a fixed contract to follow, so it stops drifting between prompts, stops hallucinating endpoints that do not exist, and produces code that is easier to maintain. The specification also doubles as documentation, which means new contributors can read it and understand the project without reading every file.

For a small weekend prototype, prompt-based exploration is fine. For a full-stack product with JWT authentication, MongoDB and Mongoose, PDF uploads, Zod validation, Qdrant vector storage, LangGraph workflows, RAG retrieval, human approval pauses, Resend email, and React Flow visualization, SDD is essential.

What You Are Going to Build Today
Today you are going to build a full-stack AI-powered application called AgentHire - an AI Recruitment Agent platform. It is a recruiter-focused workspace where a recruiter can sign up, create jobs, monitor candidates, inspect AI workflows, approve candidates at a checkpoint, and review analytics. The candidate side is public: a candidate opens a job page, submits their name, email, phone number, and PDF resume, and the system automatically starts the AI workflow.

The platform converts an uploaded resume into a fully scored, decision-ready candidate by running it through a chain of cooperating agents - a Resume Parser Agent that extracts structured candidate facts, an Embedding Agent that pushes resume and policy chunks into Qdrant, a Matching Agent that compares the candidate against the job's required skills, preferred skills, and minimum experience using RAG context, a Shortlisting Agent that turns the score into a shortlisted / hold / rejected decision using thresholds from /specs, a Human Approval checkpoint that pauses the workflow, an Interview Agent that generates questions and rubrics, and an Email Agent that produces interview-invite or rejection output. The workflow is orchestrated by LangGraph with retries, checkpoints, resumability, and state persistence, and the same workflow is rendered live on a React Flow canvas with color-coded node states.

The stack is Next.js 15 App Router, React 19, Tailwind, shadcn/ui, Zustand, React Hook Form, Zod, and React Flow on the frontend, and Node.js, Express, MongoDB, Mongoose, Zod, JWT, bcryptjs, multer, helmet, and a modular Express architecture on the backend. AI behavior runs through LangGraph and LangChain, embeddings use BAAI/bge-small-en-v1.5, vectors live in Qdrant, the primary LLM is Groq's free tier with OpenRouter free models as a fallback, and email goes through Resend's free tier. The end result should feel like a modern recruiter console: clean, operational, workflow-driven, with every hiring rule traceable to a specification file under /specs.

The Parameters of a Good Specification
Not every document qualifies as a good spec. A specification that an AI can reliably build from should meet a few quality bars:

Clarity
every sentence has one meaning, with no vague words like "etc." or "and so on".
Completeness
product purpose, stack, features, pages, data models, routes, folder structure, and verification are all covered.
Consistency
names used in the frontend match the names used in the backend.
Concrete technology choices
the stack is named explicitly, not described in general terms.
Structured sections
related information lives under clear headings that are easy to scan.
Phased delivery
the build is broken into reviewable phases instead of one giant deliverable.
Authoritative tone
words like "must" and "should" are preferred over soft suggestions.
The specification below for AgentHire was written with these parameters in mind. Read it as a reference, then look at the short notes at the end of this section that map each parameter back to where it shows up in the spec.

Important SDD Spec Topics to Include in Every Project
These topics are highlighted in the AgentHire specification, but they are not limited to this project. When creating any project using SDD, the specification should clearly mention these common sections:

Project Overview
Tech Stack
Core Features
Authentication
Frontend Pages
Backend Architecture
Database Collections
API Endpoints
Folder Structure
Development Phases
UI and UX Requirements
Security Requirements
Final Expected Outcome
Complete Specification - Overview and Tech Stack
Project Overview
Build a full-stack AI Recruitment Agent platform called AgentHire that lets recruiters create jobs, publish public application routes, receive candidate PDF resumes, and process those resumes through a LangGraph-driven AI workflow. The platform must pause the workflow at a human approval checkpoint, generate interview material, produce email output through Resend, persist every workflow step with retries and resumability, render the workflow live on a React Flow canvas, and report candidate and workflow analytics for recruiters.

The product must be spec-driven. All hiring thresholds, workflow order, retry policy, prompt rules, shortlisting rules, RAG chunking and similarity settings, email templates, and workflow node colors must come from /specs. These values must not be hardcoded inside controllers, services, agents, or UI components.

Tech Stack
Frontend uses Next.js 15 App Router, JavaScript, React 19, Tailwind CSS, shadcn/ui, Zustand, React Hook Form, Zod, React Flow, and lucide-react icons. Backend uses Node.js 20+, Express.js, MongoDB, Mongoose, Zod validation, JSON Web Tokens, bcryptjs, multer for PDF uploads, helmet, rate limiting, input sanitization, and a modular Express architecture (routes, controllers, services, validators, middleware, models, agents, workflows, rag, analytics, emails, utils, constants). AI orchestration is implemented through LangGraph workflows and LangChain agents, with embeddings produced by BAAI/bge-small-en-v1.5 and stored in Qdrant. The primary LLM provider is Groq's free tier, with OpenRouter free models as a fallback. Email is delivered through Resend's free tier. Tests run on Jest, Supertest, and Playwright. Sensitive credentials are loaded exclusively through environment variables.

Complete Specification - Authentication and Workflow Orchestration
Core Features
Authentication
The authentication system must support recruiter signup, recruiter login, JWT-based session handling, protected recruiter routes, an /auth/me profile endpoint, password hashing with bcryptjs, and persistent login state on the client through Zustand. Protected backend requests must verify the JWT, load the current user from MongoDB, and enforce role-based access. Public candidate routes must remain accessible without authentication, while every recruiter dashboard route must require auth.

Job Management
For job management, recruiters must be able to create jobs, list jobs, open job details, update jobs, and copy a public application link. Each job stores a title, description, required skills, preferred skills, minimum experience, workflow spec id, hiring spec id, creator, and creation timestamp. The matching logic must score candidates against the actual job document's saved required_skills, preferred_skills, and min_experience, while still using the base hiring spec from /specs/hiring/.

Candidate Applications
Candidate application routes must be public. A candidate must be able to open /jobs/[jobId], move to /jobs/[jobId]/apply, enter name, email, phone number, upload a PDF resume, and submit the application without recruiter authentication. The upload flow must validate file type, store the resume under /server/uploads, parse PDF text, create the candidate record, and start the AI workflow automatically. A candidate's resume upload must always trigger the workflow without any manual recruiter action.

Workflow Orchestration
For workflow orchestration, the backend must run each application through the LangGraph workflow defined by /specs/workflow/default-hiring-workflow.json:


1234567
resume_parserembedding_agentmatching_agentshortlisting_agenthuman_approvalinterview_agentemail_agent
LangGraph must support retries, checkpoints, resumability, state persistence, branching, and human approval pauses. The workflow engine must persist status, current state, retries, state output, logs, and timestamps. It must pause at human_approval until the recruiter approves or rejects, then resume from the saved state rather than restarting the entire chain.

Complete Specification - AI Agents, RAG, LangGraph, and Email Layer
AI Agents
The agent layer must implement seven cooperating agents, each backed by a prompt or rules file under /specs/prompts/ or /specs/evaluation/.

The Resume Parser Agent parses uploaded PDF resumes and extracts candidate name, skills, experience, education, and projects. Its prompt behavior, temperature, known skills, and output schema must come from /specs/prompts/resume-parser.json, and the parser must respect both the known skills in the spec and the job-specific required and preferred skills.

The Embedding Agent generates embeddings using BAAI/bge-small-en-v1.5 and stores them in Qdrant for resumes, hiring policies, evaluation docs, and interview guidelines.

The Matching Agent compares parsed resume data with the merged hiring spec and the RAG context. Scoring weights come from /specs/prompts/matching-agent.json. The agent must return matched required skills, matched preferred skills, missing skills, all_skills_matched, and the final match_score.

The Shortlisting Agent turns the match score into a decision using /specs/evaluation/shortlisting-rules.json. The current rules are >= 80 → shortlisted, 60-79 → hold, < 60 → rejected. Thresholds must come dynamically from /specs. The agent must never hardcode 80, 60, or any other threshold.

The Human Approval checkpoint pauses workflow execution and waits for recruiter approval through POST /workflow/approve.

The Interview Agent generates interview questions, coding tasks, and rubrics according to /specs/prompts/interview-agent.json.

The Email Agent generates interview-invite or rejection output using /specs/email/interview-invite.json and /specs/email/rejection.json. Delivery goes through Resend when RESEND_API_KEY is set; otherwise the agent must produce fallback output instead of failing the workflow.

RAG Pipeline
The RAG layer must support organizational intelligence for resumes, hiring policies, evaluation docs, and interview guidelines. Resume chunks must be 500 characters, policy chunks must be 1000 characters, top_k retrieval must default to 5, and minimum_similarity must default to 0.75. Retrieval behavior must come from /specs/evaluation/rag-retrieval.json. The pipeline is Documents → Chunking → Embeddings → Qdrant Storage → Similarity Search → Context Injection → LLM Response.

Failure Handling
LLM timeouts, email API failures, and vector DB timeouts are retryable. Invalid PDFs, malformed JSON, and invalid request schemas are non-retryable. Every failure must log the agent name, workflow state, stack trace, and timestamp. Retry behavior is driven by /specs/system/retry-policy.json.

Complete Specification - Frontend Pages
The application uses the Next.js 15 App Router. The root page should guide users into authentication or the recruiter dashboard depending on session state.

/login and /signup provide the recruiter authentication forms. The frontend API client must read the auth token from localStorage or cookie so dashboard requests do not drift from the current session.

/dashboard displays the recruiter dashboard overview: job count, candidate count, workflow count, completion percentage, recent workflows, and quick actions such as refresh and create job.

/dashboard/jobs lists recruiter jobs and exposes a "Copy public apply link" action for each job.

/dashboard/jobs/create provides the Create Job form. The form includes title, description, required skills, preferred skills, minimum experience, skill preview chips, and a workflow-oriented layout.

/dashboard/candidates lists submitted candidates with status, match score, and job context.

/dashboard/workflows shows workflow executions, current state, approval status, logs, retry state, and the React Flow workflow visualization. Node colors must come from a node-states spec under /specs/workflow/.

/dashboard/analytics shows candidate statistics, shortlist rate, workflow completion rate, and agent execution metrics.

/jobs/[jobId] is the public job detail page.

/jobs/[jobId]/apply is the public candidate application page. It accepts candidate information and a PDF resume upload, shows the selected file name, displays processing state while the upload and workflow run, and shows a success message with workflow status and current state.

Complete Specification - Backend Architecture and Database Collections
Backend Architecture
The backend uses a modular Express architecture under /server/src/. The config layer centralizes environment loading, Mongo connection, and Qdrant configuration. The routes layer defines HTTP endpoints and middleware composition. The controllers layer parses request intent and shapes responses - it never talks to Mongo directly. The services layer owns business behavior for auth, jobs, candidates, workflows, analytics, RAG, and scoring. The validators layer uses Zod schemas to validate every request body. The middleware layer handles auth, role checks, validation, uploads, and errors. The models layer defines Mongoose schemas. The agents layer holds the seven cooperating agents (resume parser, embedding, matching, shortlisting, interview, email, and the human approval checkpoint hook). The workflows layer owns LangGraph workflow definitions and stateful execution. The rag layer wraps Qdrant access and the in-memory equivalent for tests. The analytics layer aggregates candidate and workflow metrics. The emails layer wraps Resend. The utils and constants layers own spec loading, scoring, response helpers, async error handling, and workflow failure logging.

Resume uploads must be stored under /server/uploads. Workflow logs must be stored under /server/logs. Mongoose models must exist under /server/src/models. Shared business rules must remain under root /specs.

Database Collections
users
id, name, email, password, role, created_at.
jobs
id, title, description, required_skills, preferred_skills, min_experience, workflow_spec_id, created_at.
candidates
id, name, email, phone, resume_url, parsed_resume_json, match_score, status, created_at.
workflows
id, candidate_id, job_id, current_state, status (pending | running | waiting_approval | completed | failed), created_at.
workflow_logs
id, workflow_id, agent_name, input, output, status (running | success | failed | waiting_approval), error, created_at.
Complete Specification - API Endpoints
Health and Auth

POST /auth/signup
create a recruiter account.
POST /auth/login
issue a JWT.
GET /auth/me
return the authenticated profile.
Jobs

POST /jobs
create a job. Requires recruiter auth.
GET /jobs
list jobs. Public, so public job pages can load.
GET /jobs/:id
get one job. Public, so candidates can view a job.
PUT /jobs/:id
update a job. Requires recruiter auth.
Candidates

POST /candidates/upload
public PDF resume upload that auto-starts the workflow.
GET /candidates
list candidates. Requires recruiter auth.
GET /candidates/:id
get one candidate. Requires recruiter auth.
Workflows

POST /workflow/start
manually start a workflow. Requires recruiter auth.
POST /workflow/retry
retry a failed workflow. Requires recruiter auth.
POST /workflow/approve
approve or reject the human approval checkpoint. Requires recruiter auth.
GET /workflow/:id
get one workflow with logs, node states, and execution order. Requires recruiter auth.
Analytics

GET /analytics
candidate statistics, shortlist rate, workflow completion rate, and agent execution metrics. Requires recruiter auth.
Complete Specification - Folder Structure and Development Phases
Folder Structure
The project root already contains client/ and server/. The AI agent must use the existing structure only and must never create frontend/, backend/, a NestJS scaffold, a Prisma schema, or any TypeScript files. AgentHire is JavaScript only.


1234567891011
ai-recruitment-platform/||-- client/|   |-- app/|   |   |-- dashboard/|   |   |-- jobs/|   |   |-- auth/|   |   |-- apply/|   ||   |-- components/|   |-- features/ 
Expand
Development Phases
Phase 1
initialize the Next.js 15 frontend and the Express backend, configure Tailwind and shadcn/ui, connect to MongoDB through Mongoose, load environment variables, and implement signup, login, JWT-protected routes, role checks, and the recruiter dashboard shell.
Phase 2
implement recruiter jobs, public job detail pages, public candidate apply pages, PDF upload through multer, Mongoose models, and Zod validators.
Phase 3
implement the spec loader, the root /specs JSON files, the LangGraph workflow definition, retry policy, node state colors, and shortlisting rules.
Phase 4
implement the Resume Parser, Embedding (Qdrant + BAAI/bge-small-en-v1.5), Matching, Shortlisting, Interview, and Email agents with spec-driven prompts and deterministic fallback behavior when external services are unavailable.
Phase 5
implement LangGraph workflow persistence, stateful execution, human approval pause/resume, retry handling, workflow logs, and the React Flow workflow visualization.
Phase 6
implement analytics, recruiter UI polish, improved upload UX, Resend email integration, Jest/Supertest backend tests, Playwright end-to-end tests, build checks, and a full local smoke test.
Complete Specification - UI, Security, Outcome, and Codex Instructions
UI and UX Requirements
The UI must use a clean recruiter-console aesthetic with Tailwind and shadcn/ui. It must be responsive, include loading states for resume processing, render the workflow graph with React Flow, support color-coded node states (running blue, success green, failed red, waiting_approval yellow, pending neutral), surface execution order and the active node, display failed nodes, retries, and approval checkpoints, and show clear processing feedback while a candidate's upload is running through the workflow.

Security Requirements
The application must hash passwords with bcryptjs, sign and verify JWTs with JWT_SECRET, load the current user from MongoDB on every protected request, enforce recruiter route protection, validate every request body with Zod, validate resume uploads with multer (file type, size), set HTTP security headers via helmet, apply rate limiting, sanitize input, prevent NoSQL injection, and never expose secret values in logs or responses. Public candidate routes must not require recruiter authentication, but every recruiter dashboard route must be protected.

Final Expected Outcome
The completed platform must let a recruiter sign up, log in, create a Frontend Developer job, copy the public apply link, submit a demo PDF resume as a candidate, watch the AI workflow auto-start, see the workflow pause at human approval, approve the checkpoint, let the workflow complete through interview and email generation, and review candidates, workflows, and analytics. The end-to-end flow must succeed against MongoDB, Qdrant, and the configured LLM provider.

Spec Files as Source of Truth
The complete project specification is backed by concrete JSON files under /specs. These files are the business-rule contract for AgentHire.

JSON

12345678
// specs/hiring/frontend-developer.json{  "role": "Frontend Developer",  "required_skills": ["React", "JavaScript", "CSS"],  "preferred_skills": ["Next.js", "Tailwind CSS"],  "minimum_score": 75,  "interview_rounds": 2}
JSON

1234567891011
// specs/workflow/default-hiring-workflow.json{  "workflow": [    "resume_parser",    "embedding_agent",    "matching_agent",    "shortlisting_agent",    "human_approval",    "interview_agent",    "email_agent"  ] 
Expand
JSON

12345
// specs/system/retry-policy.json{  "max_retries": 3,  "retry_delay_ms": 5000}
Codex Implementation Instructions
The AI coding agent must build the application phase by phase, follow the folder boundaries strictly (/client, /server, /specs), keep the project JavaScript only, never introduce TypeScript, NestJS, or Prisma, keep controllers thin and push business logic into services and agents, never hardcode hiring thresholds or workflow order, read all business rules from /specs, validate every API input schema with Zod, return structured JSON, persist workflow state for every run, support retries, log every workflow failure with agent name, state, stack trace, and timestamp, keep public apply routes open and recruiter routes protected, ensure that resume uploads automatically trigger the workflow, and report the important files created or changed at the end of each phase. Implementation priorities are correctness of the agent chain, integration safety, retry and approval resumability, clean architecture, and full traceability of every hiring decision back to a spec file.

Complete Spec
The previous slides describe the AgentHire specification in narrative form, slide by slide. The raw specification document - the exact text that the AI coding agent should treat as the contract - is reproduced below. This is the source-of-truth document; the prior slides are a guided reading of it.


1234567891011
====================================================================PROJECT NAME====================================================================AI Recruitment Organization====================================================================PROJECT TYPE====================================================================Spec-Driven Multi-Agent Recruitment Platform 
Expand
Where Each Specification Parameter Shows Up
Looking at the spec above, you can see how the parameters of a good specification appear in practice.

The Project Overview and Final Expected Outcome sections demonstrate clarity, because they describe the product in single-meaning sentences and name the users - recruiter and candidate - along with the core motion: create job, apply, upload resume, run AI workflow, pause for human approval, complete the hiring decision.

Completeness comes from the combination of stack, authentication, jobs, candidates, agents, RAG, LangGraph workflow, database collections, API endpoints, UI pages, folder structure, security, environment variables, testing, and verification. There is no major area left undefined.

Consistency is visible in the way agent names are reused across the workflow spec, backend services, logs, and the React Flow visualization: resume_parser, embedding_agent, matching_agent, shortlisting_agent, human_approval, interview_agent, and email_agent appear identically on Slide 7, Slide 8, Slide 10, and Slide 14.

The Tech Stack section locks down concrete technology choices - Next.js 15 App Router, JavaScript only, Tailwind, shadcn/ui, Zustand, React Hook Form, Zod, React Flow, Express.js, MongoDB, Mongoose, JWT, bcryptjs, multer, LangGraph, LangChain, BAAI/bge-small-en-v1.5, Qdrant, Groq primary with OpenRouter fallback, and Resend - instead of leaving them open to interpretation.

The whole document is laid out under structured sections with clear headings, which makes it easy for both a human reader and an AI agent to scan.

The Development Phases section enforces phased delivery, breaking a large build into six reviewable checkpoints, each ending in a runnable surface (auth shell, jobs and candidate uploads, spec loader, agents, LangGraph + approval pause, analytics and end-to-end tests).

And the language throughout uses an authoritative tone - "must", "should", "do not", and "never hardcode" - instead of soft suggestions that an AI might silently drop. Statements like "Thresholds MUST come dynamically from /specs. NEVER hardcode thresholds." give the agent no wiggle room.

Setting Up Codex Chat or GitHub Copilot in VS Code
To build this project using SDD, you need an AI coding agent inside VS Code that can read your specification, edit files in your workspace, and run commands. Two practical options are Codex Chat and GitHub Copilot Chat.

Using Codex Chat
Install VS Code if it is not already on your machine.
Install the Codex extension from the marketplace and sign in.
Open the AgentHire project folder and trust the workspace.
Open the project specification file at the root, for example spec.txt (or save it as spec.md).
Make sure the complete specification from Slide 14 is what the agent will read.
Open the Codex chat panel and ask it to read spec.txt.
Ask Codex to summarize the project back to you before writing any code. If the summary is wrong - for example, if it describes a chatbot, adds TypeScript, introduces NestJS or Prisma, creates a frontend/ folder, or skips the human approval checkpoint - the spec or the prompt should be fixed first.
Ask Codex to propose the client/, server/, and /specs structure, review it against Slide 12, and only then proceed to phase-by-phase coding.
Using GitHub Copilot Chat
Install the GitHub Copilot and Copilot Chat extensions from the marketplace.
Sign in with a GitHub account that has Copilot access.
Open the same AgentHire folder and reference spec.txt in Copilot Chat so Copilot treats it as the source of truth.
Ask Copilot to summarize the spec, propose the folder structure, and then build phase by phase.
In both cases the workflow is identical. The agent never starts coding until it has read and summarized the spec, and you only move from one phase to the next after verifying the previous phase actually works in the browser and against MongoDB and Qdrant.

How to Properly Write Specs for AI Coding Agents
When you sit down to write a specification for an AI coding agent, keep these short guidelines in mind:

Start by naming the product and stating who the primary users are - here the users are recruiters and candidates, not generic chat users.
Lock the stack early, before describing any features. Naming Next.js 15 App Router and JavaScript prevents the agent from switching to Vite, TypeScript, NestJS, or Prisma.
Phrase features as user actions, not abstract system capabilities. "Recruiter can approve a workflow at human approval" beats "approval is supported".
Define every data model with explicit fields and enum values. The workflows.status enum on Slide 10 is what stops the agent from inventing a sixth state.
Define every API route with its method, path, auth requirement, and one-line description.
Show the folder structure so the agent knows where each file belongs - agents/, workflows/, rag/, and emails/ are easy to confuse if you skip this.
Describe each page in terms of what the user sees and can do.
List required environment variables for frontend and backend (NEXT_PUBLIC_API_URL, MONGODB_URI, JWT_SECRET, GROQ_API_KEY, OPENROUTER_API_KEY, QDRANT_URL, RESEND_API_KEY).
Move business rules into /specs, especially thresholds, workflow order, retry policy, prompt rules, RAG retrieval rules, email templates, and node colors.
Break the build into phases that each end in a runnable checkpoint.
End with verification steps that describe exactly what "working" looks like.
Avoid pasting implementation code into the spec. The spec is a contract, not an implementation.
Iterate on the spec first; only then bring the code back in line with it.
A specification written this way reads almost like an engineering requirements document, which is the point.

How to Build the Project Using the Specification
Once the specification is saved as spec.txtin your project root, the build follows a predictable rhythm. You open the agent chat panel, point it at spec.txt, and ask it to read and summarize the entire document. If the summary matches your intent, you ask the agent to inspect or scaffold the client/, server/, and /specs structure before any real code is written.

From there, work moves phase by phase. 
In Phase 1 the agent initializes the Next.js 15 frontend and the Express backend, connects to MongoDB, loads environment variables, and implements signup, login, JWT-protected routes, role checks, and the recruiter dashboard shell. You run the result and confirm you can sign up, log in, and reach /dashboard.

In Phase 2 the agent builds job creation, job listing, public job detail pages, public apply pages, candidate upload, PDF validation, and candidate persistence, and you verify that a recruiter can create a job and a candidate can submit a PDF resume without logging in. 

In Phase 3 the agent creates the root /specs files and wires the backend loader to them, and you verify that workflow order, retry policy, node colors, shortlisting thresholds, RAG settings, prompt rules, and email templates are loaded from JSON. 

In Phase 4 the agent implements the Resume Parser, Embedding, Matching, Shortlisting, Interview, and Email agents and verifies that resume parsing uses real PDF text extraction, matching uses the job's saved required and preferred skills, and shortlisting uses spec-defined thresholds.

In Phase 5 the agent implements the LangGraph workflow with retries, checkpoints, resumability, human approval pause/resume, workflow logs, and the React Flow visualization. 

In Phase 6 the agent implements analytics, UI polish, Resend integration, Jest/Supertest backend tests, Playwright end-to-end tests, build checks, and a full local smoke test.

The build is only considered complete after a full end-to-end check: signing up, logging in, creating a Frontend Developer job, copying the public apply link, uploading demo-data/resumes/john-react-resume.pdf as a candidate, watching the workflow auto-start, watching it pause at human approval, approving it, letting it complete through interview and email generation, and confirming that candidates, workflows, and analytics all reflect the run.

Throughout the build, the agent should be reminded to treat spec.txt and /specs/*.json as the source of truth, keep client/ and server/ code separated, use environment variables for all secrets, keep frontend API calls aligned with backend responses, and report which files were created or changed after each phase.

Why a Single Spec Is Not Enough
Even with a well-written specification, the agent will rarely produce a fully working product on the first pass. SDD is not a magic wand. A few features will always need targeted follow-up prompts - short, focused mini-specs that fix one specific behavior at a time.

These follow-ups should be treated as small spec updates rather than random "fix this" prompts. Each one should name the exact feature that is broken, describe the expected behavior in one or two sentences, mention any inputs the feature should accept, and reference a screenshot if the issue is visual. Scope is important - the prompt should ask the agent to fix only that specific area without refactoring unrelated code.

While building AgentHire, for example, the matching logic initially scored candidates only against the default hiring spec, ignoring the job document's own required_skills, preferred_skills, and min_experience. A short follow-up mini-spec was written that named the feature ("job-specific matching"), described the expected behavior (matching must use the actual job document's saved skills and experience while still preserving spec-driven thresholds), and pointed the agent at the workflow service, resume parser, score utility, and matching agent. That single follow-up was enough to align matching with each job without touching the threshold logic.

The same pattern applies to any other gap that appears during the build. A human_approval step that does not resume from the saved state, a PDF that extracts poorly, a React Flow node that does not pick up its color from /specs/workflow/node-states.json, an analytics number that silently excludes failed workflows, a public apply route that accidentally requires authentication, or a Resend fallback that crashes when RESEND_API_KEY is missing - each one becomes a short mini-spec. Over a full build you can expect several of these. This is normal. SDD does not eliminate iteration; it just makes each iteration cheaper and more targeted.

Closing Thought
Spec Driven Development turns the AI coding agent from a guess-driven assistant into a contract-driven builder. The specification is the contract. The clearer the contract, the closer the generated product comes to what you actually wanted.

For AgentHire, the contract is especially important because hiring workflows should be explainable. Recruiters need to know why a candidate was shortlisted, held, or rejected. Developers need to know where thresholds live. AI agents need a deterministic workflow order. The frontend needs the same node states that the backend uses. The whole system becomes easier to trust when /specs owns the business rules and spec.txt owns the system-level contract.

Write the spec well, hand it to the agent, build in phases, verify each phase, and patch the gaps with short focused mini-specs. That is the entire workflow, and it is enough to build a real, full-stack AI recruitment product like AgentHire - public applications, resume parsing, RAG-aware matching, spec-driven shortlisting, human approval, LangGraph orchestration, interview generation, email output, workflow visualization, and analytics.







# ADDITIONAL IMPLEMENTATION INSTRUCTIONS — REACT NATIVE MOBILE APP + CLAUDE CODE

## 1. Primary Development Objective

Build AgentHire as a production-quality, mobile-first AI recruitment application using React Native and Expo.

The existing AgentHire specification is the foundation and single source of truth for product functionality, business rules, AI agents, workflow orchestration, hiring logic, and backend behavior.

IMPORTANT: The original specification describes a Next.js web frontend. Replace the Next.js frontend implementation with React Native + Expo while preserving the core product requirements.

Do not convert the application into a chatbot or simplify the seven-agent architecture.

## 2. Updated Technology Stack

### Mobile frontend
- React Native
- Expo SDK (use a currently supported stable version)
- JavaScript only — no TypeScript
- Expo Router for navigation
- NativeWind for styling
- Zustand for state management
- TanStack Query for API state and caching
- React Hook Form + Zod for forms
- Lucide icons
- Expo SecureStore for secure token persistence
- Expo Document Picker for resume uploads
- Expo Notifications for notifications

### Backend
Preserve the original backend architecture:
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT authentication
- bcryptjs
- Zod validation
- Multer for PDF uploads
- Helmet and rate limiting

### AI and orchestration
Preserve:
- LangGraph
- LangChain
- Qdrant
- BAAI/bge-small-en-v1.5
- Groq as primary LLM provider
- OpenRouter as fallback
- Resend for email delivery

Do not introduce unnecessary technologies or replace existing technologies without explaining the technical reason.

## 3. Mobile Application Architecture

Create two primary experiences within AgentHire.

### A. Recruiter Application

The recruiter must be able to:

1. Sign up and log in.
2. View a personalized dashboard.
3. Create, update and manage job openings.
4. View all candidates.
5. Inspect candidate profiles and uploaded resumes.
6. View AI-generated matching scores.
7. See matched skills and missing skills.
8. Review AI shortlisting recommendations.
9. Approve or reject candidates at the human approval checkpoint.
10. View generated interview questions and coding tasks.
11. Monitor AI workflow execution.
12. View workflow logs and failure information.
13. Retry failed workflows.
14. View recruitment analytics.
15. Receive application and workflow notifications.

### B. Candidate Application Experience

Candidates must not need recruiter authentication.

Candidates should be able to:

1. Open a public job application link.
2. View job descriptions and requirements.
3. Enter their name, email and phone number.
4. Upload their PDF resume.
5. Submit their application.
6. Receive application submission confirmation.
7. View processing status where supported.

Support shareable application links using Expo-compatible deep linking and a public web fallback. Candidates must not be forced to install the mobile app just to apply.

## 4. Mobile UI/UX Requirements

Create a premium, modern SaaS mobile interface.

Design inspiration:
- Linear
- Notion
- Stripe Dashboard
- Vercel
- Modern fintech applications

Visual direction:
- Minimal, professional and elegant.
- Strong typography hierarchy.
- Consistent spacing and component design.
- Carefully designed light and dark themes.
- Subtle animations and transitions.
- Rounded cards and polished navigation.
- Clear status indicators.
- Skeleton loading states.
- Empty states and error states.
- Responsive layouts across Android and iOS.

Avoid generic AI-generated UI, excessive gradients, unnecessary glassmorphism and overcrowded screens.

### Required mobile screens

Authentication:
- Splash screen
- Login
- Signup
- Forgot password

Recruiter:
- Dashboard
- Jobs listing
- Create job
- Edit job
- Job details
- Candidates listing
- Candidate details
- Resume preview
- Workflow monitoring
- Human approval
- Interview questions
- Analytics
- Notifications
- Profile and settings

Candidate:
- Public job details
- Application form
- Resume upload
- Submission confirmation
- Application processing status

Use reusable components and a consistent design system.

## 5. AI Workflow Visualization on Mobile

The original specification uses React Flow for visualizing workflows.

Since this is a React Native application, implement a mobile-native workflow visualization instead.

Display all seven agents as a vertical timeline:

1. Resume Parser
2. Embedding Agent
3. Matching Agent
4. Shortlisting Agent
5. Human Approval
6. Interview Agent
7. Email Agent

Each step must display:
- Agent name
- Current execution status
- Start and completion timestamps
- Execution duration
- Relevant output
- Error details when applicable

Use consistent status indicators:
- Pending
- Running
- Completed
- Failed
- Waiting for approval

The recruiter should be able to tap an agent and inspect its execution details.

The visualization must reflect actual backend workflow state, not simulated frontend progress.

## 6. Backend and API Integration

Keep the backend independent of the mobile frontend.

All business logic must remain in the backend.

The React Native application must communicate with the Express backend through REST APIs.

Requirements:
- Centralized API client.
- Secure authentication token management.
- JWT-protected recruiter endpoints.
- Public candidate endpoints.
- Consistent error handling.
- API loading and retry states.
- PDF upload support.
- Pagination for candidates and jobs.
- Realtime workflow updates using WebSockets or an appropriate polling strategy.

Never expose API keys, database credentials, JWT secrets or LLM provider credentials in the mobile application.

## 7. Security and Recruitment Fairness

Implement:
- Secure token storage.
- Input validation.
- Protected recruiter screens.
- Backend authorization checks.
- PDF file validation.
- Upload size restrictions.
- Rate limiting.
- Secure API communication.
- No sensitive information in application logs.

AI recommendations must be explainable.

Never automatically reject candidates solely based on an LLM-generated score. Human review must remain available, and recruiters must be able to override AI recommendations with a recorded reason.

Do not use protected characteristics or demographic proxies in hiring decisions.

## 8. Claude Code Development Rules

You are acting as the lead software architect and senior full-stack/mobile engineer.

Follow these rules throughout development:

1. Read the entire AgentHire specification before making changes.
2. Understand the existing repository structure before creating files.
3. Treat the original specification and this mobile implementation addendum as the project contract.
4. Resolve the Next.js versus React Native conflict in favor of React Native + Expo.
5. Preserve the original Express backend and seven-agent architecture.
6. Use JavaScript only. Never introduce TypeScript.
7. Never hardcode hiring thresholds, prompts, workflow order or retry policies.
8. Keep business logic out of UI components.
9. Use reusable components and modular architecture.
10. Write maintainable, production-quality code.
11. Never create mock functionality and claim it is implemented.
12. Never simulate successful API responses when the backend is unavailable.
13. Use real API integrations with graceful error handling.
14. Write tests for important business logic and API integrations.
15. Run the relevant tests and build checks after each development phase.
16. Fix errors before proceeding to the next phase.
17. Never overwrite existing project files without inspecting their contents first.
18. Never expose environment variables or credentials.
19. Maintain project documentation and update the implementation checklist.

## 9. Spec-Driven Development Workflow

Before implementing anything:

PHASE 0 — REPOSITORY AND SPECIFICATION ANALYSIS

- Inspect the complete repository.
- Read the entire AgentHire specification.
- Identify conflicts between the original web specification and the mobile addendum.
- Propose the final architecture.
- Define the mobile folder structure.
- Define backend and mobile API contracts.
- Identify required environment variables.
- Identify external dependencies.
- Create a development roadmap.
- Identify technical risks and missing requirements.

Do not write application code during this phase.

Present the architecture and implementation plan for review.

After the architecture is approved, implement the project phase by phase.

PHASE 1 — Mobile application foundation and authentication.

PHASE 2 — Recruiter dashboard and job management.

PHASE 3 — Public candidate applications and PDF uploads.

PHASE 4 — Resume parsing, embeddings, RAG and matching agents.

PHASE 5 — LangGraph orchestration and shortlisting.

PHASE 6 — Human approval, workflow monitoring and resumability.

PHASE 7 — Interview generation and email integration.

PHASE 8 — Analytics, notifications and UI refinement.

PHASE 9 — Security, testing, optimization and deployment.

At the end of every phase:
- List files created and modified.
- Explain completed functionality.
- Report tests executed and their results.
- Report outstanding issues.
- Update the implementation checklist.

Do not silently skip incomplete features.

## 10. Final Acceptance Criteria

The application is considered complete only when:

1. A recruiter can register and log in.
2. A recruiter can create a job.
3. A public application link can be shared.
4. A candidate can apply without recruiter authentication or mandatory app installation.
5. A candidate can upload a PDF resume.
6. The application automatically starts the AI workflow.
7. All seven agents execute in the specified order.
8. Resume parsing extracts structured information.
9. Embeddings are stored and retrieved from Qdrant.
10. Candidate matching uses job-specific requirements.
11. Shortlisting follows configurable specifications.
12. The workflow pauses at human approval.
13. The recruiter can approve or reject the candidate.
14. The workflow resumes from its persisted checkpoint.
15. Interview questions and rubrics are generated.
16. Email output is generated and delivered when configured.
17. Workflow logs and execution states are persisted.
18. Analytics reflect actual database information.
19. Errors, retries and external service failures are handled correctly.
20. The mobile application works on both Android and iOS.

The final result must be a functional, secure and maintainable AI recruitment product, not merely a collection of UI screens.

## 11. Final Instruction

Think like a product engineer, not just a code generator.

Prioritize architecture, correctness, reliability, user experience and maintainability.

Do not rush into generating hundreds of files.

First understand the complete system, establish a reliable architecture, and then implement it systematically.

Start with PHASE 0 only. Inspect the repository and return the architecture proposal, technical decisions, folder structure and phased execution plan. Do not start implementation until the planning phase is complete.