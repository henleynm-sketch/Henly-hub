# SQLite → Postgres migration counts

Run: 2026-07-03T12:46:57.132Z

| Model | sqlite | postgres | status |
|---|---|---|---|
| User | 9 | 9 | MATCH |
| Client | 451 | 451 | MATCH |
| Engagement | 0 | 0 | MATCH |
| Project | 144 | 144 | MATCH |
| ProjectAssignment | 12 | 12 | MATCH |
| Milestone | 16 | 16 | MATCH |
| Selection | 5 | 5 | MATCH |
| BudgetItem | 24 | 24 | MATCH |
| DailyLog | 15 | 15 | MATCH |
| Document | 0 | 0 | MATCH |
| Thread | 239 | 239 | MATCH |
| Message | 283 | 283 | MATCH |
| Estimate | 2 | 2 | MATCH |
| EstimateLine | 15 | 15 | MATCH |
| Contract | 0 | 0 | MATCH |
| ChangeOrder | 0 | 0 | MATCH |
| TimeEntry | 0 | 0 | MATCH |
| QBOToken | 0 | 0 | MATCH |
| Setting | 4 | 4 | MATCH |
| Department | 0 | 0 | MATCH |
| SettingAudit | 2 | 2 | MATCH |
| AuditLog | 49 | 49 | MATCH |
| UserNotificationPref | 0 | 0 | MATCH |
| M365Config | 1 | 1 | MATCH |
| QuoConfig | 1 | 1 | MATCH |
| JobTreadConfig | 1 | 1 | MATCH |
| HenleyTasksConfig | 1 | 1 | MATCH |
| ScheduleTask | 6 | 6 | MATCH |
| ApiKey | 3 | 3 | MATCH |
| ApiKeyAudit | 2 | 2 | MATCH |
| ApiCallLog | 57 | 57 | MATCH |
| WarrantyItem | 0 | 0 | MATCH |
| JobTemplate | 9 | 9 | MATCH |
| TemplateScheduleItem | 54 | 54 | MATCH |
| TemplateBudgetItem | 0 | 0 | MATCH |
| Vendor | 363 | 363 | MATCH |
| CrmActivity | 0 | 0 | MATCH |
| CostType | 4 | 4 | MATCH |
| CostCode | 180 | 180 | MATCH |
| CostItem | 174 | 174 | MATCH |
| JobView | 7 | 7 | MATCH |
| AnthropicConfig | 1 | 1 | MATCH |
| AssistantThread | 1 | 1 | MATCH |
| AssistantMessage | 3 | 3 | MATCH |
| OAuthClient | 0 | 0 | MATCH |
| OAuthCode | 0 | 0 | MATCH |
| OAuthToken | 0 | 0 | MATCH |
| Notification | 338 | 338 | MATCH |
| NotificationDelivery | 338 | 338 | MATCH |
| NotificationUnsubscribe | 0 | 0 | MATCH |
| Organization | 0 | 0 | MATCH |
| Invite | 0 | 0 | MATCH |
| PasswordResetToken | 0 | 0 | MATCH |
| BrandingConfig | 1 | 1 | MATCH |

No autoincrement ids in schema — no sequences to reset.

RESULT: ALL MATCH
