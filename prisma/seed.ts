/**
 * Seed script.
 *
 *   npm run db:seed                    # reference data + synthetic dev data
 *   SEED_REFERENCE_ONLY=true npm run db:seed   # plans/FAQs/content only
 *
 * Reference data (membership plans, FAQs, content blocks) is upserted and is
 * safe in every environment. Synthetic members and the development admin are
 * created ONLY when APP_ENV is development or test. Every synthetic account
 * uses an @example.invalid address and is fictional.
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { EducationLevel, EmploymentType, Gender, MaritalStatus } from "../src/generated/prisma/enums";
import { loadEnvFile } from "../scripts/lib/load-env";

loadEnvFile();

const appEnv = process.env.APP_ENV ?? "development";
const referenceOnly = process.env.SEED_REFERENCE_ONLY === "true" || !["development", "test"].includes(appEnv);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

async function seedPlans() {
  const plans = [
    {
      code: "FREE",
      name: "Free",
      nameTa: "இலவசம்",
      description: "Create your profile, search and send a few interests every day.",
      descriptionTa: "சுயவிவரம் உருவாக்கி, தேடி, தினமும் சில விருப்பங்களை அனுப்பலாம்.",
      price: "0.00",
      durationDays: 36500,
      interestsPerDay: 5,
      contactViewsIncluded: 0,
      canViewContacts: false,
      canViewPremiumOnly: false,
      highlightProfile: false,
      benefits: ["Profile listing", "Search & matches", "Shortlist"],
      benefitsTa: ["சுயவிவரப் பட்டியல்", "தேடல் & பொருத்தங்கள்", "தேர்வுப் பட்டியல்"],
      sortOrder: 0,
    },
    {
      code: "GOLD_3M",
      name: "Gold — 3 months",
      nameTa: "கோல்டு — 3 மாதங்கள்",
      description: "View contact details of accepted matches.",
      descriptionTa: "ஏற்கப்பட்ட வரன்களின் தொடர்பு விவரங்களைக் காணலாம்.",
      price: "2499.00",
      durationDays: 90,
      interestsPerDay: 30,
      contactViewsIncluded: 40,
      canViewContacts: true,
      canViewPremiumOnly: true,
      highlightProfile: false,
      benefits: ["See premium-only profiles", "Priority support"],
      benefitsTa: ["பிரீமியம் சுயவிவரங்களைக் காணலாம்", "முன்னுரிமை உதவி"],
      sortOrder: 10,
    },
    {
      code: "DIAMOND_6M",
      name: "Diamond — 6 months",
      nameTa: "டயமண்ட் — 6 மாதங்கள்",
      description: "Our most complete plan, with a highlighted profile.",
      descriptionTa: "முழுமையான திட்டம் — உங்கள் சுயவிவரம் சிறப்பிக்கப்படும்.",
      price: "4499.00",
      durationDays: 180,
      interestsPerDay: 60,
      contactViewsIncluded: 120,
      canViewContacts: true,
      canViewPremiumOnly: true,
      highlightProfile: true,
      benefits: ["Highlighted in search", "See premium-only profiles", "Priority support"],
      benefitsTa: ["தேடலில் சிறப்பிக்கப்படும்", "பிரீமியம் சுயவிவரங்களைக் காணலாம்", "முன்னுரிமை உதவி"],
      sortOrder: 20,
    },
  ];
  for (const p of plans) {
    // Existing plans are not overwritten: administrators own prices after launch.
    await prisma.membershipPlan.upsert({ where: { code: p.code }, create: p, update: {} });
  }
}

async function seedContent() {
  const faqs = [
    {
      locale: "en",
      q: "Who can register?",
      a: "Members of the Kongu Vellalar Gounder community and their families, who are of legal marriageable age (21 for men, 18 for women).",
    },
    {
      locale: "en",
      q: "Who can see my phone number?",
      a: "Nobody, by default. Contact details are shown only to premium members whose interest you have accepted.",
    },
    {
      locale: "en",
      q: "How is a profile verified?",
      a: "Upload a government ID from the Verification page. Our team checks it against your profile and adds the verified badge. The document is never shown to other members.",
    },
    {
      locale: "en",
      q: "Can I hide my profile temporarily?",
      a: "Yes. Deactivate your account from Settings. Log in any time to reactivate.",
    },
    {
      locale: "ta",
      q: "யார் பதிவு செய்யலாம்?",
      a: "சட்டப்படி திருமண வயதை அடைந்த (ஆண்கள் 21, பெண்கள் 18) கொங்கு வேளாளர் கவுண்டர் சமூகத்தினரும் அவர்களின் குடும்பத்தினரும்.",
    },
    {
      locale: "ta",
      q: "என் தொலைபேசி எண்ணை யார் பார்க்கலாம்?",
      a: "இயல்பாக யாரும் இல்லை. நீங்கள் விருப்பத்தை ஏற்ற பிரீமியம் உறுப்பினர்களுக்கு மட்டுமே தொடர்பு விவரங்கள் காட்டப்படும்.",
    },
    {
      locale: "ta",
      q: "சுயவிவரம் எவ்வாறு சரிபார்க்கப்படுகிறது?",
      a: "'சரிபார்ப்பு' பக்கத்தில் அரசு அடையாளச் சான்றைப் பதிவேற்றுங்கள். எங்கள் குழு சரிபார்த்து முத்திரை சேர்க்கும். ஆவணம் மற்ற உறுப்பினர்களுக்குக் காட்டப்படாது.",
    },
    {
      locale: "ta",
      q: "என் சுயவிவரத்தைத் தற்காலிகமாக மறைக்கலாமா?",
      a: "ஆம். அமைப்புகளில் கணக்கை முடக்கலாம். எப்போது வேண்டுமானாலும் உள்நுழைந்து மீண்டும் இயக்கலாம்.",
    },
  ] as const;
  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: faqs.map((f, i) => ({ locale: f.locale, question: f.q, answer: f.a, sortOrder: i })),
    });
  }
}

// --- Synthetic development data ---------------------------------------------

/** Deterministic PRNG so every developer gets the same synthetic data. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const MALE = [
  "Arun",
  "Karthik",
  "Senthil",
  "Prakash",
  "Dinesh",
  "Gokul",
  "Vignesh",
  "Saravanan",
  "Manoj",
  "Naveen",
  "Ramesh",
  "Sathish",
  "Vijay",
  "Ashok",
  "Bharath",
  "Elango",
  "Kumaresan",
  "Mohan",
  "Palanisamy",
  "Tamilselvan",
];
const FEMALE = [
  "Kavya",
  "Priya",
  "Divya",
  "Nandhini",
  "Gayathri",
  "Keerthana",
  "Sowmya",
  "Preethi",
  "Janani",
  "Abinaya",
  "Bhuvana",
  "Deepika",
  "Harini",
  "Indhu",
  "Kalaivani",
  "Lavanya",
  "Meena",
  "Pavithra",
  "Revathi",
  "Sangeetha",
];
const KOOTAMS = [
  "Kaadai",
  "Sellan",
  "Pannai",
  "Aandai",
  "Kanakkan",
  "Periyan",
  "Payiran",
  "Vilayan",
  "Mayilar",
  "Sembian",
];
const PLACES: [string, string, string, string][] = [
  ["Coimbatore", "Tamil Nadu", "IN", "Coimbatore"],
  ["Erode", "Tamil Nadu", "IN", "Erode"],
  ["Tiruppur", "Tamil Nadu", "IN", "Tiruppur"],
  ["Salem", "Tamil Nadu", "IN", "Salem"],
  ["Karur", "Tamil Nadu", "IN", "Karur"],
  ["Namakkal", "Tamil Nadu", "IN", "Namakkal"],
  ["Chennai", "Tamil Nadu", "IN", "Erode"],
  ["Bengaluru", "Karnataka", "IN", "Coimbatore"],
  ["Dallas", "Texas", "US", "Erode"],
  ["Singapore", "Singapore", "SG", "Tiruppur"],
  ["London", "England", "GB", "Salem"],
  ["Dubai", "Dubai", "AE", "Karur"],
];
const JOBS: [string, EducationLevel, EmploymentType][] = [
  ["Software Engineer", "BACHELORS", "PRIVATE"],
  ["Doctor", "PROFESSIONAL", "PRIVATE"],
  ["Civil Engineer", "BACHELORS", "GOVERNMENT"],
  ["Textile Business", "BACHELORS", "BUSINESS"],
  ["Chartered Accountant", "PROFESSIONAL", "SELF_EMPLOYED"],
  ["Lecturer", "MASTERS", "GOVERNMENT"],
  ["Data Scientist", "MASTERS", "PRIVATE"],
  ["Farmer & Agri Business", "DIPLOMA", "BUSINESS"],
  ["Research Scholar", "DOCTORATE", "OTHER"],
];

async function seedSynthetic() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (adminEmail && adminPassword && !/REPLACE_WITH/.test(adminPassword)) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        passwordHash: await hash(adminPassword, ARGON),
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        dateOfBirth: new Date("1985-01-01T00:00:00Z"),
        gender: "MALE",
      },
      update: { role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    console.log(`  admin: ${adminEmail}`);
  } else {
    console.log("  admin: skipped (set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)");
  }

  if ((await prisma.user.count({ where: { email: { endsWith: "@example.invalid" }, role: "MEMBER" } })) > 0) {
    console.log("  synthetic members: already present");
    return;
  }

  const memberPassword = process.env.SEED_MEMBER_PASSWORD ?? "Member@12345";
  const passwordHash = await hash(memberPassword, ARGON);
  const rand = rng(20261027);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const now = new Date();

  for (const gender of ["MALE", "FEMALE"] as Gender[]) {
    const names = gender === "MALE" ? MALE : FEMALE;
    for (let i = 0; i < names.length; i++) {
      const age = gender === "MALE" ? 24 + Math.floor(rand() * 12) : 21 + Math.floor(rand() * 11);
      const dob = new Date(Date.UTC(now.getUTCFullYear() - age, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)));
      const [city, state, country, native] = pick(PLACES);
      const [occupation, education, employment] = pick(JOBS);
      const kootam = pick(KOOTAMS);
      const email = `${names[i].toLowerCase()}.${gender === "MALE" ? "m" : "f"}${i}@example.invalid`;
      const published = i % 7 !== 6; // a few drafts / pending for moderation testing
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          status: "ACTIVE",
          emailVerifiedAt: now,
          termsAcceptedAt: now,
          dateOfBirth: dob,
          gender,
          profile: {
            create: {
              displayName: names[i],
              gender,
              dateOfBirth: dob,
              createdFor: rand() < 0.6 ? "SELF" : gender === "MALE" ? "SON" : "DAUGHTER",
              maritalStatus: (rand() < 0.92 ? "NEVER_MARRIED" : "DIVORCED") as MaritalStatus,
              heightCm: gender === "MALE" ? 165 + Math.floor(rand() * 20) : 152 + Math.floor(rand() * 16),
              kootam,
              aboutMe: `[Synthetic profile] ${names[i]} works as a ${occupation.toLowerCase()} in ${city}. Family values and a sense of humour matter most.`,
              highestEducation: education,
              educationDetail: education === "PROFESSIONAL" ? "Professional degree" : "Engineering / Arts & Science",
              occupation,
              employmentType: employment,
              annualIncomeInr: String(400000 + Math.floor(rand() * 30) * 100000),
              nativePlace: native,
              nativeDistrict: native,
              currentCity: city,
              currentState: state,
              currentCountry: country,
              residencyStatus: country === "IN" ? "CITIZEN" : "NRI",
              fatherOccupation: pick(["Agriculture", "Business", "Retired teacher", "Textile mill owner"]),
              motherOccupation: pick(["Homemaker", "Teacher", "Business"]),
              siblingsSummary: pick([
                "One elder brother (married)",
                "One younger sister",
                "No siblings",
                "Two sisters (married)",
              ]),
              familyType: rand() < 0.7 ? "NUCLEAR" : "JOINT",
              familyStatus: pick(["MIDDLE_CLASS", "UPPER_MIDDLE_CLASS", "AFFLUENT"] as const),
              status: published ? "PUBLISHED" : i % 2 ? "PENDING_REVIEW" : "DRAFT",
              publishedAt: published ? new Date(now.getTime() - i * 86_400_000) : null,
              verificationState: i % 3 === 0 ? "VERIFIED" : "UNVERIFIED",
              visibility: i % 9 === 4 ? "PREMIUM_MEMBERS" : "MEMBERS",
              completeness: 70 + Math.floor(rand() * 20),
              contact: {
                create: {
                  contactName: `${names[i]}'s family`,
                  contactPhone: `+91900000${String(1000 + i).slice(-4)}`,
                  relationship: "Parent",
                },
              },
              preference: {
                create: {
                  ageMin: gender === "MALE" ? 21 : age - 2,
                  ageMax: gender === "MALE" ? age : age + 6,
                  maritalStatuses: ["NEVER_MARRIED"],
                  excludeSameKootam: true,
                },
              },
            },
          },
        },
      });
    }
  }
  console.log(
    `  synthetic members: ${MALE.length + FEMALE.length} created (password from SEED_MEMBER_PASSWORD or the documented default)`,
  );
}

async function main() {
  console.log(`Seeding (APP_ENV=${appEnv}${referenceOnly ? ", reference data only" : ""})`);
  await seedPlans();
  await seedContent();
  if (!referenceOnly) await seedSynthetic();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
