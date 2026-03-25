export const ANNOUNCEMENT_VERSION = "2026-03-25";

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
  links: { label: string; href: string }[];
  profilePic?: string;
}

export interface AnnouncementContent {
  title: string;
  description: string;
  whatsNew: string[];
  upcoming: string[];
  bio: AnnouncementBioData;
}

export const ANNOUNCEMENT: AnnouncementContent = {
  title: "Welcome to Trail Overlay",
  description:
    "Upload GPX rides from your GPS device, trim segments into reusable trails, tag difficulty and direction, and organize trails into networks.",
  whatsNew: [
    "Sync rides directly from Strava alongside GPX/ZIP uploads.",
    "Trail lines now appear inside Strava route builder via the Chrome extension."
  ],
  upcoming: [
    "Public trail sharing and discovery.",
    "Elevation profile viewer when trimming segments.",
    "Mobile-friendly layout."
  ],
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
    project: `full-stack Next.js, Strava OAuth, PostgreSQL, and a Chrome extension
Built to solve a real problem I have as a mountain biker.`,
    links: [
      { label: "GitHub", href: "https://github.com/harryg30" },
      { label: "LinkedIn", href: "https://linkedin.com/in/harry-gordenstein" },
      { label: "Contact", href: "https://discord.gg/uqfASaVkVD" }
    ],
    profilePic: "/20260219_160511_059_saved~2.jpg"
  }
};
