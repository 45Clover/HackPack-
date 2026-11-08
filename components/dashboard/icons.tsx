// Small icons for lists: a skill's logo (or its category's line icon) and a company's logo (or its first letter).
import {
  BrainIcon, CloudIcon, CodeXmlIcon, DatabaseIcon, FlaskConicalIcon, PanelsTopLeftIcon, ServerIcon, ShieldIcon, SmartphoneIcon, WrenchIcon,
} from "lucide-react";
import {
  siAndroid, siApacheairflow, siApachespark, siCplusplus, siCss, siCypress, siDjango, siDocker, siDotnet, siElasticsearch, siFigma, siGit,
  siGithubactions, siGo, siGooglecloud, siGraphql, siHtml5, siIos, siJavascript, siJira, siKotlin, siKubernetes, siLinux, siMongodb, siMysql,
  siNextdotjs, siNodedotjs, siOpenjdk, siPandas, siPostgresql, siPython, siPytorch, siReact, siRedis, siRedux, siRubyonrails, siRust,
  siSelenium, siSnowflake, siSwift, siTensorflow, siTerraform, siTypescript,
} from "simple-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Our skill slug → its Simple Icons logo. Skills with no logo (AWS, SQL, machine learning…) use their category icon.
const LOGOS: Record<string, { path: string }> = {
  android: siAndroid, airflow: siApacheairflow, spark: siApachespark, cplusplus: siCplusplus, css: siCss, cypress: siCypress,
  django: siDjango, docker: siDocker, net: siDotnet, elasticsearch: siElasticsearch, figma: siFigma, git: siGit,
  "github-actions": siGithubactions, go: siGo, "google-cloud": siGooglecloud, graphql: siGraphql, html: siHtml5, ios: siIos,
  javascript: siJavascript, jira: siJira, kotlin: siKotlin, kubernetes: siKubernetes, linux: siLinux, mongodb: siMongodb, mysql: siMysql,
  "next-js": siNextdotjs, "node-js": siNodedotjs, java: siOpenjdk, pandas: siPandas, postgresql: siPostgresql, python: siPython,
  pytorch: siPytorch, react: siReact, "react-native": siReact, redis: siRedis, redux: siRedux, "ruby-on-rails": siRubyonrails, rust: siRust,
  selenium: siSelenium, snowflake: siSnowflake, swift: siSwift, tensorflow: siTensorflow, terraform: siTerraform, typescript: siTypescript,
};
const CATEGORY_ICON = {
  language: CodeXmlIcon, frontend: PanelsTopLeftIcon, backend: ServerIcon, database: DatabaseIcon, "cloud-devops": CloudIcon,
  "data-ai": BrainIcon, mobile: SmartphoneIcon, testing: FlaskConicalIcon, security: ShieldIcon, practice: WrenchIcon,
} as const;

export function SkillIcon({ slug, category, className = "size-3.5" }: { slug: string; category: string | null; className?: string }) {
  const logo = LOGOS[slug];
  if (logo) return <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor"><path d={logo.path} /></svg>;
  const Icon = CATEGORY_ICON[category as keyof typeof CATEGORY_ICON] ?? WrenchIcon;
  return <Icon aria-hidden className={className} />;
}

// We don't store company websites, so the seeded companies are listed by hand.
// shortcut: hand-kept list; a company n8n adds later shows its first letter until it's added here (or a domain column lands).
const DOMAINS: Record<string, string> = {
  Benevity: "benevity.com", "Neo Financial": "neofinancial.com", Jobber: "getjobber.com", Cohere: "cohere.com",
  Wealthsimple: "wealthsimple.com", "1Password": "1password.com", Float: "floatfinancial.com", Hopper: "hopper.com",
  Trulioo: "trulioo.com", Loopio: "loopio.com", Lightspeed: "lightspeedhq.com", Hootsuite: "hootsuite.com",
  Clutch: "clutch.ca", Faire: "faire.com", PolicyMe: "policyme.com",
};

export function CompanyLogo({ name, className = "size-7" }: { name: string; className?: string }) {
  const domain = DOMAINS[name];
  return (
    <Avatar className={`${className} rounded-lg after:rounded-lg`}>
      {domain && <AvatarImage src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="rounded-lg" />}
      <AvatarFallback className="rounded-lg bg-secondary text-[11px] font-medium">{name.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}

// A website's icon (for resource links), from the same favicon service; first letter of the domain if it has none.
export function SiteIcon({ url, className = "size-8" }: { url: string; className?: string }) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return (
    <Avatar className={`${className} rounded-lg after:rounded-lg`}>
      <AvatarImage src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" className="rounded-lg bg-white p-1" />
      <AvatarFallback className="rounded-lg bg-secondary text-[11px] font-medium uppercase">{host.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}
