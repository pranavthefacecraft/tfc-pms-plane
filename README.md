<br /><br />

<p align="center">
<a href="https://plane.so">
  <img src="https://media.docs.plane.so/logo/plane_github_readme.png" alt="Plane Logo" width="400">
</a>
</p>
<p align="center"><b>Modern project management for all teams</b></p>

<p align="center">
    <a href="https://plane.so/"><b>Website</b></a> •
    <a href="https://forum.plane.so"><b>Forum</b></a> •
    <a href="https://x.com/planepowers"><b>X</b></a> •
    <a href="https://docs.plane.so/"><b>Documentation</b></a>
</p>

<p>
    <a href="https://app.plane.so/#gh-light-mode-only" target="_blank">
      <img
        src="https://media.docs.plane.so/GitHub-readme/github-top.webp"
        alt="Plane Screens"
        width="100%"
      />
    </a>
</p>

Meet [Plane](https://plane.so/), an open-source project management tool to track issues, run ~sprints~ cycles, and manage product roadmaps without the chaos of managing the tool itself. 🧘‍♀️

> Plane is evolving every day. Your suggestions, ideas, and reported bugs help us immensely. Do not hesitate to join in the conversation on [Forum](https://forum.plane.so) or raise a GitHub issue. We read everything and respond to most.

## 🚀 Installation

Getting started with Plane is simple. Choose the setup that works best for you:

- **Plane Cloud**
  Sign up for a free account on [Plane Cloud](https://app.plane.so)—it's the fastest way to get up and running without worrying about infrastructure.

- **Self-host Plane**
  Prefer full control over your data and infrastructure? Install and run Plane on your own servers. Follow our detailed [deployment guides](https://developers.plane.so/self-hosting/overview) to get started.

| Installation methods | Docs link                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker               | [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://developers.plane.so/self-hosting/methods/docker-compose)         |
| Kubernetes           | [![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white)](https://developers.plane.so/self-hosting/methods/kubernetes) |

`Instance admins` can configure instance settings with [God mode](https://developers.plane.so/self-hosting/govern/instance-admin).

## 🌟 Features

- **Work Items**
  Efficiently create and manage tasks with a robust rich text editor that supports file uploads. Enhance organization and tracking by adding sub-properties and referencing related issues.

- **Cycles**
  Maintain your team’s momentum with Cycles. Track progress effortlessly using burn-down charts and other insightful tools.

- **Modules**
  Simplify complex projects by dividing them into smaller, manageable modules.

- **Views**
  Customize your workflow by creating filters to display only the most relevant issues. Save and share these views with ease.

- **Pages**
  Capture and organize ideas using Plane Pages, complete with AI capabilities and a rich text editor. Format text, insert images, add hyperlinks, or convert your notes into actionable items.

- **Analytics**
  Access real-time insights across all your Plane data. Visualize trends, remove blockers, and keep your projects moving forward.

## 🛠️ Local development

See [CONTRIBUTING](./CONTRIBUTING.md)

## TFC PMS email branding

Web sign-in, sign-up, and password-recovery headers use the supplied Clevdex
logo. The web favicon and touch/installed-app icons use the matching Clevdex
symbol. Login/sign-up welcome text, the new-user prompt, and shared authentication
page titles use Clevdex. This does not change God Mode product copy.
Password sign-in offers "Forgot password?" on both the initial email screen
and the password screen, carrying over the entered email. Without SMTP configured,
it explains that password-reset emails are unavailable.
Login and sign-up use a centered logo above a narrow white card with rounded corners and a soft shadow,
left-aligned heading and supporting text, and an account-switch link below.
Password-recovery pages retain their existing header layout.
Shared web loading screens use the supplied stacked Clevdex logo with a
reduced-motion-aware pulse, without inverting its brand colors in light mode.

Application emails use the supplied blue Clevdex email logo on a white header,
with Clevdex product text, subjects, and footers across all templates. The logo is
loaded from `${WEB_URL}/clevdex-email.png`; `WEB_URL` must be the public web
application URL. Email clients may block remote images until the recipient
allows them. Login codes, reset links and invitation links are unchanged.
Deploy both the web asset and API/worker templates when updating email branding.

## TFCPMS navigation

The workspace top bar uses `#FAFAFA` in light mode and includes a Create menu for work
items, projects, pages, whiteboards, and workspace invitations. Existing creation
flows and workspace permissions apply: invitations are admin-only, and work items
require a joined project. The sidebar New work item action remains available.
The top-bar search closes on outside pointer presses (mouse, touch, or pen),
including sidebar controls, unrelated popup menus, and controls that stop event
propagation, while interactions inside its results remain available.
Search temporarily hides the Documentation, Join our Forum, and Report a bug
help commands using their visibility predicates. Their definitions and links are
retained for future use; Open keyboard shortcuts remains visible.
Shared-whiteboard visitors use their own workspace's navigation and creation
actions, never the board owner's workspace actions.

Scheduling date pickers (work items/drafts, Intake, cycles, modules, snooze
and token expiry) disable dates before the user's local today. Custom date
fields use the same lower bound. Existing past dates remain displayed and
can be cleared; editing them requires today or later. Existing stricter date
bounds still apply. Historical filters and calendar browsing are unchanged.

Workspace layouts have no outer left, right or bottom padding; page-specific
content spacing is unchanged.

The supplied PMS by Clevdex SVG logo sits above the workspace switcher in the
project sidebar, with a white backing to preserve its colors in either theme.
The sidebar expand/collapse control sits to the right of the logo.
Help Center and Logout Account are pinned below the scrollable sidebar navigation.
Help Center opens https://docs.plane.so/ in a new tab; Logout Account uses the
existing sign-out flow and displays an error notification if sign-out fails.
Logout text and icons use `#D50000`.
The Home navigation entry and dashboard breadcrumb are labeled Activity with a
pulse icon. Activity uses blue text and icon on hover/selection with the existing
light-blue sidebar highlight; its route and dashboard functionality are unchanged.
The dashboard Activity/Manage widgets header row is temporarily hidden, with
its component and widget-settings actions retained. The sidebar Activity link
and dashboard widgets remain visible.
Activity now opens with Overview, Add task, Today's Activity, and a navigable
Monday-first Day/Week/Month calendar. These sections show the current user's private
personal tasks and assigned project tasks; existing dashboard widgets remain below.
The legacy greeting/date and quickstart guide below the calendar are hidden.
Quicklinks and Recents are visually hidden; their components, stored data,
and widget functionality are retained.
The My tasks widget below the calendar is also visually hidden but remains mounted;
this does not disable the sidebar My tasks page.
The sidebar My tasks destination now opens the current user's Figma-style List:
private personal tasks and assigned project tasks, including undated and completed
tasks. It includes search, account/project/completion filters, collaborators,
real project states, completion/reopen actions and the existing task editors.
Assigned tasks are loaded in paginated requests without a 100-task display cap.
List, Board, Task Calendar, Timeline and Files tabs are implemented. Board columns (To Do, In Progress, Waiting For Review, Done) follow each
project's Sections: a task's section name (for example "Waiting for review") picks
its column, completed tasks are always in Done, and tasks in other sections fall
back to their state (Started → In Progress, otherwise To Do). Cancelled tasks are
not shown on the board. Dragging a card moves a project task into the project's
matching section (Done also completes it; leaving Done reopens it); if the project
has no matching section the move is rejected with a message. Personal tasks can
only move between To Do and Done. Filters and search apply to all tabs, and each
column's Add task opens the New Task panel. Task Calendar shows the same tasks on a
Monday-first Month grid (with Week and Day views, Previous/Next and Today): each task
spans its start date through its due date, PMS tasks are green and personal tasks
blue, and selecting a task opens its details. Undated tasks stay in List and Board
and are counted below the calendar. Timeline reuses the project work-item timeline
(Week/Month/Quarter, Today, full screen, task sidebar with durations): bars use the
project state colour (personal tasks are blue), dragging or resizing a bar saves the
task's start/due dates, and undated tasks can be given dates by clicking their row.
Files collects the attachments and links of your assigned project tasks (newest
first, up to 300) as Asana-style cards with image previews; cards open the file or
link in a new tab, the task name opens the task, and All/Images/Documents/Links plus
the page filters and search (by file, link or task name) narrow the list. Personal
tasks have no attachments, so they contribute no files.
Personal tasks are only editable by their owner. Existing assigned/created/subscribed/activity profile routes remain;
the original self-profile Summary is available with `?view=summary`. Other users'
profile pages retain their original layout.
Today's Activity includes tasks scheduled today and tasks completed today in the
user's timezone. Its task table shows the task and project name, blue assignee
initials, PMS source badge, scheduled date, and an actions menu. Task names,
assignee-edit buttons, and Edit use the existing task details/editor.
The three-dot menu offers Edit, Share, and Delete. Delete asks for confirmation;
project deletion is available only to the creator/project admin and remains
enforced by the API. Share copies project links with existing access restrictions.
Personal sharing is opt-in: the owner can enable a read-only public link and
stop sharing to revoke it. Anyone with that link can see the task name,
description, priority, dates, and completion status, but not owner/workspace
details or other tasks. Deleting or moving the task disables its public link.
Re-enabling after revocation creates a different token. Deploy migration
0135_personal_task_sharing before using these sharing endpoints.
Private tasks show their owner only. Task schedules have dates, not times;
the Time column displays the due/start date without inventing appointment times.
The table scrolls within its card on small screens.
The Activity filter dropdown includes Source (PMS), Project Name, and Account.
Personal means private personal tasks; Company means project tasks. Project
checkboxes filter project tasks only; personal tasks are controlled by Account.
Checkbox changes apply only after Apply; Reset selects all options in the draft.
Clear filters restores all results immediately. Filters affect Today's Activity
only, not the calendar, and reset when the page is left/reloaded.
Calendar entries span their start/due dates (or use whichever
date is set). New personal tasks with neither date set default to a due date of
today in the user's timezone. Previously undated personal tasks appear on their
creation day in Activity and the calendar without changing their saved dates.
User's Calendar uses segmented Day/Week/Month controls, a month/date heading,
Today/previous/next navigation, and green PMS task cards with date labels.
Today resets the displayed date and switches to Day view, showing only tasks
scheduled for today in the user's timezone.
Crowded week/month days show two cards and an expandable "+ more" control.
The calendar's "+ New task" button opens the same task creation side panel;
it is hidden for guests. Meeting/bookings and Clevdex schedule feeds are not
connected, so their colors and appointment times are not fabricated.
Explicit start/due dates are preserved, and all tasks remain available in My tasks. Task entries open the
existing personal-task editor or project-task peek; Add task retains the option
to create a personal task or a project task. Add task opens a full-height,
right-side panel (half-width on desktop, full-width on mobile), without dimming
the dashboard; switching to project creation stays in the panel. Other project
creation dialogs and personal-task editing keep their existing presentation.
The New Task panel follows the Assigned to, Due date, Link to Project,
Dependencies, Priority, Stage, Status, Attach File, Description, and Subtasks
layout, with task name, optional start date, and an explicit Save button.
No project creates a private personal task; choosing a joined project enables
project members, blocked-by dependencies, attachments, and new subtasks.
Normal priority maps to the existing medium priority. Stage uses a project's
single-select Stage custom field when present, otherwise its workflow state.
Status uses the project's single-select Status custom field; if absent, the
form explains that it is not configured rather than inventing a value.
Changing projects resets project-specific selections while preserving name,
description, dates, and priority. Confirmed save steps are retained in the open
panel so a retry after a detail failure does not repeat completed operations.
Personal-task saves show confirmation only after the API succeeds, with a
reminder that private tasks live in My tasks under Personal tasks. The form
explains that a task name is required and new personal tasks default to today
when both dates are empty.
Meetings and bookings are not yet
connected. Loading and request errors are shown separately from empty states.
The date-window project-task API requires the updated backend, but no migration.
The left-sidebar workspace switcher is temporarily hidden, not removed; its
component and functionality are retained for future use. The top-bar switcher
in collapsed mode is unchanged. The top Projects heading and customization icon
are also temporarily hidden; the customization dialog, handlers, and project
navigation links remain intact. The sidebar New work item button and entire
Workspace group (including Projects and More) are temporarily hidden, not
removed; their components, handlers, and preferences remain intact. The lower
Projects list is unchanged. The top-bar Create menu is also temporarily hidden,
with its component and functionality retained. The top-bar notification link
uses an outline bell and retains its unread badge and inbox navigation.
The bell has a rounded border and red unread dot. The top-bar profile trigger
and search controls have 16px of top and bottom padding in the top bar.
In light mode the top bar is white (`#FFFFFF`) with a 1px `#E2E6EF` bottom border.
The profile trigger shows the user's first initial in white on blue instead of their photo; the
profile menu and stored avatar remain unchanged.
Tools sits directly below My tasks with a four-square grid icon; its Notepad and
Whiteboard links and expand/collapse preference are unchanged. My tasks is the
display label for Your work, with a bulleted-list icon; its profile route and
functionality are unchanged. The sidebar
Inbox and Drafts entries are temporarily hidden, not removed; their routes,
components, unread badge, and functionality remain available.
Search, Inbox and profile remain available in a top bar
over the main content instead of spanning the sidebar. When the sidebar is
collapsed, the top bar retains the workspace switcher. Notifications show the
normal workspace sidebar alongside the inbox list, with the same collapse and
resize behavior as other workspace pages. Settings and other layouts keep their existing top bar.
Create > Message opens a floating draft with a subject, plain-text body, and
multiple existing workspace recipients (up to 100). Active members and admins
can send; guests can receive messages addressed to them. Drafts are saved
automatically in the same browser, separately for each account and workspace,
and can be minimized, reopened, or discarded. One draft is kept per workspace.
Messages appear in recipients' Inbox with read, archive and snooze controls,
and a full message preview. Email delivery uses the instance SMTP configuration
and links back to the Inbox message. Missing email configuration blocks sending
with an explicit error. Delivery failures are retried by the worker and pending
email deliveries are requeued every five minutes. Repeating a send with the same
draft ID does not duplicate Inbox messages or completed email deliveries.
Only the sender and addressed recipients can open a message while they remain
workspace members. Replies and attachments are not supported.
This feature requires database migration `0130_workspace_messages` and updated
API, worker, beat-worker, and web services.
On narrow viewports the sidebar opens as an overlay. Only its visible normal
or peek content is mounted, so hidden sidebar outside-click handlers cannot
close the visible sidebar. Entering the mobile breakpoint initially collapses it.

In light mode, sidebar links use a `#EAF2FF` background and a 1px `#CBDCF8`
border on hover and when selected. The New work item action uses a neutral
`#0c0a0b0f` background to distinguish it from navigation. Dark mode retains
theme-aware colors. Transparent borders on idle links prevent hover layout shifts.

The sidebar's **Tool > Notepad** entry opens workspace pages; existing page URLs
and content are unchanged. Project sidebars omit **Pages** and label **Cycles**
as **Analytics**; the Analytics entry still opens the existing Cycles screen.
Project **Settings** is a direct sidebar link below **Views**, rather than an
item in the project's three-dot menu. Settings access permissions are unchanged.
The sidebar Community footer is temporarily hidden, not removed; its badge and
upgrade dialog remain intact for future use.

## Project overview

Click a project name in the sidebar or project directory to open **Overview**.
The page shows the project's description, owner, members, key resource links,
health, and task progress. Project/workspace admins can edit the description,
assign an active project member as owner, set health to **On track**, **At risk**,
or **Off track**, and add/remove resource links. Members and guests have read-only
access; archived projects cannot be edited.

Overview includes the standard project breadcrumb and Work items toolbar.
On desktop, layout and filter icons sit beside the breadcrumb and task count;
Display and Analytics remain on the right. The breadcrumb row omits Add work
item; use the sidebar New work item button or the work-item layout's creation controls.
Selecting a layout opens Work items in that layout; Filters and Display open
Work items to configure that view. Analytics opens directly from Overview and
retains the same project-role permissions as Work items.
On smaller screens, toolbar controls appear in a scrollable row below the header.

Pages and whiteboards attached directly to a project also appear as icon-and-name shortcuts in
that project's breadcrumb/header row, including Overview and Work items.
Task-attached pages and whiteboards are not included. Only resources visible to the
signed-in user are shown; attaching a page does not change its access settings.
Long names are truncated (hover for the full name), and multiple shortcuts can
be scrolled horizontally. Links refresh after Notepad changes or when returning
to the window, with a periodic refresh for changes made by teammates.

For Notepad pages and whiteboards, copy the resource's full URL and use
**Add resource**, select its type, enter a title, and paste the URL. Linking does
not grant access to a private resource or delete it when the link is removed.
Up to 50 resources can be linked per project.

Progress counts active tasks only (excluding archived/deleted tasks, drafts,
and Intake); cancelled tasks are listed separately from completed tasks. Guest
counts follow their task visibility. Data refreshes every 30 seconds. Health is
manually assigned, not inferred from task progress. AI summaries and milestones
are not included. Apply backend migration `0128_project_overview` before running
the updated app.

## Task likes

Task detail headers (side panel and full page) include a thumbs-up button to like
or unlike a task and show its like count. Likes reuse the existing thumbs-up
reaction, persist across reloads, and stay in sync with task emoji reactions.
Archived tasks show likes read-only. Run the web component and reaction-store
tests with `pnpm --filter web test`.

## TFCPMS whiteboards

### Live sharing and presentation

Open **Tool > Whiteboard** and choose a board. The owner can use **Share** to
assign active workspace members **Viewer** or **Editor**, then copy the board
link. Recipients must sign in or create an account; anonymous access is not supported.
The sharing list hides system/bot accounts; their accounts, memberships and
existing permissions are not deleted or changed.

Owners can set **Share > Guest link access** to **Viewer** or **Editor**. A
signed-in person outside the workspace can open the same board URL and choose
**Join as guest**. Guests can access only that whiteboard, not workspace lists,
projects, tasks, or other boards belonging to the owner; no membership in the
owner's workspace is created. Existing members keep their normal access and sidebar.
After joining, outsiders open the board inside their own workspace's normal
sidebar and top bar. Home, projects, settings, search, inbox, and creation actions
apply to their own workspace, while the shared canvas retains its original
Viewer/Editor permissions. If they do not own an active workspace, one is created
automatically with an admin membership and the usual sample-project seed.
Automatic setup completes account onboarding without changing consent settings.
It is idempotent across repeat visits and tabs and respects the instance's
workspace-creation restriction; setup failures show an explicit retry screen.
The original shared URL remains valid and redirects to the visitor's own
workspace context; no board content is copied.
Guest links are off by default, including on existing boards.
Enabling a guest link also permits guests to join
a private board. Changing the link role applies to all joined guests. Turning
it off removes all guest access; removing one guest ends their current access,
but they can rejoin while the link remains enabled. Disable the link to prevent
rejoining. A removed or disabled guest is denied on subsequent API requests and
live-session refreshes.

- **Private** boards are limited to the owner, explicitly shared members, and
  joined guests when guest link access is enabled.
- **Workspace-visible** boards preserve existing member editing access; an
  explicit Viewer assignment overrides it. Workspace Guest members default to
  Viewer; the owner can explicitly grant Editor to allow canvas, title, document, and comment edits. Removing
  an override restores default workspace access, so make the board Private to
  restrict it to a selected group.
- Online sessions appear above the canvas. Edits are merged on the server and
  shared immediately through the live server; deleting a shape preserves its
  tombstone so an older participant snapshot cannot bring it back.
- The owner can select **Present**. Participants follow the owner's pan/zoom,
  and all canvas/comment editing pauses until **Stop presenting**. Disconnecting
  the presenter ends presentation; an abruptly lost session expires within
  30 seconds.
- Viewers can read the canvas, documents, and comments but cannot change them.
  A lost live connection pauses editing; use **Reconnect** to rejoin. Unsaved
  in-memory changes are retained while the board stays open.

Local development requires the API and the live server (`pnpm --filter live dev`,
port 3100 by default), plus `CORS_ALLOWED_ORIGINS=http://localhost:3000` in
`apps/live/.env`. Apply all pending migrations, including
`0129_whiteboard_guests`, before starting the updated API. Production
updates must include **api, live, and web**, and the live service must allow the
web origin (wired in `deployments/tfc/docker-compose.yml`). Old whole-scene
whiteboard PATCH requests are rejected; canvas clients must use the authenticated
session endpoint. Ordinary Notepad pages are unchanged.

Canvas state (including inline images) is limited to 8 MB and 100 concurrent
sessions per board; PDF/Word/Excel documents remain separate uploaded assets.
The live server broadcasts immediately within an instance and revalidates
sessions against the API every five seconds, including role changes/revocations.
Tests: `pnpm --filter web test` and the API contract suite
`plane/tests/contract/app/test_whiteboard_collaboration_app.py`.

Open **Tool > Whiteboard**, then use **Attach documents** or drop PDF, Word
(`.docx`) and Excel (`.xlsx`) files onto the canvas. Documents become movable,
resizable previews. Double-click a preview to interact with it, scroll, change
PDF pages or select an Excel sheet. Images still use the existing image tool.
Drop images separately from documents.

- Save legacy `.doc` and `.xls` files as `.docx` and `.xlsx` before uploading.
- The instance's `FILE_SIZE_LIMIT` applies (5 MB by default). Office documents
  are also limited to 25 MB of expanded contents.
- Word previews retain text, tables and images, not exact Word page layout.
  Excel previews show cell text, up to 200 rows and 30 columns per sheet;
  charts and full spreadsheet formatting are not reproduced.
- Use **Download** to obtain the full original file. Previews run locally in
  the browser without sending documents to third-party viewing services.
- Select a single text element and choose **Add / edit text link**. Enter an
  `https://`, `http://` or `mailto:` URL, or leave it blank to remove the link.
- Attachments follow the whiteboard's visibility rules. Viewers can open
  accessible previews; uploading requires owner or Editor access.

### Canvas comments

Choose the **Add comment** speech-bubble icon in the drawing toolbar, then click
a canvas location to start a pinned thread. Click the icon again or press Escape
to cancel placement. When the drawing toolbar is hidden (including read-only
boards), **Comments** remains available for reading existing discussions.
Pins remain anchored while panning and zooming. Open a pin to reply, or use
**Comments** to find threads and optionally show resolved discussions. Any
owner or Editor can comment, resolve and reopen threads while presentation is
stopped; Viewers can only read threads.

Type `@` in the composer and select a workspace member to mention them.
Mentioned users receive an in-app **Inbox > Mentions** notification linking to
the thread, subject to their mention preference and current board access.
Email notifications are not sent for whiteboard comments. Threads refresh every
15 seconds and when the browser regains focus.

Comments support up to 10 downloadable attachments: PDF, Word (`.doc`, `.docx`),
Excel (`.xls`, `.xlsx`), PNG, JPG, TXT, CSV and ZIP. Each file uses the instance's
upload size limit. These are downloaded as originals, not rendered inline.
Comments are stored independently from the drawing so saving a scene cannot
overwrite a discussion.

### Task details

Task previews and full-page details show **Assignees**, **Due date** and
**Dependencies** directly below the title, before the description. Editable titles
show a subtle border on hover and while focused. The summary uses
the existing task fields and permissions; assignee and due-date controls have
moved from the lower Properties section. Dependencies use **Blocked by** for
prerequisites and **Blocking** for tasks waiting on this one. Use the edit icon
to add a dependency and the remove icon on a dependency chip to unlink it.
The existing Relations section remains available for all relation types.
Side-panel, modal, and full-screen previews place the remaining **Properties**
directly below Dependencies, followed by custom fields and Description. Mobile
full-page details use the same order; desktop full-page details retain their
Properties sidebar.

### Project custom fields

Open **Project settings > Work Structure > Custom fields > Add field**.
Project admins and members can create, edit and remove fields for that
project only. Supported types are single-select, multi-select (both with colored
options), text, number and date. Every existing and new project starts with
editable **Stage** and **Status** single-select fields; these do not replace
Plane's built-in State or Priority.

Fields appear below the built-in properties and before Description in task previews and
full-page details, not on board cards or as list columns. Select values save
immediately; text, number and date values use **Save** and **Cancel**. Archived
tasks and projects are read-only, and guests can only read values on tasks they
can access.

Field types cannot change after creation. Renaming or recoloring an option
preserves its saved selections. Clear task values before removing an option in
use. Removing a field hides it and its values throughout the project.

Enable **Notify task collaborators when this field changes** on a field to send
in-app Inbox notifications to the task creator, assignees and subscribers who
are active project/workspace members or admins. The person making the change
is excluded, and property-change notification preferences are respected.
Notifications are off by default; no email is sent.

## ⚙️ Built with

[![React Router](https://img.shields.io/badge/-React%20Router-CA4245?logo=react-router&style=for-the-badge&logoColor=white)](https://reactrouter.com/)
[![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=green)](https://www.djangoproject.com/)
[![Node JS](https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white)](https://nodejs.org/en)

## 📸 Screenshots

  <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://media.docs.plane.so/GitHub-readme/github-work-items.webp"
        alt="Plane Views"
        width="100%"
      />
    </a>
  </p>
  <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://media.docs.plane.so/GitHub-readme/github-cycles.webp"
        width="100%"
      />
    </a>
  </p>
  <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://media.docs.plane.so/GitHub-readme/github-modules.webp"
        alt="Plane Cycles and Modules"
        width="100%"
      />
    </a>
  </p>
  <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://media.docs.plane.so/GitHub-readme/github-views.webp"
        alt="Plane Analytics"
        width="100%"
      />
    </a>
  </p>
   <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://media.docs.plane.so/GitHub-readme/github-analytics.webp"
        alt="Plane Pages"
        width="100%"
      />
    </a>
  </p>
</p>

## 📝 Documentation

Explore Plane's [product documentation](https://docs.plane.so/) and [developer documentation](https://developers.plane.so/) to learn about features, setup, and usage.

## ❤️ Community

Join the Plane community on [GitHub Discussions](https://github.com/orgs/makeplane/discussions) and our [Forum](https://forum.plane.so). We follow a [Code of conduct](https://github.com/makeplane/plane/blob/master/CODE_OF_CONDUCT.md) in all our community channels.

Feel free to ask questions, report bugs, participate in discussions, share ideas, request features, or showcase your projects. We’d love to hear from you!

## 🛡️ Security

If you discover a security vulnerability in Plane, please report it responsibly instead of opening a public issue. We take all legitimate reports seriously and will investigate them promptly. See [Security policy](https://github.com/makeplane/plane/blob/master/SECURITY.md) for more info.

To disclose any security issues, please email us at security@plane.so.

## 🤝 Contributing

There are many ways you can contribute to Plane:

- Report [bugs](https://github.com/makeplane/plane/issues/new?assignees=srinivaspendem%2Cpushya22&labels=%F0%9F%90%9Bbug&projects=&template=--bug-report.yaml&title=%5Bbug%5D%3A+) or submit [feature requests](https://github.com/makeplane/plane/issues/new?assignees=srinivaspendem%2Cpushya22&labels=%E2%9C%A8feature&projects=&template=--feature-request.yaml&title=%5Bfeature%5D%3A+).
- Review the [documentation](https://docs.plane.so/) and submit [pull requests](https://github.com/makeplane/docs) to improve it—whether it's fixing typos or adding new content.
- Talk or write about Plane or any other ecosystem integration and [let us know](https://forum.plane.so)!
- Show your support by upvoting [popular feature requests](https://github.com/makeplane/plane/issues).

Please read [CONTRIBUTING.md](https://github.com/makeplane/plane/blob/master/CONTRIBUTING.md) for details on the process for submitting pull requests to us.

### Repo activity

![Plane Repo Activity](https://repobeats.axiom.co/api/embed/2523c6ed2f77c082b7908c33e2ab208981d76c39.svg "Repobeats analytics image")

### We couldn't have done this without you.

<a href="https://github.com/makeplane/plane/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=makeplane/plane" />
</a>

## Project sections

Project work-item layouts (List, Board, Calendar, Spreadsheet and Timeline) have
an Add section shortcut at the bottom. It is also available in project saved
views, modules and unfinished cycles. Sections are independent project-wide
records, not workflow states: creating, renaming, reordering or deleting one
does not change work-item status or completion. Project admins and members
can create a section with a name only and use Manage sections to rename it,
move it up/down, or delete it after confirmation. Deletion keeps its tasks and
moves them to No section, including archived tasks and drafts.

Add section and Manage sections also offer an optional icon picker and icon
color. Select an icon, choose its color, and save; existing sections can update
their icon/color without renaming them. Reset icon restores the default section
symbol. Icons appear in section group headers and beside the selected section
in task pickers. Existing sections retain their default symbol and color.
This customization requires migration `0132_section_icons`.

Manage sections has one Save button beside Close at the bottom. It saves all
pending name, icon and color edits; unchanged sections are not submitted.
Close discards unsaved edits. Reordering and confirmed deletion still apply
immediately. If saving fails partway through, already-saved changes are kept,
remaining edits stay in the dialog, and Save retries only those remaining edits.

New project List and Board defaults group by Sections and show empty sections.
Existing saved grouping preferences are preserved; use Group by Sections in the
footer to switch an existing view and show empty sections. Creating a section
from List or Board also switches that view to Sections and shows empty groups,
so the new section is visible immediately. Other filters are preserved. Drag work items
between sections or use the Section picker on cards, in the create form,
or in work-item details/preview. Calendar, Spreadsheet and Timeline keep their
usual layouts; their work-item details allow section assignment. Sections
are shared across all project views, modules and cycles, not per-view copies.
Guests can view sections but cannot manage them. Archived projects and
completed cycles do not expose section management in their layout footer.

This feature requires migration `0131_project_sections` and updated API and web
services. Task statuses remain independent of section assignment.
Migration `0133_default_project_sections` creates a real
Untitled section in existing projects and assigns previously unassigned tasks
and drafts to it without changing their statuses. New projects also get this
default section. It can be renamed, reordered, given an icon/color, or deleted
in Manage sections like any other section. New tasks and drafts without a section
use the project's default section while it exists. Explicitly choosing No section,
clearing an existing task's section, or deleting a section keeps tasks unassigned.
Deleting the default does not recreate it; subsequent unassigned tasks remain
under No section.

List and Board quick-add use the selected section's ID (or a null assignment
under No section), including Board subgroups. If task creation fails,
the temporary card is removed instead of leaving a work item with an undefined
identifier.
When grouped by Sections with empty groups enabled, List and Board show the
section layout even before the first task is created. This keeps new sections
and their Add task controls visible in empty projects.

## Your work

The Assigned, Created, and Subscribed tabs on your own Your work page include
an Add work item button beside the layout and display controls. It opens the
personal task dialog with no project required. Use Create in a project instead
to open the standard project task dialog; entered text, priority, and dates
are preserved. The button is available to workspace admins and members,
including members who have not joined any projects. Other users' profiles
and the Summary and Activity tabs are unchanged.

Personal tasks are workspace-scoped and private to their creator, including
against other workspace admins. A separate Personal tasks section above
project tasks on your Assigned and Created tabs supports editing, completion,
reopening, and confirmed deletion. It remains a list in both List and Board
layouts; project filters and display settings apply only to project tasks.
Personal tasks support a name, plain-text description, priority, start date,
and due date. They do not have project-only sections, labels, dependencies,
comments, cycles, or modules until moved into a project.

Move to project requires active member/admin access to an unarchived project
in the same workspace and warns that project members will gain visibility.
The move atomically creates a project work item assigned to you, uses the
project's default section, preserves dates, priority, description, and
completion, and removes the item from the personal list. Completed tasks need
a completed state in the destination; open tasks need an open state. Repeated
move requests cannot create duplicate project tasks. Existing project tasks
and their schema are unchanged; migration 0134 adds the separate personal task table.

## Work item dependencies

The task preview Properties panel hides the built-in State row. This is a
display-only change: stored task states and state controls elsewhere are unchanged.

Blocked by lists tasks this work item depends on; Blocking lists tasks that depend
on this work item. Adding either link automatically shows the reverse relationship
on the other task. Dependency chips display task names, with the work item
identifier available in the tooltip.
The Parent field also displays the parent task's name, with its identifier in
the tooltip; opening or removing the parent link works as before.

The relation picker adds new links only. It excludes the current task and tasks
already linked in either direction. With only two tasks already linked, an empty
picker is expected; it does not mean the existing dependency is missing.

## License

This project is licensed under the [GNU Affero General Public License v3.0](https://github.com/makeplane/plane/blob/master/LICENSE.txt).
