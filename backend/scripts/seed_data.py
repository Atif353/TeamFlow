from dataclasses import dataclass, field
from typing import Literal

from app.permissions.roles import Role

DEMO_PASSWORD = "Demo12345"
PROJECT_START = (2026, 9, 1)

USERS: list[tuple[str, str, Role]] = [
    ("Ada Admin", "admin", Role.SUPER_ADMIN),
    ("Maya Manager", "manager", Role.PROJECT_MANAGER),
    ("Noah Navarro", "noah", Role.PROJECT_MANAGER),
    ("Mark Member", "member", Role.MEMBER),
    ("Omar Other", "member2", Role.MEMBER),
    ("Priya Patel", "priya", Role.MEMBER),
    ("Liam Chen", "liam", Role.MEMBER),
    ("Sofia Rossi", "sofia", Role.MEMBER),
    ("Ethan Brooks", "ethan", Role.MEMBER),
    ("Hana Kim", "hana", Role.MEMBER),
    ("Lucas Meyer", "lucas", Role.MEMBER),
    ("Zara Ahmed", "zara", Role.MEMBER),
    ("Diego Alvarez", "diego", Role.MEMBER),
    ("Ian Inactive", "ian", Role.MEMBER),
    ("Vera Viewer", "viewer", Role.VIEWER),
    ("Victor Vance", "victor", Role.VIEWER),
]
DIGEST_SUBSCRIBERS = ("manager", "noah", "member", "priya")
DEACTIVATED = "ian"
PENDING_INVITES = [
    ("new.designer@example.com", Role.MEMBER),
    ("contractor@example.com", Role.VIEWER),
]
REVOKED_INVITES = [("former.candidate@example.com", Role.MEMBER)]

Pool = list[tuple[str, str, int, int | None, int | None]]
StatusSpec = tuple[str, str, bool, int | None, int | None]


@dataclass
class DocSpec:
    title: str
    body: str
    addition: str


@dataclass
class RuleSpec:
    name: str
    trigger: str
    action: str
    status: str | None = None
    value: str | None = None


@dataclass
class Blueprint:
    key: str
    name: str
    description: str
    color: str
    manager: str
    members: list[str]
    viewers: list[str]
    mode: Literal["sprints", "kanban"]
    statuses: list[StatusSpec]
    flow: list[str]
    blocked: str | None
    transitions: dict[str, list[str]]
    labels: list[tuple[str, str]]
    components: list[str]
    epics: list[tuple[str, tuple[int, int, int], tuple[int, int, int]]]
    versions: list[tuple[str, tuple[int, int, int], str]]
    pool: Pool
    docs: list[DocSpec]
    rules: list[RuleSpec]
    filters: list[tuple[str, dict[str, str]]]
    overrides: dict[str, Role] = field(default_factory=dict)


SPRINT_SCHEDULE = [
    ("Sprint 1", (2026, 9, 1), (2026, 9, 14)),
    ("Sprint 2", (2026, 9, 15), (2026, 9, 28)),
    ("Sprint 3", (2026, 9, 29), (2026, 10, 12)),
    ("Sprint 4", (2026, 10, 13), (2026, 10, 26)),
    ("Sprint 5", (2026, 10, 27), (2026, 11, 9)),
    ("Sprint 6", (2026, 11, 10), (2026, 11, 23)),
    ("Sprint 7", (2026, 11, 24), (2026, 12, 7)),
]
SPRINT_GOALS = [
    "Audit the current state and agree the plan",
    "Lay the foundations and unblock the team",
    "Ship the first usable slice",
    "Harden what shipped and close the gaps",
    "Release candidate and performance work",
    "Polish, accessibility and documentation",
    "Launch readiness and follow-ups",
]

STANDARD_STATUSES: list[StatusSpec] = [
    ("To Do", "#64748B", False, None, 0),
    ("In Progress", "#3B82F6", False, 6, 1),
    ("In Review", "#F59E0B", False, 4, 2),
    ("Done", "#10B981", True, None, 3),
]

COMMENTS = [
    "Picked this up, will post progress here.",
    "Blocked on a decision from design, pinging @{other}.",
    "Pushed a first version, @{other} could you take a look?",
    "Updated the acceptance criteria after today's sync.",
    "This is harder than estimated, bumping the remaining time.",
    "Reproduced it locally, the cause is in the shared helper.",
    "Looks good to me, merging once the checks are green.",
    "Added a regression test so this does not come back.",
    "Moving this to the next sprint, other work took priority.",
    "Verified on staging, nothing unexpected.",
    "Customer asked about this again, raising the priority.",
    "Thanks @{other}, that unblocked me.",
]

DESCRIPTIONS = [
    "<p>{title}.</p><h3>Acceptance criteria</h3><ul><li>Works on desktop and mobile</li>"
    "<li>Covered by automated tests</li><li>Documented for the team</li></ul>",
    "<p>Context: this was raised during planning and agreed as part of the current goals.</p>"
    "<p><strong>Definition of done:</strong> reviewed, tested and deployed to staging.</p>",
    "<h3>Why</h3><p>Reduces risk and keeps the roadmap on track.</p>"
    "<h3>Notes</h3><ol><li>Check the existing behaviour first</li>"
    "<li>Agree the approach in the thread</li></ol>",
    "{title}, as discussed with the team.",
    "Needs follow-up once the dependencies land.",
]

SUBTASK_TITLES = [
    "Implementation",
    "Write tests",
    "Code review feedback",
    "Update documentation",
    "QA pass",
]

ATTACHMENTS = [
    (
        "requirements.md",
        "text/markdown",
        b"# Requirements\n\n- Keep it fast\n- Keep it accessible\n",
    ),
    ("metrics.csv", "text/csv", b"week,visits,signups\n1,1200,48\n2,1430,61\n3,1710,79\n"),
    ("api-sample.json", "application/json", b'{"status": "ok", "items": []}\n'),
    ("meeting-notes.txt", "text/plain", b"Decisions\n- Ship behind a flag\n- Review on Friday\n"),
    (
        "mockup.png",
        "image/png",
        bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000d49444154789c6360f8ffff3f0005fe02fea7d7c5f10000000049454e44ae426082"
        ),
    ),
]

WEB = Blueprint(
    key="WEB",
    name="Website Redesign",
    description="Refresh the marketing site with a new design system.",
    color="#6366F1",
    manager="manager",
    members=["member", "member2", "priya", "sofia", "hana"],
    viewers=["viewer"],
    mode="sprints",
    statuses=STANDARD_STATUSES,
    flow=["To Do", "In Progress", "In Review", "Done"],
    blocked=None,
    transitions={
        "To Do": ["In Progress"],
        "In Progress": ["To Do", "In Review"],
        "In Review": ["In Progress", "Done"],
        "Done": ["In Progress"],
    },
    labels=[
        ("Bug", "#F43F5E"),
        ("Feature", "#6366F1"),
        ("Design", "#8B5CF6"),
        ("Content", "#0EA5E9"),
    ],
    components=["Frontend", "Design system", "Content", "SEO"],
    epics=[
        ("Design system", (2026, 9, 1), (2026, 10, 15)),
        ("Marketing site", (2026, 9, 8), (2026, 11, 6)),
        ("Performance", (2026, 10, 5), (2026, 11, 20)),
        ("Accessibility", (2026, 10, 19), (2026, 11, 27)),
    ],
    versions=[
        ("v1.0", (2026, 9, 25), "First public release of the new homepage"),
        ("v1.1", (2026, 10, 30), "Pricing, blog and performance"),
        ("v2.0", (2026, 11, 26), "Full redesign launch"),
    ],
    pool=[
        ("Audit current pages", "task", 3, 1, 3),
        ("Define colour palette", "story", 5, 0, 1),
        ("Typography scale", "story", 3, 0, 1),
        ("Component library audit", "task", 2, 0, 1),
        ("Spacing and layout tokens", "story", 3, 0, 1),
        ("Icon set selection", "task", 2, 0, 1),
        ("Design new homepage", "story", 8, 1, 0),
        ("Fix navigation bug on mobile", "bug", 3, 1, 0),
        ("Home page hero image is blurry", "bug", 1, 1, 0),
        ("Merge request: new header component", "merge_request", 2, 0, 0),
        ("Footer redesign", "story", 3, 1, 0),
        ("Write launch copy", "task", 5, 1, 2),
        ("Set up analytics", "feature", 5, 2, 3),
        ("Cookie consent banner", "feature", 3, 1, 0),
        ("Pricing page layout", "story", 5, 1, 0),
        ("Pricing calculator widget", "feature", 8, 1, 0),
        ("Investigate image CDN options", "spike", 2, 2, 0),
        ("Lazy load below-the-fold images", "improvement", 3, 2, 0),
        ("Reduce bundle size", "improvement", 5, 2, 0),
        ("Preload critical fonts", "improvement", 2, 2, 0),
        ("Blog index template", "story", 5, 1, 0),
        ("Blog article template", "story", 5, 1, 0),
        ("RSS feed for the blog", "feature", 2, 1, 3),
        ("Migrate 40 legacy blog posts", "task", 8, 1, 2),
        ("Open Graph images for shared links", "task", 3, 1, 3),
        ("Sitemap and robots.txt", "task", 2, 1, 3),
        ("Keyboard navigation audit", "task", 3, 3, 0),
        ("Fix focus order in the mega menu", "bug", 2, 3, 0),
        ("Contrast fixes for the dark theme", "improvement", 5, 3, 1),
        ("Add skip links", "improvement", 1, 3, 0),
        ("Screen reader pass on forms", "test", 3, 3, 0),
        ("Contact form validation", "story", 3, 1, 0),
        ("Contact form spam protection", "feature", 3, 1, 0),
        ("Site outage during DNS switch", "incident", 5, None, 0),
        ("Staging environment drifted from production", "incident", 3, None, 0),
        ("Smoke test checkout of the pricing page", "test", 3, 1, 0),
        ("Cross-browser test matrix", "test", 5, 3, 0),
        ("Animation guidelines", "task", 2, 0, 1),
        ("Localisation groundwork", "spike", 3, None, 0),
        ("Redirect map for old URLs", "task", 5, 1, 3),
        ("Update brand assets", "task", 2, 0, 1),
        ("Launch checklist", "task", 2, None, 0),
        ("Press kit page", "story", 3, 1, 2),
        ("Customer logos carousel", "feature", 3, 1, 0),
        ("Testimonials section", "story", 3, 1, 2),
        ("Investigate layout shift on article pages", "bug", 3, 2, 0),
        ("Document the component API", "task", 3, 0, 1),
    ],
    docs=[
        DocSpec(
            "Design principles",
            "<h2>Principles</h2><p>Clear, fast and accessible.</p><ul><li>Mobile first</li>"
            "<li>WCAG AA contrast</li><li>One primary action per page</li></ul>",
            "<h3>Review</h3><p>Revisit these after the v1.0 launch.</p>",
        ),
        DocSpec(
            "Launch plan",
            "<h2>Timeline</h2><ol><li>Soft launch to staff</li><li>Public launch</li>"
            "<li>Retrospective</li></ol>",
            "<p>Soft launch moved by one week after the DNS incident.</p>",
        ),
    ],
    rules=[
        RuleSpec(
            "Tell the assignee when work is in review",
            "status_changed",
            "notify_assignee",
            "In Review",
        ),
        RuleSpec("Flag urgent bugs on creation", "issue_created", "flag_issue"),
    ],
    filters=[
        ("Urgent issues", {"priority": "urgent"}),
        ("High priority", {"priority": "high"}),
        ("Navigation", {"q": "navigation"}),
    ],
    overrides={"sofia": Role.PROJECT_MANAGER},
)

APP = Blueprint(
    key="APP",
    name="Mobile App",
    description="Ship the first version of the iOS and Android app.",
    color="#10B981",
    manager="noah",
    members=["liam", "ethan", "zara", "member", "diego"],
    viewers=["victor", "viewer"],
    mode="sprints",
    statuses=[
        ("To Do", "#64748B", False, None, 0),
        ("In Progress", "#3B82F6", False, 6, 1),
        ("In Review", "#F59E0B", False, 4, 2),
        ("QA", "#8B5CF6", False, 3, None),
        ("Done", "#10B981", True, None, 3),
    ],
    flow=["To Do", "In Progress", "In Review", "QA", "Done"],
    blocked=None,
    transitions={
        "To Do": ["In Progress"],
        "In Progress": ["To Do", "In Review"],
        "In Review": ["In Progress", "QA"],
        "QA": ["In Progress", "Done"],
        "Done": ["In Progress"],
    },
    labels=[("Bug", "#F43F5E"), ("iOS", "#0EA5E9"), ("Android", "#22C55E"), ("Release", "#F59E0B")],
    components=["iOS", "Android", "Shared", "Backend for mobile"],
    epics=[
        ("Onboarding", (2026, 9, 1), (2026, 10, 9)),
        ("Offline mode", (2026, 9, 15), (2026, 11, 13)),
        ("Push notifications", (2026, 10, 5), (2026, 11, 6)),
        ("Store release", (2026, 10, 19), (2026, 11, 27)),
    ],
    versions=[
        ("0.9 beta", (2026, 9, 30), "Internal beta"),
        ("1.0", (2026, 11, 13), "Store release"),
        ("1.1", (2026, 12, 4), "Fast follow"),
    ],
    pool=[
        ("Choose navigation pattern", "task", 2, 0, 2),
        ("Build onboarding flow", "story", 8, 0, 2),
        ("Welcome screen", "story", 3, 0, 2),
        ("Permissions prompts", "story", 3, 0, 2),
        ("Account setup form", "story", 5, 0, 2),
        ("Crash on login with expired token", "bug", 3, 0, 2),
        ("Biometric sign in", "feature", 8, 0, 0),
        ("Local database schema", "task", 5, 1, 2),
        ("Sync queue for offline edits", "story", 8, 1, 2),
        ("Conflict resolution rules", "spike", 3, 1, 2),
        ("Offline banner and retry", "story", 3, 1, 2),
        ("Image cache eviction", "improvement", 3, 1, 2),
        ("Push notification prototype", "spike", 2, 2, 3),
        ("Register device tokens", "task", 3, 2, 3),
        ("Notification preferences screen", "story", 5, 2, 2),
        ("Silent push for background sync", "feature", 5, 2, 0),
        ("Deep links from notifications", "story", 5, 2, 2),
        ("Android back button closes the app", "bug", 2, None, 1),
        ("iOS keyboard covers the input", "bug", 2, None, 0),
        ("Tablet layout for the dashboard", "story", 8, None, 2),
        ("Dark mode support", "feature", 5, None, 2),
        ("Accessibility labels for all controls", "improvement", 5, None, 2),
        ("Crash reporting setup", "task", 3, 3, 2),
        ("App icon and splash screen", "task", 2, 3, 2),
        ("Store listing copy and screenshots", "task", 3, 3, 2),
        ("Privacy manifest and permissions review", "task", 3, 3, 0),
        ("TestFlight distribution", "task", 2, 3, 0),
        ("Release checklist", "task", 2, 3, 2),
        ("Performance profile of the home screen", "spike", 3, None, 2),
        ("Reduce cold start time", "improvement", 5, None, 2),
        ("Merge request: shared networking layer", "merge_request", 3, None, 2),
        ("Merge request: design tokens package", "merge_request", 2, None, 2),
        ("UI test for onboarding", "test", 3, 0, 2),
        ("Regression suite for sync", "test", 5, 1, 2),
        ("Beta feedback triage", "task", 3, 3, 2),
        ("Fix crash on rotate during upload", "bug", 3, None, 0),
        ("Localise strings for German and French", "task", 5, None, 2),
        ("Rate the app prompt", "feature", 2, None, 2),
        ("Incident: push outage during beta", "incident", 5, 2, 3),
        ("Settings screen", "story", 3, None, 2),
        ("Profile photo upload", "story", 5, None, 0),
        ("Pull to refresh everywhere", "improvement", 2, None, 2),
        ("Share sheet integration", "feature", 5, None, 2),
        ("Widget for today's tasks", "feature", 8, None, 0),
    ],
    docs=[
        DocSpec(
            "Release process",
            "<h2>Release train</h2><p>Cut a branch on Monday, beta on Wednesday, "
            "store on Friday.</p>",
            "<p>Hotfixes skip the beta and go straight to review.</p>",
        ),
        DocSpec(
            "Offline sync design",
            "<h2>Approach</h2><p>Operations are queued locally and replayed in order.</p>"
            "<ul><li>Last writer wins for simple fields</li><li>Manual merge for text</li></ul>",
            "<p>Open question: how long do we keep the queue.</p>",
        ),
    ],
    rules=[
        RuleSpec("Notify watchers when QA starts", "status_changed", "notify_watchers", "QA"),
        RuleSpec(
            "Tell the assignee when an issue is assigned", "issue_assigned", "notify_assignee"
        ),
    ],
    filters=[
        ("Urgent issues", {"priority": "urgent"}),
        ("Crashes", {"q": "crash"}),
        ("Release work", {"q": "release"}),
    ],
    overrides={"member": Role.PROJECT_MANAGER},
)

API = Blueprint(
    key="API",
    name="Platform API",
    description="Public REST API, authentication and developer experience.",
    color="#0EA5E9",
    manager="noah",
    members=["lucas", "diego", "liam", "priya", "member2"],
    viewers=["victor"],
    mode="sprints",
    statuses=[
        ("To Do", "#64748B", False, None, 0),
        ("In Progress", "#3B82F6", False, 5, 1),
        ("Code Review", "#F59E0B", False, 4, 2),
        ("Testing", "#8B5CF6", False, 3, None),
        ("Done", "#10B981", True, None, 3),
    ],
    flow=["To Do", "In Progress", "Code Review", "Testing", "Done"],
    blocked=None,
    transitions={
        "Code Review": ["In Progress", "Testing"],
        "Testing": ["Done", "In Progress"],
        "Done": ["In Progress"],
    },
    labels=[
        ("Bug", "#F43F5E"),
        ("Security", "#DC2626"),
        ("Breaking change", "#F59E0B"),
        ("DX", "#6366F1"),
    ],
    components=["Auth", "Billing", "Webhooks", "Docs", "Infrastructure"],
    epics=[
        ("OAuth 2.0", (2026, 9, 1), (2026, 10, 16)),
        ("Rate limiting", (2026, 9, 14), (2026, 10, 30)),
        ("Webhooks", (2026, 10, 12), (2026, 11, 20)),
        ("Developer portal", (2026, 10, 26), (2026, 11, 30)),
    ],
    versions=[
        ("v2.3", (2026, 9, 24), "Token improvements"),
        ("v2.4", (2026, 10, 22), "Rate limits"),
        ("v3.0", (2026, 11, 19), "Webhooks and the new portal"),
    ],
    pool=[
        ("Authorization code flow", "story", 8, 0, 0),
        ("PKCE support", "story", 5, 0, 0),
        ("Refresh token rotation", "story", 5, 0, 0),
        ("Token introspection endpoint", "feature", 3, 0, 0),
        ("Revoke tokens on password change", "bug", 3, 0, 0),
        ("Consent screen redesign", "story", 5, 0, 0),
        ("Scope registry", "task", 3, 0, 0),
        ("Sliding window limiter", "story", 8, 1, 4),
        ("Per-key limits and headers", "story", 5, 1, 4),
        ("Rate limit dashboard", "feature", 5, 1, 4),
        ("Burst allowance for trusted keys", "improvement", 3, 1, 4),
        ("Limiter fails open when Redis is down", "bug", 3, 1, 4),
        ("Load test the limiter", "test", 5, 1, 4),
        ("Webhook delivery service", "story", 8, 2, 2),
        ("Retry with exponential backoff", "story", 5, 2, 2),
        ("Signing secrets and verification", "story", 5, 2, 2),
        ("Replay failed deliveries", "feature", 5, 2, 2),
        ("Delivery log UI", "story", 5, 2, 2),
        ("Webhook timeout leaks connections", "bug", 3, 2, 2),
        ("Incident: duplicate webhook deliveries", "incident", 5, 2, 2),
        ("Developer portal skeleton", "story", 5, 3, 3),
        ("Interactive API explorer", "feature", 8, 3, 3),
        ("Generate SDK for Python", "task", 5, 3, 3),
        ("Generate SDK for TypeScript", "task", 5, 3, 3),
        ("Getting started guide", "task", 3, 3, 3),
        ("Changelog page", "task", 2, 3, 3),
        ("Pagination is inconsistent across endpoints", "bug", 3, None, 0),
        ("Cursor pagination for events", "improvement", 5, None, 0),
        ("Idempotency keys for POST", "feature", 5, None, 1),
        ("Invoice PDF generation is slow", "bug", 3, None, 1),
        ("Usage based billing spike", "spike", 3, None, 1),
        ("Merge request: shared validation library", "merge_request", 3, None, 0),
        ("Merge request: structured logging", "merge_request", 2, None, 4),
        ("Upgrade the database driver", "task", 3, None, 4),
        ("Zero downtime deploy script", "task", 5, None, 4),
        ("Add tracing to the gateway", "improvement", 5, None, 4),
        ("Contract tests for partners", "test", 5, None, 0),
        ("Security review of the token store", "task", 5, 0, 0),
        ("Dependency vulnerability sweep", "task", 3, None, 4),
        ("Deprecate v1 endpoints", "task", 3, None, 0),
        ("Error response format", "improvement", 3, None, 0),
        ("Backfill audit events", "task", 5, None, 0),
        ("CORS misconfiguration for the portal", "bug", 2, 3, 3),
        ("Status page integration", "feature", 3, None, 4),
        ("Sandbox environment for partners", "story", 8, 3, 4),
    ],
    docs=[
        DocSpec(
            "API conventions",
            "<h2>Conventions</h2><ul><li>Resources are plural nouns</li>"
            "<li>Errors use a stable code</li><li>All lists are paginated</li></ul>",
            "<p>New endpoints must ship with contract tests.</p>",
        ),
        DocSpec(
            "Incident runbook",
            "<h2>When paged</h2><ol><li>Acknowledge</li><li>Check the status dashboard</li>"
            "<li>Roll back if in doubt</li></ol>",
            "<p>Added the webhook delivery checks after the duplicate delivery incident.</p>",
        ),
        DocSpec(
            "Rate limit design",
            "<h2>Goals</h2><p>Protect the platform without surprising partners.</p>",
            "<p>Trusted keys get a burst allowance of twice the limit.</p>",
        ),
    ],
    rules=[
        RuleSpec(
            "Notify the assignee when code review starts",
            "status_changed",
            "notify_assignee",
            "Code Review",
        ),
        RuleSpec("Flag incidents on creation", "issue_created", "flag_issue"),
    ],
    filters=[
        ("Security", {"q": "token"}),
        ("Urgent issues", {"priority": "urgent"}),
        ("Webhooks", {"q": "webhook"}),
    ],
)

MKT = Blueprint(
    key="MKT",
    name="Marketing Launch",
    description="Plan and run the Q4 launch campaign.",
    color="#F59E0B",
    manager="manager",
    members=["sofia", "hana", "zara", "member2"],
    viewers=["viewer"],
    mode="kanban",
    statuses=[
        ("To Do", "#64748B", False, None, 0),
        ("In Progress", "#3B82F6", False, 5, 1),
        ("Approval", "#F59E0B", False, 3, 2),
        ("Published", "#10B981", True, None, 3),
    ],
    flow=["To Do", "In Progress", "Approval", "Published"],
    blocked=None,
    transitions={},
    labels=[("Social", "#0EA5E9"), ("Email", "#8B5CF6"), ("Event", "#F59E0B"), ("Paid", "#F43F5E")],
    components=["Brand", "Content", "Events", "Paid media"],
    epics=[
        ("Q4 campaign", (2026, 9, 7), (2026, 11, 27)),
        ("Launch event", (2026, 10, 1), (2026, 11, 12)),
        ("Content engine", (2026, 9, 14), (2026, 11, 20)),
    ],
    versions=[
        ("Teaser phase", (2026, 9, 30), "Build anticipation"),
        ("Launch phase", (2026, 11, 3), "Go live"),
    ],
    pool=[
        ("Define campaign goals", "task", 2, 0, 0),
        ("Audience research summary", "task", 3, 0, 0),
        ("Draft press release", "task", 3, 0, 1),
        ("Book launch event venue", "task", 3, 1, 2),
        ("Event run of show", "task", 3, 1, 2),
        ("Speaker outreach", "task", 5, 1, 2),
        ("Event registration page", "story", 5, 1, 2),
        ("Teaser video script", "story", 3, 0, 0),
        ("Teaser video edit", "task", 5, 0, 0),
        ("Social media calendar for October", "task", 3, 2, 1),
        ("Social media calendar for November", "task", 3, 2, 1),
        ("Email nurture sequence", "story", 5, 2, 1),
        ("Welcome email redesign", "task", 2, 2, 1),
        ("Newsletter issue 1", "task", 3, 2, 1),
        ("Newsletter issue 2", "task", 3, 2, 1),
        ("Newsletter issue 3", "task", 3, 2, 1),
        ("Paid search keyword plan", "task", 3, 0, 3),
        ("Paid social creative variants", "task", 5, 0, 3),
        ("Landing page copy review", "task", 2, 0, 1),
        ("Case study with our first customer", "story", 5, 2, 1),
        ("Webinar outline", "task", 3, 2, 1),
        ("Webinar follow-up emails", "task", 2, 2, 1),
        ("Influencer shortlist", "spike", 2, 0, 0),
        ("Partner co-marketing proposal", "task", 3, 0, 0),
        ("Brand guidelines refresh", "task", 5, 0, 0),
        ("Launch day war room plan", "task", 3, 1, 2),
        ("Swag order", "task", 2, 1, 2),
        ("Post-launch survey", "task", 2, 0, 0),
        ("Budget reconciliation", "task", 2, 0, 3),
        ("Typo in the press release headline", "bug", 1, 0, 1),
        ("Broken tracking link in email 2", "bug", 1, 2, 1),
        ("Campaign report for leadership", "task", 3, 0, 0),
    ],
    docs=[
        DocSpec(
            "Campaign brief",
            "<h2>Objective</h2><p>Reach 5,000 qualified sign-ups by the end of November.</p>",
            "<p>Target raised after the strong teaser response.</p>",
        )
    ],
    rules=[
        RuleSpec(
            "Tell the assignee when content needs approval",
            "status_changed",
            "notify_assignee",
            "Approval",
        )
    ],
    filters=[("Email work", {"q": "email"}), ("Event tasks", {"q": "event"})],
)

SUP = Blueprint(
    key="SUP",
    name="Support Portal",
    description="Customer-facing help centre and the internal support console.",
    color="#F43F5E",
    manager="noah",
    members=["ethan", "lucas", "member", "ian", "zara"],
    viewers=["victor"],
    mode="kanban",
    statuses=[
        ("Open", "#64748B", False, None, 0),
        ("Investigating", "#3B82F6", False, 5, 1),
        ("Blocked", "#DC2626", False, 3, 2),
        ("Resolved", "#10B981", True, None, 3),
    ],
    flow=["Open", "Investigating", "Resolved"],
    blocked="Blocked",
    transitions={
        "Open": ["Investigating", "Resolved"],
        "Investigating": ["Blocked", "Resolved", "Open"],
        "Blocked": ["Investigating"],
        "Resolved": ["Open"],
    },
    labels=[
        ("Customer", "#F43F5E"),
        ("Billing", "#F59E0B"),
        ("Bug", "#DC2626"),
        ("Docs", "#0EA5E9"),
    ],
    components=["Help centre", "Console", "Search", "Integrations"],
    epics=[
        ("Help centre revamp", (2026, 9, 7), (2026, 11, 13)),
        ("Console improvements", (2026, 10, 1), (2026, 11, 27)),
    ],
    versions=[
        ("2026.10", (2026, 10, 28), "October release"),
        ("2026.11", (2026, 11, 25), "November release"),
    ],
    pool=[
        ("Customers cannot reset their password", "incident", 5, None, 1),
        ("Search returns no results for short queries", "bug", 3, 0, 2),
        ("Article feedback buttons do nothing", "bug", 2, 0, 0),
        ("Add article categories", "story", 5, 0, 0),
        ("Migrate top 50 articles to the new template", "task", 8, 0, 0),
        ("Suggested articles while typing a ticket", "feature", 8, 0, 2),
        ("Ticket form drops attachments over 5 MB", "bug", 3, None, 1),
        ("Macros for common replies", "feature", 5, 1, 1),
        ("Bulk close duplicate tickets", "feature", 3, 1, 1),
        ("Console loads slowly for large inboxes", "bug", 5, 1, 1),
        ("Internal notes on tickets", "story", 3, 1, 1),
        ("SLA timers on the ticket list", "story", 8, 1, 1),
        ("Chat widget fails behind the corporate proxy", "bug", 3, None, 3),
        ("Slack integration for escalations", "feature", 5, 1, 3),
        ("Refund request is charged twice", "incident", 5, None, 1),
        ("Invoice emails land in spam", "bug", 3, None, 3),
        ("Language detection for incoming tickets", "spike", 3, None, 2),
        ("Autoreply says the wrong office hours", "bug", 1, None, 1),
        ("Knowledge base analytics", "story", 5, 0, 0),
        ("Export tickets to CSV", "feature", 3, 1, 1),
        ("Agent presence indicator", "improvement", 2, 1, 1),
        ("Keyboard shortcuts in the console", "improvement", 3, 1, 1),
        ("Satisfaction survey after resolution", "feature", 5, None, 1),
        ("Rewrite the onboarding emails", "task", 3, None, 0),
        ("Weekly support metrics report", "task", 2, None, 1),
        ("Customer cannot download invoices", "bug", 2, None, 1),
        ("Outage: help centre unavailable for 40 minutes", "incident", 8, None, 0),
        ("Add status banner for known issues", "story", 3, 0, 0),
        ("Merge request: ticket list virtualisation", "merge_request", 3, 1, 1),
        ("Regression tests for the ticket form", "test", 3, None, 1),
        ("Review escalation policy", "task", 2, None, 1),
        ("Translate the top articles to Spanish", "task", 8, 0, 0),
        ("Fix broken links in the help centre", "bug", 2, 0, 0),
        ("Duplicate customer records after import", "bug", 5, None, 3),
    ],
    docs=[
        DocSpec(
            "Escalation policy",
            "<h2>Severity levels</h2><ul><li>S1: service down, page the on-call</li>"
            "<li>S2: major feature broken</li><li>S3: workaround exists</li></ul>",
            "<p>S1 incidents now require a written summary within 24 hours.</p>",
        ),
        DocSpec(
            "Support handbook",
            "<h2>Tone</h2><p>Plain language, no jargon, always offer a next step.</p>",
            "<p>Added guidance for refund requests.</p>",
        ),
    ],
    rules=[
        RuleSpec("Flag incidents on creation", "issue_created", "flag_issue"),
        RuleSpec(
            "Tell the assignee when an issue is blocked",
            "status_changed",
            "notify_assignee",
            "Blocked",
        ),
    ],
    filters=[
        ("Urgent issues", {"priority": "urgent"}),
        ("Billing", {"q": "invoice"}),
        ("Incidents", {"q": "outage"}),
    ],
    overrides={"viewer": Role.MEMBER},
)

BLUEPRINTS = [WEB, APP, API, MKT, SUP]
