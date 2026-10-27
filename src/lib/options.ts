import {
  DocumentType,
  EducationLevel,
  EmploymentType,
  FamilyStatus,
  FamilyType,
  MaritalStatus,
  PhotoVisibility,
  ProfileCreatedFor,
  ProfileVisibility,
  ReportReason,
  ResidencyStatus,
  TicketCategory,
} from "@/generated/prisma/enums";

/** Enum value tuples shared by forms (labels via i18n `enums.<Name>.<VALUE>`) and validation. */
const values = <T extends Record<string, string>>(e: T) => Object.values(e) as [T[keyof T], ...T[keyof T][]];

export const CREATED_FOR = values(ProfileCreatedFor);
export const MARITAL_STATUSES = values(MaritalStatus);
export const EDUCATION_LEVELS = values(EducationLevel);
export const EMPLOYMENT_TYPES = values(EmploymentType);
export const RESIDENCY_STATUSES = values(ResidencyStatus);
export const FAMILY_TYPES = values(FamilyType);
export const FAMILY_STATUSES = values(FamilyStatus);
export const PROFILE_VISIBILITIES = values(ProfileVisibility);
export const PHOTO_VISIBILITIES = values(PhotoVisibility);
export const REPORT_REASONS = values(ReportReason);
export const DOCUMENT_TYPES = values(DocumentType);
export const TICKET_CATEGORIES = values(TicketCategory);

/** Common Kongu Vellalar kootams (clans). Members may also type their own. */
export const KOOTAMS = [
  "Aadai",
  "Aandai",
  "Aathi",
  "Alagan",
  "Antuvan",
  "Cheran",
  "Eenjan",
  "Kaadai",
  "Kanakkan",
  "Kannan",
  "Kavalan",
  "Keeran",
  "Koorai",
  "Maniyan",
  "Mayilar",
  "Medhi",
  "Mullai",
  "Nerunji",
  "Oothaalar",
  "Panaiyan",
  "Pannai",
  "Payiran",
  "Periyan",
  "Perungudi",
  "Pidaari",
  "Poosan",
  "Porulthantha",
  "Saathanthai",
  "Sellan",
  "Sembian",
  "Sengannan",
  "Sevvaayar",
  "Thooran",
  "Vannakkan",
  "Vilayan",
  "Vizhiyan",
] as const;

export const RASIS = [
  "Mesham",
  "Rishabam",
  "Mithunam",
  "Kadagam",
  "Simmam",
  "Kanni",
  "Thulam",
  "Viruchigam",
  "Dhanusu",
  "Magaram",
  "Kumbam",
  "Meenam",
] as const;

export const NAKSHATRAMS = [
  "Ashwini",
  "Bharani",
  "Karthigai",
  "Rohini",
  "Mirugasirisham",
  "Thiruvathirai",
  "Punarpoosam",
  "Poosam",
  "Ayilyam",
  "Magam",
  "Pooram",
  "Uthiram",
  "Hastham",
  "Chithirai",
  "Swathi",
  "Visakam",
  "Anusham",
  "Kettai",
  "Moolam",
  "Pooradam",
  "Uthiradam",
  "Thiruvonam",
  "Avittam",
  "Sadhayam",
  "Poorattathi",
  "Uthirattathi",
  "Revathi",
] as const;

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "KW", name: "Kuwait" },
  { code: "OM", name: "Oman" },
  { code: "BH", name: "Bahrain" },
  { code: "DE", name: "Germany" },
  { code: "IE", name: "Ireland" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "JP", name: "Japan" },
];

export const PUBLIC_ID_PREFIX = "KM";

export function formatPublicId(profileNumber: number): string {
  return `${PUBLIC_ID_PREFIX}${profileNumber}`;
}

export function parsePublicId(publicId: string): number | null {
  const m = /^KM(\d{1,9})$/i.exec(publicId.trim());
  return m ? Number(m[1]) : null;
}
