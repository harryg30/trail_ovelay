import latestPayload from "@/announcements/latest.json";

export interface AnnouncementItem {
  /** Short label; optional when `summary` alone is enough */
  title: string;
  summary: string;
  /** Optional link (welcome modal usually omits — roadmap link is in the modal body) */
  notionUrl?: string;
  /** User-facing progress hint (upcoming only); use "In progress" when Notion Status is In Progress */
  status?: string;
}

export interface AnnouncementLatestPayload {
  updatedAt: string;
  headline: string;
  whatsNew: AnnouncementItem[];
  upcoming: AnnouncementItem[];
}

const latest = latestPayload as AnnouncementLatestPayload;

/** Bump or replace this when you ship a new announcement via the skill (ties to localStorage dismiss key). */
export const ANNOUNCEMENT_VERSION = latest.updatedAt;

export interface BioPosition {
  role: string;
  company: string;
  link?: string;
  dates: string;
  summary: string;
  skills: string[];
}

export interface AnnouncementBioData {
  name: string;
  title: string;
  positions: BioPosition[];
  project: string;
  links: { label: string; href?: string; action?: "contact-modal" }[];
  profilePic?: string;
}

export interface AnnouncementRoadmapCallout {
  description: string;
  linkLabel: string;
  href: string;
}

export interface AnnouncementContent {
  title: string;
  description: string;
  whatsNew: AnnouncementItem[];
  upcoming: AnnouncementItem[];
  /** Public board link shown below What's New / Upcoming */
  roadmap: AnnouncementRoadmapCallout;
  bio: AnnouncementBioData;
}

/** Static long-form copy; dynamic bullets live in `announcements/latest.json`. */
const ANNOUNCEMENT_STATIC: Pick<
  AnnouncementContent,
  "description" | "roadmap" | "bio"
> = {
  description: `Trail Overlay aims to solve my biggest pain point while planning mountain bike rides. Tools like Strava and Ride with GPS are missing details that help me decide which trails to ride, and I end up spending a lot of time cross-referencing other sources like Trailforks. 
Trail Overlay is website that gathers user generated trail information and a Chrome extension that surfaces this information directly on the Strava route builder map (Ride with GPS planned), so you can spend less time planning and more time riding.`,
  roadmap: {
    description:
      "Follow progress on recently shipped features and what we're planning next on our public board. No Notion account needed to view.",
    linkLabel: "Open the work board in Notion",
    href: "https://www.notion.so/71d8e1836c7347cfaf4205aa3c128abb?v=8a2d7d1c9ce64d00aab4d0c953ed268e"
  },
  bio: {
    name: "Harry Gordenstein",
    title: "Full-Stack Developer",
    positions: [
      {
        role: "Full-Stack Developer",
        company: "Route 36 @ Meta",
        link: "https://r36.com/",
        dates: "2024 – 2026",
        summary: "Complex map-based UIs for network capacity planning.",
        skills: ["React", "MapLibre", "Rust", "PostgreSQL", "Hasura"]
      },
      {
        role: "Full-Stack Developer / Data Scientist",
        company: "IBM",
        link: "https://www.ibm.com/",
        dates: "2020 – 2023",
        summary:
          "Enterprise web apps and data pipelines for network analytics.",
        skills: ["React", "Java", "Apache Spark"]
      }
    ],
    project: `full-stack Next.js, Strava OAuth, AWS hosted PostgreSQL, and a Chrome extension
Built to solve a real problem I have as a mountain biker.`,
    links: [
      { label: "GitHub", href: "https://github.com/harryg30" },
      { label: "LinkedIn", href: "https://linkedin.com/in/harry-gordenstein" },
      { label: "Strava", href: "https://www.strava.com/athletes/25847893" },
      { label: "Contact", action: "contact-modal" as const }
    ],
    profilePic: "/20260219_160511_059_saved~2.jpg"
  }
};

export const ANNOUNCEMENT: AnnouncementContent = {
  ...ANNOUNCEMENT_STATIC,
  title: latest.headline,
  whatsNew: latest.whatsNew,
  upcoming: latest.upcoming
};
