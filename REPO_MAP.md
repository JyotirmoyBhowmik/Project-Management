# Repository Map - Enterprise PMS

> Generated on 2026-09-19T12:29:12.330Z | **129** source files | **32,202** lines of code | **764** indexed symbols | **307** dependency relations

Compact AST symbol map (classes, functions, interfaces, types, components) with 1-based relative line numbers. Elides implementation bodies to optimize for AI token budget.

---

## ACTION (6 files)

### `src/actions/automations.ts` (272 lines)
```typescript
L14: export interface ActionResponse { ... }
L21: export component_or_fn CreateAutomationSchema
L42: export type CreateAutomationInput
L44: export function createAutomationAction
L79: export function toggleAutomationAction
L96: export function deleteAutomationAction
L113: export function getTenantAutomationsAction
L146: export function dispatchAutomationTriggerAction
L226: export function createWebhookAction
L256: export function getTenantWebhooksAction
```

### `src/actions/sprints.ts` (301 lines)
```typescript
L14: export interface ActionResponse { ... }
L21: export component_or_fn CreateSprintSchema
L30: export type CreateSprintInput
L32: export function createSprintAction
L67: export function startSprintAction
L86: export function completeSprintAction
L137: export function assignTaskToSprintAction
L169: export function getProjectSprintsAction
L200: export function getSprintMetricsAction
```

### `src/actions/tasks.ts` (443 lines)
```typescript
L18: export component_or_fn TaskInputSchema
L41: export type TaskInput
L43: export component_or_fn UpdateTaskScheduleSchema
L51: export component_or_fn UpdateTaskStatusSchema
L57: export interface ServerActionResponse { ... }
L70: export function createTaskAction
L227: export function updateTaskScheduleAction
L319: export function updateTaskStatusAction
L407: export function getTenantMembersAction
```

### `src/actions/timesheets.ts` (335 lines)
```typescript
L14: export interface ActionResponse { ... }
L21: export component_or_fn LogTimeSchema
L31: export type LogTimeInput
L33: export function logTimeAction
L83: export function updateTimesheetApprovalAction
L122: export function getTimesheetsAction
L151: export function getProjectEVMMetricsAction
L270: export function setTenantRateAction
L302: export function setProjectBudgetAction
```

### `src/actions/trash.ts` (184 lines)
```typescript
L13: export interface ActionResponse { ... }
L20: export function softDeleteEntityAction
L54: export function restoreEntityAction
L79: export function permanentDeleteEntityAction
L104: export function getTrashItemsAction
```

### `src/actions/wiki.ts` (186 lines)
```typescript
L14: export interface ActionResponse { ... }
L21: export component_or_fn CreateDocSchema
L29: export type CreateDocInput
L31: export function createDocumentAction
L64: export function updateDocumentContentAction
L95: export function getDocumentTreeAction
L138: export function linkTaskToDocAction
L153: export function unlinkTaskFromDocAction
L170: export function getTaskLinkedDocsAction
```

## LIB (29 files)

### `src/lib/calendar/calendar-engine.ts` (213 lines)
```typescript
L8: export interface CalendarDayInfo { ... }
L18: export function formatDateToISO
L25: export function parseISODate
L30: export function normalizeHolidays
L46: export function isWorkingDay
L75: export function getNextWorkingDay
L90: export function calculate_working_end_date
L118: export function addWorkingDays
L144: export function calculateWorkingDays
L170: export function generateDayGrid
```

### `src/lib/context/tenant-metadata-context.tsx` (254 lines)
```typescript
L21: interface TenantMetadataContextType { ... }
L43: component_or_fn TenantMetadataContext
L45: export function TenantMetadataProvider
L246: export function useTenantMetadata
```

### `src/lib/cpm/cpm-engine.ts` (378 lines)
```typescript
L18: export interface CPMResult { ... }
L28: export function subtractWorkingDays
L59: export function topologicalSort
L103: export function calculateCPM
L357: export function autoScheduleCascading
```

### `src/lib/email/adapters/resend-adapter.ts` (117 lines)
```typescript
L10: export class ResendEmailAdapter
  L22: send(...)
```

### `src/lib/email/adapters/smtp-adapter.ts` (125 lines)
```typescript
L12: export interface SmtpConfig { ... }
L21: export class SmtpEmailAdapter
  L54: send(...)
```

### `src/lib/email/email-service.ts` (189 lines)
```typescript
L26: export class EmailService
  L42: setAdapter(...)
  L46: getAdapter(...)
  L50: send(...)
  L107: sendWorkspaceInvitation(...)
  L123: sendGuestInvitation(...)
  L139: sendTaskAssignment(...)
  L155: sendSlaMilestoneAlert(...)
  L171: sendDailyDigest(...)
L188: export const emailService
```

### `src/lib/email/templates/daily-digest.ts` (134 lines)
```typescript
L8: export function renderDailyDigestEmail
```

### `src/lib/email/templates/guest-invitation.ts` (102 lines)
```typescript
L8: export function renderGuestInvitationEmail
```

### `src/lib/email/templates/sla-milestone.ts` (77 lines)
```typescript
L8: export function renderSlaMilestoneEmail
```

### `src/lib/email/templates/task-assignment.ts` (98 lines)
```typescript
L8: export function renderTaskAssignmentEmail
```

### `src/lib/email/templates/workspace-invitation.ts` (103 lines)
```typescript
L8: export function renderWorkspaceInvitationEmail
```

### `src/lib/email/types.ts` (112 lines)
```typescript
L8: export type EmailProvider
L10: export interface SendEmailOptions { ... }
L21: export interface EmailResult { ... }
L29: export interface IEmailAdapter { ... }
L38: export interface WorkspaceInvitationTemplateData { ... }
L49: export interface GuestInvitationTemplateData { ... }
L58: export interface TaskAssignmentTemplateData { ... }
L68: export interface SlaMilestoneTemplateData { ... }
L78: export interface DailyDigestTemplateData { ... }
L99: export component_or_fn SendEmailSchema
```

### `src/lib/error/api-handler.ts` (141 lines)
```typescript
L11: export interface StandardizedErrorResponse { ... }
L20: export interface StandardizedSuccessResponse { ... }
L28: export function extractCorrelationId
L37: export function createSuccessResponse
L55: export function createErrorResponse
L129: export function apiHandler
```

### `src/lib/error/domain-errors.ts` (99 lines)
```typescript
L6: export class DomainException
L17: export class EntityNotFoundException
L26: export class TenantNotFoundException
L35: export class UnauthorizedAccessException
L44: export class GuestAccessViolationException
L53: export class ValidationException
L64: export class DependencyCycleException
L73: export class ScheduleConflictException
L82: export class CircuitBreakerOpenException
L91: export class RequestTimeoutException
```

### `src/lib/logger/logger.ts` (123 lines)
```typescript
L6: export type LogLevel
L8: component_or_fn SENSITIVE_KEYS
L21: export function redactPII
L44: export interface StructuredLogPayload { ... }
L59: export class Logger
  L66: write(...)
  L105: debug(...)
  L109: info(...)
  L113: warn(...)
  L117: error(...)
L122: export const logger
```

### `src/lib/notifications/notification-dispatcher.ts` (114 lines)
```typescript
L10: export interface NotificationPreferences { ... }
L22: export const defaultNotificationPreferences
L34: export class NotificationDispatcher
  L35: dispatch(...)
  L41: notifyTaskAssigned(...)
  L59: notifyDueSoon(...)
  L77: notifyDependencyResolved(...)
  L95: notifyMention(...)
```

### `src/lib/realtime/presence-service.ts` (145 lines)
```typescript
L12: export interface CollaboratorPresence { ... }
L21: component_or_fn COLLABORATOR_COLORS
L31: export function useProjectPresence
```

### `src/lib/resilience/resilience.ts` (194 lines)
```typescript
L12: export function withTimeout
L34: export interface RetryOptions { ... }
L42: export function withRetry
L95: export class CircuitBreaker
  L109: getState(...)
  L120: execute(...)
  L137: onSuccess(...)
  L142: onFailure(...)
  L152: reset(...)
L163: export class IdempotencyManager
  L167: get(...)
  L177: set(...)
  L190: clear(...)
```

### `src/lib/resource/resource-engine.ts` (208 lines)
```typescript
L20: export type ResourceUtilizationStatus
L22: export interface TaskWorkloadSlice { ... }
L29: export interface DailyUserWorkload { ... }
L40: export interface UserWorkloadSummary { ... }
L52: export interface ResourceHeatmapResult { ... }
L73: export function computeResourceWorkload
```

### `src/lib/stores/gantt-store.ts` (106 lines)
```typescript
L8: export type GanttZoomLevel
L10: interface GanttState { ... }
L38: component_or_fn ZOOM_WIDTHS
L45: export const useGanttStore
```

### `src/lib/stores/tenant-store.ts` (61 lines)
```typescript
L10: interface TenantState { ... }
L22: export const useTenantStore
```

### `src/lib/stores/theme-store.ts` (45 lines)
```typescript
L9: export type EnterpriseTheme
L11: interface ThemeState { ... }
L16: component_or_fn STORAGE_KEY
L18: component_or_fn getInitialTheme
L28: export const useEnterpriseTheme
```

### `src/lib/supabase/client.ts` (22 lines)
```typescript
L8: export function createClient
```

### `src/lib/supabase/db-service.ts` (1844 lines)
```typescript
L37: function getSupabase
L42: export class DatabaseService
  L47: getTenantBySlugOrCode(...)
  L77: getTenantById(...)
  L100: getAllTenants(...)
  L119: createTenant(...)
  L146: getUserProfile(...)
  L166: getUserTenantMemberships(...)
  L186: getTenantMembers(...)
  L227: getUserGuestAccess(...)
  L253: getTenantProjects(...)
  L289: getProjectDetails(...)
  L310: createProject(...)
  L333: updateProject(...)
  L356: getProjectPhases(...)
  L384: getProjectTasks(...)
  L409: getTasksForProject(...)
  L413: getProjectDependencies(...)
  L433: getDependenciesForProject(...)
  L437: createDependency(...)
  L475: deleteDependency(...)
  L492: createTask(...)
  L524: updateTask(...)
  L525: updateTask(...)
  L526: updateTask(...)
  L570: getWorkingCalendar(...)
  L596: getCalendarHolidays(...)
  L615: getProjectBaselines(...)
  L632: getBaselineSnapshots(...)
  L647: createBaselineSnapshot(...)
  L704: getUserNotifications(...)
  L721: markNotificationRead(...)
  L739: createNotification(...)
  L771: getSystemThemes(...)
  L788: updateSystemTheme(...)
  L810: getTenantTheme(...)
  L835: setTenantTheme(...)
  L866: getTenantTaskStatuses(...)
  L882: createTenantTaskStatus(...)
  L907: updateTenantTaskStatus(...)
  L928: deleteTenantTaskStatus(...)
  L946: getTenantTaskPriorities(...)
  L962: createTenantTaskPriority(...)
  L987: updateTenantTaskPriority(...)
  L1008: deleteTenantTaskPriority(...)
  L1026: getTenantTaskTypes(...)
  L1041: createTenantTaskType(...)
  L1065: deleteTenantTaskType(...)
  L1083: getTenantCustomFields(...)
  L1099: createTenantCustomField(...)
  L1123: deleteTenantCustomField(...)
  L1141: getTenantRolePermissions(...)
  L1156: updateRolePermission(...)
  L1182: hasPermission(...)
  L1191: saveWorkingCalendar(...)
  L1225: addCalendarHoliday(...)
  L1270: deleteCalendarHoliday(...)
  L1288: getAuditLogs(...)
  L1316: createAuditLog(...)
  L1344: getAllUsers(...)
  L1366: getGlobalAuditLogs(...)
  L1389: lockProjectBaseline(...)
  L1414: getTaskComments(...)
  L1434: createTaskComment(...)
  L1481: getTaskActivityLogs(...)
  L1501: createTaskActivityLog(...)
  L1543: getTaskAttachments(...)
  L1563: createTaskAttachmentRecord(...)
  L1618: deleteTaskAttachmentRecord(...)
  L1645: getAttachmentSignedUrl(...)
  L1671: getTenantMembersWithProfiles(...)
L1719: export component_or_fn DEFAULT_THEME_TOKENS
L1745: export component_or_fn DEFAULT_SYSTEM_THEMES
L1843: export const dbService
```

### `src/lib/supabase/mock-db.ts` (1739 lines)
```typescript
L39: class DatabaseStore
  L70: seed(...)
  L954: seedCoreDemoDataset(...)
  L1186: is_member_of(...)
  L1192: has_guest_project_access(...)
  L1207: calculate_working_end_date(...)
  L1216: getTenantBySlugOrCode(...)
  L1221: getProjectsForUser(...)
  L1232: getProject(...)
  L1245: getProjectTasksWithRelations(...)
  L1281: recalculateProjectCPM(...)
  L1302: updateTask(...)
  L1336: createTask(...)
  L1377: addDependency(...)
  L1411: removeDependency(...)
  L1438: seedTenantMetadata(...)
  L1460: getTenantTaskStatuses(...)
  L1466: createTenantTaskStatus(...)
  L1476: updateTenantTaskStatus(...)
  L1483: deleteTenantTaskStatus(...)
  L1489: getTenantTaskPriorities(...)
  L1495: createTenantTaskPriority(...)
  L1505: updateTenantTaskPriority(...)
  L1512: deleteTenantTaskPriority(...)
  L1518: getTenantTaskTypes(...)
  L1522: createTenantTaskType(...)
  L1534: getSystemThemes(...)
  L1538: updateSystemTheme(...)
  L1545: getTenantTheme(...)
  L1555: setTenantTheme(...)
  L1572: createSystemTheme(...)
  L1579: getTenantCustomFields(...)
  L1585: createTenantCustomField(...)
  L1595: deleteTenantCustomField(...)
  L1603: getEntityCustomFieldValues(...)
  L1615: setEntityCustomFieldValue(...)
  L1635: createProjectBaseline(...)
  L1665: getProjectBaselines(...)
  L1669: getBaselineSnapshots(...)
  L1675: getUserNotifications(...)
  L1681: markNotificationRead(...)
  L1690: markAllNotificationsRead(...)
  L1696: createNotification(...)
  L1709: getTenantRolePermissions(...)
  L1713: updateRolePermission(...)
  L1731: hasPermission(...)
L627: component_or_fn NAVY_TOKENS
L653: component_or_fn DARK_TOKENS
L679: component_or_fn MONOKAI_TOKENS
L705: component_or_fn HIGH_CONTRAST_TOKENS
L731: component_or_fn LIGHT_TOKENS
L771: component_or_fn seedStatusesForTenant
L785: component_or_fn seedPrioritiesForTenant
L797: component_or_fn seedTypesForTenant
L896: component_or_fn seedPermissionsForTenant
L1738: export const db
```

### `src/lib/supabase/server.ts` (66 lines)
```typescript
L9: export function createServerSupabaseClient
L46: export function createAdminClient
```

### `src/lib/theme/dynamic-theme-provider.tsx` (203 lines)
```typescript
L15: interface DynamicThemeContextType { ... }
L24: component_or_fn DynamicThemeContext
L26: export function generateCssVariables
L56: export function DynamicThemeProvider
L90: function loadTheme
L196: export function useDynamicTheme
```

### `src/lib/utils.ts` (12 lines)
```typescript
L9: export function cn
```

### `src/lib/validation/schemas.ts` (196 lines)
```typescript
L8: component_or_fn SAFE_CODE_REGEX
L9: component_or_fn DATE_REGEX
L11: export function sanitizeString
L21: export component_or_fn TenantCreateBaseSchema
L38: export component_or_fn TenantCreateSchema
L44: export component_or_fn TenantUpdateSchema
L49: export component_or_fn ProjectCreateBaseSchema
L60: export component_or_fn ProjectCreateSchema
L70: export component_or_fn ProjectUpdateSchema
L75: export component_or_fn TaskCreateBaseSchema
L95: export component_or_fn TaskCreateSchema
L110: export component_or_fn TaskUpdateSchema
L112: export component_or_fn TaskMoveSchema
L122: export component_or_fn DependencyCreateBaseSchema
L132: export component_or_fn DependencyCreateSchema
L144: export component_or_fn CalendarConfigSchema
L151: export component_or_fn HolidayCreateSchema
L166: export component_or_fn StandardPredecessorSchema
L172: export component_or_fn StandardImportRowSchema
L186: export type ValidatedStandardImportRow
L188: export component_or_fn ImportRowSchema
L189: export type ValidatedImportRow
L191: export component_or_fn AuthRepairSchema
L195: export type ValidatedAuthRepair
```

## COMPONENT (23 files)

### `src/components/admin/SuperAdminPanel.tsx` (902 lines)
```typescript
L34: export function SuperAdminPanel
L67: function loadSuperAdminData
L94: component_or_fn showNotification
L99: component_or_fn handleSelectThemeToEdit
L107: component_or_fn handleUpdateToken
L114: component_or_fn handleSaveTheme
L123: component_or_fn handleProvisionTenant
L164: component_or_fn toggleTenantStatus
L176: component_or_fn handleUpdateQuota
L203: component_or_fn toggleFeatureFlag
L224: component_or_fn handleCloneTenant
```

### `src/components/admin/TenantAdminPanel.tsx` (1023 lines)
```typescript
L40: export function TenantAdminPanel
L109: function loadTenantAdminData
L155: component_or_fn showNotification
L161: component_or_fn handleAddStatus
L185: component_or_fn handleDeleteStatus
L195: component_or_fn handleAddPriority
L219: component_or_fn handleDeletePriority
L229: component_or_fn handleAddCustomField
L258: component_or_fn handleDeleteCustomField
L268: component_or_fn handleTogglePermission
L278: component_or_fn toggleDay
L286: component_or_fn handleAddHoliday
L304: component_or_fn handleDeleteHoliday
L311: component_or_fn handleSaveCalendar
L333: component_or_fn PERMISSION_KEYS
L343: component_or_fn ROLES
```

### `src/components/agile/SprintPlanningView.tsx` (497 lines)
```typescript
L37: interface SprintPlanningViewProps { ... }
L46: export function SprintPlanningView
L95: component_or_fn handleDragStart
L99: component_or_fn handleDrop
L117: component_or_fn handleCreateSprint
L142: component_or_fn handleStartSprint
L153: component_or_fn handleCompleteSprint
L244: component_or_fn Icon
```

### `src/components/calendar/ProjectCalendarView.tsx` (151 lines)
```typescript
L9: interface ProjectCalendarViewProps { ... }
L15: export function ProjectCalendarView
L18: component_or_fn prevMonth
L22: component_or_fn nextMonth
```

### `src/components/exchange/ImportExportModal.tsx` (439 lines)
```typescript
L22: interface ImportExportModalProps { ... }
L32: component_or_fn STANDARD_TEMPLATE_DATA
L61: export function ImportExportModal
L90: component_or_fn handleDownloadTemplate
L129: component_or_fn handleExport
L192: component_or_fn handleFileUpload
L253: component_or_fn handleCommitImport
```

### `src/components/gantt/InteractiveGantt.tsx` (1225 lines)
```typescript
L41: interface InteractiveGanttProps { ... }
L57: export function InteractiveGantt
L173: component_or_fn handleMouseDown
L260: component_or_fn handleMouseMove
L338: component_or_fn onGlobalMouseMove
L342: component_or_fn onGlobalMouseUp
L356: component_or_fn handleConnectorMouseUp
L398: component_or_fn handleTaskClick
L403: component_or_fn handleCreateTask
```

### `src/components/graphify/GraphCanvas.tsx` (638 lines)
```typescript
L30: export interface GraphNode { ... }
L42: export interface GraphEdge { ... }
L52: interface GraphCanvasProps { ... }
L64: component_or_fn STATUS_COLORS
L73: export function GraphCanvas
L273: component_or_fn handleMouseDown
L280: component_or_fn handleMouseMove
L292: component_or_fn handleMouseUp
```

### `src/components/grid/HierarchicalGrid.tsx` (259 lines)
```typescript
L19: interface HierarchicalGridProps { ... }
L26: export function HierarchicalGrid
L34: component_or_fn toggleExpand
L38: component_or_fn renderPriorityBadge
```

### `src/components/kanban/KanbanBoard.tsx` (278 lines)
```typescript
L23: interface KanbanBoardProps { ... }
L29: export function KanbanBoard
L42: component_or_fn handleStatusChange
L73: component_or_fn moveLane
L81: component_or_fn renderPriorityBadge
```

### `src/components/layout/Breadcrumbs.tsx` (42 lines)
```typescript
L8: export function Breadcrumbs
```

### `src/components/layout/Header.tsx` (435 lines)
```typescript
L35: export function Header
L76: component_or_fn handleMarkAsRead
L81: component_or_fn handleTenantSwitch
L96: component_or_fn handleSignOut
L106: component_or_fn closeAllMenus
```

### `src/components/layout/Sidebar.tsx` (206 lines)
```typescript
L27: export function Sidebar
L117: component_or_fn Icon
L148: component_or_fn Icon
```

### `src/components/resource/ResourceHeatmapView.tsx` (398 lines)
```typescript
L32: interface ResourceHeatmapViewProps { ... }
L41: export function ResourceHeatmapView
L103: component_or_fn toggleUser
```

### `src/components/tasks/CreateTaskDialog.tsx` (468 lines)
```typescript
L61: type CreateTaskFormData
L63: interface CreateTaskDialogProps { ... }
L71: export function CreateTaskDialog
L147: component_or_fn onSubmit
L200: component_or_fn handleToggleAssignee
```

### `src/components/tasks/TaskAttachmentsManager.tsx` (301 lines)
```typescript
L23: interface TaskAttachmentsManagerProps { ... }
L31: component_or_fn MAX_FILE_SIZE_BYTES
L33: export function TaskAttachmentsManager
L74: component_or_fn handleFileUpload
L128: component_or_fn handleDeleteAttachment
L139: component_or_fn formatFileSize
L145: component_or_fn getFileIcon
```

### `src/components/tasks/TaskDetailDrawer.tsx` (706 lines)
```typescript
L33: interface TaskDetailDrawerProps { ... }
L46: export function TaskDetailDrawer
L106: function loadData
L132: component_or_fn handleKeyDown
L142: component_or_fn handleSaveDetails
L147: component_or_fn handleDurationChange
L160: component_or_fn handleStartDateChange
L172: type FeedItem
L193: component_or_fn handleCommentChange
L213: component_or_fn insertMention
L223: component_or_fn submitComment
```

### `src/components/ui/badge.tsx` (30 lines)
```typescript
L4: export interface BadgeProps { ... }
L8: export function Badge
```

### `src/components/ui/button.tsx` (39 lines)
```typescript
L4: export interface ButtonProps { ... }
L9: export component_or_fn Button
```

### `src/components/ui/card.tsx` (32 lines)
```typescript
L4: export function Card
L13: export function CardHeader
L17: export function CardTitle
L21: export function CardDescription
L25: export function CardContent
L29: export function CardFooter
```

### `src/components/ui/dialog.tsx` (44 lines)
```typescript
L7: export interface ModalProps { ... }
L16: export function Modal
```

### `src/components/ui/input.tsx` (22 lines)
```typescript
L4: export type InputProps
L6: export component_or_fn Input
```

### `src/components/ui/tabs.tsx` (56 lines)
```typescript
L6: export interface TabItem { ... }
L13: export interface TabsProps { ... }
L20: export function Tabs
```

### `src/components/wiki/WikiWorkspace.tsx` (310 lines)
```typescript
L39: interface WikiWorkspaceProps { ... }
L48: export function WikiWorkspace
L77: component_or_fn toggleExpand
L86: component_or_fn handleCreateDoc
L108: component_or_fn handleSaveDoc
L129: component_or_fn handleLinkTask
L143: component_or_fn renderDocumentWithEmbeddedTasks
```

## PAGE (16 files)

### `src/app/(auth)/login/page.tsx` (390 lines)
```typescript
L31: function LoginPageContent
L62: component_or_fn handleResolveWorkspace
L90: component_or_fn handleLogin
L377: export function LoginPage
```

### `src/app/(dashboard)/admin/multisite/diagnostics/page.tsx` (284 lines)
```typescript
L29: export function DiagnosticsPage
L35: component_or_fn addLog
L39: component_or_fn runDiagnostics
L78: component_or_fn renderStatusBadge
```

### `src/app/(dashboard)/admin/multisite/page.tsx` (14 lines)
```typescript
L11: export function MultiSiteAdminPage
```

### `src/app/(dashboard)/admin/superadmin/help/page.tsx` (172 lines)
```typescript
L25: export function SuperAdminManualPage
L131: component_or_fn Icon
```

### `src/app/(dashboard)/admin/superadmin/page.tsx` (9 lines)
```typescript
L6: export function SuperAdminPage
```

### `src/app/(dashboard)/admin/tenant/help/page.tsx` (187 lines)
```typescript
L26: export function TenantAdminManualPage
L137: component_or_fn Icon
```

### `src/app/(dashboard)/admin/tenant/page.tsx` (9 lines)
```typescript
L6: export function TenantAdminPage
```

### `src/app/(dashboard)/help/page.tsx` (260 lines)
```typescript
L28: export function TenantUserManualPage
L198: component_or_fn Icon
```

### `src/app/(dashboard)/layout.tsx` (228 lines)
```typescript
L20: export function DashboardLayout
L47: function initSession
L155: component_or_fn handleSignOut
```

### `src/app/(dashboard)/page.tsx` (420 lines)
```typescript
L34: export function DashboardOverviewPage
L92: component_or_fn handleCreateProject
```

### `src/app/(dashboard)/projects/page.tsx` (326 lines)
```typescript
L30: export function ProjectsPortfolioPage
L80: component_or_fn handleCreateProject
L112: component_or_fn getStatusBadgeVariant
```

### `src/app/(dashboard)/projects/[projectId]/page.tsx` (661 lines)
```typescript
L71: function ProjectWorkspaceContent
L83: type ViewType
L185: function loadSnapshots
L199: component_or_fn handleRunCPM
L234: component_or_fn handleLockBaseline
L392: component_or_fn Icon
L648: export function ProjectWorkspacePage
```

### `src/app/(dashboard)/settings/automations/page.tsx` (438 lines)
```typescript
L38: export function AutomationsPage
L80: component_or_fn handleCreateRule
L121: component_or_fn handleToggle
L129: component_or_fn handleDelete
L138: component_or_fn handleCreateWebhook
L187: component_or_fn Icon
```

### `src/app/(dashboard)/settings/trash/page.tsx` (230 lines)
```typescript
L31: export function TrashPage
L59: component_or_fn handleRestore
L73: component_or_fn handlePermanentDelete
```

### `src/app/(dashboard)/timesheets/page.tsx` (464 lines)
```typescript
L38: export function TimesheetsPage
L94: component_or_fn handleLogTime
L128: component_or_fn handleApprove
L138: component_or_fn handleReject
```

### `src/app/layout.tsx` (23 lines)
```typescript
L5: export const metadata
L10: export function RootLayout
```

## API (12 files)

### `src/app/api/cron/daily-schedule/route.ts` (245 lines)
```typescript
L14: export const dynamic
L16: export function GET
```

### `src/app/api/system/health-audit/route.ts` (243 lines)
```typescript
L14: export const dynamic
L16: export component_or_fn GET
```

### `src/app/api/v1/audit-logs/route.ts` (30 lines)
```typescript
L10: export component_or_fn GET
```

### `src/app/api/v1/auth/repair/route.ts` (130 lines)
```typescript
L13: export component_or_fn POST
```

### `src/app/api/v1/export/route.ts` (76 lines)
```typescript
L11: export component_or_fn GET
```

### `src/app/api/v1/import/route.ts` (237 lines)
```typescript
L14: export component_or_fn POST
```

### `src/app/api/v1/projects/route.ts` (55 lines)
```typescript
L11: export component_or_fn GET
L24: export component_or_fn POST
```

### `src/app/api/v1/projects/[id]/cpm/route.ts` (45 lines)
```typescript
L11: export component_or_fn POST
```

### `src/app/api/v1/projects/[id]/dependencies/route.ts` (62 lines)
```typescript
L11: export component_or_fn POST
L42: export component_or_fn DELETE
```

### `src/app/api/v1/projects/[id]/route.ts` (65 lines)
```typescript
L11: export component_or_fn GET
L30: export component_or_fn PUT
```

### `src/app/api/v1/projects/[id]/tasks/route.ts` (105 lines)
```typescript
L11: export component_or_fn GET
L29: export component_or_fn POST
L73: export component_or_fn PUT
```

### `src/app/api/v1/tenants/route.ts` (46 lines)
```typescript
L11: export component_or_fn GET
L25: export component_or_fn POST
```

## TYPE (1 files)

### `src/types/database.ts` (668 lines)
```typescript
L6: export type UserTenantRole
L7: export type DependencyType
L8: export type TaskPriority
L9: export type TaskStatus
L10: export type ProjectStatus
L13: export type TenantRole
L14: export type TenantStatus
L16: export interface TenantBranding { ... }
L23: export interface WorkingCalendar { ... }
L37: export interface Tenant { ... }
L57: export interface UserProfile { ... }
L68: export interface TenantMembership { ... }
L80: export interface TenantTeam { ... }
L88: export interface TeamMember { ... }
L94: export interface CalendarHoliday { ... }
L106: export interface Project { ... }
L123: export interface ProjectGuestAccess { ... }
L133: export interface ProjectPhase { ... }
L147: export interface TaskAssignee { ... }
L158: export interface TaskDependency { ... }
L172: export type TaskConstraintType
L174: export interface Task { ... }
L226: export interface AuditLog { ... }
L247: export interface TenantTaskStatus { ... }
L260: export interface TenantTaskPriority { ... }
L273: export interface TenantTaskType { ... }
L283: export interface ThemeTokens { ... }
L309: export interface SystemTheme { ... }
L318: export interface TenantThemeOverride { ... }
L327: export type CustomFieldType
L337: export interface TenantCustomField { ... }
L350: export interface EntityCustomFieldValue { ... }
L360: export interface ProjectBaseline { ... }
L372: export interface TaskBaselineSnapshot { ... }
L383: export interface UserNotification { ... }
L398: export interface TenantRolePermission { ... }
L411: export interface TaskComment { ... }
L422: export interface TaskActivityLog { ... }
L433: export interface TaskAttachment { ... }
L448: export interface SystemHealthCheckResult { ... }
L455: export interface SystemHealthAuditReport { ... }
L478: export interface TenantUserRate { ... }
L490: export interface ProjectBudget { ... }
L501: export type TimeLogApprovalStatus
L503: export interface TaskTimeLog { ... }
L522: export interface EVMMetrics { ... }
L538: export type SprintStatus
L540: export interface ProjectSprint { ... }
L556: export interface SprintBurndownPoint { ... }
L562: export interface SprintBurnupPoint { ... }
L568: export interface CumulativeFlowPoint { ... }
L576: export interface AgileSprintMetrics { ... }
L584: export interface TenantAutomation { ... }
L606: export interface AutomationExecutionLog { ... }
L615: export interface TenantWebhook { ... }
L626: export interface ProjectDocument { ... }
L645: export interface DocumentTaskLink { ... }
L654: export interface SoftDeletedItem { ... }
```

## DATABASE (15 files)

### `supabase/fix_and_seed.sql` (1017 lines)
```typescript
L44: export table tenants
L62: export table tenants_v2
L75: export table user_profiles
L85: export table profiles
L95: export table tenant_memberships
L106: export table working_calendars
L118: export table calendar_holidays
L129: export table projects
L145: export table project_guest_access
L155: export table phases
L167: export table project_phases
L179: export table tasks
L209: export table task_assignees
L217: export table task_dependencies
L230: export table tenant_task_statuses
L244: export table tenant_task_priorities
L257: export table tenant_task_types
L268: export table system_themes
L277: export table tenant_theme_overrides
L286: export table project_baselines
L298: export table task_baseline_snapshots
L310: export table user_notifications
L324: export table tenant_role_permissions
L334: export table audit_logs
L362: export function current_app_user_id
L368: export function is_superadmin
L375: export function is_member_of
L418: export policy tenants_public_lookup on tenants
L421: export policy tenants_admin_mutation_policy on tenants
L426: export policy profiles_read_all on user_profiles
L427: export policy profiles_update_self on user_profiles
L431: export policy profiles_v2_read_all on profiles
L432: export policy profiles_v2_update_self on profiles
L436: export policy memberships_select_policy on tenant_memberships
L437: export policy memberships_admin_manage_policy on tenant_memberships
L441: export policy projects_select_policy on projects
L442: export policy projects_mutation_policy on projects
L446: export policy tasks_select_policy on tasks
L447: export policy tasks_modify_policy on tasks
L451: export policy dependencies_select_policy on task_dependencies
L452: export policy dependencies_modify_policy on task_dependencies
L456: export policy calendars_select_policy on working_calendars
L457: export policy calendars_modify_policy on working_calendars
L461: export policy holidays_select_policy on calendar_holidays
L462: export policy holidays_modify_policy on calendar_holidays
L465: export policy audit_logs_tenant_admin_read on audit_logs
L485: export table tenants_v2
L498: export table user_profiles
L509: export table profiles
L529: export table tenant_teams
```

### `supabase/master_schema.sql` (1017 lines)
```typescript
L44: export table tenants
L62: export table tenants_v2
L75: export table user_profiles
L85: export table profiles
L95: export table tenant_memberships
L106: export table working_calendars
L118: export table calendar_holidays
L129: export table projects
L145: export table project_guest_access
L155: export table phases
L167: export table project_phases
L179: export table tasks
L209: export table task_assignees
L217: export table task_dependencies
L230: export table tenant_task_statuses
L244: export table tenant_task_priorities
L257: export table tenant_task_types
L268: export table system_themes
L277: export table tenant_theme_overrides
L286: export table project_baselines
L298: export table task_baseline_snapshots
L310: export table user_notifications
L324: export table tenant_role_permissions
L334: export table audit_logs
L362: export function current_app_user_id
L368: export function is_superadmin
L375: export function is_member_of
L418: export policy tenants_public_lookup on tenants
L421: export policy tenants_admin_mutation_policy on tenants
L426: export policy profiles_read_all on user_profiles
L427: export policy profiles_update_self on user_profiles
L431: export policy profiles_v2_read_all on profiles
L432: export policy profiles_v2_update_self on profiles
L436: export policy memberships_select_policy on tenant_memberships
L437: export policy memberships_admin_manage_policy on tenant_memberships
L441: export policy projects_select_policy on projects
L442: export policy projects_mutation_policy on projects
L446: export policy tasks_select_policy on tasks
L447: export policy tasks_modify_policy on tasks
L451: export policy dependencies_select_policy on task_dependencies
L452: export policy dependencies_modify_policy on task_dependencies
L456: export policy calendars_select_policy on working_calendars
L457: export policy calendars_modify_policy on working_calendars
L461: export policy holidays_select_policy on calendar_holidays
L462: export policy holidays_modify_policy on calendar_holidays
L465: export policy audit_logs_tenant_admin_read on audit_logs
L485: export table tenants_v2
L498: export table user_profiles
L509: export table profiles
L529: export table tenant_teams
```

### `supabase/migrations/00001_initial_schema.sql` (142 lines)
```typescript
L62: export table tenants
L83: export table user_profiles
L100: export table tenant_memberships
L119: export table teams
L132: export table team_members
```

### `supabase/migrations/00002_projects_and_hierarchy.sql` (161 lines)
```typescript
L20: export table projects
L45: export table project_members
L62: export table phases
L82: export table tasks
L123: export table task_assignments
L144: export table task_dependencies
```

### `supabase/migrations/00003_calendars_and_holidays.sql` (52 lines)
```typescript
L10: export table working_calendars
L37: export table calendar_holidays
```

### `supabase/migrations/00004_rls_security_policies.sql` (302 lines)
```typescript
L27: export function current_app_user_id
L38: export function is_superadmin
L49: export function get_user_tenant_role
L65: export function can_user_access_project
L107: export policy tenants_select_policy on tenants
L119: export policy tenants_admin_mutation_policy on tenants
L129: export policy memberships_select_policy on tenant_memberships
L139: export policy memberships_admin_manage_policy on tenant_memberships
L149: export policy profiles_read_colleagues on user_profiles
L163: export policy profiles_update_self on user_profiles
L170: export policy projects_select_policy on projects
L176: export policy projects_mutation_policy on projects
L186: export policy project_members_select_policy on project_members
L192: export policy project_members_manage_policy on project_members
L202: export policy phases_select_policy on phases
L208: export policy phases_modify_policy on phases
L218: export policy tasks_select_policy on tasks
L224: export policy tasks_modify_policy on tasks
L234: export policy assignments_select_policy on task_assignments
L244: export policy assignments_modify_policy on task_assignments
L254: export policy dependencies_select_policy on task_dependencies
L260: export policy dependencies_modify_policy on task_dependencies
L270: export policy calendars_select_policy on working_calendars
L280: export policy calendars_modify_policy on working_calendars
L287: export policy holidays_select_policy on calendar_holidays
L297: export policy holidays_modify_policy on calendar_holidays
```

### `supabase/migrations/00005_audit_logs_and_crypto.sql` (152 lines)
```typescript
L11: export table audit_logs
L34: export policy audit_logs_tenant_admin_read on audit_logs
L43: export function trigger_record_audit_log
L117: export table tenant_credentials
L132: export policy credentials_tenant_admin_only on tenant_credentials
L139: export function encrypt_tenant_secret
L146: export function decrypt_tenant_secret
```

### `supabase/migrations/00005_superadmin_rls_triggers.sql` (320 lines)
```typescript
L16: export function public.is_superadmin
L20: export function public.is_superadmin
L24: export function public.current_app_user_id
L28: export function public.get_user_tenant_role
L36: export function public.is_tenant_member
L57: export policy tenants_superadmin_all on public.tenants
L58: export policy tenants_member_select on public.tenants
L65: export policy profiles_superadmin_all on public.profiles
L66: export policy profiles_select_authenticated on public.profiles
L67: export policy profiles_update_own on public.profiles
L68: export policy profiles_insert_own on public.profiles
L74: export policy memberships_superadmin_all on public.tenant_memberships
L75: export policy memberships_own_select on public.tenant_memberships
L76: export policy memberships_tenant_admin_manage on public.tenant_memberships
L83: export policy projects_superadmin_all on public.projects
L84: export policy projects_member_select on public.projects
L85: export policy projects_member_mutate on public.projects
L92: export policy tasks_superadmin_all on public.tasks
L93: export policy tasks_member_select on public.tasks
L94: export policy tasks_member_mutate on public.tasks
L100: export policy deps_superadmin_all on public.task_dependencies
L101: export policy deps_member_select on public.task_dependencies
L102: export policy deps_member_mutate on public.task_dependencies
L108: export policy cal_superadmin_all on public.working_calendars
L109: export policy cal_member_select on public.working_calendars
L110: export policy cal_admin_mutate on public.working_calendars
L117: export policy hol_superadmin_all on public.calendar_holidays
L118: export policy hol_member_select on public.calendar_holidays
L119: export policy hol_admin_mutate on public.calendar_holidays
L129: export policy audit_superadmin_all on public.audit_logs
L130: export policy audit_tenant_admin_select on public.audit_logs
L136: export policy audit_insert_system on public.audit_logs
L142: export policy baselines_superadmin_all on public.project_baselines
L143: export policy baselines_member_select on public.project_baselines
L144: export policy baselines_member_mutate on public.project_baselines
L150: export policy snapshots_superadmin_all on public.task_baseline_snapshots
L151: export policy snapshots_select on public.task_baseline_snapshots
L152: export policy snapshots_insert on public.task_baseline_snapshots
L157: export function public.handle_new_user
L186: export function public.log_entity_mutation
L267: export function public.lock_project_baseline
```

### `supabase/migrations/00007_schema_refinements.sql` (392 lines)
```typescript
L52: export table tenants_v2
L69: export table profiles
L81: export table tenant_memberships_v2
L94: export table tenant_teams
L106: export table team_members
L114: export table calendar_holidays_v2
L127: export table projects_v2
L142: export table project_guest_access
L158: export table project_phases
L170: export table tasks_v2
L202: export table task_assignees
L211: export table task_dependencies_v2
L229: export function is_member_of
L270: export function has_guest_project_access
L302: export function calculate_working_end_date
L378: export policy tenants_v2_select on tenants_v2
L382: export policy projects_v2_select on projects_v2
L386: export policy tasks_v2_select on tasks_v2
L390: export policy task_dependencies_v2_select on task_dependencies_v2
```

### `supabase/migrations/00008_dynamic_metadata_and_phase2.sql` (364 lines)
```typescript
L9: export table tenant_task_statuses
L25: export table tenant_task_priorities
L40: export table tenant_task_types
L55: export table system_themes
L64: export table tenant_theme_overrides
L78: export table tenant_custom_fields
L94: export table entity_custom_field_values
L109: export table project_baselines
L121: export table task_baseline_snapshots
L137: export table notification_events
L156: export table tenant_role_permissions
L185: export function is_member_of
L229: export policy system_themes_readable_by_all on system_themes
L232: export policy tenant_task_statuses_isolation on tenant_task_statuses
L236: export policy tenant_task_priorities_isolation on tenant_task_priorities
L240: export policy tenant_task_types_isolation on tenant_task_types
L244: export policy tenant_theme_overrides_isolation on tenant_theme_overrides
L248: export policy tenant_custom_fields_isolation on tenant_custom_fields
L252: export policy entity_custom_field_values_isolation on entity_custom_field_values
L256: export policy project_baselines_isolation on project_baselines
L260: export policy task_baseline_snapshots_isolation on task_baseline_snapshots
L267: export policy notification_events_recipient_only on notification_events
L271: export policy tenant_role_permissions_isolation on tenant_role_permissions
L276: export function seed_tenant_metadata_on_create
```

### `supabase/migrations/00009_root_superadmin_and_demo_seed.sql` (549 lines)
```typescript
L17: export table tenants_v2
L30: export table user_profiles
L41: export table profiles
L61: export table tenant_teams
```

### `supabase/migrations/00010_phase4_activity_comments_storage.sql` (171 lines)
```typescript
L7: export table public.task_comments
L23: export policy task_comments_superadmin_all on public.task_comments
L26: export policy task_comments_member_select on public.task_comments
L31: export policy task_comments_member_insert on public.task_comments
L36: export policy task_comments_author_update on public.task_comments
L41: export policy task_comments_delete on public.task_comments
L48: export table public.task_activity_log
L64: export policy task_activity_log_superadmin_all on public.task_activity_log
L67: export policy task_activity_log_member_select on public.task_activity_log
L72: export policy task_activity_log_member_insert on public.task_activity_log
L77: export table public.task_attachments
L97: export policy task_attachments_superadmin_all on public.task_attachments
L100: export policy task_attachments_member_select on public.task_attachments
L105: export policy task_attachments_member_insert on public.task_attachments
L110: export policy task_attachments_member_delete on public.task_attachments
L125: export policy task_attachments_storage_select on storage.objects
L137: export policy task_attachments_storage_insert on storage.objects
L149: export policy task_attachments_storage_update on storage.objects
L161: export policy task_attachments_storage_delete on storage.objects
```

### `supabase/migrations/00011_task_code_profiles_rls_and_members.sql` (188 lines)
```typescript
L21: export function public.generate_task_code
L94: export policy Profiles visibility on public.profiles
L107: export policy memberships_same_tenant_select on public.tenant_memberships
L118: export function public.get_tenant_members
L157: export policy Users insert tasks on public.tasks
L168: export policy Users update tasks on public.tasks
L178: export policy Users delete tasks on public.tasks
```

### `supabase/migrations/00012_phase5_graphify_finance_agile_wiki_trash.sql` (398 lines)
```typescript
L25: export table public.tenant_user_rates
L37: export table public.project_budgets
L48: export table public.task_time_logs
L70: export table public.project_sprints
L90: export table public.tenant_automations
L105: export table public.automation_execution_logs
L114: export table public.tenant_webhooks
L129: export table public.project_documents
L145: export table public.document_task_links
L158: export function public.restore_soft_deleted_entity
L185: export function public.purge_soft_deleted_records
L230: export policy Rates tenant read on public.tenant_user_rates
L238: export policy Rates admin mutate on public.tenant_user_rates
L252: export policy Budgets tenant read on public.project_budgets
L260: export policy Budgets admin mutate on public.project_budgets
L274: export policy Time logs tenant read on public.task_time_logs
L282: export policy Time logs user mutate on public.task_time_logs
L290: export policy Time logs user update on public.task_time_logs
L305: export policy Sprints tenant read on public.project_sprints
L313: export policy Sprints manager mutate on public.project_sprints
L322: export policy Automations tenant read on public.tenant_automations
L330: export policy Automations admin mutate on public.tenant_automations
L344: export policy Auto logs tenant read on public.automation_execution_logs
L353: export policy Webhooks admin mutate on public.tenant_webhooks
L367: export policy Documents tenant read on public.project_documents
L383: export policy Documents member mutate on public.project_documents
L392: export policy Doc links tenant read on public.document_task_links
```

### `supabase/seed.sql` (549 lines)
```typescript
L17: export table tenants_v2
L30: export table user_profiles
L41: export table profiles
L61: export table tenant_teams
```

## TOOLING (1 files)

### `tools/codebase-map/generate-repo-map.mjs` (455 lines)
```typescript
L15: component_or_fn ROOT_DIR
L18: component_or_fn IGNORED_DIRS
L34: component_or_fn EXTENSIONS
L39: function categorizeFile
L56: function crawlDirectory
L81: function parseTypeScriptAST
L101: function getLineNumber
L105: function getCleanSignature
L112: function visit
L235: function parseGenericFile
L261: function resolveImportPath
L303: function main
```

## TEST (8 files)

### `tests/integration/api-contracts.test.ts` (82 lines)
```typescript
L34: component_or_fn TestSchema
```

### `tests/unit/automation-engine.test.ts` (47 lines)
```typescript
L8: interface Condition { ... }
L14: function evaluateConditions
```

### `tests/unit/cpm-constraints.test.ts` (153 lines)
```typescript
L16: component_or_fn baseTask
```

### `tests/unit/email-service.test.ts` (225 lines)
```typescript
L20: class TestMockAdapter
  L24: send(...)
```

### `tests/unit/mentions-parser.test.ts` (53 lines)
```typescript
L9: function extractMentions
L15: function validateAttachmentUpload
L16: component_or_fn MAX_SIZE
```

### `tests/unit/resilience.test.ts` (73 lines)
```typescript
L25: component_or_fn transientOperation
L47: component_or_fn failingOperation
```

### `tests/unit/resource-engine.test.ts` (180 lines)
```typescript
L44: component_or_fn baseTask
```

### `tests/unit/soft-delete.test.ts` (38 lines)
```typescript
L14: component_or_fn calculateDaysLeft
```

## CONFIG (2 files)

### `src/app/providers.tsx` (33 lines)
```typescript
L9: export function Providers
```

### `src/middleware.ts` (119 lines)
```typescript
L10: export function middleware
L108: export const config
```

