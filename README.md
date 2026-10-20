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

Application emails use the TFC PMS logo, product name and footer. The logo is
loaded from `${WEB_URL}/tfc-pms-logo.png`; `WEB_URL` must be the public web
application URL. Email clients may block remote images until the recipient
allows them. Login codes, reset links and invitation links are unchanged.

## TFCPMS navigation

The sidebar's **Tool > Notepad** entry opens workspace pages; existing page URLs
and content are unchanged. Project sidebars omit **Pages** and label **Cycles**
as **Analytics**; the Analytics entry still opens the existing Cycles screen.

## Project overview

Click a project name in the sidebar or project directory to open **Overview**.
The page shows the project's description, owner, members, key resource links,
health, and task progress. Project/workspace admins can edit the description,
assign an active project member as owner, set health to **On track**, **At risk**,
or **Off track**, and add/remove resource links. Members and guests have read-only
access; archived projects cannot be edited.

Overview includes the standard project breadcrumb and Work items toolbar.
On desktop, layout and filter icons sit beside the breadcrumb and task count;
Display, Analytics, and Add work item remain on the right.
Selecting a layout opens Work items in that layout; Filters and Display open
Work items to configure that view. Analytics and Add work item open directly
from Overview and retain the same project-role permissions as Work items.
On smaller screens, toolbar controls appear in a scrollable row below the header.

Pages attached directly to a project also appear as icon-and-name shortcuts in
that project's breadcrumb/header row, including Overview and Work items.
Task-attached pages and whiteboards are not included. Only pages visible to the
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
link. Recipients must sign in with their workspace account; anonymous/external
links are not supported.

- **Private** boards are limited to the owner and explicitly shared members.
- **Workspace-visible** boards preserve existing member editing access; an
  explicit Viewer assignment overrides it. Guests default to Viewer; the owner
  can explicitly grant Editor to allow canvas, title, document, and comment edits. Removing
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
`apps/live/.env`. Apply migration `0127_whiteboard_collaboration`. Production
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

## License

This project is licensed under the [GNU Affero General Public License v3.0](https://github.com/makeplane/plane/blob/master/LICENSE.txt).
