// The public datasets behind "Impact projects". Every vector ID and series code here was looked up
// through the live APIs (StatCan WDS getSeriesInfoFromCubePidCoord, UN SDG Series/Data) and returns data.
// `id` is what we cite on the page (StatCan table number or SDG indicator), so it must be unique.
// `fits` = the skill categories (lib/categories.ts) whose skills could build something useful with it.
import type { CategorySlug } from "../categories";

export type Point = { period: string; value: number }; // period: "2026-10", "2026 Q2" or "2024"

type Base = {
  id: string;
  title: string; // what the series measures, in words Gemini and the reader both get
  url: string; // a human page to cite
  unit: string; // "%", "$" or a word after the number ("beds")
  sdg: string | null; // the UN goal it speaks to
  fits: CategorySlug[];
};
export type Dataset = Base & (
  | { source: "statcan"; vectorId: number }
  | { source: "unsdg"; seriesCode: string; dims: Record<string, string> }
);

const statcan = (table: string) => `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${table.replaceAll("-", "")}`;

export const DATASETS: Dataset[] = [
  {
    id: "14-10-0441-01", source: "statcan", vectorId: 1568396096,
    title: "Job vacancy rate, Calgary economic region (quarterly)",
    url: statcan("14-10-0441-01"), unit: "%", sdg: "8",
    fits: ["frontend", "backend", "language", "mobile", "data-ai", "practice"],
  },
  {
    id: "14-10-0471-01", source: "statcan", vectorId: 1642911638,
    title: "Unemployment rate of immigrants who landed 5 or fewer years ago, Alberta (monthly, three-month moving average)",
    url: statcan("14-10-0471-01"), unit: "%", sdg: "8",
    fits: ["frontend", "mobile", "backend", "language", "practice", "testing"],
  },
  {
    id: "14-10-0287-01", source: "statcan", vectorId: 2064543,
    title: "Unemployment rate, youth aged 15 to 24, Alberta (monthly, seasonally adjusted)",
    url: statcan("14-10-0287-01"), unit: "%", sdg: "8",
    fits: ["frontend", "mobile", "data-ai", "database", "testing"],
  },
  {
    id: "46-10-0092-01", source: "statcan", vectorId: 1675425123,
    title: "Average asking rent for a 2-bedroom apartment, Calgary (quarterly, dollars per month)",
    url: statcan("46-10-0092-01"), unit: "$", sdg: "11",
    fits: ["frontend", "mobile", "backend", "database", "data-ai", "language"],
  },
  {
    id: "14-10-0353-01", source: "statcan", vectorId: 1462662954,
    title: "Emergency shelter beds, Calgary (yearly)",
    url: statcan("14-10-0353-01"), unit: "beds", sdg: "11",
    fits: ["backend", "database", "mobile", "cloud-devops", "testing"],
  },
  {
    id: "13-10-0834-01", source: "statcan", vectorId: 1529611713,
    title: "Share of people living in food-insecure households, Alberta (yearly)",
    url: statcan("13-10-0834-01"), unit: "%", sdg: "2",
    fits: ["backend", "database", "mobile", "cloud-devops", "frontend"],
  },
  {
    id: "35-10-0002-01", source: "statcan", vectorId: 116321155,
    title: "Police-reported cybercrime incidents per 100,000 people, Calgary (yearly)",
    url: statcan("35-10-0002-01"), unit: "per 100,000 people", sdg: "16",
    fits: ["security", "testing", "backend", "cloud-devops", "practice"],
  },
  {
    id: "38-10-0097-01", source: "statcan", vectorId: 1013974302,
    title: "Greenhouse gas emissions from industries and households, Alberta (yearly, kilotonnes of CO2 equivalent)",
    url: statcan("38-10-0097-01"), unit: "kilotonnes", sdg: "13",
    fits: ["data-ai", "database", "cloud-devops", "language"],
  },
  {
    id: "8.6.1", source: "unsdg", seriesCode: "SL_TLF_NEET", dims: { Sex: "BOTHSEX", Age: "15-24" },
    title: "Share of youth aged 15 to 24 not in education, employment or training, Canada (yearly)",
    url: "https://unstats.un.org/sdgs/metadata/?Text=&Goal=8&Target=8.6", unit: "%", sdg: "8",
    fits: ["frontend", "data-ai", "practice", "language", "testing"],
  },
];
