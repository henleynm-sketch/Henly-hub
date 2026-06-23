// src/lib/taxonomy.ts
// Henley operating taxonomy -- verbatim from JobTread option sets.
// All Project/Client fields referencing these constants are plain SQLite strings.
// Use isValid* helpers in server actions and API handlers.

// -- Job Status (Project.status) -----------------------------------------------
export const JOB_STATUS = [
  "CLOSED",
  "GENERAL",
  "OPEN",
  "PRESALE",
  "WARRANTY",
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];
export const isValidJobStatus = (v: string): v is JobStatus =>
  (JOB_STATUS as readonly string[]).includes(v);

// -- Job Type (Project.jobType) ------------------------------------------------
export const JOB_TYPE = [
  "Addition",
  "Basement",
  "Bathroom",
  "Custom New Home",
  "Handyman Services",
  "Infrastructure/Utilities",
  "Kitchen",
  "Landscape",
  "Renovation/Tenant Improvements",
  "Semi-Custom",
  "Whole Home Remodel",
] as const;
export type JobType = (typeof JOB_TYPE)[number];
export const isValidJobType = (v: string): v is JobType =>
  (JOB_TYPE as readonly string[]).includes(v);

// -- Pipeline Stage (Project.pipelineStage) ------------------------------------
export const PIPELINE_STAGE = [
  "New Lead",
  "Contacted",
  "Consultation Booked",
  "Onsite Consultation Complete",
  "Design Proposal Sent",
  "Design Proposal Signed",
  "Onsite Kickoff",
  "Budget & Drawings Underway",
  "Construction Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGE)[number];
export const isValidPipelineStage = (v: string): v is PipelineStage =>
  (PIPELINE_STAGE as readonly string[]).includes(v);

// -- Construction Phase (Project.constructionPhase) ----------------------------
export const CONSTRUCTION_PHASE = [
  "Pre-Construction",
  "Site Prep & Foundations",
  "Rough Structure & Exterior",
  "Interior Finishing",
  "Cleanup Landscaping & Handoff",
  "Complete",
] as const;
export type ConstructionPhase = (typeof CONSTRUCTION_PHASE)[number];
export const isValidConstructionPhase = (v: string): v is ConstructionPhase =>
  (CONSTRUCTION_PHASE as readonly string[]).includes(v);

// -- Warranty Phase (Project.warrantyPhase) ------------------------------------
export const WARRANTY_PHASE = [
  "Handoff & Deficiency List",
  "Closing Care (30-Day)",
  "Active Warranty (Year 1)",
  "Year-End Review",
  "2-Year Warranty",
  "Warranty Complete",
] as const;
export type WarrantyPhase = (typeof WARRANTY_PHASE)[number];
export const isValidWarrantyPhase = (v: string): v is WarrantyPhase =>
  (WARRANTY_PHASE as readonly string[]).includes(v);

// -- Division (Project.division) -----------------------------------------------
export const DIVISION = [
  "Client Project",
  "Henley Capital (Development)",
] as const;
export type Division = (typeof DIVISION)[number];
export const isValidDivision = (v: string): v is Division =>
  (DIVISION as readonly string[]).includes(v);

// -- Lead Source (Client.leadSource) -------------------------------------------
export const LEAD_SOURCE = [
  "Referral",
  "Google Search",
  "Social Media",
  "Signage / Drive By",
  "Repeat Client",
  "Trade Show / Event",
  "Online Listing",
  "Other",
] as const;
export type LeadSource = (typeof LEAD_SOURCE)[number];
export const isValidLeadSource = (v: string): v is LeadSource =>
  (LEAD_SOURCE as readonly string[]).includes(v);
