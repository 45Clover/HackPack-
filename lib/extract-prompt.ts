// The Gemini prompt + output schema for reading skills out of job posts, 20 jobs per call.
// Owner: AI (@tomi-alo). Used by extractSkillsBatch in lib/extract.ts:
//
//   const res = await ai.models.generateContent({
//     model: "gemini-flash-latest",
//     contents: buildExtractInput(jobs),
//     config: { systemInstruction: EXTRACT_SYSTEM_PROMPT, responseMimeType: "application/json",
//               responseJsonSchema: EXTRACT_SCHEMA, temperature: 0 },
//   });
//   const { jobs: results } = JSON.parse(res.text ?? '{"jobs":[]}') as ExtractResult;

import { CATEGORIES } from "./categories";

export const SENIORITY = ["intern", "junior", "mid", "senior", "lead", "unknown"] as const;

export type ExtractResult = {
  jobs: {
    id: string;
    seniority: (typeof SENIORITY)[number];
    skills: { name: string; category: (typeof CATEGORIES)[number]["slug"]; required: boolean }[];
  }[];
};

// ~4,000 characters keeps 20 jobs well inside one request; the skills sit near the top of a post.
const MAX_DESCRIPTION = 4000;

export function buildExtractInput(jobs: { id: string; title: string; description: string }[]) {
  return JSON.stringify(jobs.map((j) => ({ id: j.id, title: j.title, description: j.description.slice(0, MAX_DESCRIPTION) })));
}

export const EXTRACT_SYSTEM_PROMPT = `You read tech job postings and list the technical skills each one asks the candidate to have.

INPUT: a JSON array of jobs, each { "id", "title", "description" }.
OUTPUT: JSON that matches the response schema, with one entry per input job and the same "id". Return every input id exactly once, in the same order.

For each job:

1. "skills": every concrete technical skill the posting asks the candidate for.
   - Include: programming languages, frameworks, libraries, databases, cloud platforms and services, DevOps and infrastructure tools, data and machine-learning tools, testing tools, security tools, and named engineering practices (for example CI/CD, microservices, Agile).
   - Exclude: soft skills (communication, teamwork, ownership), degrees, years of experience, job duties, benefits, the company's own products, and tools the company only mentions using without asking the candidate for them.
   - Write the standard short name with its usual spelling: "React" (not ReactJS), "Node.js", "PostgreSQL" (not Postgres), "AWS", "Google Cloud" (not GCP), "Azure", "Kubernetes" (not k8s), "CI/CD", "C#", "C++", "TypeScript", "JavaScript", "REST APIs", "GraphQL", "Machine learning".
   - Split combined items: "AWS/GCP" becomes "AWS" and "Google Cloud". "React/Redux" becomes "React" and "Redux".
   - A named cloud service counts as its own skill and also implies the platform: "AWS Lambda" gives "AWS Lambda" and "AWS".
   - Only list skills that appear in the text, directly or as an obvious synonym. Never guess from the job title alone.
   - No duplicates in one job. At most 25 skills per job, most important first.

2. "category": exactly one of these for each skill:
${CATEGORIES.map((c) => `   - ${c.slug}: ${c.hint}`).join("\n")}
   SQL itself is a language. A specific database product (PostgreSQL, MySQL) is a database.

3. "required": true when the posting presents the skill as a must-have (requirements, "you have", "must", "experience with", "proficient in"). false when it is a nice-to-have ("bonus", "nice to have", "preferred", "a plus", "an asset", "familiarity with").

4. "seniority" of the role, from the title and text:
   - intern: intern, co-op, student, summer
   - junior: junior, new grad, entry level, associate, 0 to 2 years
   - mid: 2 to 5 years, or an engineer role with no level stated
   - senior: senior, 5+ years
   - lead: staff, principal, lead, manager, architect, director
   - unknown: you cannot tell

If a job has no technical skills (for example a sales or HR role), return it with an empty "skills" array.

EXAMPLE
Input: [{"id":"a1","title":"Junior Full Stack Developer","description":"You have 1+ years with ReactJS and Node, and you write SQL against Postgres. Experience with AWS/GCP is a bonus. Strong communication skills."}]
Output: {"jobs":[{"id":"a1","seniority":"junior","skills":[{"name":"React","category":"frontend","required":true},{"name":"Node.js","category":"backend","required":true},{"name":"SQL","category":"language","required":true},{"name":"PostgreSQL","category":"database","required":true},{"name":"AWS","category":"cloud-devops","required":false},{"name":"Google Cloud","category":"cloud-devops","required":false}]}]}`;

export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          seniority: { type: "string", enum: [...SENIORITY] },
          skills: {
            type: "array",
            maxItems: 25,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: { type: "string", enum: CATEGORIES.map((c) => c.slug) },
                required: { type: "boolean" },
              },
              required: ["name", "category", "required"],
            },
          },
        },
        required: ["id", "seniority", "skills"],
      },
    },
  },
  required: ["jobs"],
};
