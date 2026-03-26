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
  links: { label: string; href?: string; action?: "contact-modal" }[];
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
    "Trail Overlay aims to solve my biggest pain point while planning mountain bike rides. Tools like Strava and Ride with GPS are missing details that help me decide which trails to ride, and I end up spending a lot of time cross-referencing other sources like Trailforks. Trail Overlay is a Chrome extension that surfaces this information directly on the Strava route builder map (Ride with GPS planned), so you can spend less time planning and more time riding.",
  whatsNew: [
    "Create and edit trails directly on the map with our new drawing tools.",
    "Trail details now appear inside Strava route builder via the Chrome extension. (experimental)"
  ],
  upcoming: [
    "Photo upload so you can see what your routing yourself to",
    "Refined trail editing tools",
    "Mobile-friendly layout",
    "Ride with GPS support"
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
    project: `full-stack Next.js, Strava OAuth, AWS hosted PostgreSQL, and a Chrome extension
Built to solve a real problem I have as a mountain biker.`,
    links: [
      { label: "GitHub", href: "https://github.com/harryg30" },
      { label: "LinkedIn", href: "https://linkedin.com/in/harry-gordenstein" },
      { label: "Contact", action: "contact-modal" as const }
    ],
    profilePic: "/20260219_160511_059_saved~2.jpg"
  }
};
