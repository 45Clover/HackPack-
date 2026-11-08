// The fixed list of skill categories. Must match the rows in db/002_skill_categories.sql.
// `hint` goes into the Gemini prompt; `color` is the solid node colour (readable on the warm-white background).
export const CATEGORIES = [
  { slug: "language", name: "Languages", color: "#0e8fd6", hint: "programming and query languages: Python, Java, TypeScript, JavaScript, SQL, Go, C#, C++, Rust, Kotlin" },
  { slug: "frontend", name: "Frontend", color: "#e4572e", hint: "browser UI: React, Next.js, Vue, Angular, HTML, CSS, Tailwind CSS, Redux" },
  { slug: "backend", name: "Backend", color: "#1f9e89", hint: "server frameworks and APIs: Node.js, Django, Spring Boot, .NET, Ruby on Rails, REST APIs, GraphQL, gRPC, microservices" },
  { slug: "database", name: "Databases", color: "#e3a21a", hint: "data stores: PostgreSQL, MySQL, MongoDB, Redis, DynamoDB, Elasticsearch, Snowflake" },
  { slug: "cloud-devops", name: "Cloud & DevOps", color: "#5a6b8c", hint: "cloud and infrastructure: AWS, Google Cloud, Azure, Docker, Kubernetes, Terraform, CI/CD, GitHub Actions, Linux" },
  { slug: "data-ai", name: "Data & AI", color: "#d6336c", hint: "data and machine learning: Pandas, Spark, Airflow, dbt, PyTorch, TensorFlow, LLMs, machine learning, Power BI, Tableau" },
  { slug: "mobile", name: "Mobile", color: "#3f8f2f", hint: "mobile apps: iOS, Android, Swift, React Native, Flutter" },
  { slug: "testing", name: "Testing & QA", color: "#8a8f2a", hint: "testing: Jest, Cypress, Playwright, Selenium, unit testing, test automation" },
  { slug: "security", name: "Security", color: "#b45309", hint: "security: OAuth, IAM, penetration testing, SIEM, network security, encryption" },
  { slug: "practice", name: "Tools & practices", color: "#a19f97", hint: "tools and ways of working: Git, Agile, Scrum, Jira, Figma, code review, system design" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const categoryColor = (slug: string | null | undefined) =>
  CATEGORIES.find((c) => c.slug === slug)?.color ?? "#a19f97";
